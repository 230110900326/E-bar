/**
 * Cloudflare Pages Functions — AI 酒保代理
 *
 * 部署后同域自动挂载到 /api/bartender
 * 网页版 ebar.html 的 BARTENDER_PROXY 填 "/api/bartender" 即可（同域无跨域）
 *
 * 环境变量（在 Cloudflare Pages → Settings → Environment variables 配置）：
 *   HUNYUAN_API_KEY = sk-你的混元token
 */

const HUNYUAN_ENDPOINT = "https://tokenhub-intl.tencentmaas.com/v1/chat/completions";
const MODEL = "hy3";
const SYSTEM_PROMPT = "你是「夜半微醺」电子酒吧的 AI 酒保。用温暖、克制、像朋友一样的语气，针对用户当下的具体烦恼给一句真诚的回应，不超过 60 字。不要说教，不要套话术，要接住对方此刻的情绪，可以借一句酒或夜晚的意象。";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS },
  });
}

export async function onRequestPost({ request, env }) {
  let text = "";
  try {
    const body = await request.json();
    text = (body && body.text || "").toString().trim();
  } catch (e) {
    return json({ reply: "" });
  }
  if (!text) return json({ reply: "" });

  const apiKey = env && env.HUNYUAN_API_KEY;
  if (!apiKey) {
    return json({ reply: "酒保今晚还没上岗（Pages 没配 HUNYUAN_API_KEY 环境变量）" });
  }

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

// 同域不需要 CORS 预检，但保留以兼容直接访问
export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}
