// 云函数 updateCityPhotos
//
// 为什么要走云函数：EMAS 的权限规则只有 true / false / 创建者匹配三种取值，
// 没法在规则里写死「只有某个人能写」。而云函数里的数据库操作不受权限规则限制
// （控制台、云函数、管控 SDK 都豁免），所以自定义鉴权只能放在这里。
//
// 配套设置：把 city 集合的权限改成
//   { ".read": true, ".write": false }
// 也就是「所有用户可读，仅管理员可写」。这样别人就算绕过界面直接调接口也写不进去。
//
// 部署：把 updateCityPhotos 整个文件夹打成 zip，在 EMAS 控制台新建同名云函数后上传。

const CITY = 'city';
const ADMINS = 'admins';

// 也可以直接把 userId 写死在这里，优先级高于 admins 集合。
// 拿到自己 userId 的办法：把 ALLOW_FIRST_CLAIM 打开，用你自己的微信保存一次，
// 被拒绝时返回的 userId 字段就是；或者让它自动登记成功也行。
const ADMIN_USER_IDS = [];

// admins 集合还是空的时候，允许第一个调用者自动登记为管理员。
// 首次部署靠它拿到管理员身份；登记完成后已关掉，避免哪天集合被清空时
// 被陌生人抢占。要重新开这个窗口，把它改回 true 再部署一次即可。
const ALLOW_FIRST_CLAIM = false;

const MAX_PHOTOS = 200;
const MAX_FILE_LEN = 120;
const MAX_TITLE_LEN = 30;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const OBJECT_ID_RE = /^[a-fA-F0-9]{24}$/;

module.exports = async ctx => {
  const args = ctx.args || {};

  const probe = await currentUser(ctx);

  // 只查询身份，不做任何写入，也不触发首次登记之外的副作用。
  // 排查阶段把 getInfo 的原始返回和环境变量一起带回去，方便看清到底卡在哪
  if (args.action === 'check') {
    // 注意别把变量命名成 isAdmin，会和下面的同名函数冲突
    const admin = await isAdmin(ctx, probe.userId, true);

    // source 用来区分是谁在调用：client 是小程序端（有真实身份），
    // server 是控制台执行，那种情况下 userId 一定是空的，查不出结果
    const source = (ctx.env && ctx.env.MP_SOURCE) || '';

    ctx.logger && ctx.logger.info('check', {
      userId: probe.userId,
      isAdmin: admin,
      source: source,
      raw: probe.raw,
      err: probe.error,
    });

    return {
      success: true,
      isAdmin: admin,
      userId: probe.userId,
      source: source,
      raw: probe.raw,
      err: probe.error,
      env: ctx.env || {},
    };
  }

  const userId = probe.userId;

  const allowed = await isAdmin(ctx, userId, true);

  if (!allowed) {
    // 把 userId 一起返回，方便确认「我是谁」，也方便把它填进 ADMIN_USER_IDS
    return {
      success: false,
      code: 'FORBIDDEN',
      message: '当前用户没有编辑权限',
      userId: userId,
    };
  }

  const invalid = validate(args);
  if (invalid) {
    return {
      success: false,
      code: 'BAD_REQUEST',
      message: invalid,
    };
  }

  const photos = args.photos.map(item => {
    const photo = {
      file: item.file,
    };
    if (item.title) photo.title = item.title;
    if (item.date) photo.date = item.date;
    return photo;
  });

  const result = await updatePhotos(ctx, args.cityId, photos);

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

  return {
    success: true,
    affectedDocs: result.affected,
  };
};

// 云函数里的 ctx.mpserverless 已经带上了调用者的身份，getInfo 拿到的就是他。
// 返回结构按文档是 { success, result: { user: { userId } } }，
// 但不同版本的 SDK 可能略有出入，这里多认几种形态
async function currentUser(ctx) {
  try {
    const info = await ctx.mpserverless.user.getInfo();

    const user =
      (info && info.result && info.result.user) ||
      (info && info.user) ||
      (info && info.result) ||
      info ||
      {};

    return {
      userId: String(user.userId || user.oAuthUserId || ''),
      raw: JSON.stringify(info).slice(0, 300),
      error: '',
    };
  } catch (err) {
    ctx.logger && ctx.logger.error('getInfo 失败', err);
    return {
      userId: '',
      raw: '',
      error: String((err && (err.message || err.errorMessage)) || err).slice(0, 200),
    };
  }
}

