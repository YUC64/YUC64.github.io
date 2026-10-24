/**
 * 饗泰多｜除夕線上預點餐 — Google 端主程式（在「訂位表」的 Apps Script 裡執行）
 *
 * 這一支腳本同時扮演「資料庫 API」與「設定工具」，不需要 Google 表單。
 *
 * ── 架構 ─────────────────────────────────────────────────────────
 *   [訂位表]  姓名｜電話｜驗證碼                          ← 員工維護（檔案保持私有）
 *             （只放登入需要的三欄；想另外記人數、桌號可以自己加，腳本用標題比對，不受影響）
 *   [訂單表]  自動建立，顧客點餐直接寫入（同一訂單編號會覆蓋同一列）
 *   doGet  ?phone=&code=      → 驗證登入（只回傳 ok／姓名，名單不外流）
 *   doPost {action, ...}      → 新增／修改／取消訂單（需通過電話+驗證碼驗證）
 * ─────────────────────────────────────────────────────────────────
 *
 * 【首次設定】
 *   ① 貼上本檔 → 執行 setupAll（會建好訂位表欄位、訂單表、並產生缺漏的驗證碼）
 *   ② 部署 → 新增部署作業 → 網頁應用程式（執行身分：我／存取權：任何人）→ 複製 /exec 網址
 *   ③ 把 /exec 網址貼給網站維護者
 *
 * 【之後新增訂位】員工只要在「訂位名單」貼上 姓名、電話 兩欄，
 *   再執行 fillCodes() 就會自動產生驗證碼（也可自己打）。驗證碼就是發給客人的登入碼。
 */

/* ============================ 設定區 ============================ */
const RESERVATION_SHEET_ID = '1vDdLKtOsXu_DbLqwxDzd8i_Dlr_Ya95NddFEBKFXOOQ'; // 你的「訂位表」
const RESERVATION_TAB = '訂位名單';

const ORDER_SHEET_NAME = '饗泰多 除夕預點餐 訂單';
const ORDER_TAB = '訂單';
const ARCHIVE_TAB = '已取消';   // 取消的訂單搬到這裡，主表保持乾淨
/** 訂單要寫進哪一份試算表：填 ID 就固定用這一張（留空 = 由 setupAll 自動建立新檔） */
const ORDER_SHEET_ID_FIXED = '1qaJy5BOywcLwlE4tPdWtdNnaVA1gV6G1a8qe4yrOtIk';

/** 員工看板密碼：改這一行後「重新部署」即生效（請換成自己的密碼） */
const STAFF_PASSWORD = '8888';
const STAFF_MAX_TRY = 20;        // 15 分鐘內錯超過這次數就暫時鎖住
const ORDER_HEADERS = [
  '訂單編號', '狀態', '動作', '姓名', '電話', '預計取餐時間', '用餐人數',
  '套餐內容', '套餐金額', '單點內容', '單點金額', '服務費', '總金額', '備註', '最後更新',
];

const RESERVATION_HEADERS = ['姓名', '電話', '驗證碼'];

const CODE_LENGTH = 4;          // 驗證碼長度（要更安全可改 6）
const MAX_FAIL_PER_HOUR = 8;    // 同一支電話每小時最多錯幾次驗證碼
const MAX_STR = 800;            // 單一欄位長度上限（防止塞爆儲存格）

/* ============================ 一鍵設定 ============================ */
function setupAll() {
  const report = [];
  setupReservationSheet(report);
  const codes = fillCodes_(report);
  const orderUrl = setupOrderSheet(report);
  const out = report.join('\n');
  Logger.log('=== 完成 ===\n' + out + '\n\n訂單表：' + orderUrl);
  return out;
}

