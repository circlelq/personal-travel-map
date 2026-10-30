# 旅行地图 · 网页版

小程序同一个数据（`city` 集合）的网页版。数据与小程序实时共享，没有第二份副本：
在小程序里改一座城市的照片，网页刷新就能看到，反之也一样。

- `index.html` — 全部城市，按最近到访排序的瀑布流
- `city.html?id=城市ID` — 城市详情，封面 + 概览 + 按景点分组的照片

图片继续走腾讯云 COS，不在云开发里，**没做任何迁移**。

---

## 开通前必须先做 3 件事

这三步在浏览器里点几下就好，但跳过任何一步页面都会报错。

**1. 云开发控制台 → 登录授权 → 打开「匿名登录」**

网页没有任何账号体系，靠匿名登录换取一个临时身份去读数据库。

**2. 安全配置 → Web 安全域名 → 加上访问域名**

本地预览加 `localhost:4173`，线上用实际域名（比如 `xxx.tcloudbaseapp.com`）。
不在白名单里的来源会被判为非法来源，浏览器里看到的现象是 `Failed to fetch`。

> 如果加了还是连不上，多半是套餐限制：有反馈称「按量计费」档不支持自定义安全域名，
> 需要升级到个人版。

**3. 确认 `city` 集合的权限是「所有用户可读」**

小程序和网页读的是同一个集合，小程序那边已经在用这个权限了，一般不用动。

环境 ID 写在 `assets/config.js` 里。它不是密钥——所有读写都受集合权限约束，放在前端无害。

---

## 本地预览

ES module 不能通过 `file://` 打开（浏览器的 CORS 限制），必须走 http：

```bash
cd web
python3 -m http.server 4173
# 打开 http://localhost:4173
```

改端口的话记得同步改安全域名白名单。

---

## 部署

静态托管免费额度是 5GB 存储 + 5GB 月流量，这点页面用不完。

```bash
npm i -g @cloudbase/cli
cloudbase login

# 把整个 web 目录传上去
cloudbase hosting deploy ./ -e cloud1-d3g2jsmt2f7b64682
```

传完控制台会给一个默认域名 `https://xxx.tcloudbaseapp.com`，**免备案直接可访问**。

也可以在控制台的「静态网站托管」里手动上传文件，效果一样。

### 关于域名

默认域名官方标注用于开发测试，有访问频率限制，控制台也会提示有效期。要长期对外：
买域名 → ICP 备案 → 在 CloudBase 里绑定自定义域名。备案要求环境是个人版及以上、
剩余有效期 > 6 个月，并开启「云托管固定 IP」。

---

## 目录结构

```
web/
├── index.html              首页
├── city.html               城市详情页
├── assets/
│   ├── config.js           环境 ID 与集合名
│   ├── city.js             文档归一化与图片地址（与小程序同源，改动需同步）
│   ├── cloud.js            Web SDK 封装：登录、分页、错误翻译
│   ├── home.js             首页逻辑
│   ├── detail.js           详情页逻辑
│   ├── style.css           样式（配色沿用小程序的 --brand 等变量）
│   └── cloudbase.iife.js   云开发 Web SDK 的本地打包产物
└── README.md
```

---

## 关于 cloudbase.iife.js

`@cloudbase/js-sdk` 从 v3 起只有 ESM 构建，且依赖里带着裸模块名，浏览器不能直接加载；
v2 的 dist 同理。国内访问 unpkg / jsdelivr 也不稳。所以把它**预先打包成一个 IIFE 文件**，
随页面一起部署：挂载全局 `cloudbase`，零外部依赖，加载也快。

需要升级或重新生成时：

```bash
mkdir -p /tmp/sdkbuild && cd /tmp/sdkbuild
npm init -y && npm i esbuild @cloudbase/js-sdk@2.32.0
printf "import cloudbase from '@cloudbase/js-sdk';\nglobalThis.cloudbase = cloudbase;\n" > entry.js
npx esbuild entry.js --bundle --format=iife --minify --target=es2018 \
  --platform=browser --legal-comments=none \
  --outfile=本仓库/web/assets/cloudbase.iife.js
```

已经过冒烟测试：bundle 能正常执行，`cloudbase.init().database().collection().get()`
和 `auth.signInAnonymously()` 均可用。

---

## 这版刻意没做的

以下功能都容易加，先确认要不要做再说：

- **搜索**：需要在每条输入框加防抖，`buildCityQueries` 那套逻辑从 `miniprogram/utils/city.js`
  移植过来就能用
- **地图**：用高德 JS API，坐标是 GCJ-02，和小程序的 `<map>` 组件一致，不用转换；
  需要先申请一个 Web 端 Key
- **编辑**：网页端没有管理员身份，不能复用小程序的 openid 白名单。要做的话得给
  `updateCityPhotos` 云函数加一条 token 通道（`EDIT_TOKEN` 的位置已经预留了）

另外详情页目前不显示「位置」区块——`locations` 数据已经在返回里了，等地图一起做。
