#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { spawnSync } = require('child_process');

const runner = path.join(__dirname, 'tentpole_dashboard.cjs');
const fields = [
  'tentpole_path', 'duration_days', 'impressions', 'unique_reach_purchase',
  'unique_reach_dpv', 'unique_viewers', 'unique_purchasers',
  'unique_ntb_purchasers', 'dpv', 'sales', 'ntb_sales', 'ad_spend', 'roas',
  'unique_reach_percentage', 'sales_percentage',
  'unique_ntb_purchasers_percentage', 'average_daily_impressions',
  'dpv_rate', 'purchase_rate', 'ntb_rate'
];
const masks = [1, 2, 4, 3, 7, 6, 5];
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'amc-tentpole-skill-test-'));

function run(command, input, extras = []) {
  return spawnSync(process.execPath, [runner, command, `--input=${input}`, ...extras], { encoding: 'utf8' });
}
function writeCsv(file, labels, zeroMask = null, allZero = false) {
  const lines = [fields.join(',')];
  for (const mask of masks) {
    const tokens = [1, 2, 4].filter(bit => mask & bit).map(bit => labels[bit]);
    const spend = allZero || mask === zeroMask ? 0 : 50 + mask * 5;
    const sales = 100 + mask * 10;
    const row = {
      tentpole_path: `[${tokens.join(', ')}]`,
      duration_days: (mask & 1 ? 8 : 0) + (mask & 2 ? 3 : 0) + (mask & 4 ? 5 : 0),
      impressions: 1000 + mask * 100, unique_reach_purchase: 500 + mask * 10,
      unique_reach_dpv: 500 + mask * 10, unique_viewers: 20 + mask,
      unique_purchasers: 10 + mask, unique_ntb_purchasers: 5 + mask,
      dpv: 50 + mask, sales, ntb_sales: 90 + mask * 8, ad_spend: spend,
      roas: spend ? (sales / spend).toFixed(2) : 0,
      unique_reach_percentage: 0.1, sales_percentage: 0.1,
      unique_ntb_purchasers_percentage: 0.1,
      average_daily_impressions: 100, dpv_rate: 0.01,
      purchase_rate: 0.02, ntb_rate: 0.01
    };
    lines.push(fields.map(field => `"${String(row[field]).replace(/"/g, '""')}"`).join(','));
  }
  fs.writeFileSync(file, '\uFEFF' + lines.join('\r\n'), 'utf8');
}

