# -*- coding: utf-8 -*-
"""1) Code.gs: num_('') 不可視為 0（否則取消時金額被寫成 0）
   2) app.js: 取消訂單時送出完整金額（不必依賴伺服器補）"""
import io, sys

# ── Code.gs ──
p = 'scripts/google-apps-script/Code.gs'
s = io.open(p, encoding='utf-8').read()
old = """function num_(v) {
  const n = Number(v);
  return isFinite(n) ? n : '';
}"""
new = """function num_(v) {
  // 注意：Number('') === 0，空字串要當「沒有值」而不是 0，否則改單／取消會把金額歸零
  if (v === '' || v === null || v === undefined) return '';
  const n = Number(v);
  return isNaN(n) ? '' : n;
}"""
if s.count(old) != 1:
    print('FAIL num_', s.count(old)); sys.exit(1)
s = s.replace(old, new)
io.open(p, 'w', encoding='utf-8').write(s)
print('Code.gs num_ 已修')

# ── app.js：取消時帶完整金額 ──
p = 'js/app.js'
a = io.open(p, encoding='utf-8').read()
old = """  let delivered = false;
  const useApi = (CFG.ordersWrite && CFG.ordersWrite.mode === 'apps-script' && apiReady());
  try {
    if (useApi) {
      await postOrderToApi({
        action: '取消', orderId, name: o.name, phone: o.phone,
        code: o.code || (S.user && S.user.code) || '', pickup: o.pickup, headcount: o.headcount,
        sets: o.summary, setsTotal: '', alacarte: '', alacarteTotal: '',
        service: '', total: o.total, note: o.note || '無', ts: values.ts,
      });"""
new = """  let delivered = false;
  const useApi = (CFG.ordersWrite && CFG.ordersWrite.mode === 'apps-script' && apiReady());

  // 取消時把當初的金額一起送出去，避免試算表上的金額被清空
  const savedCart = S.cart;
  let money = { setsSubtotal: '', alcSubtotal: '', service: '', alcLines: [] };
  try {
    if (o.cart) {
      S.cart = JSON.parse(JSON.stringify(o.cart));
      const cc = calc();
      const sm = buildSummary();
      money = { setsSubtotal: cc.setsSubtotal, alcSubtotal: cc.alcSubtotal, service: cc.service, alcLines: sm.alcLines };
    }
  } catch (e) { /* 舊資料沒有 cart 就只送金額以外的欄位 */ }
  finally { S.cart = savedCart; }

  try {
    if (useApi) {
      await postOrderToApi({
        action: '取消', orderId, name: o.name, phone: o.phone,
        code: o.code || (S.user && S.user.code) || '', pickup: o.pickup, headcount: o.headcount,
        sets: o.summary, setsTotal: money.setsSubtotal,
        alacarte: money.alcLines.join('、'), alacarteTotal: money.alcSubtotal,
        service: money.service, total: o.total, note: o.note || '無', ts: values.ts,
      });"""
if a.count(old) != 1:
    print('FAIL cancel', a.count(old)); sys.exit(1)
a = a.replace(old, new)
io.open(p, 'w', encoding='utf-8').write(a)
print('app.js cancelOrder 已修')
