# -*- coding: utf-8 -*-
"""辣度「不辣」選項：套餐選項 + 單點（關鍵字比對那 7 道菜）"""
import io

def load(p): return io.open(p, encoding='utf-8').read()
def store(p, s): io.open(p, 'w', encoding='utf-8').write(s)

MISS = []
def rep(s, o, n, label):
    if s.count(o) != 1:
        MISS.append('%s(%d)' % (label, s.count(o)))
        return s
    return s.replace(o, n)

# ── data.js ──
p = 'js/data.js'; s = load(p)
s = rep(s, "const DRINK_UPGRADES = [];   // 不加價升級（門市決定不提供）",
"""const DRINK_UPGRADES = [];   // 不加價升級（門市決定不提供）

/* 可改「不辣」的 7 道菜（關鍵字比對，涵蓋咔／卡滋等寫法） */
const NO_SPICY_KEYS = ['檸檬魚', '扁鱈', '打拋豬', '瀑布牛', '青木瓜', '椒麻雞', '軟殼蟹'];
const canNoSpicy = (name) => NO_SPICY_KEYS.some((k) => String(name || '').indexOf(k) >= 0);""", 'nospicy')
s = rep(s, "window.MENU = { SETS, ALC, CATEGORIES, DRINK_OPTIONS, DRINK_UPGRADES, SPICY, TEMPS, spicyOf, tempsOf, stripSize };",
"window.MENU = { SETS, ALC, CATEGORIES, DRINK_OPTIONS, DRINK_UPGRADES, SPICY, TEMPS, NO_SPICY_KEYS, canNoSpicy, spicyOf, tempsOf, stripSize };",
'exports')
store(p, s)

# ── app.js ──
p = 'js/app.js'; s = load(p)

s = rep(s, "const { SETS, ALC, CATEGORIES, DRINK_OPTIONS, DRINK_UPGRADES, spicyOf, tempsOf } = window.MENU;",
"const { SETS, ALC, CATEGORIES, DRINK_OPTIONS, DRINK_UPGRADES, spicyOf, tempsOf, canNoSpicy } = window.MENU;", 'destructure')

s = rep(s, "picks: {}, drinks: [], upgrades: [], tried: false };",
"picks: {}, drinks: [], upgrades: [], mild: {}, tried: false };", 'draft')
s = rep(s, "  if (!S.draft.upgrades) S.draft.upgrades = [];",
"  if (!S.draft.upgrades) S.draft.upgrades = [];\n  if (!S.draft.mild) S.draft.mild = {};", 'draft-mild')

s = rep(s, '      <div class="group-box" data-group="drink">',
'      <div id="mildBox"></div>\n      <div class="group-box" data-group="drink">', 'mildbox')

s = rep(s, "  $$('[data-upgrade]').forEach((b) => b.classList.toggle('on', S.draft.upgrades.includes(b.dataset.upgrade)));",
"""  // 辣度調整：已選且可改不辣的菜
  const mildSel = [];
  def.groups.forEach((g) => (S.draft.picks[g.key] || []).forEach((nm) => { if (canNoSpicy(nm)) mildSel.push(nm); }));
  const mildBox = $('#mildBox');
  if (mildBox) {
    mildBox.innerHTML = mildSel.length ? `<div class="group-box">
      <div class="group-head"><p class="text-sm font-black">辣度 <span class="text-ink-mute">／可選不辣</span></p></div>
      <div class="mt-2 flex flex-wrap gap-1.5">
        ${mildSel.map((nm) => `<button class="chip ${S.draft.mild[nm] ? 'on' : ''}" data-mildpick="${esc(nm)}">${esc(nm)} 不辣</button>`).join('')}
      </div></div>` : '';
  }

  $$('[data-upgrade]').forEach((b) => b.classList.toggle('on', S.draft.upgrades.includes(b.dataset.upgrade)));""", 'mild-render')

s = rep(s, """  const temps = tempsOf(item.name);
  if (!temps.length) return addAlcLine(itemId, '');""",
"""  const temps = tempsOf(item.name);
  const mildAble = canNoSpicy(item.name);
  if (!temps.length && !mildAble) return addAlcLine(itemId, '');""", 'picker-guard')

s = rep(s, """        ${temps.map((t, i) => `<button class="chip ${i === 0 ? 'on' : ''}" data-temp="${esc(t)}">${esc(t)}</button>`).join('')}
      </div>""",
"""        ${temps.map((t, i) => `<button class="chip ${i === 0 ? 'on' : ''}" data-temp="${esc(t)}">${esc(t)}</button>`).join('')}
      </div>
      ${mildAble ? `<p class="mt-4 text-[10px] tracking-[.22em] text-gold">辣度</p>
      <div class="mt-1.5 flex flex-wrap gap-2" id="mildChips">
        <button class="chip on" data-mild="0">正常</button>
        <button class="chip" data-mild="1">不辣</button>
      </div>` : ''}""", 'picker-ui')

s = rep(s, """      let chosen = temps[0];""", """      let chosen = temps[0] || '';
      let mild = false;""", 'picker-var')