/** 訂位表：建立／確認欄位（姓名｜電話｜驗證碼；不含報到、桌號等欄位） */
function setupReservationSheet(report) {
  const ss = SpreadsheetApp.openById(RESERVATION_SHEET_ID);
  let sheet = ss.getSheetByName(RESERVATION_TAB);
  if (!sheet) {
    sheet = ss.getSheets()[0];
    sheet.setName(RESERVATION_TAB);
    report.push('✅ 已建立工作表「' + RESERVATION_TAB + '」');
  }

  const firstRow = sheet.getLastRow() > 0
    ? sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), RESERVATION_HEADERS.length)).getValues()[0]
    : [];
  const hasHeader = String(firstRow[0] || '').trim() === RESERVATION_HEADERS[0];

  if (!hasHeader) {
    if (sheet.getLastRow() > 0 && String(firstRow[1] || '').trim() !== '' && !/電話|手機/.test(String(firstRow[1]))) {
      report.push('⚠ 第一列不是標題列且有資料，為避免破壞資料，請手動在第一列插入標題：'
        + RESERVATION_HEADERS.join('｜'));
    } else if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, RESERVATION_HEADERS.length).setValues([RESERVATION_HEADERS]);
      report.push('✅ 訂位表已建立欄位：' + RESERVATION_HEADERS.join('｜'));
    } else {
      sheet.insertRowBefore(1);
      sheet.getRange(1, 1, 1, RESERVATION_HEADERS.length).setValues([RESERVATION_HEADERS]);
      report.push('✅ 已在第一列插入標題：' + RESERVATION_HEADERS.join('｜'));
    }
  } else {
    report.push('✅ 訂位表欄位正常');
  }

  sheet.getRange(1, 1, 1, RESERVATION_HEADERS.length).setFontWeight('bold').setBackground('#FFD400');
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 110).setColumnWidth(2, 130).setColumnWidth(3, 100);
  sheet.getRange('B2:B').setNumberFormat('@');   // 電話當文字
  sheet.getRange('C2:C').setNumberFormat('@');   // 驗證碼當文字（保留前導 0）

  // 若之前跑過舊版而留下「已報到／桌號」等欄位，提示一下（不會自動刪，避免動到你的資料）
  const headerRow = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), RESERVATION_HEADERS.length))
    .getValues()[0].map(function (h) { return String(h).trim(); });
  const extra = headerRow.slice(RESERVATION_HEADERS.length).filter(function (h) { return h; });
  if (extra.length) {
    report.push('ℹ 第 4 欄之後還有：' + extra.join('、') + '（本系統不使用；要清掉可執行 clearExtraColumns()）');
  }
  return sheet.getName();
}

/** 選用：刪掉訂位表上「已報到、桌號、人數」等本系統不使用的欄位（會先回報再刪） */
function clearExtraColumns() {
  const ss = SpreadsheetApp.openById(RESERVATION_SHEET_ID);
  const sheet = ss.getSheetByName(RESERVATION_TAB) || ss.getSheets()[0];
  const lastCol = sheet.getLastColumn();
  if (lastCol <= RESERVATION_HEADERS.length) return Logger.log('沒有多餘欄位');
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); });
  for (let i = lastCol; i > RESERVATION_HEADERS.length; i--) {
    if (headers[i - 1]) {
      Logger.log('刪除欄位 ' + i + '：' + headers[i - 1]);
      sheet.deleteColumn(i);
    }
  }
  Logger.log('完成，目前欄位：' + sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].join('｜'));
}

/** 幫「有姓名電話但沒有驗證碼」的列自動產生不重複驗證碼 */
function fillCodes(report) { return fillCodes_(report); }

