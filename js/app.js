/* =============================================================================
 *  饗泰多 SIAM MORE｜除夕線上預點餐 — 前端主程式（Vanilla JS，無框架、無後端）
 *
 *  資料流：瀏覽器 → 購物車（記憶體 + localStorage）→ Google 表單 formResponse
 *  規則（依門市菜單 PDF）：
 *    1. 未登入只能瀏覽菜單，不能選購（加入購物車／結帳都要登入）
 *    2. 必須先加入一份「春節多人套餐」，才能單點加點
 *    3. 套餐內容需依「選 N」規則選滿才能加入購物車（飲料可逐杯選冰／去冰／熱）
 *    4. 金額 = 套餐 + 單點，另加 10% 服務費；每人最低消費 $600
 *    5. 辣度依 PDF 辣椒圖示數量顯示
 * ========================================================================== */

/* 包在 IIFE 內，避免與 data.js / config.js 的全域常數（SETS、CONFIG…）互相衝突 */
(function () {
'use strict';

/* ---------------------------------------------------------------- 小工具 */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const fmt = (n) => '$' + Number(n).toLocaleString('zh-TW');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const round = (n) => Math.round(n);

const LS = {
  user:   'eatthai.v2.user',
  cart:   'eatthai.v2.cart',
  orders: 'eatthai.v2.orders',
  users:  'eatthai.v2.users',
};
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 私密模式 */ } };

const { SETS, ALC, CATEGORIES, DRINK_OPTIONS, DRINK_UPGRADES, spicyOf, tempsOf } = window.MENU;
const CFG = window.CONFIG;

/** 統一產生「來電門市 xxx」的字串；沒設門市電話時不要留一個空白的電話 */
const tel = (verb = '來電門市') => (CFG.brand.phone ? `${verb} ${esc(CFG.brand.phone)}` : '洽門市人員');

/* ---------------------------------------------------------------- 辣度／冰熱 */
/** 辣度圖示（用門市菜單 PDF 上的辣椒圖） */
const spicyHTML = (name, cls = 'h-3.5') => {
  const n = spicyOf(name);
  if (!n) return '';
  const one = `<img src="assets/img/spicy.png" alt="辣" class="${cls} w-auto">`;
  return `<span class="inline-flex items-center gap-0.5 align-[-2px]" title="辣度 ${n}／2（依門市菜單標示）">${one.repeat(n)}</span>`;
};
const tempChip = (t) => `<span class="rounded bg-ink/5 px-1.5 py-0.5 text-[10px] font-black text-ink-soft">${esc(t)}</span>`;

/* ---------------------------------------------------------------- 狀態 */
const S = {
  user: load(LS.user, null),
  cart: load(LS.cart, { sets: [], alc: [] }),
  orders: load(LS.orders, []),
  users: load(LS.users, {}),
  cat: 'cold',
  editing: null,
  draft: null,
};

const persistCart = () => save(LS.cart, S.cart);
const hasSet = () => S.cart.sets.length > 0;
const alcLocked = () => CFG.rules.requireSetBeforeAlcarte && !hasSet();
const loggedIn = () => !!S.user;

/** 需要登入的動作：未登入就提示並開啟登入視窗，回傳 true 表示已攔下 */
function needLogin(msg = '請先登入才能選購餐點') {
  if (loggedIn()) return false;
  toast(msg, 2600);
  openLogin();
  return true;
}

/* ---------------------------------------------------------------- 金額 */
function calc() {
  const setsSubtotal = S.cart.sets.reduce((sum, line) => {
    const def = SETS.find((s) => s.id === line.setId);
    return sum + (def ? def.price * line.qty : 0);
  }, 0);
  const alcSubtotal = S.cart.alc.reduce((sum, line) => {
    const item = ALC.find((a) => a.id === line.id);
    return sum + (item ? item.price * line.qty : 0);
  }, 0);
  const subtotal = setsSubtotal + alcSubtotal;
  const service = round(subtotal * CFG.rules.serviceChargeRate);
  const count = S.cart.sets.reduce((n, l) => n + l.qty, 0) + S.cart.alc.reduce((n, l) => n + l.qty, 0);
  const headcount = S.cart.sets.reduce((n, l) => {
    const def = SETS.find((s) => s.id === l.setId);
    return n + (def ? def.people * l.qty : 0);
  }, 0);
  return { setsSubtotal, alcSubtotal, subtotal, service, total: subtotal + service, count, headcount };
}

/* ---------------------------------------------------------------- Toast / Modal */
let toastTimer;
function toast(msg, ms = 2200) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), ms);
}

function openModal(html, opts = {}) {
  const modal = $('#modal');
  $('#modalBox').innerHTML = html;
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.body.style.overflow = 'hidden';
  if (opts.onMount) opts.onMount($('#modalBox'));
}
function closeModal() {
  const modal = $('#modal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  $('#modalBox').innerHTML = '';
  document.body.style.overflow = '';
}
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeModal(); toggleCart(false); } });

/* ---------------------------------------------------------------- 圖片 */
function imgBlock(src, alt, emoji = '🍲', aspect = 'aspect-[4/3]') {
  return `<div class="group relative ${aspect} w-full overflow-hidden rounded-xl img-fallback">
      <span class="absolute inset-0 grid place-items-center text-4xl">${emoji}</span>
      <span class="absolute inset-x-0 bottom-0 bg-black/35 px-2 py-1 text-[10px] font-bold text-white/90">饗泰多</span>
      <img src="${esc(src)}" alt="${esc(alt)}" loading="lazy"
           class="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
           onerror="this.style.display='none'">
    </div>`;
}

/* ================================================================ 套餐區 */
function setCardHTML(def) {
  const fixed = def.fixed.length
    ? `<p class="mt-1 text-[12px] leading-relaxed text-ink-mute"><b class="text-ink">套餐特選：</b>${def.fixed.map((f) => esc(f) + spicyHTML(f)).join('、')}</p>`
    : '';
  const openLabel = loggedIn() ? '挑選菜色並加入購物車' : '查看菜色內容（登入後才能選購）';
  return `<article class="card-enter overflow-hidden rounded-3xl border border-ink/10 bg-white shadow-card">
    <div class="relative">
      ${imgBlock(def.img, def.name, '🍛', 'aspect-[3/2]')}
      <span class="absolute left-3 top-3 rounded-full bg-ink px-3 py-1 text-[11px] font-black text-brand">${def.people} 人套餐</span>
      <span class="absolute right-3 top-3 rounded-full bg-brand px-3 py-1 text-[11px] font-black text-ink">${esc(def.dishLine)}</span>
    </div>
    <div class="p-4">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h3 class="text-xl font-black">${esc(def.name)}</h3>
          ${fixed}
        </div>
        <p class="shrink-0 text-right">
          <span class="block text-2xl font-black text-thai-red">${fmt(def.price)}</span>
          <span class="block text-[11px] text-ink-mute">${def.rice}</span>
        </p>
      </div>
      <div class="mt-3 rounded-xl bg-[#F7F4EC] px-3 py-2 text-[12px] text-ink-soft">
        需選擇：${def.groups.map((g) => `${esc(g.label)} ${g.pick} 道`).join('、')}、飲料 ${def.drinkPick} 杯（每杯可選冰／去冰／熱）
      </div>
      <button data-config-set="${def.id}"
              class="mt-3 w-full rounded-full py-3 text-sm font-black transition ${loggedIn() ? 'bg-ink text-white hover:bg-black' : 'bg-siam-purple text-white hover:bg-siam-dark'} active:scale-[.99]">
        ${openLabel}
      </button>
    </div>
  </article>`;
}

function renderSets() {
  $('#setList').innerHTML = SETS.map(setCardHTML).join('');
}

