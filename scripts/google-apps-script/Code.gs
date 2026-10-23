/**
 * 饗泰多｜除夕線上預點餐 — Google 端設定腳本（在「訂位表」的 Apps Script 裡執行）
 *
 * 這一段會幫你做完四件事：
 *   1. 把「訂位表」整理成訂位名單格式（姓名／電話／人數／桌號／已報到），電話欄設成純文字
 *   2. 把你現有的表單「除夕」改成訂單用的 14 個題目，並發布、開放任何人回覆
 *   3. 自動建立回應試算表並把表單回應連過去
 *   4. 把表單的 entry.ID 對應表寫進試算表（讓你複製給網站設定用）
 *   另外附上訂位驗證的 doGet()，部署成網頁應用程式後，網站就能查「這支電話有沒有訂位」。
 *
 * 使用方式：
 *   ① 開「訂位表」→ 擴充功能 → Apps Script → 把這個檔案內容整個貼進 Code.gs（蓋掉原本的）
 *   ② 上方函式選單選 setupAll → 執行 → 第一次會要求授權（選你的帳號 → 進階 → 前往）
 *   ③ 看「執行紀錄」，並打開新產生的「網站設定」分頁，把內容複製給 Hermes
 *   ④ 部署 → 新增部署作業 → 網頁應用程式（執行身分：我／存取權：任何人）→ 複製 /exec 網址
 */

/* ============================ 設定區 ============================ */
const RESERVATION_SHEET_ID = '1vDdLKtOsXu_DbLqwxDzd8i_Dlr_Ya95NddFEBKFXOOQ'; // 你的「訂位表」
const RESERVATION_TAB = '訂位名單';                                            // 名單工作表名稱
const ORDER_FORM_ID = '1q_pSXBzewuWoa0kBEXmEiueBmWYn2zlHjDwMlFqK0Kw';        // 你的表單「除夕」
const ORDER_FORM_TITLE = '饗泰多｜除夕線上預點餐 訂單';
const ORDER_FORM_DESC = '由預點餐網站自動送出。同一訂單編號若有多筆，以「送出時間」最新的一筆為準。';

/** 表單題目（標題必須與網站的 formFieldTitles 完全一致，順序也照這個） */
const FORM_TITLES = [
  '訂單編號', '動作', '姓名', '手機號碼', '預計取餐時間', '用餐人數',
  '套餐內容', '套餐金額', '單點內容', '單點金額', '服務費', '總金額', '備註', '送出時間',
];

/* ============================ 一鍵設定 ============================ */
function setupAll() {
  const form = setupOrderForm();
  setupReservationSheet();
  const info = writeConfigSheet(form);
  Logger.log('=== 完成 ===\n' + info);
  return info;
}

/** 表單：清空舊題目 → 建立 14 題 → 發布 → 連結回應試算表 → 回傳設定資訊 */
function setupOrderForm() {
  const form = FormApp.openById(ORDER_FORM_ID);

  // 1) 清掉現有題目（含未命名的問題）
  form.getItems().forEach(function (item) { form.deleteItem(item); });

  // 2) 建立題目並取得 entry.ID
  const entries = {};
  FORM_TITLES.forEach(function (title) {
    const item = form.addTextItem().setTitle(title).setRequired(false);
    try {
      // 用「預先填入連結」反查 entry.ID（最可靠、不依賴畫面版本）
      const ir = item.createResponse('x');
      const url = form.createResponse().withItemResponse(ir).toPrefilledUrl();
      const m = url.match(/entry\.(\d+)/);
      if (m) entries[title] = 'entry.' + m[1];
    } catch (e) {
      Logger.log('entry ID 取得失敗：' + title + ' — ' + e);
    }
  });

  // 3) 表單標題/說明與回覆設定
  form.setTitle(ORDER_FORM_TITLE);
  form.setDescription(ORDER_FORM_DESC);
  try { form.setCollectEmail(false); } catch (e) { Logger.log('setCollectEmail: ' + e); }
  try { form.setRequireLogin(false); } catch (e) { Logger.log('setRequireLogin 不支援，請手動關閉「僅限…使用者」：' + e); }
  try { form.setLimitOneResponsePerUser(false); } catch (e) {}
  form.setAcceptingResponses(true);   // 相當於按「發布」

  // 4) 回應寫進新的試算表
  let responsesUrl = '';
  try {
    const ss = SpreadsheetApp.create('饗泰多 除夕預點餐 訂單（回應）');
    form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
    responsesUrl = ss.getUrl();
  } catch (e) {
    Logger.log('建立回應試算表失敗（可手動在表單「回應」分頁連結）：' + e);
  }

  return {
    form: form,
    viewformUrl: form.getPublishedUrl(),
    formResponseUrl: form.getPublishedUrl().replace('/viewform', '/formResponse'),
    editUrl: form.getEditUrl(),
    entries: entries,
    responsesUrl: responsesUrl,
  };
}

