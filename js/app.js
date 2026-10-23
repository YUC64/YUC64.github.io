/* =============================================================================
 *  饗泰多 2027 春節內用預訂 — 前端主程式（Vanilla JS，無框架、無後端）
 *
 *  資料流：瀏覽器 → 購物車（記憶體 + localStorage）→ Google 表單 formResponse
 *  規則（依門市菜單 PDF）：
 *    1. 必須先加入一份「春節多人套餐」，才能單點加點
 *    2. 套餐內容需依「選 N」規則選滿才能加入購物車
 *    3. 金額 = 套餐 + 單點，另加 10% 服務費；每人最低消費 $600
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
  user:   'eatthai.user',
  cart:   'eatthai.cart',
  orders: 'eatthai.orders',
  users:  'eatthai.users',
};
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 私密模式 */ } };

const { SETS, ALC, CATEGORIES, DRINK_OPTIONS, DRINK_UPGRADES } = window.MENU;
const CFG = window.CONFIG;

/* ---------------------------------------------------------------- 狀態 */
const S = {
  user: load(LS.user, null),
  cart: load(LS.cart, { sets: [], alc: [] }),
  orders: load(LS.orders, []),
  users: load(LS.users, {}),
  cat: 'cold',
  editing: null,     // 正在修改的訂單編號
  draft: null,       // 套餐選配中的暫存
};

const persistCart = () => save(LS.cart, S.cart);
const hasSet = () => S.cart.sets.length > 0;
const alcLocked = () => CFG.rules.requireSetBeforeAlcarte && !hasSet();

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

