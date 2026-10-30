// 城市文档归一化与图片地址拼装
//
// 这里的逻辑与 miniprogram/utils/city.js 保持一致：那份代码不依赖任何小程序
// 专有 API，所以可以直接搬到浏览器用。两边的数据格式必须同源，
// 改动时请同步修改，否则小程序和网页会渲染出不一样的结果。

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
      // spot 是可选的景点名，用来在详情页把同一个地方的照片放到一组；
      // 没填就归入「其他照片」，老数据不用改也能跑
      spot: item.spot ? String(item.spot).trim() : '',
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
  // 否则拼进 URL 会变成 [object Object]，详情页就打不开了
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

// 详情页首图沿用「城市同名封面」的约定
export function coverNameUrl(cityName, original) {
  const build = original ? originalUrl : previewUrl;
  return build(cityName, cityName);
}

export function coverUrl(city) {
  return coverNameUrl(city.name, false);
}

// 城市同名照片缺失时的兜底：首张照片，再没有就用头像
export function fallbackCoverUrl(city) {
  const first = (city.photos || [])[0];
  return first ? previewUrl(city.name, first.file) : avatarUrl(city.name);
}

// ---------------------------------------------------------------------------
// 照片分组
// ---------------------------------------------------------------------------

// 没有填 spot 的照片统一归入末尾一组，只有存在其他分组时才给它一个标题，
// 否则整座城市都没有分组信息时不显示标题条，直接铺开
const OTHER_SPOT = '其他照片';

// 把城市的照片按 spot 分成若干组，组内保持原始顺序。
//
// 规则：
//   1. 只认 spot 字段，不靠 title 或文件名猜（同名不同景点、景点名改了都会出错）
//   2. 组的顺序 = 该 spot 第一次出现的顺序，不去重也不重排
//   3. 没填 spot 的全部归入末尾一组；整座城市都没填时，这一组不带标题
//   4. 没填 spot 的照片彼此没有关联，各占满整行按原图比例显示
//   5. 填了 spot 的组走两列网格，组内最后一张落单时占满整行，避免右侧空半格
//
// 产出的是视图层直接能渲染的结构（含图片地址），页面不用再拼 URL。
export function groupPhotos(city) {
  const photos = (city && city.photos) || [];
  if (!photos.length) return [];

  const cityName = city.name || '';
  const named = [];
  const namedIndex = new Map();
  const others = [];

  photos.forEach(item => {
    const spot = item.spot || '';
    if (!spot) {
      others.push(item);
      return;
    }

    let group = namedIndex.get(spot);
    if (!group) {
      group = { name: spot, items: [] };
      namedIndex.set(spot, group);
      named.push(group);
    }
    group.items.push(item);
  });

  const groups = named.map(group => ({
    name: group.name,
    named: true,
    items: group.items,
  }));

  if (others.length) {
    groups.push({
      name: named.length ? OTHER_SPOT : '',
      named: false,
      items: others,
    });
  }

  return groups.map(group => ({
    key: group.name || '__all__',
    name: group.name,
    count: group.items.length,
    subtitle: buildSpotMeta(group.items),
    // wide 决定 photo 是否占满整行并按原图比例显示：
    // 没填 spot 的每张都是；填了的组只在最后一张落单时才让它占满
    photos: group.items.map((item, index) => ({
      wide: !group.named ||
        (index === group.items.length - 1 && group.items.length % 2 === 1),
      key: (group.name || 'photo') + '-' + index,
      preview: previewUrl(cityName, item.file),
      original: originalUrl(cityName, item.file),
      legend: [item.title, item.date].filter(Boolean).join(' · '),
    })),
  }));
}

// 组标题右侧的说明：张数 + 日期。日期不一致时显示到月为止的区间
function buildSpotMeta(items) {
  const parts = [items.length + ' 张'];

  const dates = items.map(item => item.date).filter(Boolean).sort();
  if (dates.length) {
    const first = dates[0];
    const last = dates[dates.length - 1];

    if (first === last) {
      parts.push(first);
    } else if (first.slice(0, 7) === last.slice(0, 7)) {
      // 同一个月内，省略重复的年月，只补后一个日号
      parts.push(first + ' ~ ' + last.slice(8));
    } else {
      parts.push(first.slice(0, 7) + ' ~ ' + last.slice(0, 7));
    }
  }

  return parts.join(' · ');
}

// ---------------------------------------------------------------------------
// 字幕与概览数字（详情页用，写法与小程序 cityDetail.js 一致）
// ---------------------------------------------------------------------------

// 封面下方的一行说明：所在地、最近到访、到访次数
export function buildSubtitle(city) {
  const parts = [];

  const place = [city.country, city.region].filter(Boolean).join(' · ');
  if (place) parts.push(place);

  if (city.visits.length) {
    let text = '最近到访 ' + city.visits[0];
    if (city.visits.length > 1) {
      text += '，共 ' + city.visits.length + ' 次';
    }
    parts.push(text);
  }

  return parts.join(' · ');
}

// 概览数字，为零的项不显示
export function buildStats(city) {
  const stats = [];

  if (city.photos.length) {
    stats.push({ value: city.photos.length, label: '张照片' });
  }
  if (city.visits.length) {
    stats.push({ value: city.visits.length, label: '次到访' });
  }
  if (city.locations.length) {
    stats.push({ value: city.locations.length, label: '个地点' });
  }

  return stats;
}
