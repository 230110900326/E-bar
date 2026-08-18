// pages/index/index.js
const db = wx.cloud.database();
const $ = db.command;
const usersCol = db.collection('ebar_users');
const recCol = db.collection('ebar_records');

const MOODS = [
  {
    key: "烦闷", emoji: "🌫️",
    drink: {
      cn: "古典波本", en: "Old Fashioned",
      base: "波本威士忌 · 苦精 · 方糖",
      taste: "浓烈醇厚，像把一团闷气慢慢搅开，咽下去就散了。",
      how: "冰镇直饮，大冰块慢化不掉味，配一块黑巧克力，睡前一小时微醺刚好。",
      cure: "闷的时候别硬撑。有些情绪，泡进酒里就化开了，明天醒来，又是新的空气。"
    }
  },
  {
    key: "失落", emoji: "🌧️",
    drink: {
      cn: "温热红酒", en: "Mulled Wine",
      base: "红酒 · 肉桂 · 丁香 · 橙片",
      taste: "温热的肉桂香会从喉咙抱住你，像奶奶灶台上的那口暖。",
      how: "小火温到 60℃ 别煮沸，双手捧杯，雨夜或独处时最对味。",
      cure: "失落是心里空了一块，不必急着填满。先暖暖手，再暖暖心，慢慢就回过神来了。"
    }
  },
  {
    key: "焦虑", emoji: "⚡",
    drink: {
      cn: "薄荷莫吉托", en: "Mojito",
      base: "白朗姆 · 薄荷 · 青柠 · 苏打",
      taste: "清凉直冲脑门，让一根紧绷的神经先松一口气。",
      how: "加满碎冰，薄荷叶轻拍出香，炎夏午后或心浮气躁时最清爽。",
      cure: "焦虑是因为想把未来一口气过完。可日子是一口一口喝的，不是一口闷的。今晚只管今晚。"
    }
  },
  {
    key: "孤独", emoji: "🌙",
    drink: {
      cn: "长岛冰茶", en: "Long Island Iced Tea",
      base: "伏特加 · 金酒 · 朗姆 · 龙舌兰 · 可乐",
      taste: "看着像茶，其实是四杯烈酒陪你坐着，你并不孤单。",
      how: "冰杯盛满，柠檬片挂杯口，一个人深夜不想睡时慢慢啜。",
      cure: "孤独不是身边没人，是心里没人应声。但今晚，我陪你坐一会儿。一杯下肚，夜就不那么长了。"
    }
  },
  {
    key: "疲惫", emoji: "🥱",
    drink: {
      cn: "蜂蜜热托迪", en: "Hot Toddy",
      base: "威士忌 · 蜂蜜 · 柠檬 · 热水",
      taste: "蜂蜜裹着柠檬的温柔，从胃里一路暖到眼皮。",
      how: "热水冲泡，趁热小口呷，睡前或感冒初袭时最熨帖。",
      cure: "辛苦了。累的时候不必逞强，把这杯喝完，早点睡。明天的事，交给明天的你。"
    }
  },
  {
    key: "迷茫", emoji: "🧭",
    drink: {
      cn: "血腥玛丽", en: "Bloody Mary",
      base: "伏特加 · 番茄汁 · 辣酱 · 芹菜",
      taste: "番茄的烟火气踩实脚下，辣意帮你找回方向感。",
      how: "冰镇畅饮，芹菜梗搅一搅，brunch 或需要清醒一下时喝。",
      cure: "迷茫不可怕，可怕的是站在原地不动。先迈一步，哪怕方向错了，走着走着就看清了。"
    }
  }
];

function todayStr() {
  const d = new Date();
  const p = (n) => (n < 10 ? "0" : "") + n;
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
}

/* 打卡勋章 */
const BADGES = [
  { need: 3, emoji: "🍺", name: "酒馆新客" },
  { need: 7, emoji: "🥃", name: "酒馆常客" },
  { need: 14, emoji: "🪵", name: "资深酒客" },
  { need: 30, emoji: "🌟", name: "微醺诗人" }
];
function getBadge(streak) {
  let cur = null, next = null;
  for (let i = 0; i < BADGES.length; i++) {
    if (streak >= BADGES[i].need) cur = BADGES[i];
    else { next = BADGES[i]; break; }
  }
  if (!cur) return { cur: null, next: BADGES[0], remain: BADGES[0].need - streak };
  if (!next) return { cur, next: null, remain: 0 };
  return { cur, next, remain: next.need - streak };
}

