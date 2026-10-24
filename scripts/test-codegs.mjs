/**
 * 本機測試 Code.gs（假 SpreadsheetApp，模擬 Google 儲存格行為）
 *   node scripts/test-codegs.mjs
 */
import fs from 'fs';

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
      if (/^\d{9,}$/.test(v)) return Number(v);
    }
    return v == null ? '' : v;
  }
  getRange(r, c, nr = 1, nc = 1) { return new Range(this, r, c, nr, nc); }
  getDataRange() { return new Range(this, 1, 1, Math.max(this.getLastRow(), 1), Math.max(this.getLastColumn(), 1)); }
  setFrozenRows() { return this; }
  setColumnWidth() { return this; }
  insertRowBefore() { this.cells.unshift([]); return this; }
  setName(n) { this.name = n; return this; }
  appendRow(vals) { const r = this.getLastRow() + 1; this.getRange(r, 1, 1, vals.length).setValues([vals]); return this; }
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
        const d = new Date(v.getTime() + 8 * 3600e3);
        const p = (x) => (String(x).length < 2 ? '0' : '') + x;
        return `${d.getUTCFullYear()}/${p(d.getUTCMonth() + 1)}/${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
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
const props = new Map();
const cache = new Map();
const stubs = {
  SpreadsheetApp: { openById, create: (name) => new Spreadsheet('NEW-' + name), flush() {} },
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
      const iso = new Date(d.getTime() + 8 * 3600e3);
      const p = (x) => (String(x).length < 2 ? '0' : '') + x;
      return fmt.replace('yyyy', iso.getUTCFullYear()).replace('MM', p(iso.getUTCMonth() + 1))
        .replace('dd', p(iso.getUTCDate())).replace('HH', p(iso.getUTCHours()))
        .replace('mm', p(iso.getUTCMinutes())).replace('ss', p(iso.getUTCSeconds()));
    },
  },
  ContentService: {
    MimeType: { JSON: 'application/json' },
    createTextOutput: (s) => ({ setMimeType: () => ({ getContent: () => s }), getContent: () => s }),
  },
  Logger: { log: (...a) => console.log('  [Logger]', ...a) },
};

const src = fs.readFileSync(new URL('../scripts/google-apps-script/Code.gs', import.meta.url), 'utf8');
const G = new Function(...Object.keys(stubs), src + `
  return { doGet, doPost, staffOrders_, setupOrderSheet, tidyOrderSheet_, orderSheet_,
           ORDER_TAB, ARCHIVE_TAB, RESERVATION_SHEET_ID, ORDER_SHEET_ID_FIXED, COL_FLAG };
