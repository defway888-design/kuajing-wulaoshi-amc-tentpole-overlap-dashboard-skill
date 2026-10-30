#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');

const TEMPLATE = path.join(__dirname, '..', 'assets', 'dashboard_template.html');
const TEMPLATE_SHA256 = 'd96f02f741a13dcad215d5e107d92aee7472f2b4ad059d9a302fe756e4d57628';
const STAGES = ['预热', '活动', '返场'];
const ORDER = [
  { mask: 1, id: 'up', name: '仅预热' },
  { mask: 2, id: 'event', name: '仅活动' },
  { mask: 4, id: 'out', name: '仅返场' },
  { mask: 3, id: 'up-event', name: '预热 + 活动' },
  { mask: 7, id: 'all', name: '预热 + 活动 + 返场' },
  { mask: 6, id: 'event-out', name: '活动 + 返场' },
  { mask: 5, id: 'up-out', name: '预热 + 返场' }
];
const FIELDS = [
  'tentpole_path', 'duration_days', 'impressions', 'unique_reach_purchase',
  'unique_reach_dpv', 'unique_viewers', 'unique_purchasers',
  'unique_ntb_purchasers', 'dpv', 'sales', 'ntb_sales', 'ad_spend', 'roas',
  'unique_reach_percentage', 'sales_percentage',
  'unique_ntb_purchasers_percentage', 'average_daily_impressions',
  'dpv_rate', 'purchase_rate', 'ntb_rate'
];
const INTEGER_FIELDS = [
  'duration_days', 'impressions', 'unique_reach_purchase', 'unique_reach_dpv',
  'unique_viewers', 'unique_purchasers', 'unique_ntb_purchasers', 'dpv'
];
const SHARE_FIELDS = [
  'unique_reach_percentage', 'sales_percentage',
  'unique_ntb_purchasers_percentage'
];
const DERIVED_FIELDS = new Set([
  'roas', 'unique_reach_percentage', 'sales_percentage',
  'unique_ntb_purchasers_percentage', 'average_daily_impressions',
  'dpv_rate', 'purchase_rate', 'ntb_rate'
]);
const STAGE_BIT = { '预热': 1, '活动': 2, '返场': 4 };

function fail(message) { throw new Error(message); }
function sha256(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }

function parseCsv(text) {
  const grid = [];
  let row = [], field = '', quoted = false, quoteClosed = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { quoted = false; quoteClosed = true; }
      else field += c;
    } else if (c === '"') {
      if (field !== '' || quoteClosed) fail('CSV 中的引号位置无效');
      quoted = true;
    } else if (c === ',') {
      row.push(field); field = ''; quoteClosed = false;
    } else if (c === '\r' || c === '\n') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = ''; quoteClosed = false;
      if (row.some(value => value !== '')) grid.push(row);
      row = [];
    } else {
      if (quoteClosed && !/\s/u.test(c)) fail('CSV 引号结束后存在非法字符');
      field += c;
    }
  }
  if (quoted) fail('CSV 中存在未闭合的引号');
  if (field !== '' || row.length) { row.push(field); grid.push(row); }
  if (!grid.length) fail('CSV 文件为空');
  const headers = grid.shift().map(value => value.trim());
  if (headers.some(value => !value) || new Set(headers).size !== headers.length) fail('CSV 表头为空或重复');
  const missing = FIELDS.filter(name => !headers.includes(name));
  if (missing.length) fail(`不是预期的 AMC Tentpole Phase Overlap 表：缺少字段 ${missing.join('、')}`);
  if (grid.length !== 7) fail(`预期 7 行阶段组合，实际 ${grid.length} 行`);
  return { headers, rows: grid.map((cells, index) => {
    if (cells.length !== headers.length) fail(`CSV 第 ${index + 2} 行列数与表头不一致`);
    return Object.fromEntries(headers.map((header, position) => [header, cells[position]]));
  }) };
}

function pathTokens(raw) {
  const value = String(raw).trim();
  if (!value.startsWith('[') || !value.endsWith(']')) fail(`无法识别 tentpole_path：${raw}`);
  const inner = value.slice(1, -1).trim();
  if (!inner) fail('tentpole_path 为空');
  const tokens = inner.split(/[,，]/u).map(token => token.trim());
  if (tokens.length > 3 || tokens.some(token => !token)) fail(`tentpole_path 阶段分隔不明确：${raw}`);
  return tokens.map(token => {
    const numbered = token.match(/^([123])(?=$|[\s:：\-\p{Script=Han}])/u);
    return { key: numbered ? numbered[1] : token, example: token };
  });
}