function fillCodes_(report) {
  const ss = SpreadsheetApp.openById(RESERVATION_SHEET_ID);
  const sheet = ss.getSheetByName(RESERVATION_TAB) || ss.getSheets()[0];
  const last = sheet.getLastRow();
  if (last < 2) {
    report.push('ℹ 訂位名單目前沒有資料，貼上姓名與電話後再執行 fillCodes()');
    return 0;
  }
  const range = sheet.getRange(2, 1, last - 1, RESERVATION_HEADERS.length);
  const values = range.getValues();
  const used = {};
  values.forEach(function (r) { const c = String(r[2] || '').trim(); if (c) used[c] = true; });

  let made = 0;
  for (let i = 0; i < values.length; i++) {
    const name = String(values[i][0] || '').trim();
    const phone = normPhone(values[i][1]);
    let code = String(values[i][2] || '').trim();
    if (!name && !phone) continue;                       // 空列跳過
    if (!code) {
      let c;
      do { c = String(Math.floor(Math.random() * Math.pow(10, CODE_LENGTH))); }
      while (c.length < CODE_LENGTH || used[c]);          // 補前導 0、避免重複
      code = c;
      values[i][2] = c;
      used[c] = true;
      made++;
    }
  }
  if (made) range.setValues(values);
  report.push(made ? ('✅ 自動產生 ' + made + ' 組驗證碼') : '✅ 所有訂位列都已有驗證碼');
  return made;
}

/** 訂單表：建立／確認欄位，回傳網址 */
function setupOrderSheet(report) {
  const props = PropertiesService.getScriptProperties();
  let ss = null;
  const savedId = ORDER_SHEET_ID_FIXED || props.getProperty('ORDER_SHEET_ID');
  if (savedId) { try { ss = SpreadsheetApp.openById(savedId); } catch (e) { ss = null; } }
  if (!ss) {
    ss = SpreadsheetApp.create(ORDER_SHEET_NAME);
    props.setProperty('ORDER_SHEET_ID', ss.getId());
    report.push('✅ 已建立訂單試算表');
  } else {
    report.push('✅ 沿用既有的訂單試算表');
  }
  let sh = ss.getSheetByName(ORDER_TAB);
  if (!sh) {
    sh = ss.getSheets()[0];
    sh.setName(ORDER_TAB);
    sh.getRange(1, 1, 1, ORDER_HEADERS.length).setValues([ORDER_HEADERS]);
    report.push('✅ 訂單表已建立欄位');
  } else if (String(sh.getRange(1, 1).getValue() || '').trim() !== ORDER_HEADERS[0]) {
    sh.getRange(1, 1, 1, ORDER_HEADERS.length).setValues([ORDER_HEADERS]);
    report.push('🔄 訂單表標題列已重設');
  } else {
    report.push('✅ 訂單表欄位正常');
  }
  sh.getRange(1, 1, 1, ORDER_HEADERS.length).setFontWeight('bold').setBackground('#FFD400');
  sh.setFrozenRows(1);
  sh.getRange('A2:A').setNumberFormat('@');   // 訂單編號當文字
  sh.getRange('E2:E').setNumberFormat('@');   // 電話當文字（保留前導 0）
  sh.setColumnWidth(1, 160).setColumnWidth(4, 100).setColumnWidth(5, 130);
  return ss.getUrl();
}

/* ============================ 顧客端 API ============================ */

/** GET ?phone=09xxxxxxxx&code=1234 → 驗證登入；只回傳 {ok, name}，名單不外流 */
function doGet(e) {
  const p = (e && e.parameter) || {};

  // 員工看板：?staff=1&pw=密碼 → 回傳訂單清單（需密碼，因為含客人姓名電話）
  if (p.staff) return staffOrders_(p);

  const phone = normPhone(p.phone);
  const code = String(p.code || '').trim();
  if (!/^09\d{8}$/.test(phone)) return jsonOut({ ok: false, error: 'bad_phone' });
  if (!code) return jsonOut({ ok: false, error: 'need_code' });

  const failKey = 'f' + phone;
  const cache = CacheService.getScriptCache();
  if (Number(cache.get(failKey) || 0) >= MAX_FAIL_PER_HOUR) {
    return jsonOut({ ok: false, error: 'too_many_attempts' });
  }

  const hit = findReservation_(phone);
  if (!hit) return jsonOut({ ok: false, error: 'not_found' });

  if (String(hit.code) !== code) {
    const n = Number(cache.get(failKey) || 0) + 1;
    cache.put(failKey, String(n), 3600);
    return jsonOut({ ok: false, error: 'bad_code', remaining: Math.max(0, MAX_FAIL_PER_HOUR - n) });
  }

  cache.remove(failKey);
  return jsonOut({ ok: true, name: hit.name });   // 注意：不回傳驗證碼
}