/* -------- 套餐選配彈窗 -------- */
function openSetConfig(setId, editLine = null) {
  const def = SETS.find((s) => s.id === setId);
  S.draft = editLine
    ? JSON.parse(JSON.stringify(editLine))
    : { lineId: `L${Date.now().toString(36)}`, setId, qty: 1, picks: {}, drinks: [], upgrades: [] };

  def.groups.forEach((g) => { if (!S.draft.picks[g.key]) S.draft.picks[g.key] = []; });
  if (!S.draft.upgrades) S.draft.upgrades = [];

  // 飲料：以「杯」為單位，預設第一種飲料 + 第一個冰熱選項，可逐杯調整
  if (!Array.isArray(S.draft.drinks) || S.draft.drinks.length !== def.drinkPick) {
    const d0 = DRINK_OPTIONS[0];
    S.draft.drinks = Array.from({ length: def.drinkPick }, () => ({ name: d0, temp: (tempsOf(d0)[0] || '') }));
  }

  openModal(`
    <div class="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-ink/10 bg-white px-4 py-3">
      <div>
        <h3 class="text-lg font-black">${esc(def.name)}</h3>
        <p class="text-[12px] text-ink-mute">${esc(def.dishLine)}・${def.rice}・${fmt(def.price)}</p>
      </div>
      <button data-close-modal class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink/5 hover:bg-ink/10">✕</button>
    </div>
    <div class="space-y-4 px-4 py-4">
      <div class="rounded-2xl border border-brand-deep bg-brand/15 p-3 text-[12px] leading-relaxed text-ink-soft">
        <b class="text-ink">套餐特選（隨餐附贈）</b><br>${def.fixed.map((f) => esc(f) + spicyHTML(f)).join('、')}
      </div>
      ${def.groups.map((g) => `
        <div class="group-box" data-group="${g.key}">
          <div class="group-head">
            <p class="text-sm font-black">${esc(g.label)} <span class="text-ink-mute">／選 ${g.pick}</span></p>
            <p class="text-[11px] font-bold" data-counter="${g.key}"></p>
          </div>
          <div class="mt-2 flex flex-wrap gap-1.5">
            ${g.options.map((o) => `<button class="chip" data-pick="${g.key}" data-value="${esc(o)}">${esc(o)}${spicyHTML(o)}</button>`).join('')}
          </div>
        </div>`).join('')}
      <div class="group-box" data-group="drink">
        <div class="group-head">
          <p class="text-sm font-black">飲料 <span class="text-ink-mute">／選 ${def.drinkPick} 杯</span></p>
          <p class="text-[11px] font-bold" data-counter="drink"></p>
        </div>
        <p class="mt-1 text-[11px] text-ink-mute">每一杯都可以單獨選品項與冰／去冰／熱</p>
        <div class="mt-2 space-y-2">${drinkSlotsHTML()}</div>
      </div>
      <div class="group-box">
        <p class="text-sm font-black">加價升級酒類／特調 <span class="text-ink-mute">（可選，價差依現場公告）</span></p>
        <div class="mt-2 flex flex-wrap gap-1.5">
          ${DRINK_UPGRADES.map((u) => `<button class="chip" data-upgrade="${esc(u)}">${esc(u)}</button>`).join('')}
        </div>
      </div>
    </div>
    <div class="sticky bottom-0 border-t border-ink/10 bg-white px-4 py-3">
      <div class="mb-2 flex items-center justify-between text-sm">
        <span class="font-bold text-ink-mute">金額</span>
        <span class="text-xl font-black">${fmt(def.price)}</span>
      </div>
      <button data-add-set class="w-full rounded-full py-3 text-sm font-black transition">加入購物車</button>
      <p data-draft-hint class="mt-2 text-center text-[12px] font-bold text-ink-mute"></p>
    </div>`, {
    onMount: (root) => {
      root.addEventListener('change', (e) => {
        const d = e.target.dataset;
        if (d.drinkslot !== undefined) {
          const i = Number(d.drinkslot);
          const name = e.target.value;
          S.draft.drinks[i] = { name, temp: tempsOf(name)[0] || '' };
          $('[data-group="drink"]', root).querySelector('div.mt-2.space-y-2').innerHTML = drinkSlotsHTML();
          syncDraftUI();
        }
        if (d.tempslot !== undefined) {
          S.draft.drinks[Number(d.tempslot)].temp = e.target.value;
          syncDraftUI();
        }
      });
      syncDraftUI();
    },
  });
}

/** 飲料逐杯選擇器 */
function drinkSlotsHTML() {
  return S.draft.drinks.map((slot, i) => {
    const temps = tempsOf(slot.name);
    return `<div class="flex items-center gap-2 rounded-xl bg-white px-2 py-2">
      <span class="w-11 shrink-0 text-[11px] font-black text-ink-mute">第 ${i + 1} 杯</span>
      <select data-drinkslot="${i}" class="min-w-0 flex-1 rounded-lg border border-ink/15 bg-white px-2 py-1.5 text-[13px] font-bold outline-none focus:border-ink">
        ${DRINK_OPTIONS.map((d) => `<option value="${esc(d)}"${slot.name === d ? ' selected' : ''}>${esc(d)}</option>`).join('')}
      </select>
      ${temps.length ? `<select data-tempslot="${i}" class="w-24 shrink-0 rounded-lg border border-ink/15 bg-white px-2 py-1.5 text-[13px] font-bold outline-none focus:border-ink">
        ${temps.map((t) => `<option value="${esc(t)}"${slot.temp === t ? ' selected' : ''}>${esc(t)}</option>`).join('')}
      </select>` : '<span class="w-24 shrink-0 text-center text-[11px] text-ink-mute">冰飲</span>'}
    </div>`;
  }).join('');
}

function syncDraftUI() {
  const def = SETS.find((s) => s.id === S.draft.setId);
  let ok = true;
  def.groups.forEach((g) => {
    const chosen = S.draft.picks[g.key] || [];
    const box = $(`[data-group="${g.key}"]`);
    box.classList.toggle('bad', chosen.length !== g.pick);
    if (chosen.length !== g.pick) ok = false;
    const c = $(`[data-counter="${g.key}"]`);
    c.textContent = chosen.length === g.pick ? `已選 ${chosen.length}／${g.pick} ✓` : `還需 ${g.pick - chosen.length} 道`;
    c.className = `text-[11px] font-bold ${chosen.length === g.pick ? 'text-thai-green' : 'text-thai-red'}`;
    $$(`[data-pick="${g.key}"]`).forEach((b) => b.classList.toggle('on', chosen.includes(b.dataset.value)));
  });

  const drinksOK = S.draft.drinks.every((d) => d.name);
  if (!drinksOK) ok = false;
  const dc = $('[data-counter="drink"]');
  dc.textContent = drinksOK ? `已選 ${S.draft.drinks.length}／${def.drinkPick} ✓` : `還需 ${def.drinkPick - S.draft.drinks.filter((d) => d.name).length} 杯`;
  dc.className = `text-[11px] font-bold ${drinksOK ? 'text-thai-green' : 'text-thai-red'}`;

  $$('[data-upgrade]').forEach((b) => b.classList.toggle('on', S.draft.upgrades.includes(b.dataset.upgrade)));

  const btn = $('[data-add-set]');
  const canAdd = ok && loggedIn();
  btn.disabled = !ok;
  if (!ok) {
    btn.className = 'w-full rounded-full py-3 text-sm font-black transition bg-gray-200 text-gray-400';
    btn.textContent = '加入購物車';
  } else if (!loggedIn()) {
    btn.className = 'w-full rounded-full py-3 text-sm font-black transition bg-siam-purple text-white hover:bg-siam-dark';
    btn.textContent = '登入後加入購物車';
  } else {
    btn.className = 'w-full rounded-full py-3 text-sm font-black transition bg-brand text-ink hover:bg-brand-dark';
    btn.textContent = '加入購物車';
  }
  $('[data-draft-hint]').textContent = !ok
    ? '請依「選 N」規則選滿後再加入購物車'
    : (loggedIn() ? '內容已選滿，可以加入購物車' : '內容已選滿，登入後即可加入購物車');
}

