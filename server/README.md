# 云函数

这里的云函数不在小程序包里，需要单独部署到 EMAS Serverless 控制台。

## updateCityPhotos

小程序的照片编辑功能通过它写入 `city` 集合。

### 为什么要有它

EMAS 的数据库权限规则只有三种取值——`true`、`false`、`request.auth.userId==resource.auth.userId`，
**没法在规则里写死「只有某个人能写」**。而控制台、云函数、管控 SDK 发起的数据库操作不受权限规则限制，
所以自定义鉴权只能放在云函数里。阿里云自己的建议也是：不要从客户端直连数据库写。

配套把 `city` 集合的权限改成「所有用户可读，仅管理员可写」：

```json
{ ".read": true, ".write": false }
```

这样别人就算绕过界面、抓包拿到接口，也写不进库。

### 部署

1. EMAS 控制台 → Serverless → 云函数 → 新建云函数，名称填 `updateCityPhotos`
2. 把 `updateCityPhotos` **整个文件夹**打包成 zip（注意是文件夹本身，不是里面的 index.js）
   ```
   cd server && zip -r updateCityPhotos.zip updateCityPhotos
   ```
3. 上传代码包并部署

### 拿到管理员身份

`index.js` 顶部的 `ALLOW_FIRST_CLAIM` 默认是 `true`：当 `admins` 集合还是空的时候，
**第一个调用者会被自动登记为管理员**，之后这条规则就永久失效了。

所以部署完，用你自己的微信打开一次小程序首页（编辑页加载时会调一次 `action: 'check'`），
你就登记上了。确认之后建议把 `ALLOW_FIRST_CLAIM` 改成 `false` 再重新部署一次，彻底关掉这个窗口。

也可以不走自动登记，直接把 userId 写进 `ADMIN_USER_IDS`：

```js
const ADMIN_USER_IDS = ['62d901b15321303781xxxxxx'];
```

不知道自己 userId 的话，被拒绝时返回的 `userId` 字段就是（小程序端会以弹窗显示出来）。

### 排查：check 一直返回 isAdmin: false / userId 为空

`action: 'check'` 现在会带回诊断字段：

| 字段 | 含义 |
| --- | --- |
| `userId` | 云函数取到的调用者 ID，空字符串就是没取到人 |
| `source` | `client` 是小程序端，`server` 是控制台执行（一定没身份） |
| `raw` | `ctx.mpserverless.user.getInfo()` 的原始返回 |
| `err` | `getInfo` 抛出的错误 |
| `env` | 云函数的环境变量，含 `MP_SOURCE` / `MP_SPACE_ID` |

**注意：在控制台直接执行云函数来测试是没有意义的**，那种调用没有用户身份，`userId` 必然为空。
必须用手机打开小程序首页，看首页那两行 `[调试]` 输出（定位完会删掉）。

- 云端 `userId` 空、客户端也空 → `authorize` 没成功，检查 EMAS 控制台的微信授权配置和小程序的 appid
- 云端空、客户端有 → 身份没有随 `function.invoke` 传到云函数，属于平台侧问题，改用下面的方案 B

### 方案 B（备选）：用 wx.login 的 code 换 openid

如果 EMAS 的身份体系在这个空间上取不到人，可以让客户端把 `wx.login()` 拿到的 code 传给云函数，
云函数用 `ctx.httpclient` 调微信 `jscode2session` 换 openid 再比对白名单。
code 是一次性的、且绑定调用者本人的微信身份，别人伪造不了。
这个方案需要在云函数里配置小程序的 `appsecret`（只存在服务端）。

### 接口

调用：`mpserverless.function.invoke('updateCityPhotos', args)`

| args | 说明 |
| --- | --- |
| `action: 'check'` | 只查询当前用户是不是管理员，不写库 |
| `cityId` + `photos` | 写库。`photos` 为 `[{file, title?, date?}]` |

返回 `result`：

| code | 含义 |
| --- | --- |
| `success: true` | 成功，`affectedDocs` 为命中条数 |
| `FORBIDDEN` | 不是管理员，附带 `userId` |
| `BAD_REQUEST` | 参数没通过校验 |
| `NOT_FOUND` | `cityId` 没命中任何记录，附带 `detail` |
| `DB_ERROR` | `updateOne` 抛异常，附带具体错误 |

### 踩过的坑：不要只看 updateOne 的返回值判断有没有写进去

云函数里 `updateOne` 的返回结构不统一，`affectedDocs` 可能出现在顶层、
`result` 里或 `result.result` 里。早期版本只认 `res.result.affectedDocs`，
解析不到就当成 0，于是**库里已经写成功了，却给前端报「没有命中任何记录」**。

现在的做法是：先 `find` 定位记录并确定 `_id` 的写法，写入后只要没抛错就算成功；
`find` 查不到时也不会直接判「不存在」，而是退化成直接尝试写入。
**误报失败比漏判一次「不存在」糟糕得多**——前者会让人以为改丢了。

### 增减管理员

往 `admins` 集合里加 / 删一条 `{userId}` 即可，不用重新部署云函数。
这个集合建议设为「仅管理员可读写」。
