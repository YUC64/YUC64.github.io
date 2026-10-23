/**
 * 饗泰多｜除夕線上預點餐 — Google 端設定腳本（在「訂位表」的 Apps Script 裡執行）
 *
 * 【第一次使用】
 *   ① 開「訂位表」→ 擴充功能 → Apps Script → 把本檔內容整個貼進 Code.gs（蓋掉原本的）
 *   ② 開你的表單 → 按一次右上「發布」（Google 規定：從未發布過的表單，API 不能代為發布）
 *   ③ Apps Script 函式選 setupAll → 執行 → 授權
 *   ④ 把「網站設定（複製給 Hermes）」分頁內容貼給 Hermes
 *   ⑤ 部署 → 網頁應用程式（執行身分：我／存取權：任何人）→ 複製 /exec 網址
 *
 * 隨時可以重複執行 setupAll，不會產生重複資料（回應試算表會重複使用同一個）。
 * 若之後改了表單題目，執行 verifyPublish() 會重新核對 entry.ID。
 */

/* ============================ 設定區 ============================ */
const RESERVATION_SHEET_ID = '1vDdLKtOsXu_DbLqwxDzd8i_Dlr_Ya95NddFEBKFXOOQ'; // 你的「訂位表」
const RESERVATION_TAB = '訂位名單';
const ORDER_FORM_ID = '1q_pSXBzewuWoa0kBEXmEiueBmWYn2zlHjDwMlFqK0Kw';        // 你的表單「除夕」
const ORDER_FORM_TITLE = '饗泰多｜除夕線上預點餐 訂單';
const ORDER_FORM_DESC = '由預點餐網站自動送出。同一訂單編號若有多筆，以「送出時間」最新的一筆為準。';
const VIEWFORM_URL = 'https://docs.google.com/forms/d/' + ORDER_FORM_ID + '/viewform';
const FORMRESPONSE_URL = 'https://docs.google.com/forms/d/' + ORDER_FORM_ID + '/formResponse';
const CONFIG_TAB = '網站設定（複製給 Hermes）';

/** 表單題目（標題必須與網站的 formFieldTitles 完全一致） */
const FORM_TITLES = [
  '訂單編號', '動作', '姓名', '手機號碼', '預計取餐時間', '用餐人數',
  '套餐內容', '套餐金額', '單點內容', '單點金額', '服務費', '總金額', '備註', '送出時間',
];

/* ============================ 一鍵設定 ============================ */
function setupAll() {
  const report = [];
  const entries = setupOrderForm(report);
  setupReservationSheet(report);
  const responsesUrl = setupResponseSheet(report);
  const check = checkPublicAccess(entries, report);   // 匿名抓表單驗證 + 核對 entry.ID

  const info = {
    viewformUrl: VIEWFORM_URL,
    formResponseUrl: FORMRESPONSE_URL,
    responsesUrl: responsesUrl,
    entries: entries,
    publicOk: check.ok,
    report: report,
  };
  writeConfigSheet(info);
  const out = report.join('\n');
  Logger.log('=== 完成 ===\n' + out
    + '\n\n表單作答網址：' + VIEWFORM_URL
    + '\n表單送出網址：' + FORMRESPONSE_URL
    + '\nentry.ID 共 ' + Object.keys(entries).length + ' 個');
  return out;
}

