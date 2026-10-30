// 云开发 Web SDK 的薄封装
//
// 页面只调用 fetchAllCities / fetchCityById，不用关心登录和分页。
// SDK 本体是随页面一起部署的 assets/cloudbase.iife.js（本地打包版），
// 不走第三方 CDN，避免外网依赖。

import { CLOUDBASE_ENV, COLLECTION, PAGE_SIZE } from './config.js';
import { normalizeCity } from './city.js';

let appPromise = null;

// 匿名登录只需要做一次，多个页面模块共用同一个 promise
function getApp() {
  if (appPromise) return appPromise;

  appPromise = (async () => {
    const app = window.cloudbase.init({ env: CLOUDBASE_ENV });
    const auth = app.auth({ persistence: 'local' });

    const state = await auth.getLoginState();
    if (!state) {
      // 两个版本的 API 都兼容一下：老版是 anonymousAuthProvider().signIn()
      if (typeof auth.signInAnonymously === 'function') {
        await auth.signInAnonymously();
      } else {
        await auth.anonymousAuthProvider().signIn();
      }
    }

    return app;
  })();

  return appPromise;
}

async function collection() {
  const app = await getApp();
  return app.database().collection(COLLECTION);
}

// Web 端单次最多读 100 条，城市多了要翻页。固定按 _id 排序，
// 否则底层返回顺序不稳定，翻页时会重复或漏记录
export async function fetchAllCities() {
  const db = await collection();
  const all = [];

  for (let page = 0; page < 50; page++) {
    const res = await db
      .orderBy('_id', 'asc')
      .skip(page * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .get();

    const rows = (res && res.data) || [];
    rows.forEach(item => all.push(normalizeCity(item)));
    if (rows.length < PAGE_SIZE) break;
  }

  return all.filter(Boolean);
}

export async function fetchCityById(id) {
  const db = await collection();
  const res = await db.doc(id).get();
  // Web SDK 的 doc().get() 返回 { data: [文档] }（数组包一层），
  // 和小程序 SDK 直接返回对象不一样，这里统一拆开
  const raw = res && Array.isArray(res.data) ? res.data[0] : res && res.data;
  return normalizeCity(raw);
}

// 把 SDK 的报错翻成人话。最常见的两类是忘记开匿名登录和忘记加安全域名
export function describeError(err) {
  const message = String((err && err.message) || err || '');

  if (/anonymous|匿名/i.test(message)) {
    return '匿名登录没开：云开发控制台 → 登录授权 → 打开「匿名登录」';
  }
  if (/domain|域名|origin/i.test(message)) {
    return '当前域名不在白名单里：云开发控制台 → 安全配置 → Web 安全域名';
  }
  if (/permission|权限|PERMISSION_DENIED/i.test(message)) {
    return '集合不允许读：检查 city 集合的权限是不是「所有用户可读」';
  }
  if (/Failed to fetch|Network Error|network/i.test(message)) {
    return '连不上云服务，检查网络，或确认环境 ID 填对了';
  }

  return message || '未知错误';
}
