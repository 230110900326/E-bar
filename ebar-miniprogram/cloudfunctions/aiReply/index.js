// 云函数 aiReply：调用大模型生成针对性酒保回信
// 部署前在「云函数 > aiReply > 配置 > 环境变量」填入 DEEPSEEK_API_KEY（DeepSeek 注册免费获取）
const API_KEY = process.env.DEEPSEEK_API_KEY || "";

const KW = {
  "加班|工作|老板|工资|实习|KPI|离职": "加班到这么晚，你已经扛了很久了。允许自己今晚什么都不做，把自己还给自己。",
  "考研|考试|复习|上岸|保研": "复习像在黑屋子里洗衣服，不知道干没干净，只能一遍遍洗。但灯一开，结果就看见了。",
  "吵架|分手|冷战|前任|感情|对象": "关系里最难的不是吵架，是还愿意说。先给自己一点空间，别急着定性。",
  "想家|妈妈|爸妈|故乡|孤独": "想家不是软弱，是心里缺了一块熟悉的温度。给家里发个消息，哪怕只是一句晚安。",
  "迷茫|未来|方向|不知道": "迷茫是因为站在十字路口，每个方向都看不清。先选一个走，走着走着路就出来了。",
  "焦虑|紧张|压力|失眠": "焦虑是把明天的重，提前压到今天的肩上。今晚先放下，明天的事交给明天的自己。",
  "钱|没钱|穷|房租|负债": "钱的事解决不了今晚，但今晚的安稳可以。先好好睡，思路清醒了才好赚钱。",
  "委屈|不被理解|压抑": "委屈憋在心里会发酵。说出来，或写下来，就已经轻了一半。",
  "失恋|暗恋|喜欢": "心动是甜的，落空是涩的。尝过味道的人，比没尝过的人更懂得自己要什么。"
};

function fallback(text) {
  for (const k in KW) {
    if (new RegExp(k).test(text)) return KW[k];
  }
  return "天黑到极致，就是天亮的前奏。今晚先放下，明天的事明天再说。";
}

exports.main = async (event) => {
  const text = ((event && event.text) || "").trim();
  if (!text) return { reply: "" };
  if (!API_KEY) return { reply: fallback(text) };
  try {
    const resp = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + API_KEY
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: "你是「夜半微醺」电子酒吧的 AI 酒保。用温暖、克制、像朋友一样的语气，针对用户当下的具体烦恼给一句真诚的回应，不超过 60 字。不要说教，不要套话术，要接住对方此刻的情绪，可以借一句酒或夜晚的意象。"
          },
          { role: "user", content: text }
        ],
        temperature: 0.9
      })
    });
    const j = await resp.json();
    const reply = j.choices && j.choices[0] && j.choices[0].message.content;
    return { reply: reply || fallback(text) };
  } catch (e) {
    return { reply: fallback(text) };
  }
};
