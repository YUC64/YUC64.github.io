#!/usr/bin/env node
/* =============================================================================
 *  把訂位名單的 CSV 轉成「公開用的雜湊檔」（不需要任何後端）
 *
 *  用法：
 *    node tools/make-reservation-hashes.mjs 訂位名單.csv
 *    node tools/make-reservation-hashes.mjs 訂位名單.csv --iterations 300000 --names
 *
 *  輸入：Google 試算表「檔案 → 下載 → CSV」。第一列是標題，需包含「電話／手機」
 *        （可選「姓名」）欄位名稱。電話可以是 0912345678 / 0912-345-678 / +886912345678。
 *  輸出：data/reservations.json —— 只放 PBKDF2 雜湊（預設不含姓名）。
 *
 *  ⚠ 隱私提醒（務必讀 SETUP.md）：
 *    這個檔案會公開在 GitHub Pages 上。雜湊過的電話號碼仍然可以被暴力反推——
 *    台灣手機號碼只有 09xxxxxxxx 一種格式（約 1 億組），用一張高階顯示卡搭配
 *    PBKDF2 20 萬次迭代，估計數十分鐘內就能反推出全部號碼。
 *    所以：只用於「不想架任何後端、且可接受這個風險」的情境；
 *    首選仍是 Apps Script 驗證（名單完全不用公開）。
 * ========================================================================== */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const args = process.argv.slice(2);
const csvPath = args.find((a) => !a.startsWith('--'));
const flag = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : dflt;
};
const iterations = Number(flag('--iterations', 200000));
const includeNames = args.includes('--names');
const outPath = flag('--out', 'data/reservations.json');

if (!csvPath) {
  console.error('用法: node tools/make-reservation-hashes.mjs <名單.csv> [--iterations 200000] [--names] [--out data/reservations.json]');
  process.exit(1);
}

/* ---- 極簡 CSV 解析（支援雙引號包住的欄位） ---- */
function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => String(x).trim() !== ''));
}

/** 0912345678 / 0912-345-678 / +886912345678 → 0912345678 */
function normPhone(v) {
  const d = String(v || '').replace(/\D/g, '');
  if (/^8869\d{8}$/.test(d)) return '0' + d.slice(3);
  if (/^9\d{8}$/.test(d)) return '0' + d;
  return d;
}

const csv = fs.readFileSync(csvPath, 'utf8').replace(/^\uFEFF/, '');
const rows = parseCsv(csv);
if (!rows.length) {
  console.error('✗ CSV 是空的');
  process.exit(1);
}
const head = rows[0].map((h) => String(h).trim());
const phoneCol = head.findIndex((h) => /電話|手機|phone|tel|mobile/i.test(h));
const nameCol = head.findIndex((h) => /姓名|名字|name/i.test(h));
const body = head.some((h) => /電話|手機|phone|tel|mobile/i.test(h)) ? rows.slice(1) : rows;
const pCol = phoneCol >= 0 ? phoneCol : 0;

if (pCol < 0) {
  console.error('✗ 找不到電話欄位（標題需含「電話」或「手機」）');
  process.exit(1);
}

const salt = crypto.randomBytes(16).toString('hex');
const entries = [];
const seen = new Set();
let bad = 0;

for (const r of body) {
  const phone = normPhone(r[pCol]);
  if (!/^09\d{8}$/.test(phone)) { bad++; continue; }
  if (seen.has(phone)) continue;
  seen.add(phone);
  const h = crypto.pbkdf2Sync(phone, salt, iterations, 32, 'sha256').toString('hex');
  const entry = { h };
  if (includeNames && nameCol >= 0) {
    const n = String(r[nameCol] || '').trim();
    if (n) entry.n = n;
  }
  entries.push(entry);
}

const out = {
  generatedAt: new Date().toISOString(),
  salt,
  iterations,
  count: entries.length,
  names: includeNames,
  entries: entries.sort((a, b) => (a.h < b.h ? -1 : 1)),
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out), 'utf8');

console.log(`✓ ${entries.length} 筆有效電話 → ${outPath}`);
if (bad) console.log(`  （略過 ${bad} 列格式不符的電話）`);
console.log(`  iterations=${iterations}  salt=${salt}`);
console.log('\n提醒：js/config.js 設定 reservation.mode = \'hashfile\' 才會啟用。');
console.log('風險：公開檔案可被暴力反推電話號碼，正式活動建議改用 Apps Script 驗證（見 SETUP.md）。');
