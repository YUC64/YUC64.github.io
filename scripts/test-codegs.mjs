/**
 * 本機測試 Code.gs（用假的 SpreadsheetApp，模擬 Google 的儲存格行為）
 *   node scripts/test-codegs.mjs
 * 模擬重點：儲存格沒設文字格式時，"2027-02-06 11:30" 會被 Google 轉成 Date、
 *          "0937745327" 會被轉成數字 —— 這正是先前兩個 bug 的來源。
 */
import fs from 'fs';

/* ───────────────── 假試算表 ───────────────── */
const COERCE_DATE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;

class Sheet {
  constructor(name) { this.name = name; this.cells = []; this.fmt = new Map(); }
  _pad(r, c) {
    while (this.cells.length < r) this.cells.push([]);
    const row = this.cells[r - 1];
    while (row.length < c) row.push('');
  }
  getLastRow() {
    let n = 0;
    this.cells.forEach((row, i) => { if (row.some((v) => v !== '' && v != null)) n = i + 1; });
    return n;
  }
  getLastColumn() {
    let m = 0;
    this.cells.forEach((row) => row.forEach((v, i) => { if (v !== '' && v != null) m = Math.max(m, i + 1); }));
    return m;
  }
  _coerce(r, c, v) {
    const f = this.fmt.get(`${r},${c}`);
    if (f === '@') return v == null ? '' : String(v);
    if (typeof v === 'string') {
      if (COERCE_DATE.test(v)) return new Date(v.replace(' ', 'T') + ':00+08:00');
      if (/^\d{9,}$/.test(v)) return Number(v);           // 電話/純數字 → 數字
    }
    return v == null ? '' : v;
  }
  getRange(r, c, nr = 1, nc = 1) { return new Range(this, r, c, nr, nc); }
  getDataRange() { return new Range(this, 1, 1, Math.max(this.getLastRow(), 1), Math.max(this.getLastColumn(), 1)); }
  setFrozenRows() { return this; }
  setColumnWidth() { return this; }
  insertRowBefore() { this.cells.unshift([]); return this; }
  setName(n) { this.name = n; return this; }
  appendRow(vals) {
    const r = this.getLastRow() + 1;
    this.getRange(r, 1, 1, vals.length).setValues([vals]);
    return this;
  }
}

