// pages/shelf/shelf.js
const db = wx.cloud.database();
const usersCol = db.collection('ebar_users');

Page({
  data: {
    shelf: [],
    loading: true
  },

  onShow() {
    this.loadShelf();
  },

  async loadShelf() {
    this.setData({ loading: true });
    try {
      const res = await usersCol.get();
      const me = res.data && res.data[0];
      const shelf = (me && Array.isArray(me.shelf)) ? me.shelf : [];
      const counts = (me && me.drinkCount) ? me.drinkCount : {};
      shelf.forEach((s) => { s.count = counts[s.cn] || 0; });
      this._meId = me && me._id;
      this.setData({ shelf, loading: false });
    } catch (e) {
      console.error("loadShelf", e);
      this.setData({ loading: false });
    }
  },

  onRemove(e) {
    const cn = e.currentTarget.dataset.cn;
    const shelf = this.data.shelf.filter((s) => s.cn !== cn);
    this.setData({ shelf });
    wx.showToast({ title: "已从酒柜移除", icon: "none" });
    const me = this.data._meId;
    if (me) {
      usersCol.doc(me).update({ data: { shelf: db.command.pull({ cn }) } })
        .catch((err) => console.error("remove", err));
    }
  },

  goMix() {
    wx.navigateBack({
      fail: () => wx.reLaunch({ url: "/pages/index/index" })
    });
  }
});
