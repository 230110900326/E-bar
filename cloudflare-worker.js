/**
 * 夜半微醺 · AI 酒保 Cloudflare Worker 代理 + 云存档同步
 *
 * 功能：
 *  1. POST /chat     —— 混元 AI 酒保代理（藏 key、转发、加 CORS）
 *  2. GET  /state    —— 拉取云存档（需 ?token= 或 x-sync-token 头）
 *  3. PUT  /state    —— 推送云存档（需 ?token= 或 x-sync-token 头）
 *  4. GET  /         —— 健康检查（可确认 KV 绑定是否生效）
 *
 * 部署步骤（Cloudflare Dashboard 网页操作，无需 CLI）：
 *  1. Workers & Pages → 选中 e-bar worker → Settings → KV → 绑定
 *     先创建 KV namespace（Workers & Pages → KV → Create namespace，名如 ebar-store）
 *     绑定变量名固定为：EBAR_KV
 *  2. Settings → Variables → 添加：
 *     SYNC_TOKEN = 一串你自己的口令（用于网页端同步鉴权，别用真实密码）
 *  3. Edit code → 把本文件全部内容粘贴替换 → Save and Deploy
 *  4. 记录 worker 地址 https://e-bar.<你的子域>.workers.dev，填到 ebar.html 的 CLOUD_URL
 *
 * 注意：SYNC_TOKEN 是网页端前端也会用到的口令（在 JS 里可见），
 *       它只用于挡住乱扫的人，不承担"真正机密"职责。心事类敏感数据请自行斟酌。
 */

const HUNYUAN_ENDPOINT = "https://tokenhub-intl.tencentmaas.com/v1/chat/completions";
const MODEL = "hy3";
const SYSTEM_PROMPT = "你是「夜半微醺」电子酒吧的 AI 酒保。用温暖、克制、像朋友一样的语气，针对用户当下的具体烦恼给一句真诚的回应，不超过 60 字。不要说教，不要套话术，要接住对方此刻的情绪，可以借一句酒或夜晚的意象。";

const KV_KEY = "ebar_state_v1";
const MOOD_LIST = ["烦闷", "失落", "焦虑", "孤独", "疲惫", "迷茫", "开心", "思念", "委屈", "兴奋"];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, PUT, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-sync-token",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS },
  });
}

export default {
  async fetch(request, env) {
    // 预检
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // 健康检查：确认 KV 与 token 配置是否就绪
    if (request.method === "GET" && (path === "/" || path === "/health")) {
      return json({
        ok: true,
        service: "夜半微醺 AI 酒保",
        model: MODEL,
        sync: !!(env.EBAR_KV && env.SYNC_TOKEN),
        kvBound: !!env.EBAR_KV,
        tokenSet: !!env.SYNC_TOKEN,
      });
    }

    // 鉴权：token 可走 query 或 header
    const authOK = !!(env.SYNC_TOKEN) && (
      url.searchParams.get("token") === env.SYNC_TOKEN ||
      request.headers.get("x-sync-token") === env.SYNC_TOKEN
    );

    // ---- 云存档 ----
    if (path === "/state") {
      if (!env.EBAR_KV) {
        return json({ error: "kv_not_bound", hint: "请在 Worker Settings → KV 绑定变量名 EBAR_KV" }, 500);
      }
      if (!authOK) return json({ error: "unauthorized" }, 403);

      if (request.method === "GET") {
        const raw = await env.EBAR_KV.get(KV_KEY);
        return json(raw ? JSON.parse(raw) : null);
      }

      if (request.method === "PUT") {
        let body;
        try { body = await request.json(); } catch (e) { return json({ error: "bad_json" }, 400); }
        if (!body || typeof body !== "object") return json({ error: "bad_payload" }, 400);
        await env.EBAR_KV.put(KV_KEY, JSON.stringify(body));
        return json({ ok: true });
      }

      return json({ error: "method_not_allowed" }, 405);
    }

    // ---- AI 心情识别（关键词没读懂时的智能兜底）----
    if (path === "/mood" && request.method === "POST") {
      if (!authOK) return json({ mood: null, reason: "unauthorized" });
      const apiKey = env && env.HUNYUAN_API_KEY;
      if (!apiKey) return json({ mood: null, reason: "no_key" });

      let text = "";
      try {
        const body = await request.json();
        text = (body && body.text || "").toString().trim();
      } catch (e) { return json({ mood: null }); }
      if (!text) return json({ mood: null });

      try {
        const resp = await fetch(HUNYUAN_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + apiKey,
          },
          body: JSON.stringify({
            model: MODEL,
            messages: [
              { role: "system", content: "你是「夜半微醺」电子酒吧的调酒师。用户会描述自己当下的心情，请从这 10 个心情类别中选出最匹配的一个。只输出类别名本身，不要输出任何其他文字、标点或解释。如果用户描述模糊或无法确定，请根据直觉和文字里的情绪倾向选一个最接近的，绝不允许输出'无法判断'之类的话。10 个类别：" + MOOD_LIST.join("、") },
              { role: "user", content: text },
            ],
            stream: false,
          }),
        });

        if (!resp.ok) return json({ mood: null });
        const j = await resp.json();
        const ans = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content || "").trim();
        const mood = MOOD_LIST.indexOf(ans) >= 0 ? ans : (MOOD_LIST.find(function (m) { return ans.indexOf(m) >= 0 }) || null);
        return json({ mood: mood });
      } catch (e) {
        return json({ mood: null });
      }
    }

    // ---- 混元 AI 酒保 ----
    if (path === "/chat" && request.method === "POST") {
      const apiKey = env && env.HUNYUAN_API_KEY;
      if (!apiKey) {
        return json({ reply: "酒保今晚还没上岗（Worker 没配 HUNYUAN_API_KEY 环境变量）" });
      }

      let text = "";
      try {
        const body = await request.json();
        text = (body && body.text || "").toString().trim();
      } catch (e) { return json({ reply: "" }); }
      if (!text) return json({ reply: "" });

      try {
        const resp = await fetch(HUNYUAN_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + apiKey,
          },
          body: JSON.stringify({
            model: MODEL,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: text },
            ],
            stream: false,
          }),
        });

        if (!resp.ok) {
          return json({ reply: "酒保今晚有点忙，先去喝一杯吧" });
        }
        const j = await resp.json();
        const reply = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
        return json({ reply: (reply || "").trim() || "酒保今晚有点忙，先去喝一杯吧" });
      } catch (e) {
        return json({ reply: "酒保今晚有点忙，先去喝一杯吧" });
      }
    }

    return json({ error: "not_found" }, 404);
  },
};