/* 今日推荐：按「距起始日的天数」轮换，6 款酒一天一杯、6 天一轮，绝不重复 */
const TODAY_EPOCH = new Date("2026-01-01T00:00:00+08:00").getTime();
function todayPick() {
  const day = Math.floor((Date.now() - TODAY_EPOCH) / 86400000);
  const idx = ((day % MOODS.length) + MOODS.length) % MOODS.length;
  return MOODS[idx];
}

function dayDiff(a, b) {
  const da = new Date(a), db2 = new Date(b);
  return Math.round((db2 - da) / 86400000);
}

Page({
  data: {
    moods: MOODS,
    pickedKey: "",
    pickedMood: null,
    mixing: false,
    drinkDetail:  null,
    points: 0,
    streak: 1,
    badge: null,          // 当前勋章 {emoji,name}
    badgeNext: "",        // 晋升提示文案
    shelf: [],            // 酒柜收藏
    shelfKeys: [],        // 已收藏的酒名集合（用于按钮态）
    undone: 0,
    talks: [],
    diaries: [],
    talkText: "",
    diaryScore: 7,
    diaryDrink: "",
    diaryText: "",
    trendPoints: [],       // 趋势图数据 [{date,score}]
    today: null,           // 今日推荐 {key,drink,emoji}
    lucky: false           // 抽一杯动画中
  },

  onLoad() {
    const t = todayPick();
    this.setData({ today: { key: t.key, emoji: t.emoji, drink: t.drink } });
    this.initUser();
    this.loadRecords();
  },

  async initUser() {
    try {
      const res = await usersCol.get();
      let me = res.data && res.data[0];
      if (!me) {
        me = { points: 100, lastDay: todayStr(), streak: 1, ledger: [{ t: todayStr(), label: "初始酒资", delta: 100, balance: 100 }] };
        const add = await usersCol.add({ data: me });
        me._id = add._id;
      } else {
        const today = todayStr();
        if (me.lastDay !== today) {
          const diff = dayDiff(me.lastDay, today);
          const nextStreak = (diff === 1) ? me.streak + 1 : 1;
          const entry = { t: today, label: "每日光顾", delta: 10, balance: me.points + 10 };
          await usersCol.doc(me._id).update({
            data: { lastDay: today, streak: nextStreak, points: me.points + 10, ledger: $.push([entry]) }
          });
          me.points += 10;
          me.streak = nextStreak;
          me.lastDay = today;
        }
      }
      this._uid = me._id;
      this.setData({ points: me.points, streak: me.streak });
      this.applyBadge(me.streak);
      if (Array.isArray(me.shelf)) {
        this.setData({
          shelf: me.shelf,
          shelfKeys: me.shelf.map((s) => s.cn)
        });
      }
    } catch (e) {
      console.error("initUser", e);
      wx.showToast({ title: "初始化失败，请重试", icon: "none" });
    }
  },

  applyBadge(streak) {
    const b = getBadge(streak || this.data.streak || 1);
    if (!b.cur) { this.setData({ badge: null, badgeNext: "" }); return; }
    const nextTxt = b.next ? " · 再 " + b.remain + " 晚升 " + b.next.name : "";
    this.setData({ badge: b.cur, badgeNext: nextTxt });
  },

  async loadRecords() {
    try {
      const res = await recCol.orderBy("date", "desc").limit(100).get();
      const list = res.data || [];
      const talks = [], diaries = [];
      let undone = 0;
      list.forEach((r) => {
        const item = {
          id: r._id, mood: r.mood || "", content: r.content || "",
          cure: r.cure || "", status:  r.status || "", date: r.date || "",
          score: r.score || 0, drink: r.drink || ""
        };
        if (r.type === "微醺日记") diaries.push(item);
        else { talks.push(item); if (r.status !== "已释怀") undone++; }
      });
      this.setData({ talks, diaries, undone });
    } catch (e) {
      console.error("loadRecords", e);
    }
  },

  addPoints(delta, label) {
    if (!this._uid) return;
    const now = new Date();
    const p = (n) => (n < 10 ? "0" : "") + n;
    const t = now.getFullYear() + "-" + p(now.getMonth() + 1) + "-" + p(now.getDate());
    const entry = { t: t, label: label || (delta > 0 ? "积分奖励" : "消费"), delta: delta, balance: this.data.points + delta };
    usersCol.doc(this._uid).update({ data: { points: $.inc(delta), ledger: $.push([entry]) } })
      .then(() => { this.setData({ points: this.data.points + delta }); })
      .catch((e) => console.error(e));
  },

  /* 酒柜收藏 */
  onShelfAdd() {
    const d = this.data.drinkDetail;
    if (!d) return;
    if (this.data.shelfKeys.indexOf(d.cn) >= 0) {
      wx.showToast({ title: "这杯已经在酒柜里啦", icon: "none" });
      return;
    }
    const item = { cn: d.cn, en: d.en, base: d.base, taste: d.taste, how: d.how, cure: d.cure, date: todayStr() };
    const shelf = [item].concat(this.data.shelf);
    const keys = shelf.map((s) => s.cn);
    this.setData({ shelf, shelfKeys: keys });
    wx.showToast({ title: "已收进酒柜", icon: "none" });
    if (this._uid) {
      usersCol.doc(this._uid).update({ data: { shelf: $.push([item]) } })
        .catch((e) => console.error("shelfAdd", e));
    }
  },

  goShelf() {
    wx.navigateTo({ url: "/pages/shelf/shelf" });
  },

  goStats() {
    wx.navigateTo({ url: "/pages/stats/stats" });
  },

  goMe() {
    wx.navigateTo({ url: "/pages/me/me" });
  },

  /* 分享海报：用隐藏 canvas 绘制并保存相册 */
  onPoster() {
    const d = this.data.drinkDetail;
    if (!d) return;
    const query = wx.createSelectorQuery();
    query.select("#posterCanvas").fields({ node: true, size: true }).exec((res) => {
      if (!res || !res[0] || !res[0].node) {
        wx.showToast({ title: "当前环境不支持海报", icon: "none" });
        return;
      }
      const canvas = res[0].node;
      const ctx = canvas.getContext("2d");
      const W = 750, H = 1200;
      const dpr = wx.getSystemInfoSync().pixelRatio || 2;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.scale(dpr, dpr);
      /* 背景 */
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, "#1c1510"); bg.addColorStop(0.55, "#241b12"); bg.addColorStop(1, "#15100c");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      /* 氛围光斑 */
      ctx.save(); ctx.globalAlpha = 0.16;
      const rg = ctx.createRadialGradient(560, 180, 20, 560, 180, 360);
      rg.addColorStop(0, "#e8a33d"); rg.addColorStop(1, "rgba(232,163,61,0)");
      ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(560, 180, 360, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      /* 边框 */
      ctx.strokeStyle = "rgba(232,163,61,.55)"; ctx.lineWidth = 2; ctx.strokeRect(30, 30, 690, 1140);
      ctx.strokeStyle = "rgba(232,163,61,.25)"; ctx.lineWidth = 1; ctx.strokeRect(42, 42, 666, 1116);
      /* 文字 */
      ctx.textAlign = "center";
      ctx.fillStyle = "#e8a33d"; ctx.font = "600 30px serif";
      ctx.fillText("夜 半 微 醺", 375, 130);
      ctx.fillStyle = "#8f806c"; ctx.font = "22px sans-serif";
      ctx.fillText("— 今夜特调 —", 375, 176);
      ctx.font = "150px serif"; ctx.fillText("🍸", 375, 420);
      ctx.fillStyle = "#f2d9ae"; ctx.font = "700 64px serif";
      ctx.fillText(d.cn, 375, 560);
      ctx.fillStyle = "#9b8b74"; ctx.font = "28px sans-serif";
      ctx.fillText(d.en || "", 375, 616);
      ctx.fillStyle = "#b8a48c"; ctx.font = "30px sans-serif";
      ctx.fillText(d.base || "", 375, 700);
      ctx.fillStyle = "#d9c6a8"; ctx.font = "34px serif";
      const words = this.wrapCure(d.cure || "");
      let wy = 820;
      words.forEach((w) => { ctx.fillText(w, 375, wy); wy += 54; });
      ctx.fillStyle = "#6b5f4f"; ctx.font = "26px sans-serif";
      ctx.fillText(todayStr() + " · 夜半微醺电子酒吧", 375, wy + 40);
      /* 导出保存 */
      setTimeout(() => {
        wx.canvasToTempFilePath({
          canvas,
          success: (r) => {
            wx.saveImageToPhotosAlbum({
              filePath: r.tempFilePath,
              success: () => wx.showToast({ title: "海报已保存到相册", icon: "none" }),
              fail: () => {
                wx.showModal({
                  title: "保存失败",
                  content: "请在设置中允许「保存到相册」权限后重试",
                  confirmText: "去设置",
                  success: (m) => { if (m.confirm) wx.openSetting(); }
                });
              }
            });
          },
          fail: () => wx.showToast({ title: "海报生成失败", icon: "none" })
        });
      }, 120);
    });
  },

  wrapCure(s) {
    const arr = []; let cur = "";
    for (let i = 0; i < s.length; i++) {
      cur += s[i];
      if (cur.length >= 9 && (s[i] === "，" || s[i] === "。" || s[i] === "、")) { arr.push(cur); cur = ""; }
      else if (cur.length >= 11) { arr.push(cur); cur = ""; }
    }
    if (cur) arr.push(cur);
    return arr;
  },

  onPickMood(e) {
    const key = e.currentTarget.dataset.key;
    const m = this.data.moods.find((x) => x.key === key);
    this.setData({ pickedKey: key, pickedMood: m });
  },
  cancelPick() { this.setData({ pickedKey: "", pickedMood: null }); },
  backToMoods() { this.setData({ drinkDetail: null }); },

  doMix() {
    if (this.data.points < 15) {
      wx.showToast({ title: "积分不足，去解忧酒馆或写日记赚积分", icon: "none" });
      return;
    }
    this.addPoints(-15, "调一杯·" + this.data.pickedMood.drink.cn);
    this.addDrinkCount(this.data.pickedMood.drink.cn);
    this.setData({ mixing: true });
    setTimeout(() => {
      this.setData({
        mixing: false,
        drinkDetail: this.data.pickedMood.drink,
        diaryDrink: this.data.pickedMood.drink.cn
      });
      wx.showToast({ title: "酒保调好了一杯" + this.data.pickedMood.drink.cn, icon: "none" });
    }, 1800);
  },

  /* 今日推荐：就喝这杯 */
  onTodayDrink() {
    const m = todayPick();
    this.setData({ pickedMood: m, pickedKey: m.key });
    this.doMix();
  },

  /* 抽一杯：随机出酒，扣积分 */
  onLucky() {
    if (this.data.points < 15) {
      wx.showToast({ title: "积分不足，去解忧酒馆或写日记赚积分", icon: "none" });
      return;
    }
    const m = this.data.moods[Math.floor(Math.random() * this.data.moods.length)];
    this.addPoints(-15, "抽一杯·" + m.drink.cn);
    this.addDrinkCount(m.drink.cn);
    this.setData({ lucky: true });
    setTimeout(() => {
      this.setData({
        lucky: false,
        drinkDetail: m.drink,
        pickedMood: m,
        pickedKey: m.key,
        diaryDrink: m.drink.cn
      });
      wx.showToast({ title: "命运抽中了一杯" + m.drink.cn, icon: "none" });
    }, 1600);
  },

  /* 点单次数统计：云端 ebar_users.drinkCount.{酒名} += 1 */
  addDrinkCount(cn) {
    if (!this._uid || !cn) return;
    const key = "drinkCount." + cn;
    usersCol.doc(this._uid).update({ data: { [key]: $.inc(1) } })
      .catch((e) => console.error("drinkCount", e));
  },

  onTalkInput(e) { this.setData({ talkText: e.detail.value }); },

  async sendTalk() {
    const text = (this.data.talkText || "").trim();
    if (!text) { wx.showToast({ title: "写点什么吧", icon: "none" }); return; }
    wx.showLoading({ title: "酒保思考中" });
    let cure = "";
    try {
      const r = await wx.cloud.callFunction({ name: "aiReply", data: { text: text } });
      cure = (r.result && r.result.reply) || "";
    } catch (e) { console.error(e); }
    wx.hideLoading();
    if (!cure) { wx.showToast({ title: "回信生成失败", icon: "none" }); return; }
    try {
      await recCol.add({
        data: { type: "解忧留言", mood: "倾诉", content: text, cure: cure, status: "未释怀", date: todayStr() }
      });
    } catch (e) { console.error(e); }
    this.addPoints(5, "投递烦恼");
    this.setData({ talkText: "" });
    this.loadRecords();
    wx.showToast({ title: "酒保回信已送达", icon: "none" });
  },

  release(e) {
    const id = e.currentTarget.dataset.id;
    recCol.doc(id).update({ data: { status: "已释怀" } })
      .then(() => {
        this.addPoints(3, "标记释怀");
        this.loadRecords();
        wx.showToast({ title: "放下了一桩心事", icon: "none" });
      }).catch((err) => console.error(err));
  },

  onScore(e) { this.setData({ diaryScore: e.detail.value }); },
  onDiaryDrink(e) { this.setData({ diaryDrink: e.detail.value }); },
  onDiaryText(e) { this.setData({ diaryText: e.detail.value }); },

  async saveDiary() {
    const text = (this.data.diaryText || "").trim();
    if (!text) { wx.showToast({ title: "写点什么吧", icon: "none" }); return; }
    try {
      await recCol.add({
        data: {
          type: "微醺日记", score: this.data.diaryScore,
          drink: this.data.diaryDrink || "", content: text,
          status: "已释怀", date: todayStr()
        }
      });
    } catch (e) { console.error(e); }
    this.addPoints(5, "写微醺日记");
    this.setData({ diaryText: "", diaryDrink: "" });
    this.loadRecords();
    wx.showToast({ title: "今晚这一杯，记下了", icon: "none" });
  }
});
