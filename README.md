# personal-travel-map

记录自己去过的城市：在地图上点亮足迹，配上照片和游记链接。

<img src="%E5%B0%8F%E7%A8%8B%E5%BA%8F%E4%BA%8C%E7%BB%B4%E7%A0%81.jpg" alt="小程序二维码" width="220" />

## 页面

| 页面 | 说明 |
| --- | --- |
| 城市 | 两列瀑布流，卡片高度随封面比例变化，点击进入详情 |
| 地图 | 足迹打点聚合，点击标记浮出城市卡片，支持比例尺、指南针与回到定位 |
| 搜索 | 中文按城市名模糊匹配，拼音 / 别名按前缀匹配，结果以封面卡片呈现 |
| 城市详情 | 照片与图注、B 站 / 小红书跳转、位置地图 |
| 照片编辑 | 长按首页卡片进入，逐张修改照片名称与日期 |
| 关于 | 联系方式、版本与开源仓库入口 |

## 技术栈

- 原生小程序，基础库 3.10.2
- 微信云开发（`wx.cloud`），使用 `city` 集合，写操作经云函数 `updateCityPhotos` 鉴权
- 腾讯云 COS 存放图片（广州，桶 `city-1257850266`）

## 目录结构

```
miniprogram/
├── app.js             wx.cloud 初始化与全局逻辑
├── app.json           页面注册与 tabBar
├── app.wxss           全局设计变量
├── cloudfunctions/
│   └── updateCityPhotos/  云函数：照片写入与管理员鉴权
├── utils/
│   ├── db.js          数据访问层：分页拉全量与查询条件构造
│   └── city.js        文档归一化与 COS 图片地址
└── pages/
    ├── index/         城市列表
    ├── map/           足迹地图
    ├── search/        搜索
    ├── cityDetail/    城市详情
    ├── cityEdit/      照片编辑（名称与日期）
    └── about/         关于
template.json          新增城市的字段模板
scripts/
├── emas-to-cloudbase.js   EMAS 数据转成云开发能导入的 JSON Lines
└── migrate-city.js        旧格式数据迁移到新格式
changeLog.md               版本记录
```

## 数据模型

`city` 集合里的一条记录长什么样，见仓库根目录的 `template.json`：

| 字段 | 说明 |
| --- | --- |
| `name` | 城市名 |
| `pinyin` | 拼音，用于搜索，如 `shenzhen` |
| `alias` | 别名数组，如 `["sz"]`，可留空 |
| `country` / `region` | 国家与地区，用于统计 |
| `visits` | 到访日期数组，最近的排在最前，如 `["2023-02-25", "2021-09-05"]` |
| `locations` | `[{lat, lng, name}]`，可放多个到访地点 |
| `photos` | `[{file, title, date}]`，`title` 与 `date` 可省略 |
| `links` | `bili`、`xhs{id, xsecToken}`，都没有时留空对象 |

图片放在 COS 的三个前缀下，城市名与照片名都需要 URL 编码：

| 用途 | 路径 |
| --- | --- |
| 头像 / 地图标记 | `头像/{城市名}.png` |
| 城市封面（首页与详情页共用） | `预览图/{城市名}/{城市名}.jpg` |
| 照片 | `预览图/{城市名}/{照片名}.jpg`、`原图/{城市名}/{照片名}.jpg` |

新增一座城市：按 `template.json` 填好字段，把对应图片传到 COS，再把记录写进 `city` 集合。
城市同名封面缺失时，首页会自动回落到该城市的第一张照片。

### 在小程序里编辑照片

长按首页任意城市卡片即可进入编辑页，逐张修改照片的 `title`（名称）与 `date`（日期），
保存后写回 `city` 集合。名称或日期留空时，详情页不再显示该项。编辑页只改这两个字段，
`file` 必须保持和 COS 上的文件名一致，因此不开放修改。

### 编辑权限

编辑只对管理员开放，判定在云函数里做，不在客户端：

- `city` 集合的权限是「所有用户可读，仅创建者可写」，客户端直连只读，写一律经云函数
- 写操作走云函数 `cloudfunctions/updateCityPhotos`，它用 `cloud.getWXContext().OPENID`
  取出调用者身份，比对云函数内的 `ADMIN_USER_IDS` 白名单后才写库。
  云函数里的数据库操作走管理端权限，不受集合权限规则限制。
- 首页会先问一次云函数「我是不是管理员」，不是就完全不显示编辑入口。

拿到自己 openid 的办法：小程序启动后控制台会打印一行 `云开发身份 xxx isAdmin: false`，
那串 `xxx` 就是要填进 `ADMIN_USER_IDS` 的值。同一小程序下 openid 固定，换手机不用重配。

### 从旧格式迁移

早期版本用的是另一套字段（`markers` 对象、`photo` 二维数组、`officialAccount`，且 `pinyin` 里存的
是日期）。`miniprogram/utils/city.js` 的 `normalizeCity` 同时认新旧两种格式，所以**可以先更新代码、
后迁移数据**，中途不会中断。

迁移步骤：

1. 在控制台导出 `city` 集合，得到 `.json` 文件
2. 编辑 `scripts/migrate-city.js` 顶部的 `VISITS`，补上各城市的真实到访日期
3. `node scripts/migrate-city.js <导出文件> city.new.ndjson`
4. 在控制台清空 `city` 集合，再导入生成的 `.ndjson`

第 2 步不能省：旧数据里 `pinyin` 存的是占位值 `2024-12-25`，脚本无从判断哪个日期是真的。

## 本地运行

1. 微信开发者工具导入 `miniprogram` 目录
2. 把 `app.js` 里的 `CLOUD_ENV` 换成自己的云开发环境 ID
3. 右键 `cloudfunctions` 目录 → 「选择想要上传的目标环境」，绑定同一个环境
4. 右键 `cloudfunctions/updateCityPhotos` → 「上传并部署：云端安装依赖」

前端已无 npm 依赖，不需要再执行「构建 npm」。

## 数据导入

云开发控制台导入功能有两个硬性要求，缺一个就会被拒：

1. 文件后缀必须是 `.json` 或 `.csv`（`.jsonl` 不行）
2. 内容是 **JSON Lines**：每行一个独立对象，不是 JSON 数组

另外，导入会先把文件传到云存储，所以环境里至少要有一个 Bucket，
否则会报 `No available bucket. Please create a bucket in Storage.`。

从 EMAS 迁过来的数据先用脚本摊平 `{$oid}` / `{$date}`（云开发要求 `_id` 是纯字符串，
嵌套对象会导致详情页路径变成 `[object Object]`）：

```bash
node scripts/emas-to-cloudbase.js <EMAS导出文件> -c city -o cloudbase-import
```

如果控制台始终导不进去，可以临时写一个云函数，把数据内联在函数里调用 `add()` 直接写库。
云函数走管理端权限，不经过云存储，也不受导入格式限制，用完删掉即可。

## 更新日志

见 [changeLog.md](changeLog.md)。

## 许可证

[MIT](LICENSE)