/** 訂位表：標題列 + 格式（電話以純文字存放，避免變成 9.12E+08） */
function setupReservationSheet() {
  const ss = SpreadsheetApp.openById(RESERVATION_SHEET_ID);
  let sheet = ss.getSheetByName(RESERVATION_TAB);
  if (!sheet) {
    sheet = ss.getSheets()[0];
    sheet.setName(RESERVATION_TAB);
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, 5).setValues([['姓名', '電話', '人數', '桌號', '已報到']]);
  }
  sheet.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground('#FFD400');
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 120).setColumnWidth(2, 140).setColumnWidth(4, 90).setColumnWidth(5, 90);
  sheet.getRange('B2:B').setNumberFormat('@');           // 電話當文字
  sheet.getRange('E2:E').setNumberFormat('@');           // 已報到：可填 ✔
  sheet.getRange('C2:C').setNumberFormat('0');
  return sheet.getName();
}

/** 把網站設定（表單網址 + entry.ID 對應）寫成一個分頁，方便複製 */
function writeConfigSheet(info) {
  const ss = SpreadsheetApp.openById(RESERVATION_SHEET_ID);
  const name = '網站設定（複製給 Hermes）';
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  sh.clear();

  const lines = [
    ['饗泰多 除夕預點餐 — 網站設定'],
    ['產生時間', new Date()],
    [''],
    ['表單作答網址', info.viewformUrl],
    ['表單送出網址（formResponse）', info.formResponseUrl],
    ['回應試算表', info.responsesUrl],
    ['訂位驗證 Web App 網址（部署後自己填）', 'https://script.google.com/macros/s/....../exec'],
    [''],
    ['欄位', 'entry.ID'],
  ];
  Object.keys(info.entries).forEach(function (title) {
    lines.push([title, info.entries[title]]);
  });
  sh.getRange(1, 1, lines.length, 2).setValues(lines);
  sh.getRange(1, 1).setFontWeight('bold').setFontSize(14);
  sh.getRange(4, 2, 3, 1).setNumberFormat('@');
  sh.setColumnWidth(1, 220).setColumnWidth(2, 420);

  return lines.map(function (r) { return r.join(' | '); }).join('\n');
}

/* ============================ 訂位驗證 API ============================ */
/**
 * 部署成「網頁應用程式」（執行身分：我／存取權：任何人）後，
 * 網站與員工頁就能用 ?phone=0912345678 查詢這支電話是否在訂位名單中。
 * 只回傳 {ok:true/false, name}，不會回傳整份名單。
 */
function doGet(e) {
  const phone = normPhone(e && e.parameter ? e.parameter.phone : '');
  if (!/^09\d{8}$/.test(phone)) return jsonOut({ ok: false, error: 'bad_phone' });

  // 節流：同一支電話每分鐘最多查 10 次
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

/** 測試用：在編輯器直接跑這個，看名單裡第一支電話查不查得到 */
function testVerify() {
  const ss = SpreadsheetApp.openById(RESERVATION_SHEET_ID);
  const sheet = ss.getSheetByName(RESERVATION_TAB) || ss.getSheets()[0];
  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return Logger.log('名單還沒有資料');
  const sample = normPhone(rows[1][0]);
  Logger.log(doGet({ parameter: { phone: sample } }).getContent());
}
