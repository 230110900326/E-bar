// pages/me/me.js
const db = wx.cloud.database();
const usersCol = db.collection('ebar_users');

Page({
  data: {
    points: 0,
    streak: 1,
    ledger: [],
    section: ""   // tasks | ledger | about | guide
  },

  onShow() {
    this.load();
  },

  async load() {
    try {
      const res = await usersCol.get();
      const me = res.data && res.data[0];
      if (me) {
        this.setData({
          points: me.points || 0,
          streak: me.streak || 1,
          ledger: Array.isArray(me.ledger) ? me.ledger : []
        });
      }
    } catch (e) {
      console.error("me load", e);
    }
  },

  open(e) {
    this.setData({ section: e.currentTarget.dataset.key });
  },

  goStats() {
    wx.navigateTo({ url: "/pages/stats/stats" });
  }
});
