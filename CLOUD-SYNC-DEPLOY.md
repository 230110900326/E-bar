# 云存档同步部署指南（Cloudflare Worker + KV）

让酒吧的「心情记录 / 积分 / 打卡」**跨浏览器、跨设备自动同步**，localStorage 做本地兜底。

## 架构

```
浏览器 A（Chrome）──┐
浏览器 B（Edge）  ──┼─→ Cloudflare Worker (e-bar) ──→ KV 命名空间（云存档）
手机（微信）     ──┘        │
                            └─→ 混元 API（AI 酒保）
```

- 网页每次打开：拉云端 → 与本地**合并去重** → 渲染（云端挂了就纯本地，照常玩）
- 每次写操作（投递烦恼 / 写日记 / 积分变动 / 打卡）：防抖 1.5 秒后自动推云端
- 冲突策略：记录按 id 合并去重，积分等标量取**最近写入端**，谁新听谁的

## 一、创建 KV 命名空间（1 分钟）

1. Cloudflare Dashboard → 左侧 **Workers & Pages** → **KV**
2. 点 **Create a namespace** → 名称填 `ebar-store` → **Create**

## 二、给 Worker 绑定 KV

1. 左侧 **Workers & Pages** → 点你的 **e-bar** Worker
2. **Settings**（设置）→ **Variables**（变量）→ **KV namespace bindings** → **Add binding**
3. **Variable name** 必须填：`EBAR_KV`
4. **KV namespace** 选刚建的 `ebar-store` → **Save**

## 三、更新 Worker 代码

1. Worker 页面 → **Edit code**（编辑代码）→ 全选替换为 `cloudflare-worker.js` 的内容 → **Save and Deploy**
   （新版已加 GET/PUT /state 云存档接口，混元代理原样保留）

## 四、配环境变量

Worker → **Settings → Variables → Environment variables**：

```
SYNC_TOKEN     = 一串口令，比如 ebar-fun-2026（网页端同步鉴权用，别用真密码）
HUNYUAN_API_KEY = sk-你的混元 token（如果没有就保持已有配置）
```

## 五、网页端开同步（关键！）

1. Worker 页面顶部能看到你的地址：`https://e-bar.<你的子域>.workers.dev`
2. 打开 `ebar.html`，找到这两行并填上：

```js
var CLOUD_URL = "https://e-bar.<你的子域>.workers.dev";   // ← 你的 Worker 地址
var CLOUD_TOKEN = "ebar-fun-2026";                        // ← 和 SYNC_TOKEN 一致
```

3. 保存后 push 到 GitHub（GitHub Pages 和 wangdada.site 自动更新）

## 六、验证

1. 浏览器打开 `https://e-bar.<你的子域>.workers.dev/` → 应返回：
   ```json
   {"ok":true,"service":"夜半微醺 AI 酒保","model":"hy3","sync":true,"kvBound":true,"tokenSet":true}
   ```
   `sync:true` = KV 绑定 + token 都配好了
2. 在 Chrome 写一条日记 → 等 2 秒 → 换 Edge 打开同一网址 → 日记应该在
3. 断网也能玩：云端失败自动走本地，数据不丢

## 安全说明

- `SYNC_TOKEN` 会出现在网页 JS 里（前端鉴权必然如此），它只挡乱扫的爬虫，**不承担机密职责**
- 心事/烦恼是敏感数据，上传到云端 KV 即意味着存在 Cloudflare 服务器上，介意就别开这个功能
- 数据存 KV 为明文 JSON，Worker 地址 + token 同时泄漏才可能被读取，日常使用风险可接受
