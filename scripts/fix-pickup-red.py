# -*- coding: utf-8 -*-
"""① 拿掉取餐日期／時間  ② 套餐內容改成好讀的多行格式  ③ 選套餐時不要一開始就紅框"""
import io, sys
p = 'js/app.js'
s = io.open(p, encoding='utf-8').read()
n = 0

def rep(old, new, label):
    global s, n
    c = s.count(old)
    if c != 1:
        print('FAIL', label, c); sys.exit(1)
    s = s.replace(old, new); n += 1

# ── ① 結帳表單：移除取餐日／時間 ──
rep("""  const c = calc();
  const { min, max, slots } = { min: CFG.orders.openFrom, max: CFG.orders.openTo, slots: CFG.orders.timeSlots };
""",
"""  const c = calc();
""", 'checkout-vars')

rep("""        <label class="block">
          <span class="field-label">預計取餐日</span>
          <input name="date" type="date" required min="${min}" max="${max}" value="${min}"
                 class="field">
        </label>
        <label class="block">
          <span class="field-label">預計取餐時間</span>
          <select name="time" required class="field">
            ${slots.map((t) => `<option value="${t}">${t}</option>`).join('')}
          </select>
        </label>
""", "", 'checkout-fields')

# submitOrder：移除日期時間
rep("""  const date = f.date.value;
  const time = f.time.value;
""", "", 'submit-vars')
rep("""  if (!date || !time) return toast('請選擇預計取餐時間');
""", "", 'submit-validate')
rep("""    pickup: `${date} ${time}`,
""", """    pickup: '',
""", 'submit-values')
rep("""        pickup: values.pickup, headcount: c.headcount,""",
    """        headcount: c.headcount,""", 'api-payload-pickup')
rep("""    orderId, phone, name, pickup: values.pickup, headcount: c.headcount, total: c.total,""",
    """    orderId, phone, name, pickup: '', headcount: c.headcount, total: c.total,""", 'record-pickup')

# 我的訂單 / 成功頁：不再顯示取餐時間
rep("""          <p class="mt-1 text-[12px] text-ink-mute">取餐時間：${esc(o.pickup)}・${o.headcount} 人・總計 ${fmt(o.total)}</p>""",
    """          <p class="mt-1 text-[12px] text-ink-mute">${o.headcount} 人・總計 ${fmt(o.total)}</p>""", 'orders-line')
rep("""          <p>取餐時間：<b>${esc(record.pickup)}</b></p>
""", "", 'success-line')

# ── ② 套餐內容：多行好讀格式 ──
rep("""function buildSummary() {
  const setLines = S.cart.sets.map((line) => {
    const def = SETS.find((s) => s.id === line.setId);
    const picks = def.groups.map((g) => `${g.label}:${(line.picks[g.key] || []).join('/')}`).join(' ');
    const drinks = (line.drinks || []).map((d) => `${d.name}${d.temp ? `(${d.temp})` : ''}`).join('/');
    const ups = (line.upgrades || []).length ? ` 升級:${line.upgrades.join('/')}` : '';
    return `${def.name} x${line.qty} [${picks} | 特選:${def.fixed.join('/')} | 飲料:${drinks}${ups}]`;
  });""",
"""function buildSummary() {
  const setLines = S.cart.sets.map((line) => {
    const def = SETS.find((s) => s.id === line.setId);
    const rows = [`${def.name} ×${line.qty}`];
    // 每個選項類別各一行，門市一眼看出客人選了什麼
    def.groups.forEach((g) => {
      const chosen = (line.picks[g.key] || []).filter(Boolean);
      rows.push(`　${g.label}：${chosen.length ? chosen.join('、') : '—'}`);
    });
    const drinks = (line.drinks || []).filter((d) => d.name)
      .map((d) => `${d.name}${d.temp ? `（${d.temp}）` : ''}`);
    rows.push(`　飲料：${drinks.length ? drinks.join('、') : '—'}`);
    rows.push(`　內含：${def.fixed.join('、')}`);
    if ((line.upgrades || []).length) rows.push(`　升級：${line.upgrades.join('、')}`);
    return rows.join('\\n');
  });""", 'buildSummary')

