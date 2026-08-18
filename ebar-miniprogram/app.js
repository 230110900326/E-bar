// app.js
// 云环境 ID：在微信开发者工具「云开发」开通后，把下面 env 改成你的环境 ID
const CLOUD_ENV = "your-env-id";

App({
  onLaunch() {
    if (!wx.cloud) {
      console.error("当前基础库不支持云开发，请使用 2.2.3 以上版本");
      return;
    }
    wx.cloud.init({
      env: CLOUD_ENV,
      traceUser: true
    });
  },
  globalData: {}
});