/**
 * POST（body 為 JSON，Content-Type: text/plain 以避免 CORS 預檢）
 * { action:'新增'|'修改'|'取消', orderId, name, phone, code, pickup, headcount,
 *   sets, setsTotal, alacarte, alacarteTotal, service, total, note, ts }
 * 以「訂單編號」為 key：已存在就覆蓋同一列，不存在就新增。
 */
function doPost(e) {
  let body = {};
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return jsonOut({ ok: false, error: 'bad_json' });
  }

  const phone = normPhone(body.phone);
  const code = String(body.code || '').trim();
  const action = String(body.action || '新增');
  const orderId = String(body.orderId || '').trim();

  if (!/^09\d{8}$/.test(phone)) return jsonOut({ ok: false, error: 'bad_phone' });
  if (!orderId) return jsonOut({ ok: false, error: 'no_order_id' });
  if (['新增', '修改', '取消'].indexOf(action) < 0) return jsonOut({ ok: false, error: 'bad_action' });

  // 驗證身分：電話+驗證碼必須對得上（避免有人亂塞訂單）
  const hit = findReservation_(phone);
  if (!hit) return jsonOut({ ok: false, error: 'not_found' });
  if (String(hit.code) !== code) return jsonOut({ ok: false, error: 'bad_code' });

  const ss = orderSheet_();
  const sh = ss.getSheetByName(ORDER_TAB);
  const last = sh.getLastRow();
  const rows = last > 1 ? sh.getRange(2, 1, last - 1, ORDER_HEADERS.length).getValues() : [];

  // 找同一訂單編號（只認同一支電話的單，避免猜別人的編號）
  let rowIndex = -1;
  for (let i = rows.length - 1; i >= 0; i--) {
    if (String(rows[i][0]).trim() === orderId) {
      if (normPhone(rows[i][4]) !== phone) return jsonOut({ ok: false, error: 'not_your_order' });
      rowIndex = i + 2;
      break;
    }
  }
  if (action !== '新增' && rowIndex < 0) return jsonOut({ ok: false, error: 'order_not_found' });

  const status = action === '取消' ? '已取消' : (action === '修改' ? '已修改' : '新訂單');
  const now = new Date();

  // 修改／取消時，前端沒帶的欄位沿用原值（例如取消只帶狀態，不能把餐點金額清空）
  const base = rowIndex > 0 ? sh.getRange(rowIndex, 1, 1, ORDER_HEADERS.length).getValues()[0] : null;
  const keep = function (v, i) {
    if (v === undefined || v === null) return base ? base[i] : '';
    if (typeof v === 'string' && v.trim() === '') return base ? base[i] : '';
    return v;
  };

  const values = [
    orderId, status, action,
    keep(body.name ? safe_(body.name) : '', 3),
    phone,                                              // 一律用驗證過的正規化電話（含前導 0）
    keep(body.pickup ? safe_(body.pickup) : '', 5),
    keep(body.headcount === undefined || body.headcount === '' ? '' : Number(body.headcount) || '', 6),
    keep(body.sets ? safe_(body.sets) : '', 7),
    keep(num_(body.setsTotal), 8),
    keep(body.alacarte ? safe_(body.alacarte) : '', 9),
    keep(num_(body.alacarteTotal), 10),
    keep(num_(body.service), 11),
    keep(num_(body.total), 12),
    keep(body.note ? safe_(body.note) : '', 13),
    now,
  ];

  if (rowIndex > 0) {
    // 先設文字格式，避免電話被當成數字而掉了前導 0
    sh.getRange(rowIndex, 5).setNumberFormat('@');
    sh.getRange(rowIndex, 1, 1, ORDER_HEADERS.length).setValues([values]);
    return jsonOut({ ok: true, orderId: orderId, mode: 'updated', row: rowIndex, status: status });
  }

  const newRow = sh.getLastRow() + 1;
  sh.getRange(newRow, 5).setNumberFormat('@');          // 電話欄先設文字
  sh.getRange(newRow, 1, 1, ORDER_HEADERS.length).setValues([values]);

  const tidyInfo = tidyOrderSheet_();
  return jsonOut({ ok: true, orderId: orderId, mode: 'created', row: newRow, status: status,
                   archived: tidyInfo.moved, active: tidyInfo.kept });
}

