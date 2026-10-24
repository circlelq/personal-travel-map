// 数据访问层：所有对 city 集合的读写都走这里
//
// 为什么要单独一层：
//   1. 小程序端一次最多只能读 20 条（云函数端 100 条），不循环分页的话
//      城市一多就会静默截断，首页只显示前 20 个，而且不会报错
//   2. 查询条件的构造方式（正则要用 db.RegExp、或查询要用 _.or）和 Mongo
//      $regex / $or 写法不一样，集中在一处改，页面不用关心
//   3. 以后网页版要复用同一套查询逻辑时，只改这个文件

import { buildCityQueries } from './city';

const CITY = 'city';

// 小程序端单次读取上限，写死 20
const PAGE_SIZE = 20;
// 分页保护：最多翻 50 页（1000 条），防止查不到末尾时死循环
const MAX_PAGES = 50;

function db() {
  return wx.cloud.database();
}

function collection() {
  return db().collection(CITY);
}

// 拉全量城市：循环分页直到取不满一页
export async function fetchAllCities() {
  const all = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    // 必须固定排序，否则不写 orderBy 时底层返回顺序不保证稳定，
    // skip 分页会重复或漏掉记录。首页的展示顺序由客户端排序决定，
    // 这里的排序只用来保证分页不重不漏
    const res = await collection()
      .orderBy('_id', 'asc')
      .skip(page * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .get();

    const list = (res && res.data) || [];
    all.push.apply(all, list);

    if (list.length < PAGE_SIZE) break;
  }

  return all;
}

// 按 _id 取单条。优先用 doc() 直取，取不到（比如 _id 存成了别的类型）
// 再退化成按字段查
export async function fetchCityById(id) {
  try {
    const res = await collection().doc(id).get();
    return res && res.data ? [res.data] : [];
  } catch (err) {
    const res = await collection().where({ _id: id }).limit(1).get();
    return (res && res.data) || [];
  }
}

// 按城市名精确取一条，搜索栏回车直达详情用
export async function fetchCityByName(name) {
  const res = await collection().where({ name: name }).limit(1).get();
  return (res && res.data) || [];
}

// 关键词搜索。buildCityQueries 会给出几组候选条件，逐个试：
// 查询报错或结果为空都换下一组，直到某一组真的查到东西
export async function searchCities(keyword) {
  const queries = buildCityQueries(keyword);
  let lastError = null;

  for (const query of queries) {
    const where = buildWhere(query);
    if (!where) continue;

    try {
      const res = await collection().where(where).limit(PAGE_SIZE).get();
      const list = (res && res.data) || [];
      if (list.length) return list;
    } catch (err) {
      // 比如基础库不支持某个正则选项，换下一种写法再试
      lastError = err;
      console.error('搜索条件不可用，尝试下一种', err);
    }
  }

  if (lastError) throw lastError;
  return [];
}

// 把 city.js 给出的查询描述翻译成云开发的 where 条件
function buildWhere(query) {
  const instance = db();
  const _ = instance.command;

  if (query.type === 'prefix') {
    // 拼音 / 别名前缀命中。alias 是数组，正则会去匹配数组里的每一项
    const prefix = instance.RegExp({
      regexp: '^' + query.prefix,
      options: 'i',
    });
    return _.or([{ pinyin: prefix }, { alias: prefix }]);
  }

  if (query.type === 'regex') {
    return {
      name: instance.RegExp({
        regexp: query.pattern,
        options: query.options || '',
      }),
    };
  }

  return null;
}
