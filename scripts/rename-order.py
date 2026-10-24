# -*- coding: utf-8 -*-
"""
1) 購物車 → 訂單（含登入後才顯示訂單頁面）
2) 移除員工專用頁與連結
3) Code.gs 改為寫入使用者指定的訂單表
"""
import io, sys, os

def load(p): return io.open(p, encoding='utf-8').read()
def store(p, s): io.open(p, 'w', encoding='utf-8').write(s)

n = 0
def rep(s, old, new, label, expect=1):
    global n
    c = s.count(old)
    if c != expect:
        print(f'FAIL {label}: {c}（需 {expect}）'); sys.exit(1)
    n += c
    return s.replace(old, new)

# ══════════════════════════════ app.js ══════════════════════════════
p = 'js/app.js'; s = load(p)

# 文案：購物車 → 訂單
pairs = [
    ('加入購物車', '加入訂單'),
    ('已加入購物車', '已加入訂單'),
    ('購物車還是空的', '訂單還是空的'),
    ('購物車是空的', '訂單是空的'),
    ('內容已選滿，可以加入購物車', '內容已選滿，可以加入訂單'),
    ('內容已選滿，登入後即可加入購物車', '內容已選滿，登入後即可加入訂單'),
    ('請依「選 N」規則選滿後再加入購物車', '請依「選 N」規則選滿後再加入訂單'),
    ('請先登入才能把套餐加入購物車', '請先登入才能把套餐加入訂單'),
    ('保留購物車內容，讓客人可以重試', '保留訂單內容，讓客人可以重試'),
    ('修改已送出的訂單：載回購物車', '修改已送出的訂單：載回訂單內容'),
    ('瀏覽器 → 購物車（記憶體 + localStorage）', '瀏覽器 → 訂單內容（記憶體 + localStorage）'),
    ('不能選購（加入購物車／結帳都要登入）', '不能選購（加入訂單／送出都要登入）'),
    ('才能加入購物車（飲料可逐杯選冰／去冰／熱）', '才能加入訂單（飲料可逐杯選冰／去冰／熱）'),
]
for a, b in pairs:
    if s.count(a):
        n += s.count(a); s = s.replace(a, b)

# 抽屜選單：我的購物車 → 訂單內容
s = rep(s, '>我的購物車 <span class="text-ink-mute">›</span></button>',
           '>訂單內容 <span class="text-ink-mute">›</span></button>', 'drawer-cart-item')

# 移除抽屜員工專用連結
s = rep(s, """    <p class="mt-7 text-center"><a href="staff.html" class="text-[9.5px] tracking-[.24em] text-ink-mute/60 transition hover:text-ink-mute">員工專用</a></p>`;""" + "\n}",
           """`;""" + "\n}", 'drawer-staff-link')

# 訂單按鈕與手機列：登入後才出現
s = rep(s, """  $('#cartCountTop').textContent = c.count;
  $('#cartCountTop').classList.toggle('hidden', !c.count);
  $('#cartCountBar').textContent = c.count;
  $('#cartTotalBar').textContent = fmt(c.total);""",
"""  $('#cartCountTop').textContent = c.count;
  $('#cartCountTop').classList.toggle('hidden', !c.count);
  $('#cartCountBar').textContent = c.count;
  $('#cartTotalBar').textContent = fmt(c.total);

  // 訂單頁面只在登入後出現（未登入純瀏覽菜單）
  const on = loggedIn();
  const topBtn = $('#btnCartTop');
  if (topBtn) topBtn.classList.toggle('hidden', !on);
  const bar = $('#mobileBar');
  if (bar) bar.classList.toggle('hidden', !on);""", 'gate-order-entry')

# 登出時若訂單面板開著，順手關掉
s = rep(s, """function doLogout() {
  S.user = null;
  save(LS.user, null);
  closeDrawer();""",
"""function doLogout() {
  S.user = null;
  save(LS.user, null);
  closeDrawer();
  toggleCart(false);""", 'logout-close-cart')

store(p, s)

