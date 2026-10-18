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
| 关于 | 联系方式、版本与开源仓库入口 |

## 技术栈

- 原生小程序，基础库 3.10.2
- 阿里云 EMAS Serverless（`@alicloud/mpserverless-sdk`），使用其中的 `city` 集合
- 腾讯云 COS 存放图片（广州，桶 `city-1257850266`）
- WeUI 扩展库

## 目录结构

```
miniprogram/
├── app.js             SDK 初始化与全局逻辑
├── app.json           页面注册与 tabBar
├── app.wxss           全局设计变量
├── utils/
│   └── city.js        文档归一化与 COS 图片地址
└── pages/
    ├── index/         城市列表
    ├── map/           足迹地图
    ├── search/        搜索
    ├── cityDetail/    城市详情
    └── about/         关于
template.json          新增城市的字段模板
scripts/
└── migrate-city.js    旧格式数据迁移到新格式
changeLog.md           版本记录
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
2. 在工具里执行「构建 npm」，生成 `miniprogram_npm`
3. 把 `app.js` 里的 `spaceId` 与 `clientSecret` 换成自己的服务空间凭证

## 更新日志

见 [changeLog.md](changeLog.md)。

## 许可证

[MIT](LICENSE)