/** 表單：清題目 → 建 14 題 → 取 entry.ID → 設定標題與發布 */
function setupOrderForm(report) {
  const form = FormApp.openById(ORDER_FORM_ID);

  // 1) 清掉現有題目
  form.getItems().forEach(function (item) { form.deleteItem(item); });

  // 2) 建立題目，並用「預先填入連結」反查 entry.ID
  const entries = {};
  FORM_TITLES.forEach(function (title) {
    const item = form.addTextItem().setTitle(title).setRequired(false);
    try {
      const ir = item.createResponse('x');
      const url = form.createResponse().withItemResponse(ir).toPrefilledUrl();
      const m = url.match(/entry\.(\d+)/);
      if (m) entries[title] = 'entry.' + m[1];
    } catch (e) {
      report.push('⚠ entry.ID 取得失敗：' + title + ' — ' + e.message);
    }
  });
  report.push('✅ 已建立 ' + FORM_TITLES.length + ' 個題目，取得 ' + Object.keys(entries).length + ' 個 entry.ID');

  // 3) 標題與回覆設定
  form.setTitle(ORDER_FORM_TITLE);
  form.setDescription(ORDER_FORM_DESC);
  try { form.setCollectEmail(false); } catch (e) { report.push('（略過）無法關閉收集 Email：' + e.message); }
  try { form.setLimitOneResponsePerUser(false); } catch (e) { report.push('（略過）無法關閉限填一次：' + e.message); }
  try { form.setRequireLogin(false); } catch (e) { report.push('（略過）此帳號不支援限制登入設定，非必要'); }

  // 4) 發布：Google 規定「從未發布過的表單」不能用 API 發布，必須先在表單畫面按一次
  try {
    form.setAcceptingResponses(true);
    report.push('✅ 已設定為接受回覆');
  } catch (e) {
    report.push('⚠ 無法自動發布：' + e.message);
    report.push('👉 請打開表單按一次右上角「發布」→ 再執行 setupAll（或 verifyPublish）');
  }
  return entries;
}

/** 回應試算表：只建立一次，重複執行會沿用（避免每次產生新檔） */
function setupResponseSheet(report) {
  const props = PropertiesService.getScriptProperties();
  let ss = null;
  const savedId = props.getProperty('RESPONSE_SHEET_ID');
  if (savedId) {
    try { ss = SpreadsheetApp.openById(savedId); } catch (e) { ss = null; }
  }
  if (!ss) {
    ss = SpreadsheetApp.create('饗泰多 除夕預點餐 訂單（回應）');
    props.setProperty('RESPONSE_SHEET_ID', ss.getId());
    report.push('✅ 已建立回應試算表');
  } else {
    report.push('✅ 沿用既有的回應試算表');
  }
  const form = FormApp.openById(ORDER_FORM_ID);
  try {
    form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
    report.push('✅ 表單回應已連結到試算表');
  } catch (e) {
    report.push('⚠ 連結回應試算表失敗（可手動在表單「回應」分頁連結）：' + e.message);
  }
  return ss.getUrl();
}

/** 訂位表：標題列與格式（電話以純文字存放） */
function setupReservationSheet(report) {
  const ss = SpreadsheetApp.openById(RESERVATION_SHEET_ID);
  let sheet = ss.getSheetByName(RESERVATION_TAB);
  if (!sheet) {
    sheet = ss.getSheets()[0];
    sheet.setName(RESERVATION_TAB);
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, 5).setValues([['姓名', '電話', '人數', '桌號', '已報到']]);
    report.push('✅ 訂位表已建立標題列：姓名／電話／人數／桌號／已報到');
  } else {
    report.push('✅ 訂位表已有資料，保留原內容（僅套用格式）');
  }
  sheet.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground('#FFD400');
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 120).setColumnWidth(2, 140).setColumnWidth(4, 90).setColumnWidth(5, 90);
  sheet.getRange('B2:B').setNumberFormat('@');   // 電話當文字，避免 9.12E+08
  sheet.getRange('E2:E').setNumberFormat('@');
  sheet.getRange('C2:C').setNumberFormat('0');
  return sheet.getName();
}

