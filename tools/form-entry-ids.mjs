#!/usr/bin/env node
/* =============================================================================
 *  把 Google 表單自動接上網站
 *
 *  用法：
 *    node tools/form-entry-ids.mjs "https://docs.google.com/forms/d/e/XXXX/viewform"
 *    node tools/form-entry-ids.mjs "https://docs.google.com/forms/d/XXXX/edit" --write
 *
 *  做的事：
 *    1. 抓取表單公開頁面（viewform）
 *    2. 解析 FB_PUBLIC_LOAD_DATA_ 取得每個題目的 entry.ID
 *    3. 依 js/config.js 的 formFieldTitles（中文題目標題）自動對應欄位
 *    4. 印出結果；加 --write 會直接改寫 js/config.js 的 form.action / form.entries
 *
 *  表單題目請依 SETUP.md 的順序與標題建立，對應才會成功。
 * ========================================================================== */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG_PATH = path.join(ROOT, 'js', 'config.js');

const args = process.argv.slice(2);
const url = args.find((a) => /^https?:\/\//.test(a));
const write = args.includes('--write');

if (!url) {
  console.error('用法: node tools/form-entry-ids.mjs <Google表單網址> [--write]');
  process.exit(1);
}

const viewUrl = url
  .replace(/\/edit(\?.*)?$/, '/viewform')
  .replace(/\/formResponse.*$/, '/viewform');

const res = await fetch(viewUrl, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
    'Accept-Language': 'zh-TW,zh;q=0.9',
  },
});
if (!res.ok) {
  console.error(`✗ 無法讀取表單（HTTP ${res.status}）。請確認表單已發布、且知道連結的人可以填寫。`);
  process.exit(1);
}
const html = await res.text();

/* ---- 1) 取出題目與 entry.ID ---- */
function extractArray(text, marker) {
  const start = text.indexOf(marker);
  if (start < 0) return null;
  const open = text.indexOf('[', start);
  let depth = 0, inStr = false, escNext = false;
  for (let i = open; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (escNext) escNext = false;
      else if (ch === '\\') escNext = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === '[') depth++;
    else if (ch === ']') { depth--; if (depth === 0) return JSON.parse(text.slice(open, i + 1)); }
  }
  return null;
}

const data = extractArray(html, 'FB_PUBLIC_LOAD_DATA_');
if (!data) {
  console.error('✗ 找不到表單資料（FB_PUBLIC_LOAD_DATA_）。請改用「傳送 → 連結」的 /viewform 網址。');
  process.exit(1);
}

const items = (data[1] && data[1][1]) || [];
const byTitle = {};
const walk = (node, out) => {
  if (typeof node === 'string' && /^entry\.\d+$/.test(node)) out.push(node);
  else if (Array.isArray(node)) node.forEach((n) => walk(n, out));
};
for (const item of items) {
  const title = String(item[1] ?? '').trim();
  const found = [];
  walk(item[4], found);
  if (title && found.length) byTitle[title] = found;
}

/* ---- 2) 讀出 config.js 裡的欄位標題對應 ---- */
const cfgText = fs.readFileSync(CONFIG_PATH, 'utf8');
const block = cfgText.match(/formFieldTitles\s*:\s*\{[\s\S]*?\}/);
const titles = block ? new Function(`return ${block[0].replace(/^formFieldTitles\s*:\s*/, '')}`)() : {};

/* ---- 3) 對應 ---- */
const entries = {};
const missing = [];
for (const [field, title] of Object.entries(titles)) {
  const hit = byTitle[title];
  if (hit) entries[field] = hit[0];
  else missing.push(`${field}（題目標題需為「${title}」）`);
}

/* ---- 4) 表單送出網址 ---- */
const actionMatch = html.match(/action="(https:\/\/docs\.google\.com\/forms\/[^"]*formResponse[^"]*)"/);
const action = actionMatch ? actionMatch[1].replace(/&amp;/g, '&') : '';
if (!action) {
  console.error('✗ 找不到 formResponse 網址，請確認表單為「知道連結的任何人」可填寫。');
}

console.log(`\n表單題目共 ${Object.keys(byTitle).length} 個：`);
for (const [t, ids] of Object.entries(byTitle)) console.log(`  • ${t} → ${ids.join(', ')}`);

console.log(`\n對應結果（${Object.keys(entries).length}/${Object.keys(titles).length}）：`);
for (const [f, e] of Object.entries(entries)) console.log(`  ✓ ${f.padEnd(12)} ${e}`);
if (missing.length) {
  console.log('\n未對應到的欄位（請在表單中新增相同標題的簡答題）：');
  missing.forEach((m) => console.log(`  ✗ ${m}`));
}

const generated = `    action: '${action}',
    formUrl: '${viewUrl}',
    entries: {
${Object.keys(titles).map((f) => `      ${f}:${' '.repeat(Math.max(1, 10 - f.length))}'${entries[f] || ''}',`).join('\n')}
    },`;

if (write && action) {
  const next = cfgText.replace(/form:\s*\{[\s\S]*?\n  \},/, `form: {\n${generated}\n  },`);
  if (next === cfgText) {
    console.error('\n✗ 無法自動改寫 config.js，請手動貼上上面印出的設定。');
  } else {
    fs.writeFileSync(CONFIG_PATH, next, 'utf8');
    console.log('\n✓ 已寫入 js/config.js');
  }
} else {
  console.log('\n把以下內容貼進 js/config.js 的 form: { ... }（或加 --write 自動寫入）：\n');
  console.log(`  form: {\n${generated}\n  },`);
}

if (missing.length) process.exitCode = 2;