/* ================================================================ 單點區 */
function renderTabs() {
  $('#catTabs > div').innerHTML = CATEGORIES.map((c) => {
    const on = c.key === S.cat;
    return `<button data-cat="${c.key}" class="rounded-full px-4 py-2 text-sm font-black transition ${on ? 'bg-ink text-white' : 'bg-white text-ink-soft hover:bg-ink/5'}">${esc(c.label)}</button>`;
  }).join('');
}

const alcKey = (line) => (line.temp ? `${line.id}@${line.temp}` : line.id);

function alcCardHTML(item) {
  const locked = alcLocked();
  const inCart = S.cart.alc.filter((l) => l.id === item.id).reduce((n, l) => n + l.qty, 0);
  const temps = tempsOf(item.name);
  const badges = [
    item.veg ? '<span class="rounded bg-thai-green/10 px-1.5 py-0.5 text-[10px] font-bold text-thai-green">素</span>' : '',
    item.hot ? '<span class="rounded bg-brand px-1.5 py-0.5 text-[10px] font-bold text-ink">招牌</span>' : '',
  ].join(' ');
  // 未登入時按鈕要「可按」才會提示登入；已登入但未選套餐才停用
  const blocked = locked && loggedIn();
  const label = blocked ? '需先選套餐' : (loggedIn() ? '加入' : '登入後選購');
  const btnClass = blocked
    ? 'cursor-not-allowed bg-gray-200 text-gray-400'
    : (loggedIn() ? 'bg-ink text-white hover:bg-black active:scale-95' : 'bg-siam-purple text-white hover:bg-siam-dark active:scale-95');
  return `<article class="card-enter flex flex-col overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-card ${locked ? 'opacity-70' : ''}">
    <div class="relative">
      ${imgBlock(item.img, item.name, '🍜')}
      ${inCart ? `<span class="absolute right-2 top-2 rounded-full bg-thai-red px-2 py-0.5 text-[10px] font-black text-white">已選 ${inCart}</span>` : ''}
    </div>
    <div class="flex flex-1 flex-col p-3">
      <h3 class="text-sm font-black leading-snug">${esc(item.name)} ${spicyHTML(item.name)} ${badges}</h3>
      <p class="mt-1 text-[11px] text-ink-mute">${esc(item.unit || (item.alcohol ? '含酒精' : temps.length ? temps.join('／') : '單點'))}</p>
      ${item.desc ? `<p class="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-ink-soft/80">${esc(item.desc)}</p>` : ''}
      <div class="mt-auto flex items-center justify-between gap-2 pt-3">
        <span class="text-base font-black text-thai-red">${fmt(item.price)}</span>
        <button data-add-alc="${item.id}" ${blocked ? 'disabled' : ''}
                class="rounded-full px-3 py-1.5 text-[12px] font-black transition ${btnClass}">${label}</button>
      </div>
    </div>
  </article>`;
}

function renderAlc() {
  const list = ALC.filter((a) => a.cat === S.cat);
  $('#alcList').innerHTML = list.map(alcCardHTML).join('');
  const locked = alcLocked();
  $('#alcLock').classList.toggle('hidden', !locked);
  $('#alcHint').textContent = locked
    ? (loggedIn() ? '先選一份春節套餐即可解鎖單點菜色。' : '登入並選擇一份春節套餐後，即可加點單點菜色。')
    : '單點已解鎖 ✓ 加點不受套餐規則限制（金額另加 10% 服務費）。';
}

/* -------- 冰／去冰／熱選擇（單點甜點、飲料） -------- */
function openTempPicker(itemId) {
  const item = ALC.find((a) => a.id === itemId);
  const temps = tempsOf(item.name);
  if (!temps.length) return addAlcLine(itemId, '');
  openModal(`
    <div class="flex items-start justify-between border-b border-ink/10 px-4 py-3">
      <div>
        <h3 class="text-lg font-black">${esc(item.name)}</h3>
        <p class="text-[12px] text-ink-mute">${fmt(item.price)}・請選擇${esc(temps.join('／'))}</p>
      </div>
      <button data-close-modal class="grid h-9 w-9 place-items-center rounded-full bg-ink/5">✕</button>
    </div>
    <div class="px-4 py-4">
      <div class="flex flex-wrap gap-2" id="tempChips">
        ${temps.map((t, i) => `<button class="chip ${i === 0 ? 'on' : ''}" data-temp="${esc(t)}">${esc(t)}</button>`).join('')}
      </div>
      <button id="btnTempAdd" class="mt-4 w-full rounded-full bg-brand py-3 text-sm font-black text-ink hover:bg-brand-dark">
        加入購物車
      </button>
    </div>`, {
    onMount: (root) => {
      let chosen = temps[0];
      $$('[data-temp]', root).forEach((b) => b.addEventListener('click', () => {
        chosen = b.dataset.temp;
        $$('[data-temp]', root).forEach((x) => x.classList.toggle('on', x === b));
      }));
      $('#btnTempAdd', root).addEventListener('click', () => {
        closeModal();
        if (needLogin()) return;
        addAlcLine(itemId, chosen);
      });
    },
  });
}

function addAlcLine(itemId, temp) {
  const item = ALC.find((a) => a.id === itemId);
  const line = S.cart.alc.find((l) => l.id === itemId && (l.temp || '') === (temp || ''));
  if (line) line.qty += 1; else S.cart.alc.push({ id: itemId, temp: temp || '', qty: 1 });
  persistCart();
  renderAll();
  toast(`${item.name}${temp ? `（${temp}）` : ''} 已加入購物車`);
}

/* ================================================================ 購物車 */
function setLineHTML(line) {
  const def = SETS.find((s) => s.id === line.setId);
  if (!def) return '';
  const groups = def.groups.map((g) => {
    const picked = (line.picks[g.key] || []).map((p) => esc(p) + spicyHTML(p)).join('、') || '—';
    return `<li><b>${esc(g.label)}：</b>${picked}</li>`;
  }).join('');
  const drinks = (Array.isArray(line.drinks) ? line.drinks : [])
    .map((d) => `${esc(d.name)}${d.temp ? `(${esc(d.temp)})` : ''}`).join('、') || '—';
  const ups = line.upgrades && line.upgrades.length
    ? `<li><b>升級：</b>${line.upgrades.map(esc).join('、')}（價差現場計）</li>` : '';
  return `<div class="rounded-2xl border border-ink/10 bg-white p-3">
    <div class="flex items-start gap-3">
      <div class="w-20 shrink-0">${imgBlock(def.img, def.name, '🍛', 'aspect-[3/2]')}</div>
      <div class="min-w-0 flex-1">
        <div class="flex items-start justify-between gap-2">
          <p class="text-sm font-black leading-snug">${esc(def.name)}</p>
          <button data-del-set="${line.lineId}" class="text-[11px] font-bold text-ink-mute hover:text-thai-red">移除</button>
        </div>
        <p class="mt-0.5 text-[11px] text-ink-mute">${esc(def.dishLine)}・${esc(def.rice)}</p>
        <ul class="mt-1.5 space-y-0.5 text-[11px] leading-relaxed text-ink-soft">${groups}
          <li><b>特選：</b>${def.fixed.map((f) => esc(f) + spicyHTML(f)).join('、')}</li>
          <li><b>飲料：</b>${drinks}</li>${ups}
        </ul>
        <div class="mt-2 flex items-center justify-between">
          <span class="flex items-center gap-2">
            <button class="qty-btn" data-qty-set="${line.lineId}" data-delta="-1">−</button>
            <span class="w-6 text-center text-sm font-black">${line.qty}</span>
            <button class="qty-btn" data-qty-set="${line.lineId}" data-delta="1">+</button>
          </span>
          <span class="text-base font-black text-thai-red">${fmt(def.price * line.qty)}</span>
        </div>
      </div>
    </div>
  </div>`;
}