/** 匿名抓取表單頁面：確認「任何人可回覆」，並從 HTML 交叉核對 entry.ID（最權威） */
function checkPublicAccess(entries, report) {
  try {
    const res = UrlFetchApp.fetch(VIEWFORM_URL, { muteHttpExceptions: true, followRedirects: true });
    const code = res.getResponseCode();
    const html = res.getContentText();
    if (code !== 200) {
      report.push('⚠ 匿名讀取表單失敗（HTTP ' + code + '）→ 表單還沒發布，請先按「發布」');
      return { ok: false };
    }
    if (html.indexOf('FB_PUBLIC_LOAD_DATA_') < 0) {
      report.push('⚠ 讀不到表單資料，可能表單要求登入 → 請確認表單設定沒有要求登入');
      return { ok: false };
    }
    const parsed = parseEntriesFromHtml(html);
    let matched = 0;
    Object.keys(parsed).forEach(function (title) {
      if (entries[title] && entries[title] !== parsed[title]) {
        report.push('ℹ 已用表單實際的 entry.ID 覆蓋「' + title + '」');
      }
      if (parsed[title]) { entries[title] = parsed[title]; matched++; }
    });
    report.push('✅ 表單可匿名存取；從表單頁面核對到 ' + matched + ' 個 entry.ID');
    return { ok: true, matched: matched };
  } catch (e) {
    report.push('⚠ 匿名驗證例外：' + e.message);
    return { ok: false };
  }
}

/** 讀取 published 表單 HTML 的 FB_PUBLIC_LOAD_DATA_，回傳 {題目標題: entry.ID} */
function parseEntriesFromHtml(html) {
  const marker = 'FB_PUBLIC_LOAD_DATA_';
  const at = html.indexOf(marker);
  if (at < 0) return {};
  const open = html.indexOf('[', at);
  let depth = 0, inStr = false, esc = false, end = -1;
  for (let i = open; i < html.length; i++) {
    const ch = html.charAt(i);
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === '[') depth++;
    else if (ch === ']') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end < 0) return {};
  let data;
  try { data = JSON.parse(html.substring(open, end + 1)); } catch (e) { return {}; }
  const items = (data[1] && data[1][1]) || [];
  const out = {};
  items.forEach(function (item) {
    const title = String(item[1] || '').trim();
    const found = [];
    (function walk(node) {
      if (typeof node === 'string' && /^entry\.\d+$/.test(node)) found.push(node);
      else if (Object.prototype.toString.call(node) === '[object Array]') node.forEach(walk);
    })(item[4]);
    if (title && found.length) out[title] = found[0];
  });
  return out;
}

/** 只重新驗證發布狀態與 entry.ID（改過表單題目後可單獨執行） */
function verifyPublish() {
  const report = [];
  const entries = {};
  const parsed = checkPublicAccess(entries, report);
  // 重新用 prefill 取一次，補齊 HTML 沒抓到的欄位
  const form = FormApp.openById(ORDER_FORM_ID);
  form.getItems().forEach(function (item) {
    const title = item.getTitle();
    try {
      const url = form.createResponse().withItemResponse(item.asTextItem().createResponse('x')).toPrefilledUrl();
      const m = url.match(/entry\.(\d+)/);
      if (m && !entries[title]) entries[title] = 'entry.' + m[1];
    } catch (e) {}
  });
  const props = PropertiesService.getScriptProperties();
  const rid = props.getProperty('RESPONSE_SHEET_ID');
  const info = {
    viewformUrl: VIEWFORM_URL,
    formResponseUrl: FORMRESPONSE_URL,
    responsesUrl: rid ? 'https://docs.google.com/spreadsheets/d/' + rid + '/edit' : '（尚未建立）',
    entries: entries,
    publicOk: parsed.ok,
    report: report,
  };
  writeConfigSheet(info);
  const out = report.join('\n');
  Logger.log(out);
  return out;
}

