# -*- coding: utf-8 -*-
"""Code.gs 修正：
   ① 修改／取消（update 路徑）也要執行 tidy
   ② 取餐時間統一存成文字（避免 Google 自動轉成 Date，排序與 API 都亂）
   ③ 員工 API 回傳 src（資料來自哪個分頁）方便核對
"""
import io, sys
p = 'scripts/google-apps-script/Code.gs'
s = io.open(p, encoding='utf-8').read()
n = 0

def rep(old, new, label):
    global s, n
    c = s.count(old)
    if c != 1:
        print('FAIL', label, c); sys.exit(1)
    s = s.replace(old, new); n += 1

# ── ① 取餐時間格式化工具（放在內部工具區） ──
rep("""function normPhone(v) {""",
"""/** 取餐時間一律轉成 'yyyy-MM-dd HH:mm' 文字（試算表可能把它變成 Date） */
function pickupStr_(v) {
  if (v instanceof Date) {
    return Utilities.formatDate(v, 'Asia/Taipei', 'yyyy-MM-dd HH:mm');
  }
  const s = String(v == null ? '' : v).trim();
  if (!s) return '';
  const m = s.match(/^(\\d{4})[-\\/](\\d{1,2})[-\\/](\\d{1,2})[ T](\\d{1,2}):(\\d{2})/);
  if (m) {
    const pad = function (x) { return (String(x).length < 2 ? '0' : '') + x; };
    return m[1] + '-' + pad(m[2]) + '-' + pad(m[3]) + ' ' + pad(m[4]) + ':' + m[5];
  }
  return s;
}

function normPhone(v) {""", 'pickupStr_')

# ── ② 寫入前把「取餐時間」欄設成文字格式（新增與更新都要） ──
rep("""  if (rowIndex > 0) {
    // 先設文字格式，避免電話被當成數字而掉了前導 0
    sh.getRange(rowIndex, 5).setNumberFormat('@');
    sh.getRange(rowIndex, 1, 1, ORDER_HEADERS.length).setValues([values]);
    return jsonOut({ ok: true, orderId: orderId, mode: 'updated', row: rowIndex, status: status });
  }""",
"""  if (rowIndex > 0) {
    // 先設文字格式：電話保住前導 0、取餐時間不被轉成日期
    sh.getRange(rowIndex, 5).setNumberFormat('@');
    sh.getRange(rowIndex, 6).setNumberFormat('@');
    sh.getRange(rowIndex, 1, 1, ORDER_HEADERS.length).setValues([values]);
    const tidyUpd = tidyOrderSheet_();     // 取消 → 搬到「已取消」分頁＋重新排序
    return jsonOut({ ok: true, orderId: orderId, mode: 'updated', row: rowIndex, status: status,
                     archived: tidyUpd.moved, active: tidyUpd.kept });
  }""", 'update-tidy')

rep("""  const newRow = sh.getLastRow() + 1;
  sh.getRange(newRow, 5).setNumberFormat('@');          // 電話欄先設文字
  sh.getRange(newRow, 1, 1, ORDER_HEADERS.length).setValues([values]);""",
"""  const newRow = sh.getLastRow() + 1;
  sh.getRange(newRow, 5).setNumberFormat('@');          // 電話欄先設文字
  sh.getRange(newRow, 6).setNumberFormat('@');          // 取餐時間也保持文字
  sh.getRange(newRow, 1, 1, ORDER_HEADERS.length).setValues([values]);""", 'create-text-format')

# ── ③ 寫入值時就用正規化後的取餐時間 ──
rep("""    keep(body.pickup ? safe_(body.pickup) : '', 5),""",
    """    keep(body.pickup ? pickupStr_(body.pickup) : '', 5),""", 'pickup-value')

# ── ④ tidy：把每一列的取餐時間正規化，並用字串排序 ──
rep("""  // ② 排序：取餐時間（字串 YYYY-MM-DD HH:mm 可直接比大小）→ 送出時間（越早越前面）
  const timeOf = function (v) { return v instanceof Date ? v.getTime() : 0; };
  keep.sort(function (a, b) {
    const pa = String(a[5] || ''), pb = String(b[5] || '');
    if (pa !== pb) return pa < pb ? -1 : 1;
    return timeOf(a[14]) - timeOf(b[14]);
  });""",
"""  // ② 取餐時間正規化成文字，再依「取餐時間 → 送出時間」排序
  const timeOf = function (v) { return v instanceof Date ? v.getTime() : 0; };
  keep.concat(moved).forEach(function (r) { r[5] = pickupStr_(r[5]); });
  keep.sort(function (a, b) {
    const pa = String(a[5] || ''), pb = String(b[5] || '');
    if (pa !== pb) return pa < pb ? -1 : 1;
    return timeOf(a[14]) - timeOf(b[14]);
  });""", 'tidy-sort')

# 寫回時把取餐時間欄設文字
rep("""  if (keep.length) {
    sh.getRange(2, 1, keep.length, width).setValues(keep);
    sh.getRange(2, 5, keep.length, 1).setNumberFormat('@');
  }""",
"""  if (keep.length) {
    sh.getRange(2, 1, keep.length, width).setValues(keep);
    sh.getRange(2, 5, keep.length, 1).setNumberFormat('@');
    sh.getRange(2, 6, keep.length, 1).setNumberFormat('@');
  }""", 'tidy-write-format')

# 已取消分頁的取餐時間也設文字
rep("""    arc.getRange(startRow, 5, moved.length, 1).setNumberFormat('@');""",
"""    arc.getRange(startRow, 5, moved.length, 1).setNumberFormat('@');
    arc.getRange(startRow, 6, moved.length, 1).setNumberFormat('@');""", 'archive-format')

# ── ⑤ 員工 API：取餐時間用 pickupStr_、多回傳 src ──
rep("""  const orders = [];
  sources.forEach(function (src) {
  const rows = src.rows, disp = src.disp;""",
"""  const orders = [];
  sources.forEach(function (src) {
  const rows = src.rows, disp = src.disp;""", 'noop-src')

rep("""      pickup: String(r[5] || '').trim(),""",
    """      pickup: pickupStr_(r[5]),""", 'api-pickup')

rep("""    sources.push({
      rows: sh.getRange(2, 1, last - 1, ORDER_HEADERS.length).getValues(),
      disp: sh.getRange(2, 1, last - 1, ORDER_HEADERS.length).getDisplayValues(),
    });""",
"""    sources.push({
      tab: name,
      rows: sh.getRange(2, 1, last - 1, ORDER_HEADERS.length).getValues(),
      disp: sh.getRange(2, 1, last - 1, ORDER_HEADERS.length).getDisplayValues(),
    });""", 'api-tab')

rep("""      updated: String(d[14] || '').trim(),
    });""",
"""      updated: String(d[14] || '').trim(),
      src: src.tab,
    });""", 'api-src')

# setupOrderSheet：取餐時間欄設文字
rep("""  sh.getRange('A2:A').setNumberFormat('@');   // 訂單編號當文字""",
"""  sh.getRange('A2:A').setNumberFormat('@');   // 訂單編號當文字
  sh.getRange('F2:F').setNumberFormat('@');   // 取餐時間當文字（避免被轉成日期）""", 'setup-format')

io.open(p, 'w', encoding='utf-8').write(s)
print('Code.gs 修正完成，共', n, '處')