function inspect(input) {
  const bytes = fs.readFileSync(input);
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/, '');
  const csv = parseCsv(text);
  const examples = new Map();
  const numeric = new Map();
  const inferredZero = [];
  const unresolvedBlank = [];
  const blankDerived = [];
  for (const [index, row] of csv.rows.entries()) {
    for (const field of FIELDS.slice(1)) {
      if (row[field].trim() === '') {
        if (field === 'duration_days') fail(`第 ${index + 2} 行 duration_days 为空；无法核对阶段覆盖天数`);
        row[field] = null;
        continue;
      }
      const number = Number(row[field]);
      if (!Number.isFinite(number) || number < 0) fail(`第 ${index + 2} 行 ${field} 不是非负数`);
      if (INTEGER_FIELDS.includes(field) && !Number.isInteger(number)) fail(`第 ${index + 2} 行 ${field} 应为整数`);
      if (field === 'duration_days' && number === 0) fail(`第 ${index + 2} 行覆盖天数必须大于 0`);
      if (SHARE_FIELDS.includes(field) && number > 1.0001) fail(`第 ${index + 2} 行 ${field} 超出 0–1 范围`);
      row[field] = number;
    }
    for (const [field, witness] of [
      ['dpv', 'unique_viewers'],
      ['sales', 'unique_purchasers'],
      ['ntb_sales', 'unique_ntb_purchasers']
    ]) {
      if (row[field] === null && row[witness] === 0) {
        row[field] = 0;
        inferredZero.push({ row: index + 2, path: row.tentpole_path, field, evidence: `${witness}=0` });
      }
    }
    for (const field of FIELDS.slice(1)) {
      if (row[field] === null) {
        (DERIVED_FIELDS.has(field) ? blankDerived : unresolvedBlank).push({ row: index + 2, path: row.tentpole_path, field });
      }
    }
    if (row.unique_ntb_purchasers !== null && row.unique_purchasers !== null && row.unique_ntb_purchasers > row.unique_purchasers) fail(`第 ${index + 2} 行新客购买人数超过总购买人数`);
    if (row.unique_purchasers !== null && row.unique_reach_purchase !== null && row.unique_purchasers > row.unique_reach_purchase) fail(`第 ${index + 2} 行购买人数超过购买口径触达人数`);
    if (row.ad_spend !== null && row.ad_spend > 0 && row.sales !== null && row.roas !== null && Math.abs(row.sales / row.ad_spend - row.roas) > 0.021) fail(`第 ${index + 2} 行 ROAS 与销售额／广告花费不一致`);
    const tokens = pathTokens(row.tentpole_path);
    if (new Set(tokens.map(token => token.key)).size !== tokens.length) fail(`同一 tentpole_path 中重复出现阶段：${row.tentpole_path}`);
    for (const token of tokens) {
      if (!examples.has(token.key)) examples.set(token.key, new Set());
      examples.get(token.key).add(token.example);
    }
    numeric.set(row, tokens);
  }
  const keys = [...examples].sort(([a], [b]) => a.localeCompare(b, 'zh-CN', { numeric: true }));
  return {
    input, source_sha256: sha256(bytes), csv,
    rows: csv.rows, tokens: numeric,
    phase_keys: keys.map(([key, names]) => ({ key, examples: [...names] })),
    inferred_zero: inferredZero,
    unresolved_blank: unresolvedBlank,
    blank_derived: blankDerived
  };
}