function alcLineHTML(line) {
  const item = ALC.find((a) => a.id === line.id);
  if (!item) return '';
  const key = alcKey(line);
  return `<div class="flex items-center gap-3 rounded-2xl border border-ink/10 bg-white p-3">
    <div class="w-16 shrink-0">${imgBlock(item.img, item.name, '🍜')}</div>
    <div class="min-w-0 flex-1">
      <p class="truncate text-sm font-black">${esc(item.name)} ${spicyHTML(item.name)}</p>
      <p class="mt-0.5 text-[11px] text-ink-mute">${fmt(item.price)}／份 ${line.temp ? tempChip(line.temp) : ''}</p>
      <div class="mt-1.5 flex items-center gap-2">
        <button class="qty-btn" data-qty-alc="${esc(key)}" data-delta="-1">−</button>
        <span class="w-6 text-center text-sm font-black">${line.qty}</span>
        <button class="qty-btn" data-qty-alc="${esc(key)}" data-delta="1">+</button>
        <button data-del-alc="${esc(key)}" class="ml-auto text-[11px] font-bold text-ink-mute hover:text-thai-red">移除</button>
      </div>
    </div>
    <span class="shrink-0 text-base font-black text-thai-red">${fmt(item.price * line.qty)}</span>
  </div>`;
}

function renderCart() {
  const c = calc();
  const body = $('#cartBody');

  if (!c.count) {
    body.innerHTML = `<div class="grid h-full place-items-center text-center">
      <div>
        <p class="text-4xl">🛒</p>
        <p class="mt-2 font-black">購物車還是空的</p>
        <p class="mt-1 text-sm text-ink-mute">${loggedIn() ? '先挑一份春節套餐，再來加點單點菜色吧！' : '登入後就可以開始點餐。'}</p>
        <a href="#sets" data-close-cart class="mt-3 inline-block rounded-full bg-ink px-5 py-2 text-sm font-bold text-white">去挑套餐</a>
      </div></div>`;
  } else {
    body.innerHTML = `<div class="space-y-3">
      ${S.cart.sets.length ? `<p class="text-[11px] font-black text-ink-mute">春節套餐（${S.cart.sets.length}）</p>${S.cart.sets.map(setLineHTML).join('')}` : ''}
      ${S.cart.alc.length ? `<p class="pt-1 text-[11px] font-black text-ink-mute">單點加點（${S.cart.alc.length}）</p>${S.cart.alc.map(alcLineHTML).join('')}` : `
        <div class="rounded-2xl border border-dashed border-ink/15 p-4 text-center text-[12px] text-ink-mute">
          還沒加點單點菜色（可不加點直接送出訂單）
        </div>`}
    </div>`;
  }

  const perPerson = c.headcount ? c.subtotal / c.headcount : 0;
  const lowSpend = c.headcount > 0 && perPerson < CFG.rules.minSpendPerPerson;
  const canCheckout = c.count && !alcLocked() && loggedIn();
  $('#cartFoot').innerHTML = `
    <div class="space-y-1.5 text-sm">
      <div class="flex justify-between"><span class="text-ink-mute">套餐小計</span><span class="font-bold">${fmt(c.setsSubtotal)}</span></div>
      <div class="flex justify-between"><span class="text-ink-mute">單點小計</span><span class="font-bold">${fmt(c.alcSubtotal)}</span></div>
      <div class="flex justify-between"><span class="text-ink-mute">服務費 10%</span><span class="font-bold">${fmt(c.service)}</span></div>
      <div class="mt-1 flex items-end justify-between border-t border-dashed border-ink/15 pt-2">
        <span class="font-black">總計</span><span class="text-2xl font-black text-thai-red">${fmt(c.total)}</span>
      </div>
      ${c.headcount ? `<p class="text-right text-[11px] ${lowSpend ? 'font-bold text-thai-red' : 'text-ink-mute'}">
        用餐人數 ${c.headcount} 人・每人平均 ${fmt(round(perPerson))}${lowSpend ? `（未達最低消費 ${fmt(CFG.rules.minSpendPerPerson)}）` : ''}</p>` : ''}
    </div>
    <button id="btnCheckout" ${canCheckout ? '' : 'disabled'}
      class="mt-3 w-full rounded-full py-3.5 text-sm font-black transition ${canCheckout ? 'bg-brand text-ink hover:bg-brand-dark' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}">
      ${!loggedIn() ? '登入後才能結帳' : (alcLocked() ? '請先選擇春節套餐' : '前往填寫訂購資料')}
    </button>
    <p class="mt-2 text-center text-[11px] text-ink-mute">送出即代表同意門市訂購規則；現場結帳（無線上金流）</p>`;

  $('#cartCountTop').textContent = c.count;
  $('#cartCountTop').classList.toggle('hidden', !c.count);
  $('#cartCountBar').textContent = c.count;
  $('#cartTotalBar').textContent = fmt(c.total);
  if ($('#btnCheckout')) $('#btnCheckout').addEventListener('click', openCheckout);
}

function toggleCart(open) {
  const panel = $('#cartPanel'), overlay = $('#cartOverlay');
  const willOpen = open ?? !panel.classList.contains('open');
  panel.classList.toggle('open', willOpen);
  overlay.classList.toggle('hidden', !willOpen);
  document.body.style.overflow = willOpen ? 'hidden' : '';
  if (willOpen) renderCart();
}

/* ================================================================ 訂位驗證 / 訂單 API */
const API_BASE = () => String((CFG.api && CFG.api.endpoint) || '').trim();
const apiReady = () => API_BASE().length > 0;
const needVerifyCode = () => (CFG.reservation || {}).mode === 'endpoint'
  && (CFG.reservation || {}).requireCode !== false && apiReady();

/** PBKDF2-SHA256 → hex（hashfile 模式用） */
async function pbkdf2Hex(text, salt, iterations) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(text), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations, hash: 'SHA-256' }, key, 256);
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** 把 Apps Script 回傳的錯誤碼翻成人話 */
const verifyErrorText = (data) => {
  switch (data && data.error) {
    case 'bad_code':
      return `驗證碼錯誤${data.remaining != null ? `（還可嘗試 ${data.remaining} 次）` : ''}`;
    case 'not_found':
      return '查無此訂位資料，請確認是訂位時留的手機號碼';
    case 'too_many_attempts':
      return '嘗試次數過多，請 1 小時後再試，或直接來電門市';
    case 'need_code':
      return '請輸入門市提供的驗證碼';
    case 'bad_phone':
      return '手機號碼格式錯誤';
    default:
      return '訂位驗證失敗，請稍後再試或來電門市';
  }
};

/**
 * 檢查這支電話（＋驗證碼）是不是有效訂位。
 *   mode='endpoint' → 呼叫 api.endpoint（Apps Script，名單不外流）
 *   mode='hashfile' → 讀公開雜湊檔比對
 *   mode='off'      → 不驗證
 */
async function verifyReservation(phone, code) {
  const R = CFG.reservation || {};
  const mode = R.mode || 'off';

  if (mode === 'endpoint' && apiReady()) {
    try {
      const qs = new URLSearchParams({ phone });
      if (R.requireCode !== false) qs.set('code', code || '');
      const res = await fetch(`${API_BASE()}?${qs.toString()}`, { method: 'GET' });
      const data = await res.json();
      if (data.ok) return { ok: true, verified: true, name: data.name || '', mode, error: false };
      return { ok: false, verified: false, name: '', mode, error: false,
               message: verifyErrorText(data), code: data.error };
    } catch (err) {
      console.warn('訂位驗證連線失敗', err);
      return {
        ok: R.onError === 'allow', verified: false, name: '', mode, error: true,
        message: R.onError === 'allow'
          ? '訂位驗證服務暫時無法連線，先讓您繼續點餐（訂單會標記待確認）'
          : '訂位驗證服務暫時無法連線，請稍後再試或來電門市',
      };
    }
  }

  if (mode === 'hashfile') {
    try {
      window.__resList = window.__resList
        || fetch(R.hashFile || 'data/reservations.json').then((r) => r.json());
      const list = await window.__resList;
      const h = await pbkdf2Hex(phone, list.salt, list.iterations || 200000);
      const hit = (list.entries || []).find((e) => e.h === h);
      return { ok: !!hit, verified: !!hit, name: (hit && hit.n) || '', mode, error: false };
    } catch (err) {
      console.warn('訂位雜湊檔讀取失敗', err);
      return { ok: R.onError === 'allow', verified: false, name: '', mode, error: true,
               message: '訂位名單讀取失敗，先讓您繼續點餐' };
    }
  }

  return { ok: true, verified: false, name: '', mode: 'off', error: false };
}

