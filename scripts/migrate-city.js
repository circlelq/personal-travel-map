// 把 city 集合从旧格式迁移到新格式
//
// 用法：node scripts/migrate-city.js <旧导出文件> [输出文件]
// 输出 NDJSON（每行一个文档），可直接拿到 EMAS Serverless 控制台导入。
//
// 为什么到访日期要手写：旧数据的 pinyin 字段对深圳/北京/香港三城存的是占位值
// 2024-12-25，不是真实日期，脚本无从判断哪个是真的，所以一律以 VISITS 为准。

// 到访日期，新的在前。留空的城市迁移后没有日期，排序时排在最后。
// 深圳与香港的日期来自各自照片的图注，悉尼来自旧 pinyin 里那个真日期。
const VISITS = {
  '深圳': ['2023-02-25', '2021-09-05'],
  '北京': [], // 常住地，不算到访，有意留空
  '香港': ['2024-10-12', '2024-03-23'],
  '悉尼': ['2025-07-16'],
};

// 拼音用于搜索，别名可留空
const META = {
  '深圳': { pinyin: 'shenzhen', alias: ['sz'], country: '中国', region: '广东' },
  '北京': { pinyin: 'beijing', alias: ['bj'], country: '中国', region: '北京' },
  '香港': { pinyin: 'xianggang', alias: ['hk'], country: '中国', region: '香港' },
  '悉尼': { pinyin: 'xini', alias: ['sydney'], country: '澳大利亚', region: '新南威尔士' },
};

// 旧坐标存的是城市中心，只有悉尼那个点本身就是歌剧院，单独给它起名
const LOCATION_NAMES = {
  '悉尼': '悉尼歌剧院',
};

const fs = require('fs');

const source = process.argv[2];
const target = process.argv[3] || 'city.new.ndjson';

if (!source) {
  console.error('用法: node scripts/migrate-city.js <旧导出文件> [输出文件]');
  process.exit(1);
}

const documents = fs.readFileSync(source, 'utf8')
  .split('\n')
  .filter(line => line.trim())
  .map(line => JSON.parse(line));

const converted = documents.map(raw => {
  const name = raw.name;
  const meta = META[name] || {};

  // markers 对象 → locations 数组
  const locations = Object.keys(raw.markers || {}).map(key => {
    const coordinates = raw.markers[key].coordinates;
    return {
      lat: coordinates[0],
      lng: coordinates[1],
      name: LOCATION_NAMES[name] || name,
    };
  });

  // photo 二维数组 → photos 对象数组
  const photos = (raw.photo || []).map(arr => {
    const item = { file: arr[0] };
    if (arr[1]) item.title = arr[1];
    if (arr[2]) item.date = arr[2];
    return item;
  });

  // officialAccount → links，顺带把 ObjectId 的 xhs.id 转成字符串
  const account = raw.officialAccount || {};
  const links = {};
  if (account.bili) links.bili = account.bili;
  if (account.xhs) {
    links.xhs = {
      id: account.xhs.id && account.xhs.id.$oid
        ? account.xhs.id.$oid
        : String(account.xhs.id),
      xsecToken: account.xhs.xsecToken || '',
    };
  }

  return {
    _id: raw._id,
    name: name,
    pinyin: meta.pinyin || '',
    alias: meta.alias || [],
    country: meta.country || '',
    region: meta.region || '',
    visits: VISITS[name] || [],
    locations: locations,
    photos: photos,
    links: links,
  };
});

fs.writeFileSync(target, converted.map(item => JSON.stringify(item)).join('\n') + '\n');

converted.forEach(item => {
  const missing = [];
  if (!item.visits.length) missing.push('到访日期');
  if (!item.pinyin) missing.push('拼音');
  console.log(
    item.name +
    '  地点' + item.locations.length +
    '  照片' + item.photos.length +
    (missing.length ? '  缺: ' + missing.join('/') : '')
  );
});

console.log('\n已生成 ' + target);