# ══════════════════════════════ index.html ══════════════════════════════
p = 'index.html'; h = load(p)

h = rep(h, '        購物車\n        <span id="cartCountTop"', '        訂單\n        <span id="cartCountTop"', 'header-label')
h = rep(h, '<div class="fixed inset-x-0 bottom-0 z-40 border-t border-[rgba(23,20,15,.12)] bg-paper/95',
           '<div id="mobileBar" class="fixed inset-x-0 bottom-0 z-40 hidden border-t border-[rgba(23,20,15,.12)] bg-paper/95', 'mobile-bar-id')
h = rep(h, '<button id="btnCartBar" class="btn btn-solid px-5 py-3 text-[11px]">查看購物車</button>',
           '<button id="btnCartBar" class="btn btn-solid px-5 py-3 text-[11px]">查看訂單</button>', 'bar-btn')
h = rep(h, '<!-- ══════════════════════════════ 購物車 ══════════════════════════════ -->',
           '<!-- ══════════════════════════════ 訂單內容 ══════════════════════════════ -->', 'cart-comment')
h = rep(h, '<h3 class="serif text-[15px] tracking-[.24em]">我的購物車</h3>',
           '<h3 class="serif text-[15px] tracking-[.24em]">訂單內容</h3>', 'panel-title')

# 頁尾移除員工專用
h = rep(h, """  <p class="mt-9">
    <a href="staff.html" class="text-[9.5px] tracking-[.26em] text-white/20 transition hover:text-white/55">員工專用</a>
  </p>
""", "", 'footer-staff')
store(p, h)

# ══════════════════════════════ config.js ══════════════════════════════
p = 'js/config.js'; c = load(p)
c = rep(c, """  // ---------------------------------------------------------------------------
  // 員工專用頁（/staff.html）與訂位驗證設定
  // ---------------------------------------------------------------------------
  staff: {
    // 訂位名單試算表：只分享給員工的 Google 帳號（不要把連結公開）
    sheetUrl: 'https://docs.google.com/spreadsheets/d/1vDdLKtOsXu_DbLqwxDzd8i_Dlr_Ya95NddFEBKFXOOQ/edit',
    // 訂單回應試算表（Google 表單回應匯集處）
    ordersSheetUrl: '',
    // 值班電話（員工頁顯示）
    dutyPhone: '',
  },""",
"""  // ---------------------------------------------------------------------------
  // 訂單試算表（Apps Script 會把訂單寫進這張表，僅供備查／核對用）
  //   訂位名單表：https://docs.google.com/spreadsheets/d/1vDdLKtOsXu_DbLqwxDzd8i_Dlr_Ya95NddFEBKFXOOQ/edit
  // ---------------------------------------------------------------------------
  ordersSheetUrl: 'https://docs.google.com/spreadsheets/d/1qaJy5BOywcLwlE4tPdWtdNnaVA1gV6G1a8qe4yrOtIk/edit',""",
         'config-staff-block')
store(p, c)

# ══════════════════════════════ Code.gs ══════════════════════════════
p = 'scripts/google-apps-script/Code.gs'; g = load(p)
g = rep(g, "const ORDER_TAB = '訂單';",
"""const ORDER_TAB = '訂單';
/** 訂單要寫進哪一份試算表：填 ID 就固定用這一張（留空 = 由 setupAll 自動建立新檔） */
const ORDER_SHEET_ID_FIXED = '1qaJy5BOywcLwlE4tPdWtdNnaVA1gV6G1a8qe4yrOtIk';""", 'gs-const')
g = rep(g, "  const savedId = props.getProperty('ORDER_SHEET_ID');",
           "  const savedId = ORDER_SHEET_ID_FIXED || props.getProperty('ORDER_SHEET_ID');", 'gs-setup')
g = rep(g, """function orderSheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('ORDER_SHEET_ID');""",
"""function orderSheet_() {
  const id = ORDER_SHEET_ID_FIXED || PropertiesService.getScriptProperties().getProperty('ORDER_SHEET_ID');""", 'gs-resolve')
store(p, g)

print('完成，共', n, '處')
