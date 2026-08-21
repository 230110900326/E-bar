/**
 * Cloudflare Pages Functions — AI 心情识别（关键词没读懂时的智能兜底）
 * 部署后同域自动挂载到 /api/mood
 * 环境变量：HUNYUAN_API_KEY（与 bartender.js 共用）
 */

const HUNYUAN_ENDPOINT = "https://tokenhub-intl.tencentmaas.com/v1/chat/completions";
const MODEL = "hy3";
const MOOD_LIST = ["烦闷", "失落", "焦虑", "孤独", "疲惫", "迷茫", "开心", "思念", "委屈", "兴奋"];

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
    return json({ mood: null });
  }
  if (!text) return json({ mood: null });

  const apiKey = env && env.HUNYUAN_API_KEY;
  if (!apiKey) return json({ mood: null, reason: "no_key" });

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

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}
