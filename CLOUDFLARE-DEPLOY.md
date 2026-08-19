# Cloudflare Pages 部署指南（路线 B · 一体化，全免费）

网页 + AI 后端 + 自定义域名全部走 Cloudflare，**零服务器费用**。

## 架构

```
浏览器 → https://wangdada.site（Cloudflare Pages 托管静态网页）
             └─ /api/bartender（Pages Functions，同域调用混元，无跨域）
```

- 静态网页：`index.html`（跳 ebar.html）+ `ebar.html`
- 后端：`functions/api/bartender.js`（Pages Functions，同域自动挂载到 `/api/bartender`）
- 网页里 `BARTENDER_PROXY = "/api/bartender"`（相对路径，同域直连）

## 一、把域名迁到 Cloudflare（免费）

1. 注册/登录 https://dash.cloudflare.com （免费）
2. **Add a site** → 输入 `wangdada.site` → 选 **Free** 套餐
3. Cloudflare 会给你 **2 个 NS 地址**（形如 `xxx.ns.cloudflare.com`、`yyy.ns.cloudflare.com`）
4. 登录**阿里云域名控制台** → 找到 wangdada.site → **DNS 修改**（修改 DNS 服务器）
   - 把原来的 `dns19/20.hichina.com` 改成 Cloudflare 给的 2 个 NS
5. 等 DNS 生效（通常 10-30 分钟，最长 24h）。生效后 Cloudflare 站点状态变 **Active**
6. 在 Cloudflare 里把可能自动扫描到的记录删干净（或不管，Pages 会用 CNAME）

## 二、部署 Pages（连 GitHub 自动发布）

1. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages**
2. **Connect to Git** → 授权 GitHub → 选 `230110900326/E-bar` 仓库
3. 构建配置：
   - **Framework preset**: 选 **None**（纯静态）
   - **Build command**: 留空
   - **Build output directory**: 填 `/`
4. Save and Deploy → 自动构建上线，得到 `https://E-bar.pages.dev`

## 三、配混元环境变量

Pages 项目 → **Settings** → **Environment variables** → **Production**：
```
HUNYUAN_API_KEY = sk-7Evgzf9eE7OlzE4HMbZZJ9lNigDiTerYdSzRXdOvkL1GTaWT
```
保存后点 **Create deployment** 重新部署一次生效。

## 四、绑自定义域名

Pages 项目 → **Custom domains** → **Set up a custom domain** → 填 `wangdada.site`
Cloudflare 自动加 CNAME 并签发证书（同域托管，全程自动）。

## 五、验证

- 打开 `https://wangdada.site` → 应该看到酒吧
- 投递一条烦恼 → 看回信是不是混元真 AI 生成的（不是套话）
- 直接访问 `https://wangdada.site/api/bartender` → 应返回 JSON `{"ok":...}`

## 六、以后每次更新网页

改完 `ebar.html` → git push → **Pages 自动重新构建**，无需手动操作。

## 注意事项

- `functions/` 目录只对 **Cloudflare Pages** 生效；GitHub Pages 下访问 `/api/bartender` 会 404，网页自动降级到关键词兜底（不影响使用）
- key 只存 Cloudflare 环境变量，**不进 GitHub**（.gitignore 已排除 wrangler.jsonc）
- 免费套餐：静态托管无限流量，Functions 每天 10 万次请求，个人酒吧绰绰有余