/** 把設定寫成一個分頁，方便複製給網站維護者 */
function writeConfigSheet(info) {
  const ss = SpreadsheetApp.openById(RESERVATION_SHEET_ID);
  let sh = ss.getSheetByName(CONFIG_TAB);
  if (!sh) sh = ss.insertSheet(CONFIG_TAB);
  sh.clear();

  const lines = [
    ['饗泰多 除夕預點餐 — 網站設定（把下面整片複製給 Hermes）'],
    ['產生時間', new Date()],
    ['表單可匿名回覆', info.publicOk ? '是 ✅' : '否 ⚠（請先到表單按「發布」再執行 verifyPublish）'],
    [''],
    ['表單作答網址', info.viewformUrl],
    ['表單送出網址（formResponse）', info.formResponseUrl],
    ['回應試算表', info.responsesUrl],
    ['訂位驗證 Web App 網址（部署後請填這裡）', ''],
    [''],
    ['── 執行結果 ──', ''],
  ];
  (info.report || []).forEach(function (r) { lines.push([r, '']); });
  lines.push([''], ['欄位', 'entry.ID']);
  Object.keys(info.entries).forEach(function (title) {
    lines.push([title, info.entries[title]]);
  });

  sh.getRange(1, 1, lines.length, 2).setValues(lines);
  sh.getRange(1, 1).setFontWeight('bold').setFontSize(13);
  sh.getRange(3, 2).setNumberFormat('@');
  sh.setColumnWidth(1, 300).setColumnWidth(2, 460);
  sh.getRange(2, 2, 1, 1).setNumberFormat('yyyy-mm-dd hh:mm:ss');
  return sh.getName();
}

/* ============================ 訂位驗證 API ============================ */
/**
 * 部署成網頁應用程式（執行身分：我／存取權：任何人）後，
 * 網站與員工頁就能用 ?phone=0912345678 查詢這支電話是否在訂位名單中。
 * 只回傳 {ok:true/false, name}，不會把整份名單送出去。
 */
function doGet(e) {
  const phone = normPhone(e && e.parameter ? e.parameter.phone : '');
  if (!/^09\d{8}$/.test(phone)) return jsonOut({ ok: false, error: 'bad_phone' });

  const cache = CacheService.getScriptCache();
  const key = 'q' + phone;
  const n = Number(cache.get(key) || 0);
  if (n >= 10) return jsonOut({ ok: false, error: 'rate_limited' });
  cache.put(key, String(n + 1), 60);

  const ss = SpreadsheetApp.openById(RESERVATION_SHEET_ID);
  const sheet = ss.getSheetByName(RESERVATION_TAB) || ss.getSheets()[0];
  const rows = sheet.getDataRange().getValues();
  if (!rows.length) return jsonOut({ ok: false, error: 'empty_sheet' });

  const head = rows.shift().map(function (h) { return String(h).trim(); });
  const pi = head.findIndex(function (h) { return /電話|手機|phone|tel/i.test(h); });
  const ni = head.findIndex(function (h) { return /姓名|名字|name/i.test(h); });
  if (pi < 0) return jsonOut({ ok: false, error: 'no_phone_column' });

  for (let i = 0; i < rows.length; i++) {
    if (normPhone(rows[i][pi]) === phone) {
      return jsonOut({ ok: true, name: ni >= 0 ? String(rows[i][ni] || '') : '' });
    }
  }
  return jsonOut({ ok: false });
}

function normPhone(v) {
  const d = String(v || '').replace(/\D/g, '');
  if (/^8869\d{8}$/.test(d)) return '0' + d.slice(3);
  if (/^9\d{8}$/.test(d)) return '0' + d;
  return d;
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** 測試：拿名單第一筆電話跑一次驗證邏輯 */
function testVerify() {
  const ss = SpreadsheetApp.openById(RESERVATION_SHEET_ID);
  const sheet = ss.getSheetByName(RESERVATION_TAB) || ss.getSheets()[0];
  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return Logger.log('名單還沒有資料，先加一筆測試');
  const sample = normPhone(rows[1][0]);
  Logger.log('查 ' + sample + ' → ' + doGet({ parameter: { phone: sample } }).getContent());
}
