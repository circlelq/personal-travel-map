// 城市文档归一化
//
// 库里的文档可能是迁移前的旧格式（markers 对象、photo 二维数组、officialAccount、
// pinyin 存日期），也可能是迁移后的新格式（locations / photos / links / visits）。
// 这里统一成一种结构，页面只认归一化后的结果，迁移前后都不用改页面逻辑。

const COS_BASE = 'https://city-1257850266.cos.ap-guangzhou.myqcloud.com/';
const COS_AVATAR = COS_BASE + '%E5%A4%B4%E5%83%8F/';
const COS_PREVIEW = COS_BASE + '%E9%A2%84%E8%A7%88%E5%9B%BE/';
const COS_ORIGINAL = COS_BASE + '%E5%8E%9F%E5%9B%BE/';

// 旧格式里 pinyin 存的是日期，新格式存的是拼音，用它区分
const DATE_PREFIX = /^\d{4}-\d{1,2}-\d{1,2}/;

// 归一化成 YYYY-MM-DD，顺带容忍 2024-3-2 这种写法
function parseDate(value) {
  if (!value) return '';
  const matched = String(value).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!matched) return '';

  const month = ('0' + matched[2]).slice(-2);
  const day = ('0' + matched[3]).slice(-2);
  return matched[1] + '-' + month + '-' + day;
}

export function normalizeCity(raw) {
  if (!raw) return null;

  // 坐标：新格式是 locations 数组，旧格式是名为 markers 的对象
  const rawLocations = (raw.locations || []).length
    ? raw.locations
    : Object.keys(raw.markers || {}).map(key => raw.markers[key]);
  const locations = (rawLocations || []).map(item => {
    const coordinates = (item || {}).coordinates || [];
    return {
      lat: Number(item && item.lat != null ? item.lat : coordinates[0]),
      lng: Number(item && item.lng != null ? item.lng : coordinates[1]),
      name: (item && item.name) || raw.name || '',
    };
  }).filter(point => isFinite(point.lat) && isFinite(point.lng) && (point.lat || point.lng));

  // 照片：新格式是对象数组，旧格式是二维数组 [文件名, 标题, 日期]
  const rawPhotos = (raw.photos || []).length
    ? raw.photos
    : (raw.photo || []).map(arr => ({
      file: arr[0],
      title: arr[1],
      date: arr[2],
    }));
  const photos = (rawPhotos || [])
    .filter(item => item && item.file)
    .map(item => ({
      file: item.file,
      title: item.title || '',
      date: parseDate(item.date),
    }));

  // 到访日期：新格式是 visits 数组，旧格式藏在 pinyin 里
  let visits = (raw.visits || []).map(parseDate).filter(Boolean);
  if (!visits.length && raw.pinyin && DATE_PREFIX.test(raw.pinyin)) {
    visits = [parseDate(raw.pinyin)];
  }
  visits.sort().reverse(); // 最近的排在最前

  // 外链：新格式叫 links，旧格式叫 officialAccount
  const rawLinks = raw.links || raw.officialAccount || {};
  const rawXhs = rawLinks.xhs || {};
  // xhs.id 一度存成了 ObjectId，取值时统一成字符串
  const xhsId = rawXhs.id && rawXhs.id.$oid ? rawXhs.id.$oid : rawXhs.id;
  const links = {
    bili: rawLinks.bili || '',
    xhs: xhsId ? {
      id: String(xhsId),
      xsecToken: rawXhs.xsecToken || '',
    } : null,
  };

  // 旧数据的 pinyin 存的是日期，那种情况当作没有拼音
  const pinyin = raw.pinyin && !DATE_PREFIX.test(raw.pinyin) ? raw.pinyin : '';

  // _id 有可能是 ObjectId 的扩展 JSON 形式，统一取成字符串，
  // 否则拼进页面路径会变成 [object Object]，详情页就打不开了
  const rawId = raw._id && raw._id.$oid ? raw._id.$oid : raw._id;

  return {
    _id: rawId ? String(rawId) : '',
    name: raw.name || '',
    pinyin: pinyin,
    alias: raw.alias || [],
    country: raw.country || '',
    region: raw.region || '',
    visits: visits,
    locations: locations,
    photos: photos,
    links: links,
  };
}

// 最近到访的城市排前面；都没有日期时按名称兜底
export function compareByLastVisit(a, b) {
  const dateA = (a.visits || [])[0] || '';
  const dateB = (b.visits || [])[0] || '';

  if (dateA !== dateB) {
    if (!dateA) return 1;
    if (!dateB) return -1;
    return dateB < dateA ? -1 : 1;
  }
  return (a.name || '') < (b.name || '') ? -1 : 1;
}

export function avatarUrl(name) {
  return COS_AVATAR + encodeURIComponent(name) + '.png';
}

export function previewUrl(cityName, fileName) {
  return COS_PREVIEW + encodeURIComponent(cityName) + '/' + encodeURIComponent(fileName) + '.jpg';
}

export function originalUrl(cityName, fileName) {
  return COS_ORIGINAL + encodeURIComponent(cityName) + '/' + encodeURIComponent(fileName) + '.jpg';
}

// 把关键字拆成单字，字与字之间允许任意字符，实现「模糊顺序匹配」
function buildPattern(keyword) {
  return '(.*)(' + keyword.split('').join(')(.*)(') + ')(.*)';
}

// 纯拉丁字母时按拼音 / 别名前缀匹配，否则按中文名模糊匹配。
// 每组按优先级排列，前一个不被服务端接受就用后一个。
//
// 这里只产出「查询描述」，不写具体的数据库语法：Mongo 风格的 $regex / $or
// 和云开发的 db.RegExp / _.or 写法不一样，由 utils/db.js 负责翻译。
// 好处是这段纯逻辑在小程序和网页版里都能原样复用。
export function buildCityQueries(keyword) {
  if (/^[a-zA-Z]+$/.test(keyword)) {
    return [
      // 第一选择：拼音或别名任一前缀命中
      {
        type: 'prefix',
        prefix: keyword,
      },
      // 备选：只按拼音前缀，某些环境下 or 查询不被接受
      {
        type: 'regex',
        field: 'pinyin',
        pattern: '^' + keyword,
        options: 'i',
      },
    ];
  }

  const pattern = buildPattern(keyword);
  return [{
    type: 'regex',
    field: 'name',
    pattern: pattern,
    options: 'i',
  }, {
    type: 'regex',
    field: 'name',
    pattern: pattern,
  }];
}

// 详情页首图沿用「城市同名封面」的约定
export function coverNameUrl(cityName, original) {
  const build = original ? originalUrl : previewUrl;
  return build(cityName, cityName);
}

// 列表封面与详情页首图保持一致，都用城市同名照片
export function coverUrl(city) {
  return coverNameUrl(city.name, false);
}

// 城市同名照片缺失时的兜底：首张照片，再没有就用头像
export function fallbackCoverUrl(city) {
  const first = (city.photos || [])[0];
  return first ? previewUrl(city.name, first.file) : avatarUrl(city.name);
}
