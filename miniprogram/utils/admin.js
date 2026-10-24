// 管理员相关：编辑权限的判定一律由云函数说了算，客户端只负责展示结果

const FUNCTION_NAME = 'updateCityPhotos';

// 云开发的 callFunction 把返回值放在 res.result 里，偶尔是 JSON 字符串，
// 这里统一解开，调用方只管拿业务字段
function unwrap(res) {
  let body = res && res.result;

  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (err) {
      body = {};
    }
  }

  return body && typeof body === 'object' ? body : {};
}

function call(data) {
  return wx.cloud.callFunction({
    name: FUNCTION_NAME,
    data: data,
  }).then(unwrap);
}

// 只查询当前用户能不能编辑，不写库
export function checkAdmin() {
  return call({
    action: 'check',
  });
}

// 提交照片改动，服务端会再校验一遍身份和参数
export function updatePhotos(cityId, photos) {
  return call({
    cityId: cityId,
    photos: photos,
  });
}
