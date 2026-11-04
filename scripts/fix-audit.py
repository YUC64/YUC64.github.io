# -*- coding: utf-8 -*-
"""修復稽核發現的 BUG"""
import io, re, sys
def load(p): return io.open(p, encoding='utf-8').read()
def store(p, s): io.open(p, 'w', encoding='utf-8').write(s)
miss = []
def rep(s, o, n, l, cnt=1):
    if s.count(o) != cnt:
        miss.append('%s(%d)' % (l, s.count(o))); return s
    return s.replace(o, n)

# ══════════ app.js ══════════
p = 'js/app.js'; s = load(p)

# A) 車號沒有進 API payload（只進了舊表單 fallback）
s = rep(s, "        service: c.service, total: c.total, note: values.note, ts: values.ts,",
           "        service: c.service, total: c.total, note: values.note, car: car || '', ts: values.ts,", 'A-payload')

# E) 辣椒是 <img>，之前只隱藏 svg
s = rep(s, "    b.querySelectorAll('svg').forEach((svg) => { svg.style.display = mild ? 'none' : ''; });",
           "    b.querySelectorAll('svg, img').forEach((el) => { el.style.display = mild ? 'none' : ''; });", 'E-spicy')

# F) 送出後重新載入，套餐卡按鈕沒同步
s = rep(s, """  if (lbl) lbl.textContent = S.hasOrder ? '我的點餐' : '訂單';
  if (S.hasOrder && autoOpen) openMyOrders();""",
"""  if (lbl) lbl.textContent = S.hasOrder ? '我的點餐' : '訂單';
  renderSets();                                  // 讓套餐卡按鈕同步（已送出 → 觀看菜色）
  if (S.hasOrder && autoOpen) openMyOrders();""", 'F-render')

io.open(p, 'w', encoding='utf-8').write(s)

# ══════════ staff.js ══════════
p = 'js/staff.js'; s = load(p)

# B) CSV 少一欄（車號）造成整列左移
s = rep(s, "      o.sets, o.setsTotal, o.alacarte, o.alacarteTotal, o.service, o.total, o.note, o.updated,",
           "      o.sets, o.setsTotal, o.alacarte, o.alacarteTotal, o.service, o.total, o.note, o.car, o.updated,", 'B-csv')

# H) 排序選單顯示與實際排序不一致 → 渲染時同步 select
m = re.search(r"(\n\s*(?:\$\('#sortSel'\)|document\.querySelector\('#sortSel'\))[^\n]*\n)", s)
if "sortSel" in s:
    # 在 render() 內把 select 值同步（找 render 函式起點插入）
    rm = re.search(r"(function render\(\)\s*\{\n)", s)
    if rm:
        s = s[:rm.end()] + "    const ssel = $('#sortSel') || document.getElementById('sortSel');\n    if (ssel) ssel.value = S.sort;\n" + s[rm.end():]
    else:
        miss.append('H-render')
else:
    miss.append('H-no-sortSel')
io.open(p, 'w', encoding='utf-8').write(s)

# ══════════ 抽屜「訂單內容」未登入要擋 ══════════
p = 'js/app.js'; s = load(p)
m = re.search(r"if \(d\.menuAction === 'cart'\) return[^\n]*\n", s)
if m:
    s = s[:m.start()] + "if (d.menuAction === 'cart') {\n      if (!loggedIn()) { openLogin(); return toast('請先登入才能查看您的點餐', 2600); }\n      return toggleCart(true);\n    }\n" + s[m.end():]
else:
    miss.append('G-cart-drawer')
# 抽屜項目：未登入時隱藏「訂單內容」
m2 = re.search(r"<button data-menu-action=\"cart\"[^>]*>訂單內容[^\n]*\n", s)
if m2:
    s = s[:m2.start()] + '${loggedIn() ? `' + m2.group(0).rstrip('\n') + '` : \'\'}\n' + s[m2.end():]
else:
    miss.append('G-drawer-item')
io.open(p, 'w', encoding='utf-8').write(s)

# ══════════ Code.gs ══════════
p = 'scripts/google-apps-script/Code.gs'; s = load(p)

# C) 員工端 updated 會變成原始 Date 字串
s = rep(s, "      updated: String(r[COL_UPDATED] || '').trim(),", "      updated: tsStr_(r[COL_UPDATED]),", 'C-updated')

# D) 開放／收回權限只找主表 → 已取消的訂單一定失敗
old = """  const sh = orderSheet_().getSheetByName(ORDER_TAB);
  const last = sh ? sh.getLastRow() : 0;
  if (last < 2) return jsonOut({ ok: false, error: 'order_not_found' });
  const rows = sh.getRange(2, 1, last - 1, ORDER_HEADERS.length).getValues();
  for (let i = rows.length - 1; i >= 0; i--) {
    if (String(rows[i][0] || '').trim() === oid) {
      sh.getRange(i + 2, COL_FLAG + 1).setValues([[open ? 'open' : '']]);
      return jsonOut({ ok: true, orderId: oid, editable: open, row: i + 2 });
    }
  }
  return jsonOut({ ok: false, error: 'order_not_found' });"""
new = """  const ss = orderSheet_();
  const tabs = [ORDER_TAB, ARCHIVE_TAB];   // 主表找不到就找「已取消」分頁
  for (let t = 0; t < tabs.length; t++) {
    const sh = ss.getSheetByName(tabs[t]);
    if (!sh) continue;
    const last = sh.getLastRow();
    if (last < 2) continue;
    const rows = sh.getRange(2, 1, last - 1, ORDER_HEADERS.length).getValues();
    for (let i = rows.length - 1; i >= 0; i--) {
      if (String(rows[i][0] || '').trim() === oid) {
        sh.getRange(i + 2, COL_FLAG + 1).setValues([[open ? 'open' : '']]);
        return jsonOut({ ok: true, orderId: oid, editable: open, row: i + 2, tab: tabs[t] });
      }
    }
  }
  return jsonOut({ ok: false, error: 'order_not_found' });"""
s = rep(s, old, new, 'D-setedit')
io.open(p, 'w', encoding='utf-8').write(s)

for f in ['index.html', 'staff.html']:
    store(f, load(f).replace('?v=20261104f', '?v=20261105a'))
print('未套用:', miss if miss else '無')