# ── ③ 選套餐：不要一開就紅框 ──
rep("""function openSetConfig(setId, editLine = null) {""",
"""function draftComplete() {
  if (!S.draft) return false;
  const def = SETS.find((s) => s.id === S.draft.setId);
  if (!def) return false;
  const groupsOK = def.groups.every((g) => (S.draft.picks[g.key] || []).length === g.pick);
  const drinksOK = (S.draft.drinks || []).every((d) => d.name);
  return groupsOK && drinksOK;
}

function openSetConfig(setId, editLine = null) {""", 'draftComplete')

rep("""    : { lineId: `L${Date.now().toString(36)}`, setId, qty: 1, picks: {}, drinks: [], upgrades: [] };""",
    """    : { lineId: `L${Date.now().toString(36)}`, setId, qty: 1, picks: {}, drinks: [], upgrades: [], tried: false };""", 'draft-tried')

rep("""    const box = $(`[data-group="${g.key}"]`);
    box.classList.toggle('bad', chosen.length !== g.pick);""",
"""    const box = $(`[data-group="${g.key}"]`);
    // 只有「按過加入但沒選滿」才亮紅框，一開窗不亮
    box.classList.toggle('bad', S.draft.tried === true && chosen.length !== g.pick);""", 'red-gate')

rep("""    c.className = `text-[11px] font-bold ${chosen.length === g.pick ? 'text-thai-green' : 'text-thai-red'}`;""",
"""    c.className = `text-[11px] font-bold ${chosen.length === g.pick ? 'text-thai-green'
      : (S.draft.tried === true ? 'text-thai-red' : 'text-ink-mute')}`;""", 'counter-color')

rep("""  const drinksOK = S.draft.drinks.every((d) => d.name);
  if (!drinksOK) ok = false;
  const dc = $('[data-counter="drink"]');
  dc.textContent = drinksOK ? `已選 ${S.draft.drinks.length}／${def.drinkPick} ✓` : `還需 ${def.drinkPick - S.draft.drinks.filter((d) => d.name).length} 杯`;
  dc.className = `text-[11px] font-bold ${drinksOK ? 'text-thai-green' : 'text-thai-red'}`;""",
"""  const drinksOK = S.draft.drinks.every((d) => d.name);
  if (!drinksOK) ok = false;
  const drinkBox = $('[data-group="drink"]');
  if (drinkBox) drinkBox.classList.toggle('bad', S.draft.tried === true && !drinksOK);
  const dc = $('[data-counter="drink"]');
  dc.textContent = drinksOK ? `已選 ${S.draft.drinks.length}／${def.drinkPick} ✓` : `還需 ${def.drinkPick - S.draft.drinks.filter((d) => d.name).length} 杯`;
  dc.className = `text-[11px] font-bold ${drinksOK ? 'text-thai-green'
    : (S.draft.tried === true ? 'text-thai-red' : 'text-ink-mute')}`;""", 'drinks-red-gate')

rep("""  const btn = $('[data-add-set]');
  const canAdd = ok && loggedIn();
  btn.disabled = !ok;
  if (!ok) {
    btn.className = 'btn btn-line is-disabled w-full text-[11.5px]';
    btn.textContent = '請選滿內容';
  } else if (!loggedIn()) {""",
"""  const btn = $('[data-add-set]');
  btn.disabled = false;          // 可按：按了才知道哪幾項沒選到
  if (!ok) {
    btn.className = 'btn btn-line w-full text-[11.5px]';
    btn.textContent = '加入訂單';
  } else if (!loggedIn()) {""", 'btn-enabled')

rep("""    if (d.addSet !== undefined) {
      if (!loggedIn()) return needLogin('請先登入才能把套餐加入訂單');""",
"""    if (d.addSet !== undefined) {
      if (!draftComplete()) {
        S.draft.tried = true;
        syncDraftUI();
        const missing = $$('.group-box.bad').length;
        return toast(`還有 ${missing} 項沒選滿，已用紅框標出`);
      }
      if (!loggedIn()) return needLogin('請先登入才能把套餐加入訂單');""", 'addset-guard')

io.open(p, 'w', encoding='utf-8').write(s)
print('app.js 修改', n, '處')