class Range {
  constructor(sheet, r, c, nr, nc) { Object.assign(this, { sheet, r, c, nr, nc }); }
  getValues() {
    const out = [];
    for (let i = 0; i < this.nr; i++) {
      const row = [];
      for (let j = 0; j < this.nc; j++) {
        const rr = this.sheet.cells[this.r - 1 + i];
        row.push(rr && rr[this.c - 1 + j] != null ? rr[this.c - 1 + j] : '');
      }
      out.push(row);
    }
    return out;
  }
  getDisplayValues() {
    return this.getValues().map((row) => row.map((v) => {
      if (v instanceof Date) {
        const d = v;
        const p = (x) => (String(x).length < 2 ? '0' : '') + x;
        return `${d.getUTCFullYear()}/${p(d.getUTCMonth() + 1)}/${p(d.getUTCDate())} 下午 ${d.getUTCHours() + 8 > 12 ? d.getUTCHours() + 8 - 12 : d.getUTCHours() + 8}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
      }
      return v == null ? '' : String(v);
    }));
  }
  setValues(vals) {
    if (vals.length !== this.nr || (vals[0] && vals[0].length !== this.nc)) {
      throw new Error(`setValues 尺寸不符：需要 ${this.nr}x${this.nc}，給了 ${vals.length}x${vals[0] ? vals[0].length : 0}`);
    }
    for (let i = 0; i < this.nr; i++) {
      for (let j = 0; j < this.nc; j++) {
        const r = this.r + i, c = this.c + j;
        this.sheet._pad(r, c);
        this.sheet.cells[r - 1][c - 1] = this.sheet._coerce(r, c, vals[i][j]);
      }
    }
    return this;
  }
  setNumberFormat(fmt) {
    for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) this.sheet.fmt.set(`${this.r + i},${this.c + j}`, fmt);
    return this;
  }
  setFontWeight() { return this; }
  setBackground() { return this; }
  setFormula() { return this; }
  setWrap() { return this; }
  setVerticalAlignment() { return this; }
  setHorizontalAlignment() { return this; }
  clearContent() {
    for (let i = 0; i < this.nr; i++) {
      for (let j = 0; j < this.nc; j++) {
        const r = this.r + i;
        if (this.sheet.cells[r - 1]) this.sheet.cells[r - 1][this.c - 1 + j] = '';
      }
    }
    return this;
  }
  getValue() { return this.getValues()[0][0]; }
}

class Spreadsheet {
  constructor(id) { this.id = id; this.tabs = []; }
  getSheetByName(n) { return this.tabs.find((s) => s.name === n) || null; }
  getSheets() { return this.tabs.length ? this.tabs : [this.insertSheet('工作表1')]; }
  insertSheet(n) { const s = new Sheet(n); this.tabs.push(s); return s; }
  getId() { return this.id; }
  getUrl() { return 'https://docs.google.com/spreadsheets/d/' + this.id; }
}

const DBS = new Map();
const openById = (id) => { if (!DBS.has(id)) DBS.set(id, new Spreadsheet(id)); return DBS.get(id); };

/* ───────────────── 假 Apps Script 服務 ───────────────── */
const props = new Map();
const cache = new Map();
const stubs = {
  SpreadsheetApp: {
    openById,
    create: (name) => new Spreadsheet('NEW-' + name),
    flush() {},
  },
  PropertiesService: {
    getScriptProperties: () => ({
      getProperty: (k) => (props.has(k) ? props.get(k) : null),
      setProperty: (k, v) => props.set(k, String(v)),
      deleteProperty: (k) => props.delete(k),
    }),
  },
  CacheService: {
    getScriptCache: () => ({
      get: (k) => (cache.has(k) ? cache.get(k) : null),
      put: (k, v) => cache.set(k, String(v)),
      remove: (k) => cache.delete(k),
    }),
  },
  Utilities: {
    formatDate: (d, tz, fmt) => {
      const iso = new Date(d.getTime() + 8 * 3600e3);   // 轉台北時間
      const p = (x) => (String(x).length < 2 ? '0' : '') + x;
      return fmt
        .replace('yyyy', iso.getUTCFullYear())
        .replace('MM', p(iso.getUTCMonth() + 1))
        .replace('dd', p(iso.getUTCDate()))
        .replace('HH', p(iso.getUTCHours()))
        .replace('mm', p(iso.getUTCMinutes()))
        .replace('ss', p(iso.getUTCSeconds()));
    },
  },
  ContentService: {
    MimeType: { JSON: 'application/json' },
    createTextOutput: (s) => ({ setMimeType: () => ({ getContent: () => s }), getContent: () => s }),
  },
  Logger: { log: (...a) => console.log('  [Logger]', ...a) },
};

/* ───────────────── 載入 Code.gs ───────────────── */
const src = fs.readFileSync(new URL('../scripts/google-apps-script/Code.gs', import.meta.url), 'utf8');
const factory = new Function(...Object.keys(stubs), src + `
  return { doGet, doPost, staffOrders_, setupOrderSheet, tidyOrderSheet_, orderSheet_, pickupStr_,
           ORDER_TAB, ARCHIVE_TAB, RESERVATION_SHEET_ID, ORDER_SHEET_ID_FIXED };
`);
const G = factory(...Object.values(stubs));

/* ───────────────── 準備資料 ───────────────── */
let pass = 0, fail = 0;
const ok = (cond, msg, extra) => {
  if (cond) { pass++; console.log('  ✅', msg); }
  else { fail++; console.log('  ❌', msg, extra !== undefined ? JSON.stringify(extra) : ''); }
};
const callPost = (body) => JSON.parse(G.doPost({ postData: { contents: JSON.stringify(body) } }).getContent());
const callGet = (params) => JSON.parse(G.doGet({ parameter: params }).getContent());

// 訂位表
const res = openById(G.RESERVATION_SHEET_ID);
const rs = res.insertSheet('訂位名單');
rs.getRange(1, 1, 1, 3).setValues([['姓名', '電話', '驗證碼']]);
rs.getRange('B2:B').setNumberFormat('@');
rs.getRange('C2:C').setNumberFormat('@');
rs.getRange(2, 1, 1, 3).setValues([['謝寓臣', '0937745327', '1020']]);

// 訂單表
const ord = openById(G.ORDER_SHEET_ID_FIXED);
G.setupOrderSheet([]);

/* ───────────────── 測試開始 ───────────────── */
const base = (o) => Object.assign({
  name: '謝寓臣', phone: '0937745327', code: '1020', headcount: 6,
  sets: '六人套餐', setsTotal: 5280, alacarte: '泰式奶茶（熱）x2', alacarteTotal: 260,
  service: 554, note: '測試', ts: '2026-10-24 15:00:00',
}, o);

console.log('\n① 登入驗證');
ok(callGet({ phone: '0937745327', code: '1020' }).ok === true, '正確驗證碼可登入');
ok(callGet({ phone: '0937745327', code: '0000' }).error === 'bad_code', '錯驗證碼被擋');

console.log('\n② 新增兩張單（先晚後早，驗證自動排序）');
const r1 = callPost(base({ action: '新增', orderId: 'T-B', pickup: '2027-02-06 18:30', total: 6094 }));
ok(r1.ok && r1.mode === 'created', '建立 18:30 的單', r1);
const r2 = callPost(base({ action: '新增', orderId: 'T-A', pickup: '2027-02-06 11:30', total: 6094 }));
ok(r2.ok && r2.mode === 'created', '建立 11:30 的單', r2);

let main = ord.getSheetByName(G.ORDER_TAB);
let ids = main.getRange(2, 1, main.getLastRow() - 1, 1).getValues().map((r) => r[0]);
ok(JSON.stringify(ids) === JSON.stringify(['T-A', 'T-B']), '主表依取餐時間排序（T-A 在前）', ids);

const pickupCell = main.getRange(2, 6).getValue();
ok(typeof pickupCell === 'string' && pickupCell === '2027-02-06 11:30', '取餐時間存成文字（不是 Date）', String(pickupCell));
const phoneCell = main.getRange(2, 5).getValue();
ok(phoneCell === '0937745327', '電話保留前導 0', String(phoneCell));

console.log('\n③ 取消 T-A → 應搬到「已取消」分頁');
const r3 = callPost(base({ action: '取消', orderId: 'T-A', pickup: '2027-02-06 11:30', total: 6094,
  setsTotal: '', alacarte: '', alacarteTotal: '', service: '' }));
ok(r3.ok && r3.status === '已取消', '取消成功', r3);

main = ord.getSheetByName(G.ORDER_TAB);
ids = main.getLastRow() > 1 ? main.getRange(2, 1, main.getLastRow() - 1, 1).getValues().map((r) => r[0]) : [];
ok(ids.length === 1 && ids[0] === 'T-B', '主表只剩 T-B（取消的自動搬走）', ids);

const arc = ord.getSheetByName(G.ARCHIVE_TAB);
const arcIds = arc && arc.getLastRow() > 1 ? arc.getRange(2, 1, arc.getLastRow() - 1, 1).getValues().map((r) => r[0]) : [];
ok(arcIds.length === 1 && arcIds[0] === 'T-A', '「已取消」分頁有 T-A', arcIds);
const arcMoney = arc.getRange(2, 9).getValue();
ok(Number(arcMoney) === 5280, '取消後套餐金額仍保留（5280）', arcMoney);

console.log('\n④ 員工 API');
const api = callGet({ staff: '1', pw: '8888' });
ok(api.ok === true, '密碼正確可讀取', api.error);
ok(api.count === 2, '回傳 2 筆（主表 1 + 已取消 1）', api.count);
const a = api.orders.find((o) => o.orderId === 'T-A');
const b = api.orders.find((o) => o.orderId === 'T-B');
ok(a && a.src === G.ARCHIVE_TAB, 'T-A 來自「已取消」分頁', a && a.src);
ok(b && b.src === G.ORDER_TAB, 'T-B 來自「訂單」分頁', b && b.src);
ok(a && a.pickup === '2027-02-06 11:30', 'API 取餐時間是乾淨字串', a && a.pickup);
ok(a && a.phone === '0937745327', 'API 電話保留前導 0', a && a.phone);
ok(callGet({ staff: '1', pw: '0000' }).error === 'bad_password', '錯密碼被擋');

console.log('\n⑤ 修改 T-B（同編號覆蓋，不新增列）');
const r4 = callPost(base({ action: '修改', orderId: 'T-B', pickup: '2027-02-06 12:30', total: 7000 }));
ok(r4.ok && r4.mode === 'updated', '改單回 updated', r4);
main = ord.getSheetByName(G.ORDER_TAB);
ok(main.getLastRow() === 2, '主表仍只有 1 筆資料列（沒有重複）', main.getLastRow());
ok(main.getRange(2, 6).getValue() === '2027-02-06 12:30', '取餐時間已更新', main.getRange(2, 6).getValue());
ok(Number(main.getRange(2, 13).getValue()) === 7000, '金額已更新', main.getRange(2, 13).getValue());

console.log('\n⑥ 再新增一張更早的單，確認重新排序');
callPost(base({ action: '新增', orderId: 'T-C', pickup: '2027-02-05 19:00', total: 5000 }));
main = ord.getSheetByName(G.ORDER_TAB);
ids = main.getRange(2, 1, main.getLastRow() - 1, 1).getValues().map((r) => r[0]);
ok(JSON.stringify(ids) === JSON.stringify(['T-C', 'T-B']), 'T-C（2/5）排到最前', ids);

console.log(`\n結果：${pass} 通過、${fail} 失敗`);
process.exit(fail ? 1 : 0);
