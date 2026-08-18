/**
 * 夜半微醺 · AI 酒保 Cloudflare Worker 代理
 *
 * 部署步骤：
 * 1. Cloudflare Dashboard → Workers & Pages → Create → Worker
 * 2. 把本文件全部内容粘贴到编辑器，替换默认代码，保存部署
 * 3. Settings → Variables → 添加环境变量：
 *      HUNYUAN_API_KEY = sk-你的混元token（tokenhub-intl.tencentmaas.com 的 key）
 * 4. 部署后会得到 https://<worker名>.<你的子域>.workers.dev
 * 5. 把这个 URL 填到 ebar.html 顶部的 BARTENDER_PROXY 常量里
 *
 * 这个 Worker 做三件事：藏 key、转发到混元、加 CORS 让网页能跨域调
 */

const HUNYUAN_ENDPOINT = "https://tokenhub-intl.tencentmaas.com/v1/chat/completions";
const MODEL = "hy3";
const SYSTEM_PROMPT = "你是「夜半微醺」电子酒吧的 AI 酒保。用温暖、克制、像朋友一样的语气，针对用户当下的具体烦恼给一句真诚的回应，不超过 60 字。不要说教，不要套话术，要接住对方此刻的情绪，可以借一句酒或夜晚的意象。";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }
    if (request.method === "GET") {
      return json({ ok: true, service: "夜半微醺 AI 酒保", model: MODEL });
    }
    if (request.method !== "POST") {
      return json({ reply: "" });
    }

    const apiKey = env && env.HUNYUAN_API_KEY;
    if (!apiKey) {
      return json({ reply: "酒保今晚还没上岗（Worker 没配 HUNYUAN_API_KEY 环境变量）" });
    }

    let text = "";
    try {
      const body = await request.json();
      text = (body && body.text || "").toString().trim();
    } catch (e) {
      return json({ reply: "" });
    }
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
  },
};