/* ---------------------------------------------------------------- 圖片（含缺失替代） */
function imgBlock(src, alt, emoji = '🍲') {
  return `<div class="group relative aspect-[4/3] w-full overflow-hidden rounded-xl img-fallback">
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
    ? `<p class="mt-1 text-[12px] leading-relaxed text-ink-mute"><b class="text-ink">套餐特選：</b>${def.fixed.map(esc).join('、')}</p>`
    : '';
  return `<article class="card-enter overflow-hidden rounded-3xl border border-ink/10 bg-white shadow-card">
    <div class="relative">
      ${imgBlock(def.img, def.name, '🍛')}
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
        需選擇：${def.groups.map((g) => `${esc(g.label)} ${g.pick} 道`).join('、')}、飲料 ${def.drinkPick} 杯（可加價升級酒類／特調）
      </div>
      <button data-config-set="${def.id}"
              class="mt-3 w-full rounded-full bg-ink py-3 text-sm font-black text-white transition hover:bg-black active:scale-[.99]">
        挑選菜色並加入購物車
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
    : { lineId: `L${Date.now().toString(36)}`, setId, qty: 1, picks: {}, drinks: {}, upgrades: [] };
  def.groups.forEach((g) => { if (!S.draft.picks[g.key]) S.draft.picks[g.key] = []; });
  DRINK_OPTIONS.forEach((d) => { if (S.draft.drinks[d] == null) S.draft.drinks[d] = 0; });
  if (!S.draft.upgrades) S.draft.upgrades = [];

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
        <b class="text-ink">套餐特選（隨餐附贈）</b><br>${def.fixed.map(esc).join('、')}
      </div>
      ${def.groups.map((g) => `
        <div class="group-box" data-group="${g.key}">
          <div class="group-head">
            <p class="text-sm font-black">${esc(g.label)} <span class="text-ink-mute">／選 ${g.pick}</span></p>
            <p class="text-[11px] font-bold" data-counter="${g.key}"></p>
          </div>
          <div class="mt-2 flex flex-wrap gap-1.5">
            ${g.options.map((o) => `<button class="chip" data-pick="${g.key}" data-value="${esc(o)}">${esc(o)}</button>`).join('')}
          </div>
        </div>`).join('')}
      <div class="group-box" data-group="drink">
        <div class="group-head">
          <p class="text-sm font-black">飲料 <span class="text-ink-mute">／選 ${def.drinkPick}</span></p>
          <p class="text-[11px] font-bold" data-counter="drink"></p>
        </div>
        <div class="mt-2 space-y-2">
          ${DRINK_OPTIONS.map((d) => `
            <div class="flex items-center justify-between rounded-xl bg-white px-3 py-2">
              <span class="text-sm font-bold">${esc(d)}</span>
              <span class="flex items-center gap-2">
                <button class="qty-btn" data-drink="${esc(d)}" data-delta="-1">−</button>
                <span class="w-6 text-center text-sm font-black" data-drinkval="${esc(d)}">0</span>
                <button class="qty-btn" data-drink="${esc(d)}" data-delta="1">+</button>
              </span>
            </div>`).join('')}
        </div>
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
      <button data-add-set class="w-full rounded-full bg-brand py-3 text-sm font-black text-ink transition hover:bg-brand-dark">
        加入購物車
      </button>
      <p data-draft-hint class="mt-2 text-center text-[12px] font-bold text-ink-mute"></p>
    </div>`, { onMount: () => syncDraftUI() });
}

function syncDraftUI() {
  const def = SETS.find((s) => s.id === S.draft.setId);
  let ok = true;
  def.groups.forEach((g) => {
    const chosen = S.draft.picks[g.key] || [];
    const box = $(`[data-group="${g.key}"]`);
    box.classList.toggle('bad', chosen.length !== g.pick);
    if (chosen.length !== g.pick) ok = false;
    $(`[data-counter="${g.key}"]`).textContent =
      chosen.length === g.pick ? `已選 ${chosen.length}／${g.pick} ✓` : `還需 ${g.pick - chosen.length} 道`;
    $(`[data-counter="${g.key}"]`).className = `text-[11px] font-bold ${chosen.length === g.pick ? 'text-thai-green' : 'text-thai-red'}`;
    $$(`[data-pick="${g.key}"]`).forEach((b) => b.classList.toggle('on', chosen.includes(b.dataset.value)));
  });
  const drinkTotal = DRINK_OPTIONS.reduce((n, d) => n + (S.draft.drinks[d] || 0), 0);
  const drinkOK = drinkTotal === def.drinkPick;
  if (!drinkOK) ok = false;
  $('[data-group="drink"]').classList.toggle('bad', !drinkOK);
  const dc = $('[data-counter="drink"]');
  dc.textContent = drinkOK ? `已選 ${drinkTotal}／${def.drinkPick} ✓` : `還需 ${def.drinkPick - drinkTotal} 杯`;
  dc.className = `text-[11px] font-bold ${drinkOK ? 'text-thai-green' : 'text-thai-red'}`;
  DRINK_OPTIONS.forEach((d) => { $(`[data-drinkval="${d}"]`).textContent = S.draft.drinks[d] || 0; });
  $$('[data-upgrade]').forEach((b) => b.classList.toggle('on', S.draft.upgrades.includes(b.dataset.upgrade)));
  $('[data-add-set]').disabled = !ok;
  $('[data-add-set]').className = `w-full rounded-full py-3 text-sm font-black transition ${ok ? 'bg-brand text-ink hover:bg-brand-dark' : 'bg-gray-200 text-gray-400'}`;
  $('[data-draft-hint]').textContent = ok ? '內容已選滿，可以加入購物車' : '請依「選 N」規則選滿後再加入購物車';
}

/* ================================================================ 單點區 */
function renderTabs() {
  const box = $('#catTabs > div');
  box.innerHTML = CATEGORIES.map((c) => {
    const on = c.key === S.cat;
    return `<button data-cat="${c.key}" class="rounded-full px-4 py-2 text-sm font-black transition ${on ? 'bg-ink text-white' : 'bg-white text-ink-soft hover:bg-ink/5'}">${esc(c.label)}</button>`;
  }).join('');
}

function alcCardHTML(item) {
  const locked = alcLocked();
  const inCart = S.cart.alc.find((l) => l.id === item.id);
  const badges = [
    item.spicy ? '<span class="rounded bg-thai-red/10 px-1.5 py-0.5 text-[10px] font-bold text-thai-red">辣</span>' : '',
    item.veg ? '<span class="rounded bg-thai-green/10 px-1.5 py-0.5 text-[10px] font-bold text-thai-green">素</span>' : '',
    item.hot ? '<span class="rounded bg-brand px-1.5 py-0.5 text-[10px] font-bold text-ink">招牌</span>' : '',
  ].join(' ');
  return `<article class="card-enter flex flex-col overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-card ${locked ? 'opacity-70' : ''}">
    <div class="relative">
      ${imgBlock(item.img, item.name, '🍜')}
      ${inCart ? `<span class="absolute right-2 top-2 rounded-full bg-thai-red px-2 py-0.5 text-[10px] font-black text-white">已選 ${inCart.qty}</span>` : ''}
    </div>
    <div class="flex flex-1 flex-col p-3">
      <h3 class="text-sm font-black leading-snug">${esc(item.name)} ${badges}</h3>
      <p class="mt-1 text-[11px] text-ink-mute">${esc(item.unit || (item.alcohol ? '含酒精' : '單點'))}</p>
      <div class="mt-auto flex items-center justify-between gap-2 pt-3">
        <span class="text-base font-black text-thai-red">${fmt(item.price)}</span>
        <button data-add-alc="${item.id}" ${locked ? 'disabled' : ''}
                class="rounded-full px-3 py-1.5 text-[12px] font-black transition ${locked ? 'cursor-not-allowed bg-gray-200 text-gray-400' : 'bg-ink text-white hover:bg-black active:scale-95'}">
          ${locked ? '需先選套餐' : '加入'}
        </button>
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
    ? '先選一份春節套餐即可解鎖單點菜色。'
    : '單點已解鎖 ✓ 加點不受套餐規則限制（金額另加 10% 服務費）。';
}