/**
 * 整理訂單表：① 已取消的搬到「已取消」分頁 ② 剩下的依「取餐時間 → 送出時間」排序
 * 每次寫入自動執行；也可以在編輯器手動執行 tidyNow()
 */
function tidyOrderSheet_() {
  const ss = orderSheet_();
  const sh = ss.getSheetByName(ORDER_TAB);
  if (!sh) return { moved: 0, kept: 0 };
  const last = sh.getLastRow();
  if (last < 2) return { moved: 0, kept: 0 };

  const width = ORDER_HEADERS.length;
  const range = sh.getRange(2, 1, last - 1, width);
  const rows = range.getValues();

  const keep = [];
  const moved = [];
  for (let i = 0; i < rows.length; i++) {
    const id = String(rows[i][0] || '').trim();
    if (!id) continue;                                        // 空列直接丟掉
    if (String(rows[i][1] || '').trim() === '已取消') moved.push(rows[i]);
    else keep.push(rows[i]);
  }

  // ① 已取消 → 分頁
  if (moved.length) {
    let arc = ss.getSheetByName(ARCHIVE_TAB);
    if (!arc) {
      arc = ss.insertSheet(ARCHIVE_TAB);
      arc.getRange(1, 1, 1, width).setValues([ORDER_HEADERS]);
      arc.getRange(1, 1, 1, width).setFontWeight('bold').setBackground('#E8E1D4');
      arc.setFrozenRows(1);
      arc.setColumnWidth(1, 160).setColumnWidth(4, 100).setColumnWidth(5, 130);
    }
    const startRow = Math.max(arc.getLastRow() + 1, 2);
    arc.getRange(startRow, 1, moved.length, width).setValues(moved);
    arc.getRange(startRow, 5, moved.length, 1).setNumberFormat('@');
  }

  // ② 排序：取餐時間（字串 YYYY-MM-DD HH:mm 可直接比大小）→ 送出時間（越早越前面）
  const timeOf = function (v) { return v instanceof Date ? v.getTime() : 0; };
  keep.sort(function (a, b) {
    const pa = String(a[5] || ''), pb = String(b[5] || '');
    if (pa !== pb) return pa < pb ? -1 : 1;
    return timeOf(a[14]) - timeOf(b[14]);
  });

  // ③ 寫回：先寫入排序後的資料，再清掉尾端多出來的舊列（比先清空安全）
  if (keep.length) {
    sh.getRange(2, 1, keep.length, width).setValues(keep);
    sh.getRange(2, 5, keep.length, 1).setNumberFormat('@');
  }
  const oldCount = last - 1;
  if (oldCount > keep.length) {
    sh.getRange(2 + keep.length, 1, oldCount - keep.length, width).clearContent();
  }
  return { moved: moved.length, kept: keep.length };
}

/** 手動整理（在 Apps Script 編輯器選這個函式執行即可） */
function tidyNow() {
  const info = tidyOrderSheet_();
  Logger.log('已取消搬到「' + ARCHIVE_TAB + '」：' + info.moved + ' 筆；主表保留 ' + info.kept + ' 筆（已依取餐時間排序）');
  return info;
}