s = rep(s, """      $('#btnTempAdd', root).addEventListener('click', () => {""",
"""      $$('[data-mild]', root).forEach((b) => b.addEventListener('click', () => {
        mild = b.dataset.mild === '1';
        $$('[data-mild]', root).forEach((x) => x.classList.toggle('on', x === b));
      }));
      $('#btnTempAdd', root).addEventListener('click', () => {""", 'picker-mild')
s = rep(s, """        addAlcLine(itemId, chosen);""", """        addAlcLine(itemId, chosen, mild ? '不辣' : '');""", 'picker-add')

s = rep(s, "      if (tempsOf(item.name).length) return openTempPicker(d.addAlc);",
"      if (tempsOf(item.name).length || canNoSpicy(item.name)) return openTempPicker(d.addAlc);", 'route')

s = rep(s, """function addAlcLine(itemId, temp) {
  const item = ALC.find((a) => a.id === itemId);
  const line = S.cart.alc.find((l) => l.id === itemId && (l.temp || '') === (temp || ''));
  if (line) line.qty += 1; else S.cart.alc.push({ id: itemId, temp: temp || '', qty: 1 });
  persistCart();
  renderAll();
  toast(`${item.name}${temp ? `（${temp}）` : ''} 已加入訂單`);
}""",
"""function addAlcLine(itemId, temp, spicy) {
  const item = ALC.find((a) => a.id === itemId);
  const line = S.cart.alc.find((l) => l.id === itemId && (l.temp || '') === (temp || '') && (l.spicy || '') === (spicy || ''));
  if (line) line.qty += 1; else S.cart.alc.push({ id: itemId, temp: temp || '', qty: 1, spicy: spicy || '' });
  persistCart();
  renderAll();
  toast(`${item.name}${temp ? `（${temp}）` : ''}${spicy ? `（${spicy}）` : ''} 已加入訂單`);
}""", 'addalc')

s = rep(s, "const alcKey = (line) => (line.temp ? `${line.id}@${line.temp}` : line.id);",
"const alcKey = (line) => `${line.id}@${line.temp || ''}${line.spicy ? '#' + line.spicy : ''}`;", 'alckey')

s = rep(s, """      const [id, temp = ''] = d.qtyAlc.split('@');
      const line = S.cart.alc.find((l) => l.id === id && (l.temp || '') === temp);""",
"""      const [idTemp, spicy = ''] = d.qtyAlc.split('#');
      const [id, temp = ''] = idTemp.split('@');
      const line = S.cart.alc.find((l) => l.id === id && (l.temp || '') === temp && (l.spicy || '') === spicy);""", 'qty')

s = rep(s, """      const [id, temp = ''] = d.delAlc.split('@');
      S.cart.alc = S.cart.alc.filter((l) => !(l.id === id && (l.temp || '') === temp));""",
"""      const [idTemp2, spicy2 = ''] = d.delAlc.split('#');
      const [id, temp = ''] = idTemp2.split('@');
      S.cart.alc = S.cart.alc.filter((l) => !(l.id === id && (l.temp || '') === temp && (l.spicy || '') === spicy2));""", 'del')

s = rep(s, """${fmt(item.price)}／份 ${line.temp ? tempChip(line.temp) : ''}""",
"""${fmt(item.price)}／份 ${line.temp ? tempChip(line.temp) : ''}${line.spicy ? tempChip(line.spicy) : ''}""", 'cart-alc-show')

s = rep(s, """    return `${item.name}${line.temp ? `(${line.temp})` : ''} x${line.qty}`;""",
"""    return `${item.name}${line.temp ? `(${line.temp})` : ''}${line.spicy ? `(${line.spicy})` : ''} x${line.qty}`;""", 'summary-alc')

s = rep(s, """      rows.push(`　${g.label}：${chosen.length ? chosen.join('、') : '—'}`);""",
"""      rows.push(`　${g.label}：${chosen.length ? chosen.map((nm) => (line.mild && line.mild[nm] ? nm + '（不辣）' : nm)).join('、') : '—'}`);""", 'summary-mild')

s = rep(s, """    const picked = (line.picks[g.key] || []).map((p) => esc(p) + spicyHTML(p)).join('、') || '—';""",
"""    const picked = (line.picks[g.key] || []).map((p) => esc(p) + ((line.mild || {})[p] ? '<span class="text-[9.5px] tracking-[.1em] text-gold">（不辣）</span>' : '') + spicyHTML(p)).join('、') || '—';""", 'cart-mild')

s = rep(s, "    if (d.upgrade !== undefined) {",
"""    if (d.mildpick !== undefined) {
      S.draft.mild[d.mildpick] = !S.draft.mild[d.mildpick];
      return syncDraftUI();
    }
    if (d.upgrade !== undefined) {""", 'mild-event')

s = rep(s, "[data-config-set],[data-pick],[data-upgrade]",
"[data-config-set],[data-pick],[data-mildpick],[data-upgrade]", 'delegate')

store(p, s)
for f in ['index.html', 'staff.html']:
    store(f, load(f).replace('?v=20261024i', '?v=20261024j'))
print('未套用：', MISS if MISS else '無')
