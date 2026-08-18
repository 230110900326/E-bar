// pages/stats/stats.js
const db = wx.cloud.database();
const recCol = db.collection('ebar_records');

Page({
  data: {
    loading: true,
    total: 0, avg: 0, max: 0, released: 0, owe: 0, streak: 1,
    trendPoints: [],
    diaries: [],
    shownDiaries: [],   // 分页后当前展示的日记
    hasMore: false,
    moreCount: 0,
    _page: 5            // 每页条数
  },

  onShow() {
    this.load();
  },

  async load() {
    this.setData({ loading: true });
    try {
      const res = await recCol.orderBy("date", "desc").limit(100).get();
      const list = res.data || [];
      const diaries = [], talks = [];
      let released = 0, owe = 0;
      list.forEach((r) => {
        const item = {
          id: r._id, date: r.date || "", score: r.score || 0,
          content: r.content || "", drink: r.drink || "",
          status: r.status || "", mood: r.mood || ""
        };
        if (r.type === "微醺日记") diaries.push(item);
        else { talks.push(item); if (r.status === "已释怀") released++; else owe++; }
      });
      const total = diaries.length;
      let sum = 0, max = 0;
      diaries.forEach((d) => { sum += d.score; if (d.score > max) max = d.score; });
      const avg = total ? Math.round(sum / total * 10) / 10 : 0;
      const trend = diaries.slice().sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-14)
        .map((d) => ({ date: d.date, score: d.score }));
      this.setData({
        total, avg, max, released, owe, streak: this._streak || 1,
        trendPoints: trend, diaries, loading: false
      }, () => {
        this.drawTrend();
        this.applyPage();
      });
    } catch (e) {
      console.error("stats load", e);
      this.setData({ loading: false });
    }
  },

  /* 分页：默认显示前 _page 条 */
  applyPage() {
    const page = this.data._page || 5;
    const list = this.data.diaries || [];
    const shownDiaries = list.slice(0, page);
    this.setData({
      shownDiaries,
      hasMore: list.length > page,
      moreCount: list.length - page
    });
  },

  /* 加载更多 */
  showMoreDiary() {
    const page = this.data._page || 5;
    const shown = this.data.shownDiaries.length + page;
    const list = this.data.diaries || [];
    this.setData({
      shownDiaries: list.slice(0, shown),
      hasMore: list.length > shown,
      moreCount: Math.max(0, list.length - shown)
    });
  },

  drawTrend() {
    const pts = this.data.trendPoints;
    if (!pts || pts.length < 2) return;
    const query = wx.createSelectorQuery();
    query.select("#trendCanvas").fields({ node: true, size: true }).exec((res) => {
      if (!res || !res[0] || !res[0].node) return;
      const canvas = res[0].node;
      const ctx = canvas.getContext("2d");
      const W = res[0].width, H = res[0].height;
      const dpr = wx.getSystemInfoSync().pixelRatio || 2;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, W, H);
      const padL = 30, padR = 12, padT = 14, padB = 20;
      const min = 1, max = 10;
      const xs = [], ys = [];
      pts.forEach((p, i) => {
        const x = padL + (W - padL - padR) * i / (pts.length - 1);
        const sc = Math.max(1, Math.min(10, p.score));
        const y = padT + (H - padT - padB) * (1 - (sc - min) / (max - min));
        xs.push(x); ys.push(y);
      });
      ctx.strokeStyle = "rgba(255,255,255,.06)"; ctx.lineWidth = 1;
      [1, 5, 10].forEach((v) => {
        const y = padT + (H - padT - padB) * (1 - (v - min) / (max - min));
        ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
        ctx.fillStyle = "#6b6155"; ctx.font = "10px sans-serif";
        ctx.fillText(String(v), 4, y + 3);
      });
      const grad = ctx.createLinearGradient(0, padT, 0, H - padB);
      grad.addColorStop(0, "rgba(232,163,61,.35)");
      grad.addColorStop(1, "rgba(232,163,61,0)");
      ctx.beginPath();
      ctx.moveTo(xs[0], H - padB);
      xs.forEach((x, i) => { ctx.lineTo(x, ys[i]); });
      ctx.lineTo(xs[xs.length - 1], H - padB);
      ctx.closePath();
      ctx.fillStyle = grad; ctx.fill();
      ctx.beginPath();
      xs.forEach((x, i) => { i === 0 ? ctx.moveTo(x, ys[i]) : ctx.lineTo(x, ys[i]); });
      ctx.strokeStyle = "#e8a33d"; ctx.lineWidth = 2; ctx.lineJoin = "round"; ctx.stroke();
      pts.forEach((p, i) => {
        ctx.beginPath(); ctx.arc(xs[i], ys[i], 3, 0, Math.PI * 2);
        ctx.fillStyle = "#e8a33d"; ctx.fill();
        ctx.strokeStyle = "#1c1510"; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = "#6b6155"; ctx.font = "9px sans-serif";
        ctx.fillText(String(p.date).slice(5).replace("-", "/"), xs[i], H - 6);
      });
    });
  }
});