/** 員工用：列出某支電話的訂單（在 Apps Script 編輯器執行，或部署後用 GET 擴充） */
function listOrders(phone) {
  const p = normPhone(phone);
  const sh = orderSheet_().getSheetByName(ORDER_TAB);
  const rows = sh.getDataRange().getValues();
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    if (normPhone(rows[i][4]) === p) {
      out.push(rows[i][0] + ' ' + rows[i][1] + ' $' + rows[i][12] + ' ' + rows[i][5]);
    }
  }
  Logger.log(out.length ? out.join('\n') : '查無訂單');
  return out;
}

/* ============================ 內部工具 ============================ */
function orderSheet_() {
  const id = ORDER_SHEET_ID_FIXED || PropertiesService.getScriptProperties().getProperty('ORDER_SHEET_ID');
  if (!id) throw new Error('尚未建立訂單表，請先執行 setupAll()');
  return SpreadsheetApp.openById(id);
}

/**
 * 員工看板：GET ?staff=1&pw=密碼 → { ok, count, orders:[…], updatedAt }
 * 只回傳「最近的狀態」（同一訂單編號在表上只有一列）
 */
function staffOrders_(p) {
  const cache = CacheService.getScriptCache();
  if (cache.get('staffLock')) return jsonOut({ ok: false, error: 'locked' });
  if (String(p.pw || '') !== STAFF_PASSWORD) {
    const n = Number(cache.get('staffTry') || 0) + 1;
    cache.put('staffTry', String(n), 900);
    if (n >= STAFF_MAX_TRY) cache.put('staffLock', '1', 900);
    return jsonOut({ ok: false, error: 'bad_password', remaining: Math.max(0, STAFF_MAX_TRY - n) });
  }
  cache.remove('staffTry');

  const ss = orderSheet_();
  const sources = [];
  [ORDER_TAB, ARCHIVE_TAB].forEach(function (name) {
    const sh = ss.getSheetByName(name);
    if (!sh) return;
    const last = sh.getLastRow();
    if (last < 2) return;
    sources.push({
      rows: sh.getRange(2, 1, last - 1, ORDER_HEADERS.length).getValues(),
      disp: sh.getRange(2, 1, last - 1, ORDER_HEADERS.length).getDisplayValues(),
    });
  });
  if (!sources.length) return jsonOut({ ok: true, count: 0, orders: [], updatedAt: new Date().toISOString() });

  const orders = [];
  sources.forEach(function (src) {
  const rows = src.rows, disp = src.disp;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i], d = disp[i];
    const orderId = String(r[0] || '').trim();
    if (!orderId) continue;
    orders.push({
      orderId: orderId,
      status: String(r[1] || '').trim(),
      action: String(r[2] || '').trim(),
      name: String(r[3] || '').trim(),
      phone: normPhone(r[4]),
      pickup: String(r[5] || '').trim(),
      headcount: String(r[6] || '').trim(),
      sets: String(r[7] || '').trim(),
      setsTotal: num_(r[8]),
      alacarte: String(r[9] || '').trim(),
      alacarteTotal: num_(r[10]),
      service: num_(r[11]),
      total: num_(r[12]),
      note: String(r[13] || '').trim(),
      updated: String(d[14] || '').trim(),
    });
  }
  });
  // 主表已依取餐時間排序，這裡再排一次確保「已取消」分頁的資料也接得順
  orders.sort(function (a, b) {
    if (a.pickup !== b.pickup) return a.pickup < b.pickup ? -1 : 1;
    return String(a.orderId) < String(b.orderId) ? -1 : 1;
  });
  return jsonOut({ ok: true, count: orders.length, orders: orders, updatedAt: new Date().toISOString() });
}