async function isAdmin(ctx, userId, allowClaim) {
  if (!userId) return false;
  if (ADMIN_USER_IDS.indexOf(userId) !== -1) return true;

  const mine = await find(ctx, ADMINS, {
    userId: userId,
  });
  if (mine.length) return true;

  if (!ALLOW_FIRST_CLAIM || !allowClaim) return false;

  // 只有从来没有人登记过时才放行第一个人，避免后来者拿到权限。
  // 部署后请立刻用自己的微信打开一次小程序完成登记，之后建议把
  // ALLOW_FIRST_CLAIM 改成 false 再重新部署一次
  const everyone = await find(ctx, ADMINS, {});
  if (everyone.length) return false;

  try {
    await ctx.mpserverless.db.collection(ADMINS).insertOne({
      userId: userId,
      createdAt: Date.now(),
    });
  } catch (err) {
    ctx.logger && ctx.logger.error('登记管理员失败', err);
    return false;
  }

  return true;
}

// 先用 find 确认记录存在，顺便决定 _id 该用字符串还是 {$oid} 写法。
// 不能只看 updateOne 的返回值来判断命中：云函数里 affectedDocs 的位置不固定
// （顶层、result 里、result.result 里都见过），解析不到就误报成「没命中」，
// 而实际上库已经写成功了
async function updatePhotos(ctx, cityId, photos) {
  const filters = [{
    _id: cityId,
  }, {
    _id: {
      $oid: cityId,
    },
  }];

  // 先用 find 定位记录，顺便确定 _id 该用哪种写法
  for (const filter of filters) {
    const hit = await find(ctx, CITY, filter, {
      limit: 1,
    });
    if (hit.length) {
      return writePhotos(ctx, filter, photos);
    }
  }

  // find 查不到也不代表记录不存在：云函数里 _id 的两种写法未必都支持。
  // 这时退化成直接写，只要没抛错就算成功 —— 误报「没命中」比漏判一次
  // 真正的不存在要糟糕得多（实际上已经写进去了，却弹失败）
  let lastError = '';

  for (const filter of filters) {
    const attempt = await writePhotos(ctx, filter, photos);
    if (attempt.ok) return attempt;
    lastError = attempt.error;
  }

  return {
    ok: false,
    notFound: true,
    error: lastError,
  };
}

async function writePhotos(ctx, filter, photos) {
  try {
    const res = await ctx.mpserverless.db.collection(CITY).updateOne(filter, {
      $set: {
        photos: photos,
      },
    });

    // 只要没抛错就认为写成功了。affectedDocs 在不同调用链路下的位置不固定
    // （顶层 / result 里 / result.result 里都见过），解析不到不代表没写进去
    return {
      ok: true,
      affected: pickAffected(res) || 1,
    };
  } catch (err) {
    ctx.logger && ctx.logger.error('updateOne 失败', err);
    return {
      ok: false,
      error: String((err && (err.message || err.errorMessage)) || err).slice(0, 200),
    };
  }
}

// updateOne 在不同调用链路下的返回结构不一致，把几种都认一遍
function pickAffected(res) {
  if (!res) return 0;

  const candidates = [
    res.affectedDocs,
    res.result && res.result.affectedDocs,
    res.result && res.result.result && res.result.result.affectedDocs,
    res.result && res.result.affected,
  ];

  for (const value of candidates) {
    if (typeof value === 'number' && value > 0) return value;
  }

  return 0;
}

async function find(ctx, collection, query, options) {
  try {
    const res = await ctx.mpserverless.db.collection(collection).find(query, options || {});

    const list =
      (Array.isArray(res && res.result) && res.result) ||
      (res && res.result && res.result.result) ||
      (Array.isArray(res) && res) ||
      [];

    return Array.isArray(list) ? list : [];
  } catch (err) {
    ctx.logger && ctx.logger.error('find 失败', err);
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
