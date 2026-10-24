# -*- coding: utf-8 -*-
"""Code.gs：新增員工看板 API（?staff=1&pw=密碼）"""
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

# 1) 密碼常數
rep("""const ORDER_SHEET_ID_FIXED = '1qaJy5BOywcLwlE4tPdWtdNnaVA1gV6G1a8qe4yrOtIk';""",
"""const ORDER_SHEET_ID_FIXED = '1qaJy5BOywcLwlE4tPdWtdNnaVA1gV6G1a8qe4yrOtIk';

/** 員工看板密碼：改這一行後「重新部署」即生效（請換成自己的密碼） */
const STAFF_PASSWORD = 'SIAMMORE2027';
const STAFF_MAX_TRY = 20;        // 15 分鐘內錯超過這次數就暫時鎖住""", 'const')

# 2) doGet 分流
rep("""function doGet(e) {
  const p = (e && e.parameter) || {};
  const phone = normPhone(p.phone);""",
"""function doGet(e) {
  const p = (e && e.parameter) || {};

  // 員工看板：?staff=1&pw=密碼 → 回傳訂單清單（需密碼，因為含客人姓名電話）
  if (p.staff) return staffOrders_(p);

  const phone = normPhone(p.phone);""", 'doGet')

# 3) 員工看板資料
rep("""/** 依電話找訂位列，回傳 {row, name, code, phone} */""",
"""/**
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

  const sh = orderSheet_().getSheetByName(ORDER_TAB);
  const last = sh.getLastRow();
  if (last < 2) return jsonOut({ ok: true, count: 0, orders: [], updatedAt: new Date().toISOString() });

  const rows = sh.getRange(2, 1, last - 1, ORDER_HEADERS.length).getValues();
  const disp = sh.getRange(2, 1, last - 1, ORDER_HEADERS.length).getDisplayValues();
  const orders = [];
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
  orders.reverse();   // 最新的排前面
  return jsonOut({ ok: true, count: orders.length, orders: orders, updatedAt: new Date().toISOString() });
}

/** 依電話找訂位列，回傳 {row, name, code, phone} */""", 'staffOrders_')

io.open(p, 'w', encoding='utf-8').write(s)
print('Code.gs 已加入員工看板 API，共', n, '處')