class Element {
  constructor(tag) { this.tag = tag; this.attrs = {}; this.children = []; this.style = {}; this.dataset = {}; this.textContent = ''; this.innerHTML = ''; this.listeners = {}; this.hidden = false; }
  appendChild(child) { this.children.push(child); return child; }
  replaceChildren(...children) { this.children = children; }
  setAttribute(name, value) { this.attrs[name] = String(value); }
  getAttribute(name) { return this.attrs[name] ?? null; }
  removeAttribute(name) { delete this.attrs[name]; }
  addEventListener(name, listener) { this.listeners[name] = listener; }
}
function render(htmlFile) {
  const html = fs.readFileSync(htmlFile, 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert(script, 'embedded script exists');
  const ids = ['k-sales', 'k-spend', 'k-reach', 'k-roas', 'days-chart', 'volume-chart', 'phase-roas-chart', 'volume-readout', 'roas-spend-readout', 'detail-body', 'download-detail'];
  const elements = Object.fromEntries(ids.map(id => [id, new Element(id)]));
  const document = {
    getElementById: id => elements[id] ?? null,
    createElement: tag => new Element(tag),
    createElementNS: (namespace, tag) => new Element(tag),
    querySelectorAll: () => [],
    addEventListener() {}, body: new Element('body')
  };
  vm.runInNewContext(script, { document, window: { addEventListener() {} }, console });
  return elements;
}

try {
  const numericFile = path.join(dir, 'numbered.csv');
  writeCsv(numericFile, { 1: '1 任意预热名', 2: '2 任意活动名', 4: '3 任意返场名' });
  const inspection = run('inspect', numericFile);
  assert.strictEqual(inspection.status, 0, inspection.stderr);
  assert.deepStrictEqual(JSON.parse(inspection.stdout).phase_keys.map(item => item.key), ['1', '2', '3']);
  const mapFile = path.join(dir, 'mapping.json');
  fs.writeFileSync(mapFile, JSON.stringify({ '1': '预热', '2': '活动', '3': '返场' }), 'utf8');
  const output = path.join(dir, 'dashboard.html');
  let built = run('build', numericFile, [`--map-file=${mapFile}`, `--output=${output}`]);
  assert.strictEqual(built.status, 0, built.stderr);
  assert.strictEqual(JSON.parse(built.stdout).rows, 7);
  let ui = render(output);
  assert.strictEqual(ui['days-chart'].children.length, 7);
  assert.strictEqual(ui['detail-body'].children.length, 7);
  let chart = ui['phase-roas-chart'];
  assert.strictEqual(chart.children.filter(item => item.tag === 'rect' && item.attrs.class === 'volume-bar').length, 7);
  assert.strictEqual(chart.children.filter(item => item.tag === 'circle').length, 7);
  assert.strictEqual(ui['roas-spend-readout'].textContent, '');
  chart.children.find(item => item.attrs.role === 'button').listeners.click();
  assert.match(ui['roas-spend-readout'].textContent, /仅预热｜广告花费 55\.00 · ROAS 2\.00/);

  const chineseFile = path.join(dir, 'chinese.csv');
  writeCsv(chineseFile, { 1: '蓄水随机甲', 2: '爆发随机乙', 4: '收尾随机丙' });
  const chineseInspection = run('inspect', chineseFile);
  assert.strictEqual(chineseInspection.status, 0, chineseInspection.stderr);
  assert.deepStrictEqual(new Set(JSON.parse(chineseInspection.stdout).phase_keys.map(item => item.key)), new Set(['蓄水随机甲', '爆发随机乙', '收尾随机丙']));
  fs.writeFileSync(mapFile, JSON.stringify({ '蓄水随机甲': '活动', '爆发随机乙': '预热', '收尾随机丙': '返场' }), 'utf8');
  built = run('build', chineseFile, [`--map-file=${mapFile}`, `--output=${output}`]);
  assert.strictEqual(built.status, 0, built.stderr);
  assert.strictEqual(render(output)['detail-body'].children.length, 7);

  const zeroFile = path.join(dir, 'zero.csv');
  writeCsv(zeroFile, { 1: '1', 2: '2', 4: '3' }, 1);
  fs.writeFileSync(mapFile, JSON.stringify({ '1': '预热', '2': '活动', '3': '返场' }), 'utf8');
  built = run('build', zeroFile, [`--map-file=${mapFile}`, `--output=${output}`]);
  assert.strictEqual(built.status, 0, built.stderr);
  ui = render(output);
  assert.strictEqual(ui['phase-roas-chart'].children.filter(item => item.tag === 'circle').length, 6);
  ui['phase-roas-chart'].children.find(item => item.attrs.role === 'button').listeners.click();
  assert.match(ui['roas-spend-readout'].textContent, /ROAS —/);

  writeCsv(zeroFile, { 1: '1', 2: '2', 4: '3' }, null, true);
  built = run('build', zeroFile, [`--map-file=${mapFile}`, `--output=${output}`]);
  assert.strictEqual(built.status, 0, built.stderr);
  ui = render(output);
  assert.strictEqual(ui['k-roas'].textContent, '—');
  assert.strictEqual(ui['phase-roas-chart'].children.filter(item => item.tag === 'circle').length, 0);

  const badFile = path.join(dir, 'bad.csv');
  fs.writeFileSync(badFile, 'tentpole_path,sales\n[1],10', 'utf8');
  assert.notStrictEqual(run('inspect', badFile).status, 0, 'missing fields must fail');
  fs.writeFileSync(mapFile, JSON.stringify({ '1': '预热', '2': '活动', '3': '未知' }), 'utf8');
  assert.notStrictEqual(run('build', numericFile, [`--map-file=${mapFile}`, `--output=${output}`]).status, 0, 'unconfirmed stage must fail');
  console.log('Self-test passed: numeric and arbitrary Chinese paths, permutation, zero spend, chart interaction, missing fields, invalid mapping.');
} finally {
  if (path.dirname(dir) !== os.tmpdir() || !path.basename(dir).startsWith('amc-tentpole-skill-test-')) throw new Error('Unsafe temporary cleanup target');
  fs.rmSync(dir, { recursive: true, force: true });
}