function normalize(inspection, mapping) {
  if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) fail('缺少用户确认的阶段映射');
  const observed = inspection.phase_keys.map(item => item.key);
  const provided = Object.keys(mapping);
  if (observed.some(key => !Object.hasOwn(mapping, key)) || provided.some(key => !observed.includes(key))) fail('阶段映射必须覆盖本次 CSV 中观察到的每个阶段键，且不能包含其他键');
  if (new Set(Object.values(mapping)).size !== 3 || Object.values(mapping).some(value => !STAGES.includes(value))) fail('阶段映射必须覆盖预热、活动、返场三个阶段');
  const byMask = new Map();
  for (const row of inspection.rows) {
    const bits = inspection.tokens.get(row).map(token => STAGE_BIT[mapping[token.key]]);
    if (new Set(bits).size !== bits.length) fail(`一个路径中的两个输入值被映射到同一阶段：${row.tentpole_path}`);
    const mask = bits.reduce((result, bit) => result | bit, 0);
    if (byMask.has(mask)) fail(`映射后阶段组合重复：${row.tentpole_path}`);
    byMask.set(mask, row);
  }
  for (const { mask } of ORDER) if (!byMask.has(mask)) fail(`映射后缺少 ${ORDER.find(item => item.mask === mask).name}`);
  const singleDays = { 1: byMask.get(1).duration_days, 2: byMask.get(2).duration_days, 4: byMask.get(4).duration_days };
  for (const { mask, name } of ORDER) {
    const expected = [1, 2, 4].reduce((total, bit) => total + (mask & bit ? singleDays[bit] : 0), 0);
    if (byMask.get(mask).duration_days !== expected) fail(`${name} 的覆盖天数与组成阶段不一致`);
  }
  return ORDER.map(({ mask, id, name }) => {
    const row = byMask.get(mask);
    return {
      id, path: row.tentpole_path, name,
      days: row.duration_days, reach: row.unique_reach_purchase,
      reachDpv: row.unique_reach_dpv, viewers: row.unique_viewers,
      buyers: row.unique_purchasers, ntbBuyers: row.unique_ntb_purchasers,
      sales: row.sales, ntbSales: row.ntb_sales, spend: row.ad_spend,
      impressions: row.impressions, dpv: row.dpv
    };
  });
}

function build(input, mapFile, output) {
  if (path.resolve(input) === path.resolve(output) || path.resolve(output) === path.resolve(TEMPLATE)) fail('输出路径不能覆盖输入 CSV 或 Skill 模板');
  const inspection = inspect(input);
  const mapping = JSON.parse(fs.readFileSync(mapFile, 'utf8').replace(/^\uFEFF/, ''));
  const data = normalize(inspection, mapping);
  const templateBytes = fs.readFileSync(TEMPLATE);
  if (sha256(templateBytes) !== TEMPLATE_SHA256) fail('固定看板模板已改动；请使用原版 Skill 模板');
  const template = templateBytes.toString('utf8');
  if (template.split('__TENTPOLE_DATA__').length !== 2) fail('看板模板的数据占位符异常');
  const html = template.replace('__TENTPOLE_DATA__', JSON.stringify(data).replace(/</g, '\\u003c'));
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  if (!script) fail('生成看板缺少嵌入脚本');
  new vm.Script(script);
  if (/<(?:script|link)[^>]+(?:src|href)=["']https?:/i.test(html)) fail('生成看板意外依赖外部脚本或样式');
  fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
  fs.writeFileSync(output, html, 'utf8');
  const saved = fs.readFileSync(output, 'utf8');
  if (saved !== html) fail('看板写入后校验失败');
  const sum = field => data.reduce((total, item) => total + item[field], 0);
  const completeSum = field => data.every(item => item[field] !== null) ? sum(field) : null;
  const sales = completeSum('sales');
  const spend = completeSum('spend');
  return {
    output: path.resolve(output), source_sha256: inspection.source_sha256,
    template_sha256: TEMPLATE_SHA256, rows: data.length, phase_map: mapping,
    inferred_zero: inspection.inferred_zero, unresolved_blank: inspection.unresolved_blank, blank_derived: inspection.blank_derived,
    sales, ad_spend: spend,
    unique_reach_purchase: completeSum('reach'), unique_purchasers: completeSum('buyers'),
    roas: sales !== null && spend !== null && spend > 0 ? sales / spend : null
  };
}

function argument(name) {
  const prefix = `--${name}=`;
  return process.argv.find(value => value.startsWith(prefix))?.slice(prefix.length);
}

try {
  const command = process.argv[2];
  const input = argument('input');
  if (!input) fail('请提供 --input=已上传CSV路径');
  if (command === 'inspect') {
    const result = inspect(input);
    console.log(JSON.stringify({ source_sha256: result.source_sha256, row_count: result.rows.length, column_count: result.csv.headers.length, phase_keys: result.phase_keys, tentpole_paths: result.rows.map(row => row.tentpole_path), inferred_zero: result.inferred_zero, unresolved_blank: result.unresolved_blank, blank_derived: result.blank_derived }, null, 2));
  } else if (command === 'build') {
    const mapFile = argument('map-file');
    const output = argument('output');
    if (!mapFile || !output) fail('生成看板前必须提供 --map-file=已确认映射JSON路径 和 --output=输出HTML路径');
    console.log(JSON.stringify(build(input, mapFile, output), null, 2));
  } else fail('命令应为 inspect 或 build');
} catch (error) {
  console.error(`跨境吴老师当前无法继续生成 Tentpole Phase Overlap 看板：${error.message}`);
  process.exitCode = 1;
}
