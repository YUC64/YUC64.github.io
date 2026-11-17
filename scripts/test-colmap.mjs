/**
 * 用「你表上的真實標題」模擬一次寫入，看每個值實際落在哪一欄
 *   node scripts/test-colmap.mjs
 */
import fs from 'fs';

class Sheet {
  constructor(name, header) { this.name = name; this.header = header.slice(); this.rows = []; }
  getLastRow() { return 1 + this.rows.length; }
  getLastColumn() { return this.header.length; }
  getRange(r, c, nr = 1, nc = 1) {
    const self = this;
    return {
      getValues() {
        if (r === 1) return [self.header.slice(c - 1, c - 1 + nc).concat(Array(Math.max(0, nc - self.header.length + c - 1)).fill(''))].map((x) => x.slice(0, nc));
        const out = [];
        for (let i = 0; i < nr; i++) {
          const row = self.rows[r - 2 + i] || [];
          const line = [];
          for (let j = 0; j < nc; j++) line.push(row[c - 1 + j] === undefined ? '' : row[c - 1 + j]);
          out.push(line);
        }
        return out;
      },
      setValues(vals) {
        if (r === 1) { vals[0].forEach((v, i) => { self.header[c - 1 + i] = v; }); return; }
        for (let i = 0; i < vals.length; i++) {
          self.rows[r - 2 + i] = self.rows[r - 2 + i] || [];
          vals[i].forEach((v, j) => { self.rows[r - 2 + i][c - 1 + j] = v; });
        }
      },
      setNumberFormat() {}, setFontWeight() { return this; }, setBackground() { return this; }, setWrap() { return this; },
      setValue(v) { this.setValues([[v]]); },
    };
  }
  insertColumnBefore(at) { this.header.splice(at - 1, 0, ''); this.rows.forEach((r) => r.splice(at - 1, 0, '')); }
  deleteRow(i) { this.rows.splice(i - 2, 1); }
  clear() { this.rows = []; }
  getSheetName() { return this.name; }
}

// ← 這是 peek=1 回傳的真實表頭（訂單分頁）
const MAIN_HEADER = ['訂單編號', '狀態', '動作', '姓名', '電話', '預計取餐時間', '用餐人數', '套餐內容', '套餐金額', '單點內容', '單點金額', '服務費', '總金額', '備註', '最後更新', '車號', '', '', '修改權限', '原始資料'];
const AR_HEADER = ['訂單編號', '狀態', '動作', '姓名', '電話', '預計取餐時間', '用餐人數', '套餐內容', '套餐金額', '單點內容', '單點金額', '服務費', '總金額', '備註', '車號', '最後更新', '', ''];

const main = new Sheet('訂單', MAIN_HEADER);
const arc = new Sheet('已取消', AR_HEADER);

const sheets = { 訂單: main, 已取消: arc };
const ss = {
  getSheetByName: (n) => sheets[n] || null,
  insertSheet: (n) => { sheets[n] = new Sheet(n, MAIN_HEADER); return sheets[n]; },
  getSheets: () => [main],
};
const range1 = () => ({ setNumberFormat() {}, setFontWeight() { return this; }, setBackground() { return this; }, setWrap() { return this; }, setValue() {}, setValues() {}, getValue: () => '' });
main.getRange = ((orig) => (r, c, nr, nc) => orig.call(main, r, c, nr, nc))(main.getRange);
main.getRange('A2:A').setNumberFormat = () => {};

global.SpreadsheetApp = {
  openById: () => ss,
  create: () => ss,
  getActiveSpreadsheet: () => ss,
};
global.PropertiesService = { getScriptProperties: () => ({ getProperty: () => 'x', setProperty() {} }) };
global.Logger = { log: () => {} };
global.CacheService = { getScriptCache: () => ({ get: () => null, put() {}, remove() {} }) };
global.Utilities = { formatDate: () => '2026/11/17 13:00', sleep() {} };
global.ContentService = { createTextOutput: (s) => ({ setMimeType() { return s; }, getContent: () => s }) };

const code = fs.readFileSync('scripts/google-apps-script/Code.gs', 'utf8');
const ctx = { ...global };
const fn = new Function('SpreadsheetApp', 'PropertiesService', 'Logger', 'CacheService', 'Utilities', 'ContentService', code + '\nreturn { writeRowByHeader_, colIdx_, ORDER_HEADERS };');
const mod = fn(global.SpreadsheetApp, global.PropertiesService, global.Logger, global.CacheService, global.Utilities, global.ContentService);

console.log('ORDER_HEADERS:', mod.ORDER_HEADERS.join(' | '));
console.log('主表標題    :', MAIN_HEADER.join(' | '));
console.log('colIdx_(主表):', JSON.stringify(mod.colIdx_(main)));
console.log('colIdx_(已取消):', JSON.stringify(mod.colIdx_(arc)));

// 模擬一筆寫入（values 依 ORDER_HEADERS 順序）
const values = ['XT-TEST', '新訂單', '新增', '測試', '0937745327', '', '2', '春節兩人套餐 ×1', '1760', '', '0', '176', '1936', '備註內容', 'CAR-9999', '2026/11/17 13:30', '', '{"sets":[]}'];
mod.writeRowByHeader_(main, 2, values);

const row = main.rows[0];
console.log('\n=== 寫入後每一欄 ===');
MAIN_HEADER.forEach((h, i) => console.log(`  ${String(i + 1).padStart(2)} ${String(h || '(空)').padEnd(8)} = ${JSON.stringify(row[i])}`));
const ci = mod.colIdx_(main);
console.log('\n讀回 car     =', JSON.stringify(row[ci.car]));
console.log('讀回 updated =', JSON.stringify(row[ci.updated]));
console.log('讀回 cart    =', JSON.stringify(row[ci.cart]));
console.log('\n>>> 判定:', (row[ci.car] === 'CAR-9999' && String(row[ci.updated]).indexOf('/') > 0) ? '✅ 程式正確（問題在部署）' : '❌ 程式有 bug，需要修');
