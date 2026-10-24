// 云函数 updateCityPhotos（微信云开发版）
//
// 与 EMAS 版的区别：
//   1. 签名从 module.exports = ctx => {} 改成 exports.main = async (event, context) => {}
//   2. 身份从 ctx.mpserverless.user.getInfo() 改成 cloud.getWXContext().OPENID
//   3. 数据库 API 换成 wx-server-sdk 的 where / doc / update
//   4. 云函数里的数据库操作走管理端权限，不受集合权限规则限制，
//      所以自定义鉴权（只有我能写）依然放在这里
//
// 配套设置：把 city 集合的权限改成「所有用户可读，仅创建者可写」或「仅管理端可写」，
// 写操作一律走本云函数，别人就算绕过界面也写不进去。
//
// 部署：在开发者工具里右键 cloudfunctions/updateCityPhotos → 上传并部署（云端安装依赖），
// 或在该目录执行 npm install 后再上传。
//
// 环境：cloud1-d3g2jsmt2f7b64682

const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

const CITY = 'city';
const ADMINS = 'admins';

// 写死的 openid，优先级高于 admins 集合。
// 拿自己 openid 的办法：小程序启动后首页会打印一行「云开发身份 xxx」，
// 那串 xxx 就是。换手机/换微信号都不会变（同一小程序下 openid 唯一）。
const ADMIN_USER_IDS = ['oFCT06yM-bPKJJ-tAdIJIsKziI20'];

// admins 集合还是空的时候，允许第一个调用者自动登记为管理员。
// 首次部署靠它拿到管理员身份，登记完成后关掉，避免集合被清空时被陌生人抢占。
const ALLOW_FIRST_CLAIM = false;

// 网页版等非小程序端没有微信身份，用这个 token 走编辑通道。
// 在云函数「环境变量」里配置 EDIT_TOKEN，值随便起一个长随机串。
const EDIT_TOKEN = (process.env && process.env.EDIT_TOKEN) || '';

const MAX_PHOTOS = 200;
const MAX_FILE_LEN = 120;
const MAX_TITLE_LEN = 30;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const OBJECT_ID_RE = /^[a-fA-F0-9]{24}$/;

exports.main = async (event = {}, context = {}) => {
  // 小程序端调用时才有 OPENID；控制台调试、HTTP 网关调用时为空，属正常现象
  const wxContext = cloud.getWXContext();
  const openId = String((wxContext && wxContext.OPENID) || '');

  // 非小程序端用 token 换身份，方便以后网页版复用同一套写入逻辑
  const tokenOk = EDIT_TOKEN && event.token && event.token === EDIT_TOKEN;

  const userId = openId || (tokenOk ? 'token:' + EDIT_TOKEN.slice(0, 6) : '');

  // 只查询身份，不做任何写入
  if (event.action === 'check') {
    const admin = await isAdmin(userId, true);
    return {
      success: true,
      isAdmin: admin,
      userId: userId,
      openId: openId,
      // source 用来区分调用来源：client 是小程序端（有真实身份），
      // console 是控制台调试，那种情况下 userId 一定是空的
      source: openId ? 'client' : (tokenOk ? 'token' : 'console'),
    };
  }

  if (!userId) {
    return {
      success: false,
      code: 'FORBIDDEN',
      message: '拿不到调用者身份，请确认是从小程序端调用或带上 token',
      userId: '',
    };
  }

  const allowed = await isAdmin(userId, true);

  if (!allowed) {
    // 把 userId 一起返回，方便确认「我是谁」，也方便把它填进 ADMIN_USER_IDS
    return {
      success: false,
      code: 'FORBIDDEN',
      message: '当前用户没有编辑权限',
      userId: userId,
    };
  }

  const invalid = validate(event);
  if (invalid) {
    return { success: false, code: 'BAD_REQUEST', message: invalid };
  }

  const photos = event.photos.map(item => {
    const photo = { file: item.file };
    if (item.title) photo.title = item.title;
    if (item.date) photo.date = item.date;
    return photo;
  });

  const result = await updatePhotos(event.cityId, photos);

  if (result.notFound) {
    return {
      success: false,
      code: 'NOT_FOUND',
      message: '没有命中任何记录，请检查 cityId',
      detail: result.error,
    };
  }

  if (!result.ok) {
    return {
      success: false,
      code: 'DB_ERROR',
      message: '写入失败：' + result.error,
    };
  }

  return { success: true, affectedDocs: result.affected };
};

