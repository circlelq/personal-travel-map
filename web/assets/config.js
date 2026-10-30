// 云开发环境配置
//
// env 填环境 ID（不是环境名称）。环境 ID 在云开发控制台 → 环境 → 环境信息里能看到。
// 它不是密钥：所有读写都受集合的安全规则约束，公开在前端代码里也没关系。
//
// 本地预览前记得做两件事（详见 README）：
//   1. 云开发控制台 → 登录授权 → 打开「匿名登录」
//   2. 安全配置 → Web 安全域名 → 加上 localhost:4173（本地）和你的线上域名

export const CLOUDBASE_ENV = 'cloud1-d3g2jsmt2f7b64682';

// 与小程序共用的集合名，一般不用改
export const COLLECTION = 'city';

// 每次分页取多少条。Web 端单次上限是 100，小程序端是 20
export const PAGE_SIZE = 100;
