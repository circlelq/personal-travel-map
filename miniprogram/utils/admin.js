// 管理员相关：编辑权限的判定一律由云函数说了算，客户端只负责展示结果

const FUNCTION_NAME = 'updateCityPhotos';

// 云函数 invoke 的返回形态不统一：SDK 直接把 HTTP 响应体铺平返回，
// 函数返回值可能藏在 result 里，也可能就在顶层，还有可能是 JSON 字符串。
// 这里统一解开，调用方只管拿业务字段
export function unwrapFunctionResult(res) {
  if (!res) return {};

  let body = res.result !== undefined ? res.result : res;

  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (err) {
      return {};
    }
  }

  return body && typeof body === 'object' ? body : {};
}

// mpserverless 的授权在 App.onLaunch 里做，页面加载时往往还没结束。
// 不等它就发请求，云函数那边拿不到调用者身份，鉴权必然失败
export function whenAuthorized() {
  const app = getApp();
  return Promise.resolve(app && app.authReady ? app.authReady : null);
}

// 只查询当前用户能不能编辑，不写库
export function checkAdmin() {
  const app = getApp();

  return whenAuthorized().then(() => {
    return app.mpServerless.function.invoke(FUNCTION_NAME, {
      action: 'check',
    });
  }).then(unwrapFunctionResult);
}

// 提交照片改动，服务端会再校验一遍身份和参数
export function updatePhotos(cityId, photos) {
  const app = getApp();

  return whenAuthorized().then(() => {
    return app.mpServerless.function.invoke(FUNCTION_NAME, {
      cityId: cityId,
      photos: photos,
    });
  }).then(unwrapFunctionResult);
}