async function isAdmin(userId, allowClaim) {
  if (!userId) return false;
  if (ADMIN_USER_IDS.indexOf(userId) !== -1) return true;
  // token 通道不再查库，避免把 token 持有者登记进 admins
  if (userId.indexOf('token:') === 0) return true;

  const mine = await find(ADMINS, { userId });
  if (mine.length) return true;

  if (!ALLOW_FIRST_CLAIM || !allowClaim) return false;

  // 只有从来没有人登记过时才放行第一个人
  const everyone = await find(ADMINS, {});
  if (everyone.length) return false;

  try {
    await db.collection(ADMINS).add({
      data: { userId, createdAt: Date.now() },
    });
  } catch (err) {
    console.error('登记管理员失败', err);
    return false;
  }

  return true;
}

// 先确认记录存在，再写入。云开发的 doc().update() 对不存在的记录不会报错，
// 只返回 updated: 0，所以必须先用 get() 定位，否则会「静默写空」还以为成功了
async function updatePhotos(cityId, photos) {
  try {
    const doc = await db.collection(CITY).doc(cityId).get();
    if (!doc || !doc.data) {
      return { ok: false, notFound: true, error: '记录不存在' };
    }
  } catch (err) {
    // _id 在库里可能被存成了别的类型，退化成按字段查一遍
    const hit = await find(CITY, { _id: cityId }, 1);
    if (!hit.length) {
      return { ok: false, notFound: true, error: String(err && err.message || err).slice(0, 200) };
    }
  }

  try {
    const res = await db.collection(CITY).doc(cityId).update({
      data: { photos },
    });

    // updated 只要不是明确的 0 就当成功。历史教训：解析不到 affectedDocs
    // 就误报「没命中」，实际上库已经写进去了
    const updated = res && res.stats && res.stats.updated;
    return { ok: updated !== 0, affected: typeof updated === 'number' ? updated : 1 };
  } catch (err) {
    return {
      ok: false,
      error: String((err && err.message) || err).slice(0, 200),
    };
  }
}

async function find(collection, query, limit) {
  try {
    let q = db.collection(collection).where(query);
    if (limit) q = q.limit(limit);
    const res = await q.get();
    return Array.isArray(res && res.data) ? res.data : [];
  } catch (err) {
    console.error('find 失败', err);
    return [];
  }
}

// 参数校验：小程序端传什么都不能信，字段的长度和格式在这里再卡一遍
function validate(args) {
  if (!args.cityId || !OBJECT_ID_RE.test(String(args.cityId))) {
    return 'cityId 不合法';
  }
  if (!Array.isArray(args.photos) || !args.photos.length) {
    return 'photos 不能为空';
  }
  if (args.photos.length > MAX_PHOTOS) {
    return '照片数量超出上限';
  }

  for (const item of args.photos) {
    if (!item || typeof item.file !== 'string' || !item.file.trim()) {
      return '每张照片都必须有 file';
    }
    if (item.file.length > MAX_FILE_LEN) {
      return 'file 过长';
    }
    if (item.title != null) {
      if (typeof item.title !== 'string' || item.title.length > MAX_TITLE_LEN) {
        return 'title 不合法';
      }
    }
    if (item.date != null && item.date !== '') {
      if (typeof item.date !== 'string' || !DATE_RE.test(item.date)) {
        return 'date 必须是 YYYY-MM-DD';
      }
    }
  }

  return '';
}