/* ================================================================ 購物車 */
function setLineHTML(line) {
  const def = SETS.find((s) => s.id === line.setId);
  if (!def) return '';
  const groups = def.groups.map((g) => {
    const picked = (line.picks[g.key] || []).join('、') || '—';
    return `<li><b>${esc(g.label)}：</b>${esc(picked)}</li>`;
  }).join('');
  const drinks = DRINK_OPTIONS.filter((d) => (line.drinks[d] || 0) > 0)
    .map((d) => `${esc(d)}×${line.drinks[d]}`).join('、') || '—';
  const ups = line.upgrades && line.upgrades.length ? `<li><b>升級：</b>${line.upgrades.map(esc).join('、')}（價差現場計）</li>` : '';
  return `<div class="rounded-2xl border border-ink/10 bg-white p-3">
    <div class="flex items-start gap-3">
      <div class="w-20 shrink-0">${imgBlock(def.img, def.name, '🍛')}</div>
      <div class="min-w-0 flex-1">
        <div class="flex items-start justify-between gap-2">
          <p class="text-sm font-black leading-snug">${esc(def.name)}</p>
          <button data-del-set="${line.lineId}" class="text-[11px] font-bold text-ink-mute hover:text-thai-red">移除</button>
        </div>
        <p class="mt-0.5 text-[11px] text-ink-mute">${esc(def.dishLine)}・${esc(def.rice)}</p>
        <ul class="mt-1.5 space-y-0.5 text-[11px] leading-relaxed text-ink-soft">${groups}
          <li><b>特選：</b>${def.fixed.map(esc).join('、')}</li>
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
  return `<div class="flex items-center gap-3 rounded-2xl border border-ink/10 bg-white p-3">
    <div class="w-16 shrink-0">${imgBlock(item.img, item.name, '🍜')}</div>
    <div class="min-w-0 flex-1">
      <p class="truncate text-sm font-black">${esc(item.name)}</p>
      <p class="text-[11px] text-ink-mute">${fmt(item.price)}／份</p>
      <div class="mt-1.5 flex items-center gap-2">
        <button class="qty-btn" data-qty-alc="${line.id}" data-delta="-1">−</button>
        <span class="w-6 text-center text-sm font-black">${line.qty}</span>
        <button class="qty-btn" data-qty-alc="${line.id}" data-delta="1">+</button>
        <button data-del-alc="${line.id}" class="ml-auto text-[11px] font-bold text-ink-mute hover:text-thai-red">移除</button>
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
        <p class="mt-1 text-sm text-ink-mute">先挑一份春節套餐，再來加點單點菜色吧！</p>
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
    <button id="btnCheckout" ${c.count && !alcLocked() ? '' : 'disabled'}
      class="mt-3 w-full rounded-full py-3.5 text-sm font-black transition ${c.count && !alcLocked() ? 'bg-brand text-ink hover:bg-brand-dark' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}">
      ${alcLocked() ? '請先選擇春節套餐' : '前往填寫訂購資料'}
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

/* ================================================================ 登入／會員 */
function openLogin() {
  const u = S.user;
  openModal(`
    <div class="flex items-start justify-between border-b border-ink/10 px-4 py-3">
      <div>
        <h3 class="text-lg font-black">手機號碼登入</h3>
        <p class="text-[12px] text-ink-mute">用電話號碼預先訂餐、之後可修改或取消自己的訂單</p>
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
      <label class="block">
        <span class="text-[12px] font-black">自訂 4 位數密碼 <span class="font-normal text-ink-mute">（首次登入即設定，之後用來登入）</span></span>
        <input name="pin" required inputmode="numeric" maxlength="4" placeholder="例如 1234"
               class="mt-1 w-full rounded-xl border border-ink/15 px-3 py-2.5 text-sm tracking-[.4em] outline-none focus:border-ink">
      </label>
      <button class="w-full rounded-full bg-brand py-3 text-sm font-black text-ink hover:bg-brand-dark">登入／註冊</button>
      <p class="rounded-xl bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
        ⓘ 本網站無後端伺服器：帳號與訂單紀錄僅儲存在<b>這支裝置的瀏覽器</b>內（換裝置請重新登入）。
        為保護隱私，請勿使用您在別處使用過的密碼。
      </p>
    </form>`, {
    onMount: (root) => {
      $('#loginForm', root).addEventListener('submit', (e) => {
        e.preventDefault();
        const f = e.target;
        const name = f.name.value.trim();
        const phone = f.phone.value.replace(/\D/g, '');
        const pin = f.pin.value.trim();
        if (!/^09\d{8}$/.test(phone)) return toast('手機號碼格式錯誤（需 09 開頭 10 碼）');
        if (!/^\d{4}$/.test(pin)) return toast('密碼需為 4 位數字');
        const known = S.users[phone];
        if (known) {
          if (known.pin !== pin) return toast('密碼不正確');
          if (known.name !== name) S.users[phone].name = name;
        } else {
          S.users[phone] = { name, pin };
        }
        save(LS.users, S.users);
        S.user = { name, phone };
        save(LS.user, S.user);
        closeModal();
        renderMember();
        renderAll();
        toast(`歡迎，${name}！`);
      });
    },
  });
}

function renderMember() {
  const card = $('#memberCard');
  if (!S.user) {
    card.classList.add('hidden');
    $('#loginLabel').textContent = '登入';
    return;
  }
  const mine = S.orders.filter((o) => o.phone === S.user.phone);
  card.classList.remove('hidden');
  $('#loginLabel').textContent = S.user.name;
  card.innerHTML = `<div class="flex flex-wrap items-center gap-3">
    <span class="grid h-11 w-11 place-items-center rounded-full bg-brand text-lg font-black">${esc(S.user.name.slice(0, 1))}</span>
    <div class="min-w-0">
      <p class="font-black">${esc(S.user.name)} <span class="text-[11px] font-normal text-ink-mute">已登入</span></p>
      <p class="text-[12px] text-ink-mute">${esc(S.user.phone)}・本機訂單 ${mine.length} 筆</p>
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
    renderMember();
    toast('已登出');
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
          : `查無此訂單。無後端架構下僅能查詢本機紀錄，請來電門市 ${esc(CFG.brand.phone)}。`;
      });
    },
  });
}

/* ================================================================ 結帳 */
function pickupOptions() {
  const o = CFG.orders;
  return { date: o.openFrom, min: o.openFrom, max: o.openTo, slots: o.timeSlots };
}

function openCheckout() {
  if (alcLocked()) return toast('請先選擇一份春節套餐');
  if (!calc().count) return toast('購物車是空的');
  if (!S.user) { toast('請先用手機號碼登入'); return openLogin(); }

  const c = calc();
  const { min, max, slots } = pickupOptions();
  const defaultDate = min;

  openModal(`
    <div class="flex items-start justify-between border-b border-ink/10 px-4 py-3">
      <div>
        <h3 class="text-lg font-black">③ 填寫訂購資料</h3>
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
          <input name="date" type="date" required min="${min}" max="${max}" value="${defaultDate}"
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

      ${CFG.form.action ? '' : `<p class="rounded-xl bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
        ⓘ <b>示範模式</b>：尚未設定 Google 表單 action，送出後訂單只會存在本機（設定方式見 SETUP.md）。</p>`}

      <button id="btnSubmit" class="w-full rounded-full bg-brand py-3.5 text-sm font-black text-ink transition hover:bg-brand-dark">
        確認送出訂單
      </button>
      <p class="text-center text-[11px] text-ink-mute">本頁不含線上付款，款項請於現場結清</p>
    </form>`, {
    onMount: (root) => {
      $('#orderForm', root).addEventListener('submit', submitOrder);
    },
  });
}

/* ---------------- 訂單字串化（給 Google 表單用） ---------------- */
function buildSummary() {
  const setLines = S.cart.sets.map((line) => {
    const def = SETS.find((s) => s.id === line.setId);
    const picks = def.groups.map((g) => `${g.label}:${(line.picks[g.key] || []).join('/')}`).join(' ');
    const drinks = DRINK_OPTIONS.filter((d) => (line.drinks[d] || 0) > 0).map((d) => `${d}x${line.drinks[d]}`).join('/');
    const ups = (line.upgrades || []).length ? ` 升級:${line.upgrades.join('/')}` : '';
    return `${def.name} x${line.qty} [${picks} | 特選:${def.fixed.join('/')} | 飲料:${drinks}${ups}]`;
  });
  const alcLines = S.cart.alc.map((line) => {
    const item = ALC.find((a) => a.id === line.id);
    return `${item.name} x${line.qty}`;
  });
  return { setLines, alcLines };
}

function makeOrderId() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const stamp = `${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}`;
  return `XT${stamp}${Math.floor(Math.random() * 900 + 100)}`;
}

async function submitOrder(ev) {
  ev.preventDefault();
  const form = ev.target;
  const btn = $('#btnSubmit');
  const f = form;
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
  const pickup = `${date} ${time}`;
  const now = new Date().toLocaleString('zh-TW', { hour12: false });

  const values = {
    orderId,
    action: act,
    name,
    phone,
    pickup,
    headcount: `${c.headcount} 人`,
    sets: setLines.join(' ｜ ') || '無',
    setsTotal: String(c.setsSubtotal),
    alacarte: alcLines.join('、') || '無',
    alacarteTotal: String(c.alcSubtotal),
    service: String(c.service),
    total: String(c.total),
    note: note || '無',
    ts: now,
  };

  btn.disabled = true;
  btn.textContent = '傳送中…';
  let delivered = false;
  try {
    delivered = await postToGoogleForm(values);
  } catch (err) {
    console.warn('form post failed', err);
  }

  // 存本機紀錄（同時作為「修改自己的訂單」的資料來源）
  const record = {
    orderId, phone, name, pickup, headcount: c.headcount, total: c.total,
    status: act, ts: Date.now(), note,
    summary: [...setLines, ...alcLines].join(' ｜ '),
    cart: JSON.parse(JSON.stringify(S.cart)),
    delivered,
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
  // 帶上送出輔助參數（Google 表單官網表單不需要，但無害）
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
        ${delivered
          ? '訂單已寫入門市 Google 表單／試算表，門市將依此備餐。'
          : '示範模式：尚未設定 Google 表單，此筆訂單僅儲存在本機（請見 SETUP.md 設定後再正式收單）。'}
      </p>
      <div class="mt-4 flex flex-col gap-2">
        <button id="btnGoOrders" class="w-full rounded-full bg-ink py-3 text-sm font-black text-white">查看我的訂單（可修改／取消）</button>
        <button data-close-modal class="w-full rounded-full bg-ink/5 py-3 text-sm font-bold">繼續點餐</button>
      </div>
      <p class="mt-3 text-[11px] text-ink-mute">如需變更，請登入同一支手機號碼後於「我的訂單」修改，或來電 ${esc(CFG.brand.phone)}</p>
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
  const { setLines, alcLines } = { setLines: [o.summary], alcLines: [] };
  const values = {
    orderId, action: '取消訂單', name: o.name, phone: o.phone, pickup: o.pickup,
    headcount: `${o.headcount} 人`, sets: setLines.join(' '), setsTotal: '', alacarte: alcLines.join(''),
    alacarteTotal: '', service: '', total: String(o.total), note: o.note || '無',
    ts: new Date().toLocaleString('zh-TW', { hour12: false }),
  };
  let delivered = false;
  try { delivered = await postToGoogleForm(values); } catch (e) { console.warn(e); }
  o.status = '取消訂單';
  o.ts = Date.now();
  save(LS.orders, S.orders);
  closeModal();
  renderMember();
  toast(delivered ? '已送出取消通知' : '已取消（示範模式，僅更新本機紀錄）');
}

/* ================================================================ 事件綁定 */
function bindEvents() {
  // 套餐選配彈窗
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-config-set],[data-pick],[data-drink],[data-upgrade],[data-add-set],[data-close-modal],[data-close-cart],[data-add-alc],[data-qty-alc],[data-del-alc],[data-qty-set],[data-del-set],[data-cat],[data-edit-order],[data-cancel-order]');
    if (!t) return;
    const d = t.dataset;

    if (d.configSet) return openSetConfig(d.configSet);
    if (d.closeModal !== undefined) return closeModal();

    if (d.pick) {
      const g = SETS.find((s) => s.id === S.draft.setId).groups.find((x) => x.key === d.pick);
      const arr = S.draft.picks[d.pick];
      const i = arr.indexOf(d.value);
      if (i >= 0) arr.splice(i, 1);
      else if (arr.length < g.pick) arr.push(d.value);
      else { arr.shift(); arr.push(d.value); toast(`「${g.label}」最多選 ${g.pick} 道，已自動替換`); }
      return syncDraftUI();
    }
    if (d.drink) {
      const def = SETS.find((s) => s.id === S.draft.setId);
      const cur = DRINK_OPTIONS.reduce((n, x) => n + (S.draft.drinks[x] || 0), 0);
      const next = (S.draft.drinks[d.drink] || 0) + Number(d.delta);
      if (next < 0) return;
      if (Number(d.delta) > 0 && cur >= def.drinkPick) return toast(`飲料最多選 ${def.drinkPick} 杯`);
      S.draft.drinks[d.drink] = next;
      return syncDraftUI();
    }
    if (d.upgrade) {
      const i = S.draft.upgrades.indexOf(d.upgrade);
      if (i >= 0) S.draft.upgrades.splice(i, 1); else S.draft.upgrades.push(d.upgrade);
      return syncDraftUI();
    }
    if (d.addSet !== undefined) { // 空字串屬性也是假值，必須用 !== undefined 判斷
      const existing = S.cart.sets.findIndex((l) => l.lineId === S.draft.lineId);
      if (existing >= 0) S.cart.sets[existing] = S.draft; else S.cart.sets.push(S.draft);
      S.draft = null;
      persistCart();
      closeModal();
      renderAll();
      toast('套餐已加入購物車');
      return;
    }
    if (d.addAlc) {
      if (alcLocked()) return toast('請先選擇一份春節套餐才能加點單點');
      const item = ALC.find((a) => a.id === d.addAlc);
      const line = S.cart.alc.find((l) => l.id === d.addAlc);
      if (line) line.qty += 1; else S.cart.alc.push({ id: d.addAlc, qty: 1 });
      persistCart(); renderAll();
      return toast(`${item.name} 已加入購物車`);
    }
    if (d.qtyAlc) {
      const line = S.cart.alc.find((l) => l.id === d.qtyAlc);
      const item = ALC.find((a) => a.id === d.qtyAlc);
      line.qty += Number(d.delta);
      if (line.qty <= 0) S.cart.alc = S.cart.alc.filter((l) => l.id !== d.qtyAlc);
      else if (line.qty > 20) { line.qty = 20; toast('單一品項最多 20 份'); }
      persistCart(); renderAll();
      return;
    }
    if (d.delAlc) {
      S.cart.alc = S.cart.alc.filter((l) => l.id !== d.delAlc);
      persistCart(); renderAll(); return toast('已移除');
    }
    if (d.qtySet) {
      const line = S.cart.sets.find((l) => l.lineId === d.qtySet);
      line.qty += Number(d.delta);
      if (line.qty <= 0) S.cart.sets = S.cart.sets.filter((l) => l.lineId !== d.qtySet);
      else if (line.qty > 20) line.qty = 20;
      persistCart(); renderAll(); return;
    }
    if (d.delSet) {
      S.cart.sets = S.cart.sets.filter((l) => l.lineId !== d.delSet);
      persistCart(); renderAll(); return toast('已移除套餐');
    }
    if (d.cat) { S.cat = d.cat; renderTabs(); renderAlc(); return; }
    if (d.editOrder) return loadOrderForEdit(d.editOrder);
    if (d.cancelOrder) return cancelOrder(d.cancelOrder);

    if (d.closeCart !== undefined) {
      if (t.tagName === 'A') { toggleCart(false); } else { toggleCart(false); }
      return;
    }
  });

  // 抽屜／頂部按鈕
  $('#btnCartTop').addEventListener('click', () => toggleCart());
  $('#btnCartBar').addEventListener('click', () => toggleCart());
  $('#cartOverlay').addEventListener('click', () => toggleCart(false));
  $('#btnLogin').addEventListener('click', () => (S.user ? openMyOrders() : openLogin()));
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