/** 訂單寫入：POST 給 Apps Script（同一訂單編號會覆蓋同一列） */
async function postOrderToApi(payload) {
  const res = await fetch(API_BASE(), {
    method: 'POST',
    // 用 text/plain 避免 CORS 預檢；Apps Script 端再 JSON.parse
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!data.ok) {
    const map = {
      bad_code: '驗證碼驗證失敗，請重新登入',
      not_found: '查無訂位資料，請重新登入',
      not_your_order: '這筆訂單不是這個手機號碼的',
      order_not_found: '找不到這筆訂單（可能已被取消）',
      no_order_id: '訂單編號遺失，請重新整理後再試',
    };
    throw new Error(map[data.error] || `寫入失敗（${data.error || '未知錯誤'}）`);
  }
  return data;   // { mode:'created'|'updated', row, status }
}

const verifyStateText = (u) => {
  if (!u) return '';
  if (u.verifyMode === 'off') return '<span class="text-amber-700">訂位驗證：未啟用（示範模式）</span>';
  return u.verified
    ? '<span class="text-thai-green">訂位已驗證 ✓</span>'
    : '<span class="text-amber-700">未通過訂位驗證</span>';
};

/* ================================================================ 登入／會員 */
function openLogin() {
  const u = S.user;
  openModal(`
    <div class="flex items-start justify-between border-b border-ink/10 px-4 py-3">
      <div>
        <h3 class="text-lg font-black">訂位客人登入</h3>
        <p class="text-[12px] text-ink-mute">${needVerifyCode()
          ? '請輸入訂位時的<b>手機號碼</b>與門市提供的<b>驗證碼</b>，通過後才能選購'
          : '需為<b>已訂位</b>的客人：請填訂位時留的手機號碼，登入後才能選購'}</p>
      </div>
      <button data-close-modal class="grid h-9 w-9 place-items-center rounded-full bg-ink/5">✕</button>
    </div>
    <form id="loginForm" class="space-y-3 px-4 py-4">
      <label class="block">
        <span class="text-[12px] font-black">姓名</span>
        <input name="name" required value="${u ? esc(u.name) : ''}" placeholder="王小明"
               class="mt-1 w-full rounded-xl border border-ink/15 px-3 py-2.5 text-sm outline-none focus:border-ink">
      </label>
      <label class="block">
        <span class="text-[12px] font-black">手機號碼</span>
        <input name="phone" required inputmode="numeric" value="${u ? esc(u.phone) : ''}" placeholder="0912345678" maxlength="10"
               class="mt-1 w-full rounded-xl border border-ink/15 px-3 py-2.5 text-sm outline-none focus:border-ink">
        <span class="mt-1 block text-[11px] text-ink-mute">格式：09 開頭共 10 碼</span>
      </label>
      ${needVerifyCode() ? `
      <label class="block">
        <span class="text-[12px] font-black">驗證碼</span>
        <input name="code" required inputmode="numeric" maxlength="6" placeholder="門市提供的 4 位數字"
               class="mt-1 w-full rounded-xl border border-ink/15 px-3 py-2.5 text-sm tracking-[.4em] outline-none focus:border-ink">
        <span class="mt-1 block text-[11px] text-ink-mute">訂位完成後由門市提供（簡訊／LINE／電話）</span>
      </label>` : `
      <label class="block">
        <span class="text-[12px] font-black">自訂 4 位數密碼 <span class="font-normal text-ink-mute">（首次登入即設定，之後用來登入）</span></span>
        <input name="pin" required inputmode="numeric" maxlength="4" placeholder="例如 1234"
               class="mt-1 w-full rounded-xl border border-ink/15 px-3 py-2.5 text-sm tracking-[.4em] outline-none focus:border-ink">
      </label>`}
      <div id="verifyMsg" class="hidden rounded-xl px-3 py-2 text-[12px] font-bold leading-relaxed"></div>
      <button type="submit" class="w-full rounded-full bg-siam-purple py-3 text-sm font-black text-white hover:bg-siam-dark">登入／註冊</button>
      <p class="rounded-xl bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
        ⓘ 本網站無後端伺服器：帳號與訂單紀錄僅儲存在<b>這支裝置的瀏覽器</b>內（換裝置請重新登入）。
        為保護隱私，請勿使用您在別處使用過的密碼。
      </p>
    </form>`, {
    onMount: (root) => {
      $('#loginForm', root).addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = e.target;
        const btn = $('button[type="submit"]', root);
        let name = f.name.value.trim();
        const phone = f.phone.value.replace(/\D/g, '');
        const useCode = needVerifyCode();
        const code = useCode ? f.code.value.replace(/\D/g, '') : '';
        const pin = useCode ? '' : f.pin.value.trim();
        const msgBox = $('#verifyMsg', root);
        if (!/^09\d{8}$/.test(phone)) return toast('手機號碼格式錯誤（需 09 開頭 10 碼）');
        if (useCode && !/^\d{4,6}$/.test(code)) return toast('請輸入門市提供的驗證碼');
        if (!useCode && !/^\d{4}$/.test(pin)) return toast('密碼需為 4 位數字');

        // 驗證訂位：endpoint 模式＝電話＋驗證碼；off/hashfile＝只驗電話
        btn.disabled = true;
        const label = btn.textContent;
        btn.textContent = '驗證訂位中…';
        const v = await verifyReservation(phone, code);
        btn.disabled = false;
        btn.textContent = label;

        if (!v.ok) {
          msgBox.className = 'rounded-xl bg-thai-red/10 px-3 py-2 text-[12px] font-bold leading-relaxed text-thai-red';
          msgBox.innerHTML = `${esc(v.message || '驗證失敗')}<br>需要協助請${tel()}`;
          return;
        }
        if (v.error) toast(v.message || '驗證服務連線異常，先讓您繼續點餐', 3600);
        if (!name && v.name) name = v.name;
        if (!name) return toast('請填寫姓名');

        // 沒有驗證碼模式時，才用本機自訂密碼（純前端帳號）
        if (!useCode) {
          const known = S.users[phone];
          if (known) {
            if (known.pin !== pin) return toast('密碼不正確');
            if (known.name !== name) S.users[phone].name = name;
          } else {
            S.users[phone] = { name, pin };
          }
          save(LS.users, S.users);
        }
        S.user = { name, phone, code, verified: v.verified, verifyMode: v.mode, verifyError: !!v.error };
        save(LS.user, S.user);
        const draft = S.draft;   // 若正在選套餐，登入後回到原畫面
        closeModal();
        renderAll();
        if (draft) openSetConfig(draft.setId, draft);
        toast(`歡迎，${name}！可以開始選購了`);
      });
    },
  });
}

function renderMember() {
  const card = $('#memberCard');
  $('#loginPrompt').classList.toggle('hidden', loggedIn());
  if (!S.user) {
    card.classList.add('hidden');
    $('#loginLabel').textContent = '登入';
    return;
  }
  const mine = S.orders.filter((o) => o.phone === S.user.phone);
  card.classList.remove('hidden');
  $('#loginLabel').textContent = S.user.name;
  card.innerHTML = `<div class="flex flex-wrap items-center gap-3">
    <span class="grid h-11 w-11 place-items-center rounded-full bg-siam-purple text-lg font-black text-white">${esc(S.user.name.slice(0, 1))}</span>
    <div class="min-w-0">
      <p class="font-black">${esc(S.user.name)} <span class="text-[11px] font-normal text-ink-mute">已登入・可以選購</span></p>
      <p class="text-[12px] text-ink-mute">${esc(S.user.phone)}・本機訂單 ${mine.length} 筆</p>
      <p class="text-[12px]">${verifyStateText(S.user)}</p>
    </div>
    <div class="ml-auto flex gap-2">
      <button id="btnMyOrders" class="rounded-full bg-ink px-4 py-2 text-[12px] font-black text-white">我的訂單</button>
      <button id="btnLogout" class="rounded-full bg-ink/5 px-4 py-2 text-[12px] font-bold">登出</button>
    </div>
  </div>`;
  $('#btnMyOrders').addEventListener('click', openMyOrders);
  $('#btnLogout').addEventListener('click', () => {
    S.user = null;
    save(LS.user, null);
    renderAll();
    toast('已登出，登出後只能瀏覽菜單');
  });
}

