#!/usr/bin/env node
// 把 EMAS（阿里云小程序云）导出的数据，转成微信云开发控制台能直接导入的格式
//
// 用法：
//   node scripts/emas-to-cloudbase.js city.json admins.json
//   node scripts/emas-to-cloudbase.js ./emas-export/            # 整个目录
//   node scripts/emas-to-cloudbase.js city.json -o ./import     # 指定输出目录
//
// 输入支持两种形态：
//   1) 标准 JSON 数组：[{...}, {...}]
//   2) JSON Lines：每行一个 JSON 对象
//
// 输出：每个集合一个 .json 文件，每行一条记录。云开发控制台对导入文件有两个
// 硬要求，缺一个就拒绝：
//   1) 后缀必须是 .json 或 .csv —— 用 .jsonl 会被直接判定为格式不支持
//   2) 内容是 JSON Lines（每行一个独立对象），不能是 JSON 数组
// 单文件超过 --max-bytes（默认 8MB）或 --max-records（默认 1000 条）会自动
// 分片，命名如 city.1.json、city.2.json。
//
// 转换规则：
//   - {$oid: "xxx"} 摊平成 "xxx"。_id 必须是字符串，否则详情页路径会变成
//     [object Object]，云开发的 doc(_id) 也会定位不到
//   - {$date: "..."} 转成 ISO 字符串
//   - $numberLong / $numberInt / $numberDouble / $numberDecimal 转成普通数字

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
if (!args.length || args[0] === '-h' || args[0] === '--help') {
  console.log('用法: node scripts/emas-to-cloudbase.js <文件或目录...> [-o 输出目录]');
  process.exit(0);
}

let outDir = path.join(process.cwd(), 'cloudbase-import');
let maxBytes = 8 * 1024 * 1024;
let maxRecords = 1000;
let forceName = '';
const inputs = [];

for (let i = 0; i < args.length; i++) {
  if (args[i] === '-o') { outDir = args[++i]; continue; }
  if (args[i] === '-c') { forceName = args[++i]; continue; }
  if (args[i] === '--max-bytes') { maxBytes = Number(args[++i]); continue; }
  if (args[i] === '--max-records') { maxRecords = Number(args[++i]); continue; }
  inputs.push(args[i]);
}

// 从文件名推断集合名：city.json / city.jsonl / city-1.json → city。
// EMAS 控制台导出的文件名是「时间戳_UUID.json」，推断不出来，用 -c 手动指定
function collectionNameOf(file) {
  if (forceName) return forceName;
  return path.basename(file).replace(/\.(jsonl|json|csv)$/i, '').replace(/[-_]\d+$/, '');
}

function parseRecords(text, file) {
  const trimmed = text.trim();
  if (!trimmed) return [];

  if (trimmed[0] === '[') {
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) throw new Error(file + '：顶层不是数组');
    return parsed;
  }

  return trimmed.split(/\r?\n/).filter(Boolean).map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (err) {
      throw new Error(file + '：第 ' + (index + 1) + ' 行不是合法 JSON');
    }
  });
}

// 把扩展 JSON 摊平成云开发能直接吃的普通值
function flatten(value) {
  if (Array.isArray(value)) return value.map(flatten);

  if (value && typeof value === 'object') {
    const keys = Object.keys(value);

    if (keys.length === 1 && keys[0] === '$oid') return String(value.$oid);
    if (keys.length === 1 && keys[0] === '$date') return toIso(value.$date);
    if (keys.length === 1 && typeof value[keys[0]] === 'string' &&
        /^\$(numberLong|numberInt|numberDouble|numberDecimal)$/.test(keys[0])) {
      return Number(value[keys[0]]);
    }

    const out = {};
    for (const key of keys) out[key] = flatten(value[key]);
    return out;
  }

  return value;
}

function toIso(value) {
  if (typeof value === 'number') return new Date(value).toISOString();
  if (value && typeof value === 'object' && typeof value.$numberLong === 'string') {
    return new Date(Number(value.$numberLong)).toISOString();
  }
  return String(value);
}

const buckets = new Map();

for (const input of inputs) {
  const stat = fs.statSync(input);

  const files = stat.isDirectory()
    ? fs.readdirSync(input)
        .filter(name => /\.(json|jsonl)$/i.test(name))
        .map(name => path.join(input, name))
    : [input];

  if (!files.length) {
    console.warn('跳过（没有 json/jsonl 文件）：' + input);
    continue;
  }

  for (const file of files) {
    const records = parseRecords(fs.readFileSync(file, 'utf8'), file);
    const name = collectionNameOf(file);

    if (!buckets.has(name)) buckets.set(name, []);
    buckets.get(name).push(...records);

    console.log('读取 ' + file + ' → 集合 ' + name + '（' + records.length + ' 条）');
  }
}

fs.mkdirSync(outDir, { recursive: true });

const summary = [];

for (const [name, records] of buckets) {
  const cleaned = records.filter(Boolean).map(flatten);

  const missingId = cleaned.filter(item => !item._id).length;
  const dupIds = new Set();
  let dup = 0;
  for (const item of cleaned) {
    if (dupIds.has(item._id)) dup++;
    dupIds.add(item._id);
  }

  let part = 1;
  let buffer = [];
  let bytes = 0;

  const flush = () => {
    if (!buffer.length) return;
    const file = path.join(outDir, name + '.' + part + '.json');
    fs.writeFileSync(file, buffer.join('\n') + '\n');
    console.log('写出 ' + file + '（' + buffer.length + ' 条）');
    part++;
    buffer = [];
    bytes = 0;
  };

  for (const item of cleaned) {
    const line = JSON.stringify(item);
    buffer.push(line);
    bytes += Buffer.byteLength(line) + 1;

    if (bytes > maxBytes || buffer.length >= maxRecords) flush();
  }
  flush();

  summary.push({
    集合: name,
    条数: cleaned.length,
    缺_id: missingId,
    重复_id: dup,
  });
}

console.log('\n汇总：');
console.table(summary);
console.log('\n输出目录：' + outDir);
console.log('导入方式：云开发控制台 → 数据库 → 选择集合 → 导入 → 文件格式选 JSON → 上传 .json 文件');
console.log('注意：导入时「冲突处理」选「Insert」，已有 _id 的会原样保留；');
console.log('      如果提示 _id 冲突，说明该集合里已有同名记录，先清空再导。');