/** 依電話找訂位列，回傳 {row, name, code, phone} */
function findReservation_(phone) {
  const ss = SpreadsheetApp.openById(RESERVATION_SHEET_ID);
  const sheet = ss.getSheetByName(RESERVATION_TAB) || ss.getSheets()[0];
  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return null;
  const head = rows.shift().map(function (h) { return String(h).trim(); });
  const pi = idxOf_(head, /電話|手機|phone|tel/i, 1);
  const ni = idxOf_(head, /姓名|名字|name/i, 0);
  const ci = idxOf_(head, /驗證碼|code|密碼/i, 2);
  if (pi < 0) return null;
  for (let i = 0; i < rows.length; i++) {
    if (normPhone(rows[i][pi]) === phone) {
      return {
        row: i + 2,
        name: String(rows[i][ni] || '').trim(),
        code: String(rows[i][ci] || '').trim(),
      };
    }
  }
  return null;
}

function idxOf_(headers, re, fallback) {
  for (let i = 0; i < headers.length; i++) if (re.test(headers[i])) return i;
  return fallback;
}

function normPhone(v) {
  const d = String(v || '').replace(/\D/g, '');
  if (/^8869\d{8}$/.test(d)) return '0' + d.slice(3);
  if (/^9\d{8}$/.test(d)) return '0' + d;
  return d;
}

/** 欄位清洗：截長度、去掉開頭的 = + - @（避免試算表把它當公式） */
function safe_(v) {
  let s = String(v == null ? '' : v).slice(0, MAX_STR);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function num_(v) {
  // 注意：Number('') === 0，空字串要當「沒有值」而不是 0，否則改單／取消會把金額歸零
  if (v === '' || v === null || v === undefined) return '';
  const n = Number(v);
  return isNaN(n) ? '' : n;
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ============================ 測試工具（在編輯器直接執行） ============================ */
/** 假造一筆訂位 + 一筆訂單，驗證整條流程（測完可刪掉那兩列） */
function selfTest() {
  const ss = SpreadsheetApp.openById(RESERVATION_SHEET_ID);
  const rs = ss.getSheetByName(RESERVATION_TAB) || ss.getSheets()[0];
  const testPhone = '0900000000';
  rs.appendRow(['測試客人', testPhone, '1234', 4, '', '']);
  Logger.log('① 已加入測試訂位 0900000000 / 驗證碼 1234');

  const wrong = doGet({ parameter: { phone: testPhone, code: '9999' } }).getContent();
  Logger.log('② 錯誤驗證碼應被拒：' + wrong);

  const good = doGet({ parameter: { phone: testPhone, code: '1234' } }).getContent();
  Logger.log('③ 正確驗證碼：' + good);

  const created = doPost({
    postData: { contents: JSON.stringify({
      action: '新增', orderId: 'XT-TEST-001', name: '測試客人', phone: testPhone, code: '1234',
      pickup: '2027-02-18 18:30', headcount: 4, sets: '春節四人套餐 x1', setsTotal: 3520,
      alacarte: '摩摩喳喳(去冰) x1', alacarteTotal: 100, service: 362, total: 3982, note: '測試',
    }) },
  }).getContent();
  Logger.log('④ 新增訂單：' + created);

  const updated = doPost({
    postData: { contents: JSON.stringify({
      action: '修改', orderId: 'XT-TEST-001', name: '測試客人', phone: testPhone, code: '1234',
      pickup: '2027-02-18 19:00', headcount: 4, sets: '春節四人套餐 x1（已改）', setsTotal: 3520,
      alacarte: '無', alacarteTotal: 0, service: 352, total: 3872, note: '改單測試',
    }) },
  }).getContent();
  Logger.log('⑤ 修改同一編號（應該 updated 而不是新增）：' + updated);

  const sh = orderSheet_().getSheetByName(ORDER_TAB);
  Logger.log('⑥ 訂單表目前列數：' + sh.getLastRow() + '（含標題；重複執行自我測試不會變多）');
  Logger.log('提醒：測完請刪掉訂位表最後一列（測試客人）與訂單表 XT-TEST-001 那一列。');
}