/* ================================================================ 我的訂單 */
function openMyOrders() {
  if (!S.user) return openLogin();
  const mine = S.orders.filter((o) => o.phone === S.user.phone).sort((a, b) => b.ts - a.ts);
  const statusColor = { 新訂單: 'bg-thai-green/10 text-thai-green', 修改訂單: 'bg-amber-100 text-amber-800', 取消訂單: 'bg-thai-red/10 text-thai-red' };
  openModal(`
    <div class="flex items-start justify-between border-b border-ink/10 px-4 py-3">
      <div>
        <h3 class="text-lg font-black">我的訂單</h3>
        <p class="text-[12px] text-ink-mute">${esc(S.user.name)}・${esc(S.user.phone)}</p>
      </div>
      <button data-close-modal class="grid h-9 w-9 place-items-center rounded-full bg-ink/5">✕</button>
    </div>
    <div class="space-y-3 px-4 py-4">
      ${mine.length ? mine.map((o) => `
        <div class="rounded-2xl border border-ink/10 bg-white p-3">
          <div class="flex items-center justify-between gap-2">
            <p class="font-black">${esc(o.orderId)}</p>
            <span class="rounded-full px-2 py-0.5 text-[11px] font-black ${statusColor[o.status] || ''}">${esc(o.status)}</span>
          </div>
          <p class="mt-1 text-[12px] text-ink-mute">取餐時間：${esc(o.pickup)}・${o.headcount} 人・總計 ${fmt(o.total)}</p>
          <p class="mt-1 line-clamp-2 text-[11px] leading-relaxed text-ink-soft">${esc(o.summary)}</p>
          <div class="mt-2 flex gap-2">
            <button data-edit-order="${esc(o.orderId)}" ${o.status === '取消訂單' ? 'disabled' : ''}
              class="rounded-full bg-ink px-3 py-1.5 text-[12px] font-black text-white disabled:bg-gray-200 disabled:text-gray-400">修改內容</button>
            <button data-cancel-order="${esc(o.orderId)}" ${o.status === '取消訂單' ? 'disabled' : ''}
              class="rounded-full bg-ink/5 px-3 py-1.5 text-[12px] font-bold disabled:opacity-40">取消訂單</button>
          </div>
        </div>`).join('') : `<p class="py-8 text-center text-sm text-ink-mute">這支手機還沒有訂單紀錄</p>`}
      <div class="rounded-2xl bg-[#F7F4EC] p-3">
        <p class="text-[12px] font-black">找不到訂單？用訂單編號查詢</p>
        <div class="mt-2 flex gap-2">
          <input id="findOrder" placeholder="例如 XT2701251830" class="min-w-0 flex-1 rounded-xl border border-ink/15 px-3 py-2 text-sm outline-none focus:border-ink">
          <button id="btnFindOrder" class="rounded-xl bg-ink px-4 text-[12px] font-black text-white">查詢</button>
        </div>
        <p id="findResult" class="mt-2 text-[11px] text-ink-mute"></p>
      </div>
      <p class="rounded-xl bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
        ⓘ 無後端架構下，訂單紀錄保存在本機瀏覽器：換手機／清除瀏覽器資料後將無法在此查詢，
        請保留訂單編號或直接來電門市。
      </p>
    </div>`, {
    onMount: (root) => {
      $('#btnFindOrder', root).addEventListener('click', () => {
        const q = $('#findOrder', root).value.trim().toUpperCase();
        const hit = S.orders.find((o) => o.orderId.toUpperCase() === q);
        $('#findResult', root).innerHTML = hit
          ? `找到訂單 <b>${esc(hit.orderId)}</b>（${esc(hit.status)}）總計 ${fmt(hit.total)}；若為本機訂單可直接修改。`
          : `查無此訂單。無後端架構下僅能查詢本機紀錄，請${tel()}。`;
      });
    },
  });
}

/* ================================================================ 結帳 */
function openCheckout() {
  if (!loggedIn()) { toast('請先登入才能結帳'); return openLogin(); }
  if (alcLocked()) return toast('請先選擇一份春節套餐');
  if (!calc().count) return toast('購物車是空的');

  const c = calc();
  const { min, max, slots } = { min: CFG.orders.openFrom, max: CFG.orders.openTo, slots: CFG.orders.timeSlots };

  openModal(`
    <div class="flex items-start justify-between border-b border-ink/10 px-4 py-3">
      <div>
        <h3 class="text-lg font-black">填寫訂購資料</h3>
        <p class="text-[12px] text-ink-mute">${S.editing ? `修改訂單 ${esc(S.editing)}` : '送出後我們會替您備餐'}</p>
      </div>
      <button data-close-modal class="grid h-9 w-9 place-items-center rounded-full bg-ink/5">✕</button>
    </div>
    <form id="orderForm" class="space-y-3 px-4 py-4">
      <div class="grid gap-3 sm:grid-cols-2">
        <label class="block">
          <span class="text-[12px] font-black">姓名 *</span>
          <input name="name" required value="${esc(S.user.name)}"
                 class="mt-1 w-full rounded-xl border border-ink/15 px-3 py-2.5 text-sm outline-none focus:border-ink">
        </label>
        <label class="block">
          <span class="text-[12px] font-black">電話 *</span>
          <input name="phone" required inputmode="numeric" maxlength="10" value="${esc(S.user.phone)}"
                 class="mt-1 w-full rounded-xl border border-ink/15 px-3 py-2.5 text-sm outline-none focus:border-ink">
        </label>
        <label class="block">
          <span class="text-[12px] font-black">預計取餐日 *</span>
          <input name="date" type="date" required min="${min}" max="${max}" value="${min}"
                 class="mt-1 w-full rounded-xl border border-ink/15 px-3 py-2.5 text-sm outline-none focus:border-ink">
        </label>
        <label class="block">
          <span class="text-[12px] font-black">預計取餐時間 *</span>
          <select name="time" required class="mt-1 w-full rounded-xl border border-ink/15 px-3 py-2.5 text-sm outline-none focus:border-ink">
            ${slots.map((t) => `<option value="${t}">${t}</option>`).join('')}
          </select>
        </label>
      </div>
      <label class="block">
        <span class="text-[12px] font-black">備註 <span class="font-normal text-ink-mute">（素食、兒童座椅、飲料升級說明…）</span></span>
        <textarea name="note" rows="2" class="mt-1 w-full rounded-xl border border-ink/15 px-3 py-2.5 text-sm outline-none focus:border-ink"></textarea>
      </label>

      <div class="rounded-2xl bg-[#F7F4EC] p-3 text-[12px] leading-relaxed">
        <p class="font-black">訂單摘要</p>
        <p class="mt-1 text-ink-soft">用餐人數：${c.headcount} 人（依套餐人數計算）</p>
        <p class="text-ink-soft">套餐 ${fmt(c.setsSubtotal)} + 單點 ${fmt(c.alcSubtotal)} + 服務費 ${fmt(c.service)}</p>
        <p class="mt-1 text-base font-black">總計 ${fmt(c.total)}</p>
        ${c.headcount && c.subtotal / c.headcount < CFG.rules.minSpendPerPerson
          ? `<p class="mt-1 font-bold text-thai-red">⚠ 每人平均 ${fmt(round(c.subtotal / c.headcount))}，未達最低消費 ${fmt(CFG.rules.minSpendPerPerson)}</p>` : ''}
      </div>

      ${(apiReady() || CFG.form.action) ? '' : `<p class="rounded-xl bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
        ⓘ <b>示範模式</b>：尚未連接門市系統（Apps Script 與 Google 表單都未設定），送出後訂單只會存在本機。設定方式見 SETUP.md。</p>`}

      <button id="btnSubmit" class="w-full rounded-full bg-brand py-3.5 text-sm font-black text-ink transition hover:bg-brand-dark">
        確認送出訂單
      </button>
      <p class="text-center text-[11px] text-ink-mute">本頁不含線上付款，款項請於現場結清</p>
    </form>`, {
    onMount: (root) => { $('#orderForm', root).addEventListener('submit', submitOrder); },
  });
}