`)(...Object.values(stubs));

let pass = 0, fail = 0;
const ok = (cond, msg, extra) => {
  if (cond) { pass++; console.log('  ✅', msg); }
  else { fail++; console.log('  ❌', msg, extra !== undefined ? JSON.stringify(extra) : ''); }
};
const callPost = (body) => JSON.parse(G.doPost({ postData: { contents: JSON.stringify(body) } }).getContent());
const callGet = (params) => JSON.parse(G.doGet({ parameter: params }).getContent());

const rs = openById(G.RESERVATION_SHEET_ID).insertSheet('訂位名單');
rs.getRange(1, 1, 1, 3).setValues([['姓名', '電話', '驗證碼']]);
rs.getRange('B2:B').setNumberFormat('@');
rs.getRange('C2:C').setNumberFormat('@');
rs.getRange(2, 1, 2, 3).setValues([['謝寓臣', '0937745327', '1020'], ['陳大文', '0911222333', '5678']]);

const ord = openById(G.ORDER_SHEET_ID_FIXED);
G.setupOrderSheet([]);

const A = (o) => Object.assign({
  name: '謝寓臣', phone: '0937745327', code: '1020', headcount: 6,
  sets: '春節六人套餐 ×1\n　涼拌：酸辣海鮮涼拌', setsTotal: 5280,
  alacarte: '泰式奶茶（熱）x2', alacarteTotal: 260,
  service: 554, note: '', ts: '2026-10-24 15:00:00',
}, o);
const B = (o) => Object.assign({
  name: '陳大文', phone: '0911222333', code: '5678', headcount: 4,
  sets: '春節四人套餐 ×1', setsTotal: 3280,
  alacarte: '', alacarteTotal: 0, service: 328, note: '', ts: '2026-10-24 15:05:00',
}, o);

console.log('\n① 登入驗證');
ok(callGet({ phone: '0937745327', code: '1020' }).ok === true, '正確驗證碼可登入');
ok(callGet({ phone: '0937745327', code: '0000' }).error === 'bad_code', '錯驗證碼被擋');

console.log('\n② 兩位客人各下一張');
ok(callPost(A({ action: '新增', orderId: 'T-A', total: 6094 })).ok, '謝寓臣 下單成功');
ok(callPost(B({ action: '新增', orderId: 'T-B', total: 3608 })).ok, '陳大文 下單成功');
let main = ord.getSheetByName(G.ORDER_TAB);
let ids = main.getRange(2, 1, main.getLastRow() - 1, 1).getValues().map((r) => r[0]);
ok(JSON.stringify(ids) === JSON.stringify(['T-A', 'T-B']), '依訂單編號（下單順序）排序', ids);

console.log('\n③ 每人只能送一次');
const dup = callPost(A({ action: '新增', orderId: 'T-DUP', total: 1000 }));
ok(dup.error === 'already_ordered', '同一位客人再送 → already_ordered', dup);

console.log('\n④ 未開放前不能改單／取消');
ok(callPost(A({ action: '修改', orderId: 'T-A', total: 7000 })).error === 'edit_locked', '改單 → edit_locked');
ok(callPost(B({ action: '取消', orderId: 'T-B' })).error === 'edit_locked', '取消 → edit_locked');

console.log('\n⑤ 員工開放修改權限');
ok(callPost({ action: '開放修改', orderId: 'T-A', staffPw: '0000' }).error === 'bad_password', '員工密碼錯 → 擋下');
const open1 = callPost({ action: '開放修改', orderId: 'T-A', staffPw: '8888' });
ok(open1.ok && open1.editable === true, '開放成功', open1);
const mine1 = callGet({ mine: '1', phone: '0937745327', code: '1020' });
ok(mine1.ok && mine1.orders.length === 1, '客人只看到自己的 1 筆', mine1.count);
ok(mine1.orders[0].editable === true, '客人看到「可修改」');
ok(callGet({ mine: '1', phone: '0937745327', code: '9999' }).error === 'bad_code', '他人無法用錯驗證碼查詢');

console.log('\n⑥ 客人改單（限一次）');
const mod = callPost(A({ action: '修改', orderId: 'T-A', total: 7000, note: '改成 7000' }));
ok(mod.ok && mod.mode === 'updated', '開放後可改單', mod);
main = ord.getSheetByName(G.ORDER_TAB);
ok(main.getLastRow() === 3, '沒有新增列（主表 2 筆）', main.getLastRow());
ok(Number(main.getRange(2, 13).getValue()) === 7000, '金額已更新', main.getRange(2, 13).getValue());
ok(String(main.getRange(2, G.COL_FLAG + 1).getValue() || '') === '', '改完自動收回權限');
ok(callPost(A({ action: '修改', orderId: 'T-A', total: 8000 })).error === 'edit_locked', '第二次改單被擋');

console.log('\n⑦ 取消（需權限）');
callPost({ action: '開放修改', orderId: 'T-B', staffPw: '8888' });
const cancelOk = callPost(B({ action: '取消', orderId: 'T-B', setsTotal: '', alacarte: '', alacarteTotal: '', service: '' }));
ok(cancelOk.ok && cancelOk.status === '已取消', '開放後可取消', cancelOk);
main = ord.getSheetByName(G.ORDER_TAB);
ids = main.getLastRow() > 1 ? main.getRange(2, 1, main.getLastRow() - 1, 1).getValues().map((r) => r[0]) : [];
ok(!ids.includes('T-B'), '取消的單已離開主表', ids);
const arc = ord.getSheetByName(G.ARCHIVE_TAB);
const arcIds = arc && arc.getLastRow() > 1 ? arc.getRange(2, 1, arc.getLastRow() - 1, 1).getValues().map((r) => r[0]) : [];
ok(arcIds.includes('T-B'), '「已取消」分頁有 T-B', arcIds);
ok(Number(arc.getRange(2, 9).getValue()) === 3280, '取消後套餐金額保留', arc.getRange(2, 9).getValue());

console.log('\n⑧ 取消後可以重新下單');
ok(callPost(B({ action: '新增', orderId: 'T-B2', total: 3000 })).ok, '原單取消後可再下單');

console.log('\n⑨ 員工看板資料');
const staff = callGet({ staff: '1', pw: '8888' });
ok(staff.ok === true, '員工可讀取', staff.error);
ok(staff.orders.length >= 3, '含主表與已取消分頁', staff.count);
const aStaff = staff.orders.find((o) => o.orderId === 'T-A');
ok(aStaff && aStaff.editable === false, '權限收回後看板顯示不可修改');
ok(typeof staff.orders[0].pickup === 'string', 'pickup 仍是乾淨字串（不再使用）');
ok(callGet({ staff: '1', pw: '0000' }).error === 'bad_password', '員工密碼錯被擋');

console.log('\n⑩ 格式檢查');
const phoneCell = main.getRange(2, 5).getValue();
ok(phoneCell === '0937745327', '電話保留前導 0', String(phoneCell));
const aMine2 = callGet({ mine: '1', phone: '0937745327', code: '1020' }).orders[0];
ok(typeof aMine2.updated === 'string' && aMine2.updated.indexOf('/') > 0, 'updated 是乾淨字串', aMine2.updated);

console.log(`\n結果：${pass} 通過、${fail} 失敗`);
process.exit(fail ? 1 : 0);