/* ---------------- 訂單字串化（給 Google 表單用） ---------------- */
function buildSummary() {
  const setLines = S.cart.sets.map((line) => {
    const def = SETS.find((s) => s.id === line.setId);
    const picks = def.groups.map((g) => `${g.label}:${(line.picks[g.key] || []).join('/')}`).join(' ');
    const drinks = (line.drinks || []).map((d) => `${d.name}${d.temp ? `(${d.temp})` : ''}`).join('/');
    const ups = (line.upgrades || []).length ? ` 升級:${line.upgrades.join('/')}` : '';
    return `${def.name} x${line.qty} [${picks} | 特選:${def.fixed.join('/')} | 飲料:${drinks}${ups}]`;
  });
  const alcLines = S.cart.alc.map((line) => {
    const item = ALC.find((a) => a.id === line.id);
    return `${item.name}${line.temp ? `(${line.temp})` : ''} x${line.qty}`;
  });
  return { setLines, alcLines };
}

function makeOrderId() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `XT${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${Math.floor(Math.random() * 900 + 100)}`;
}

async function submitOrder(ev) {
  ev.preventDefault();
  if (!loggedIn()) { toast('請先登入才能送出訂單'); return openLogin(); }
  const f = ev.target;
  const btn = $('#btnSubmit');
  const name = f.name.value.trim();
  const phone = f.phone.value.replace(/\D/g, '');
  const date = f.date.value;
  const time = f.time.value;
  const note = f.note.value.trim();

  if (!name) return toast('請填寫姓名');
  if (!/^09\d{8}$/.test(phone)) return toast('電話格式錯誤（09 開頭共 10 碼）');
  if (!date || !time) return toast('請選擇預計取餐時間');
  if (alcLocked()) return toast('請先選擇春節套餐');
  if (!calc().count) return toast('購物車是空的');

  const c = calc();
  const { setLines, alcLines } = buildSummary();
  const orderId = S.editing || makeOrderId();
  const act = S.editing ? '修改訂單' : '新訂單';
  // 未通過訂位驗證的訂單要標記，門市才知道要再核對
  const resMode = (CFG.reservation && CFG.reservation.mode) || 'off';
  const flag = resMode !== 'off' && !S.user.verified ? '[未通過訂位驗證] ' : '';

  const values = {
    orderId,
    action: act,
    name,
    phone,
    pickup: `${date} ${time}`,
    headcount: `${c.headcount} 人`,
    sets: setLines.join(' ｜ ') || '無',
    setsTotal: String(c.setsSubtotal),
    alacarte: alcLines.join('、') || '無',
    alacarteTotal: String(c.alcSubtotal),
    service: String(c.service),
    total: String(c.total),
    note: flag + (note || '無'),
    ts: new Date().toLocaleString('zh-TW', { hour12: false }),
  };

  const useApi = (CFG.ordersWrite && CFG.ordersWrite.mode === 'apps-script' && apiReady());
  btn.disabled = true;
  btn.textContent = '傳送中…';
  let delivered = false;
  let writeInfo = null;
  try {
    if (useApi) {
      writeInfo = await postOrderToApi({
        action: S.editing ? '修改' : '新增',
        orderId, name, phone, code: S.user.code || '',
        pickup: values.pickup, headcount: c.headcount,
        sets: setLines.join(' ｜ '), setsTotal: c.setsSubtotal,
        alacarte: alcLines.join('、'), alacarteTotal: c.alcSubtotal,
        service: c.service, total: c.total, note: values.note, ts: values.ts,
      });
      delivered = true;
    } else {
      delivered = await postToGoogleForm(values);
    }
  } catch (err) {
    console.warn('訂單寫入失敗', err);
    btn.disabled = false;
    btn.textContent = '確認送出訂單';
    toast(`送出失敗：${err.message || '請稍後再試'}`, 4200);
    return;   // 保留購物車內容，讓客人可以重試
  }

  const record = {
    orderId, phone, name, pickup: values.pickup, headcount: c.headcount, total: c.total,
    status: act, ts: Date.now(), note,
    code: S.user.code || '',
    summary: [...setLines, ...alcLines].join(' ｜ '),
    cart: JSON.parse(JSON.stringify(S.cart)),
    delivered,
    writeMode: writeInfo ? writeInfo.mode : (delivered ? 'form' : 'local'),
  };
  S.orders = S.orders.filter((o) => o.orderId !== orderId).concat(record);
  save(LS.orders, S.orders);

  S.editing = null;
  S.cart = { sets: [], alc: [] };
  persistCart();
  renderAll();
  showSuccess(record, delivered);
}

/** 送到 Google 表單：no-cors + x-www-form-urlencoded，比對 entry.ID */
async function postToGoogleForm(values) {
  const { action, entries } = CFG.form;
  if (!action || !entries.orderId) {
    console.info('[示範模式] 未設定 Google 表單，訂單內容如下：', values);
    return false;
  }
  const body = new URLSearchParams();
  Object.entries(entries).forEach(([field, entryId]) => {
    if (entryId && values[field] != null) body.append(entryId, values[field]);
  });
  body.append('fvv', '1');
  body.append('pageHistory', '0');
  await fetch(action, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: body.toString(),
  });
  return true; // no-cors 無法讀取回應，能送出即視為成功
}

function showSuccess(record, delivered) {
  openModal(`
    <div class="px-5 py-6 text-center">
      <p class="tick mx-auto grid h-16 w-16 place-items-center rounded-full bg-thai-green text-3xl text-white">✓</p>
      <h3 class="mt-3 text-xl font-black">訂購成功！</h3>
      <p class="mt-1 text-sm text-ink-mute">${record.status === '修改訂單' ? '訂單內容已更新，' : ''}我們已收到您的預訂內容</p>
      <div class="mt-4 rounded-2xl bg-[#F7F4EC] p-4 text-left text-[13px]">
        <p class="text-[11px] font-black text-ink-mute">訂單編號</p>
        <p class="text-2xl font-black tracking-wider">${esc(record.orderId)}</p>
        <div class="mt-3 space-y-0.5 text-ink-soft">
          <p>取餐時間：<b>${esc(record.pickup)}</b></p>
          <p>用餐人數：<b>${record.headcount} 人</b></p>
          <p>總計：<b>${fmt(record.total)}</b>（含服務費）</p>
        </div>
      </div>
      <p class="mt-3 rounded-xl ${delivered ? 'bg-thai-green/10 text-thai-green' : 'bg-amber-50 text-amber-900'} px-3 py-2 text-[11px] leading-relaxed">
        ${!delivered
          ? '示範模式：尚未連接門市系統，此筆訂單僅儲存在本機（請見 SETUP.md 設定後再正式收單）。'
          : record.writeMode === 'updated'
            ? '訂單已更新到門市試算表（同一筆覆蓋，不會多出一列）。'
            : record.writeMode === 'created'
              ? '訂單已寫入門市試算表，門市將依此備餐。'
              : '訂單已送出到門市 Google 表單（修改會以新的一列記錄，門市取最新一筆）。'}
      </p>
      <div class="mt-4 flex flex-col gap-2">
        <button id="btnGoOrders" class="w-full rounded-full bg-ink py-3 text-sm font-black text-white">查看我的訂單（可修改／取消）</button>
        <button data-close-modal class="w-full rounded-full bg-ink/5 py-3 text-sm font-bold">繼續點餐</button>
      </div>
      <p class="mt-3 text-[11px] text-ink-mute">如需變更，請登入同一支手機號碼後於「我的訂單」修改，或${tel()}</p>
    </div>`, {
    onMount: (root) => $('#btnGoOrders', root).addEventListener('click', () => { closeModal(); openMyOrders(); }),
  });
  toast(delivered ? '訂單已送出' : '已建立本機訂單（示範模式）');
}

/* -------- 修改已送出的訂單：載回購物車 -------- */
function loadOrderForEdit(orderId) {
  const o = S.orders.find((x) => x.orderId === orderId);
  if (!o) return toast('找不到這筆訂單');
  S.cart = JSON.parse(JSON.stringify(o.cart));
  S.editing = orderId;
  persistCart();
  closeModal();
  renderAll();
  toggleCart(true);
  toast('已載入原訂單內容，修改後按「前往填寫訂購資料」重新送出');
}

async function cancelOrder(orderId) {
  const o = S.orders.find((x) => x.orderId === orderId);
  if (!o) return;
  if (!confirm(`確定要取消訂單 ${orderId} 嗎？`)) return;
  const values = {
    orderId, action: '取消訂單', name: o.name, phone: o.phone, pickup: o.pickup,
    headcount: `${o.headcount} 人`, sets: o.summary, setsTotal: '', alacarte: '',
    alacarteTotal: '', service: '', total: String(o.total), note: o.note || '無',
    ts: new Date().toLocaleString('zh-TW', { hour12: false }),
  };
  let delivered = false;
  const useApi = (CFG.ordersWrite && CFG.ordersWrite.mode === 'apps-script' && apiReady());
  try {
    if (useApi) {
      await postOrderToApi({
        action: '取消', orderId, name: o.name, phone: o.phone,
        code: o.code || (S.user && S.user.code) || '', pickup: o.pickup, headcount: o.headcount,
        sets: o.summary, setsTotal: '', alacarte: '', alacarteTotal: '',
        service: '', total: o.total, note: o.note || '無', ts: values.ts,
      });
      delivered = true;
    } else {
      delivered = await postToGoogleForm(values);
    }
  } catch (err) {
    console.warn('取消訂單失敗', err);
    return toast(`取消失敗：${err.message || '請稍後再試'}`, 4200);
  }
  o.status = '取消訂單';
  o.ts = Date.now();
  save(LS.orders, S.orders);
  closeModal();
  renderAll();
  toast(delivered ? '已送出取消通知' : '已取消（示範模式，僅更新本機紀錄）');
}

/* ================================================================ 事件綁定 */
function bindEvents() {
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-config-set],[data-pick],[data-upgrade],[data-add-set],[data-close-modal],[data-close-cart],[data-add-alc],[data-qty-alc],[data-del-alc],[data-qty-set],[data-del-set],[data-cat],[data-edit-order],[data-cancel-order]');
    if (!t) return;
    const d = t.dataset;

    if (d.configSet !== undefined) return openSetConfig(d.configSet);
    if (d.closeModal !== undefined) return closeModal();

    if (d.pick !== undefined) {   // 空字串屬性也是假值，一律用 !== undefined 判斷
      const g = SETS.find((s) => s.id === S.draft.setId).groups.find((x) => x.key === d.pick);
      const arr = S.draft.picks[d.pick];
      const i = arr.indexOf(d.value);
      if (i >= 0) arr.splice(i, 1);
      else if (arr.length < g.pick) arr.push(d.value);
      else { arr.shift(); arr.push(d.value); toast(`「${g.label}」最多選 ${g.pick} 道，已自動替換`); }
      return syncDraftUI();
    }
    if (d.upgrade !== undefined) {
      const i = S.draft.upgrades.indexOf(d.upgrade);
      if (i >= 0) S.draft.upgrades.splice(i, 1); else S.draft.upgrades.push(d.upgrade);
      return syncDraftUI();
    }
    if (d.addSet !== undefined) {
      if (!loggedIn()) return needLogin('請先登入才能把套餐加入購物車');
      const existing = S.cart.sets.findIndex((l) => l.lineId === S.draft.lineId);
      if (existing >= 0) S.cart.sets[existing] = S.draft; else S.cart.sets.push(S.draft);
      S.draft = null;
      persistCart(); closeModal(); renderAll();
      toast('套餐已加入購物車');
      return;
    }
    if (d.addAlc !== undefined) {
      if (needLogin('請先登入才能選購餐點')) return;
      if (alcLocked()) return toast('請先選擇一份春節套餐才能加點單點');
      const item = ALC.find((a) => a.id === d.addAlc);
      if (tempsOf(item.name).length) return openTempPicker(d.addAlc);
      return addAlcLine(d.addAlc, '');
    }
    if (d.qtyAlc !== undefined) {
      const [id, temp = ''] = d.qtyAlc.split('@');
      const line = S.cart.alc.find((l) => l.id === id && (l.temp || '') === temp);
      if (!line) return;
      line.qty += Number(d.delta);
      if (line.qty <= 0) S.cart.alc = S.cart.alc.filter((l) => l !== line);
      else if (line.qty > 20) { line.qty = 20; toast('單一品項最多 20 份'); }
      persistCart(); renderAll();
      return;
    }
    if (d.delAlc !== undefined) {
      const [id, temp = ''] = d.delAlc.split('@');
      S.cart.alc = S.cart.alc.filter((l) => !(l.id === id && (l.temp || '') === temp));
      persistCart(); renderAll(); return toast('已移除');
    }
    if (d.qtySet !== undefined) {
      const line = S.cart.sets.find((l) => l.lineId === d.qtySet);
      line.qty += Number(d.delta);
      if (line.qty <= 0) S.cart.sets = S.cart.sets.filter((l) => l.lineId !== d.qtySet);
      else if (line.qty > 20) line.qty = 20;
      persistCart(); renderAll(); return;
    }
    if (d.delSet !== undefined) {
      S.cart.sets = S.cart.sets.filter((l) => l.lineId !== d.delSet);
      persistCart(); renderAll(); return toast('已移除套餐');
    }
    if (d.cat !== undefined) { S.cat = d.cat; renderTabs(); renderAlc(); return; }
    if (d.editOrder !== undefined) return loadOrderForEdit(d.editOrder);
    if (d.cancelOrder !== undefined) return cancelOrder(d.cancelOrder);
    if (d.closeCart !== undefined) return toggleCart(false);
  });

  $('#btnCartTop').addEventListener('click', () => toggleCart());
  $('#btnCartBar').addEventListener('click', () => toggleCart());
  $('#cartOverlay').addEventListener('click', () => toggleCart(false));
  $('#btnLogin').addEventListener('click', () => (S.user ? openMyOrders() : openLogin()));
  $('#btnLoginPrompt').addEventListener('click', openLogin);
  $('#btnOrdersHero').addEventListener('click', () => (S.user ? openMyOrders() : openLogin()));
}

/* ================================================================ 初始化 */
function renderAll() {
  renderSets();
  renderTabs();
  renderAlc();
  renderCart();
  renderMember();
}

function init() {
  if (CFG.brand.phone) {
    $('#footContact').textContent = `訂購專線 ${CFG.brand.phone}${CFG.brand.address ? '・' + CFG.brand.address : ''}`;
  }
  const dl = CFG.orders.deadline ? new Date(CFG.orders.deadline) : null;
  if (dl && Date.now() > dl.getTime()) {
    const note = $('#deadlineNote');
    note.classList.remove('hidden');
    note.textContent = `⛔ 春節預訂已於 ${dl.toLocaleDateString('zh-TW')} 截止`;
  }
  bindEvents();
  renderAll();
}
document.addEventListener('DOMContentLoaded', init);

})(); /* end of IIFE */
