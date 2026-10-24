/* =============================================================================
 *  饗泰多 SIAM MORE｜除夕線上預點餐 — 前端主程式（Vanilla JS，無框架、無後端）
 *
 *  資料流：瀏覽器 → 訂單內容（記憶體 + localStorage）→ Google 表單 formResponse
 *  規則（依門市菜單 PDF）：
 *    1. 未登入只能瀏覽菜單，不能選購（加入訂單／結帳都要登入）
 *    2. 必須先加入一份「春節多人套餐」，才能單點加點
 *    3. 套餐內容需依「選 N」規則選滿才能加入訂單（飲料可逐杯選冰／去冰／熱）
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

const { SETS, ALC, CATEGORIES, DRINK_OPTIONS, DRINK_UPGRADES, spicyOf, tempsOf, canNoSpicy } = window.MENU;
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

/* 是否已經送出過訂單（送出後只能檢視，要門市開放才能改） */
const hasOrder = () => S.hasOrder === true;
function localHasOrder() {
  if (!S.user) return false;
  return S.orders.some((o) => o.phone === S.user.phone && o.status !== '取消訂單');
}
async function refreshMyOrderState(autoOpen) {
  if (!S.user) { S.hasOrder = false; return; }
  S.hasOrder = localHasOrder();            // 先用本機資料判斷，避免空窗
  try {
    const data = await fetchMine();
    if (data && Array.isArray(data.orders)) {
      S.myOrders = data.orders;
      S.hasOrder = data.orders.some((o) => o.status !== '已取消');
    }
  } catch (e) { /* 連線異常就沿用本機判斷 */ }
  // 右上按鈕文字：已送出 → 我的訂單
  const lbl = document.querySelector('#btnCartTop [data-top-label]');
  if (lbl) lbl.textContent = S.hasOrder ? '我的訂單' : '訂單';
  if (S.hasOrder && autoOpen) openMyOrders();
}

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
function toast(msg, ms = 2400) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  requestAnimationFrame(() => { el.style.opacity = '1'; });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.classList.add('hidden'), 420);
  }, ms);
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
  return `<div class="media ${aspect} w-full img-fallback">
      <span class="absolute inset-0 grid place-items-center text-3xl opacity-60">${emoji}</span>
      <img src="${esc(src)}" alt="${esc(alt)}" loading="lazy"
           class="absolute inset-0 h-full w-full object-cover"
           onerror="this.style.display='none'">
    </div>`;
}

/* ================================================================ 套餐區 */
function setCardHTML(def) {
  const fixed = def.fixed.length
    ? `<p class="mt-2.5 text-[11.5px] leading-[1.95] tracking-[.04em] text-ink-mute"><span class="text-ink">套餐特選</span>　${def.fixed.map((f) => esc(f) + spicyHTML(f)).join('、')}</p>`
    : '';
  const openLabel = hasOrder() ? '觀看菜色' : (loggedIn() ? '選擇菜色' : '查看菜色');
  return `<article class="card-enter overflow-hidden">
    <div class="relative">
      ${imgBlock(def.img, def.name, '🍛', 'aspect-[3/2]')}
      <span class="absolute left-0 top-0 z-10 bg-ink/90 px-3 py-1.5 text-[9.5px] tracking-[.26em] text-white/95">${def.people} 人</span>
      <span class="absolute right-0 top-0 z-10 bg-white/95 px-3 py-1.5 text-[9.5px] tracking-[.2em] text-ink">${esc(def.dishLine)}</span>
    </div>
    <div class="px-5 py-5 sm:px-6 sm:py-6">
      <div class="flex items-baseline justify-between gap-4">
        <div class="min-w-0">
          <h3 class="serif text-[21px] leading-snug tracking-[.06em] sm:text-[23px]">${esc(def.name)}</h3>
          <p class="mt-1.5 text-[9.5px] tracking-[.2em] text-ink-mute">${def.rice}</p>
        </div>
        <p class="num shrink-0 text-[20px] tracking-wide sm:text-[22px]">${fmt(def.price)}</p>
      </div>
      ${fixed}
      <div class="hairline-soft my-4"></div>
      <p class="text-[10.5px] leading-[1.95] tracking-[.08em] text-ink-mute">
        需選擇：${def.groups.map((g) => `${esc(g.label)} ${g.pick} 道`).join('・')}・飲料 ${def.drinkPick} 杯（每杯可選冰／去冰／熱）
      </p>
      <button data-config-set="${def.id}" class="btn btn-line mt-5 w-full text-[11.5px]">${openLabel}</button>
    </div>
  </article>`;
}

function renderSets() {
  $('#setList').innerHTML = SETS.map(setCardHTML).join('');
}

/* -------- 套餐選配彈窗 -------- */
function draftComplete() {
  if (!S.draft) return false;
  const def = SETS.find((s) => s.id === S.draft.setId);
  if (!def) return false;
  const groupsOK = def.groups.every((g) => (S.draft.picks[g.key] || []).length === g.pick);
  const drinksOK = (S.draft.drinks || []).every((d) => d.name);
  return groupsOK && drinksOK;
}

function openSetConfig(setId, editLine = null) {
  const def = SETS.find((s) => s.id === setId);
  S.draft = editLine
    ? JSON.parse(JSON.stringify(editLine))
    : { lineId: `L${Date.now().toString(36)}`, setId, qty: 1, picks: {}, drinks: [], upgrades: [], mild: {}, tried: false };

  def.groups.forEach((g) => { if (!S.draft.picks[g.key]) S.draft.picks[g.key] = []; });
  if (!S.draft.upgrades) S.draft.upgrades = [];
  if (!S.draft.mild) S.draft.mild = {};

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
      <div id="mildBox"></div>
      <div class="group-box" data-group="drink">
        <div class="group-head">
          <p class="text-sm font-black">飲料 <span class="text-ink-mute">／選 ${def.drinkPick} 杯</span></p>
          <p class="text-[11px] font-bold" data-counter="drink"></p>
        </div>
        <p class="mt-1 text-[11px] text-ink-mute">每一杯都可以單獨選品項與冰／去冰／熱</p>
        <div class="mt-2 space-y-2">${drinkSlotsHTML()}</div>
      </div>
      ${DRINK_UPGRADES.length ? `<div class="group-box">
        <p class="text-sm font-black">加價升級酒類／特調 <span class="text-ink-mute">（可選，價差依現場公告）</span></p>
        <div class="mt-2 flex flex-wrap gap-1.5">
          ${DRINK_UPGRADES.map((u) => `<button class="chip" data-upgrade="${esc(u)}">${esc(u)}</button>`).join('')}
        </div>
      </div>` : ''}
    </div>
    <div class="sticky bottom-0 border-t border-ink/10 bg-white px-4 py-3">
      <div class="mb-2 flex items-center justify-between text-sm">
        <span class="font-bold text-ink-mute">金額</span>
        <span class="text-xl font-black">${fmt(def.price)}</span>
      </div>
      <button data-add-set class="w-full rounded-full py-3 text-sm font-black transition">加入訂單</button>
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
    // 只有「按過加入但沒選滿」才亮紅框，一開窗不亮
    box.classList.toggle('bad', S.draft.tried === true && chosen.length !== g.pick);
    if (chosen.length !== g.pick) ok = false;
    const c = $(`[data-counter="${g.key}"]`);
    c.textContent = chosen.length === g.pick ? `已選 ${chosen.length}／${g.pick} ✓` : `還需 ${g.pick - chosen.length} 道`;
    c.className = `text-[11px] font-bold ${chosen.length === g.pick ? 'text-thai-green'
      : (S.draft.tried === true ? 'text-thai-red' : 'text-ink-mute')}`;
    $$(`[data-pick="${g.key}"]`).forEach((b) => b.classList.toggle('on', chosen.includes(b.dataset.value)));
  });

  const drinksOK = S.draft.drinks.every((d) => d.name);
  if (!drinksOK) ok = false;
  const drinkBox = $('[data-group="drink"]');
  if (drinkBox) drinkBox.classList.toggle('bad', S.draft.tried === true && !drinksOK);
  const dc = $('[data-counter="drink"]');
  dc.textContent = drinksOK ? `已選 ${S.draft.drinks.length}／${def.drinkPick} ✓` : `還需 ${def.drinkPick - S.draft.drinks.filter((d) => d.name).length} 杯`;
  dc.className = `text-[11px] font-bold ${drinksOK ? 'text-thai-green'
    : (S.draft.tried === true ? 'text-thai-red' : 'text-ink-mute')}`;

  // 選了不辣：菜名按鈕上的辣椒拿掉，改成（不辣）
  $$('#modalBox [data-pick]').forEach((b) => {
    const nm = b.dataset.value;
    const on = (S.draft.picks[b.dataset.pick] || []).indexOf(nm) >= 0;
    const mild = on && !!((S.draft.mild || {})[nm]);
    const tag = b.querySelector('[data-mildtag]');
    if (mild && !tag) {
      b.insertAdjacentHTML('beforeend', '<span data-mildtag class="ml-1 text-[9.5px] tracking-[.08em] text-gold">（不辣）</span>');
    } else if (!mild && tag) {
      tag.remove();
    }
    b.querySelectorAll('svg').forEach((svg) => { svg.style.display = mild ? 'none' : ''; });
  });

  $$('[data-upgrade]').forEach((b) => b.classList.toggle('on', S.draft.upgrades.includes(b.dataset.upgrade)));

  const btn = $('[data-add-set]');
  if (hasOrder()) {
    btn.disabled = true;
    btn.className = 'btn btn-line is-disabled w-full text-[11.5px]';
    btn.textContent = '已送出訂單・需門市開放才能修改';
    $('[data-draft-hint]').textContent = '目前僅供觀看菜色內容';
    return;
  }
  btn.disabled = false;          // 可按：按了才知道哪幾項沒選到
  if (!ok) {
    btn.className = 'btn btn-line w-full text-[11.5px]';
    btn.textContent = '加入訂單';
  } else if (!loggedIn()) {
    btn.className = 'btn btn-line w-full text-[11.5px]';
    btn.textContent = '登入後加入';
  } else {
    btn.className = 'btn btn-solid w-full text-[11.5px]';
    btn.textContent = '加入訂單';
  }
  $('[data-draft-hint]').textContent = !ok
    ? '請依「選 N」規則選滿後再加入訂單'
    : (loggedIn() ? '內容已選滿，可以加入訂單' : '內容已選滿，登入後即可加入訂單');
}

/* ================================================================ 單點區 */
function renderTabs() {
  $('#catTabs > div').innerHTML = CATEGORIES.map((c) => {
    const on = c.key === S.cat;
    return `<button data-cat="${c.key}" class="tab ${on ? 'on' : ''}">${esc(c.label)}</button>`;
  }).join('');
}

const alcKey = (line) => `${line.id}@${line.temp || ''}${line.spicy ? '#' + line.spicy : ''}`;

function alcCardHTML(item) {
  const inCart = S.cart.alc.filter((l) => l.id === item.id).reduce((n, l) => n + l.qty, 0);
  const temps = tempsOf(item.name);
  const badges = [
    item.veg ? '<span class="text-[9px] tracking-[.22em] text-thai-green">素</span>' : '',
    item.hot ? '<span class="text-[9px] tracking-[.22em] text-gold">招牌</span>' : '',
  ].join(' ');
  return `<article class="card-enter group flex flex-col overflow-hidden">
    <div class="relative">
      ${imgBlock(item.img, item.name, '🍜')}
      ${inCart ? `<span class="absolute right-0 top-0 z-10 bg-ink px-2 py-1 text-[9px] tracking-[.2em] text-white">已選 ${inCart}</span>` : ''}
    </div>
    <div class="flex flex-1 flex-col px-3.5 pb-4 pt-3.5">
      <h3 class="text-[13.5px] leading-snug tracking-[.04em]">${esc(item.name)} ${spicyHTML(item.name)}</h3>
      <p class="mt-1.5 text-[9.5px] tracking-[.18em] text-ink-mute">${esc(item.unit || (item.alcohol ? '含酒精' : temps.length ? temps.join('／') : ''))}</p>
      ${item.desc ? `<p class="mt-2 line-clamp-2 text-[11px] leading-[1.85] text-ink-soft/70">${esc(item.desc)}</p>` : ''}
      <div class="mt-auto pt-4">
        <div class="flex items-end justify-between gap-2">
          <span class="num text-[14.5px] tracking-wide">${fmt(item.price)}</span>
          <button data-add-alc="${item.id}" aria-label="加入 ${esc(item.name)}"
                  class="grid h-9 w-9 shrink-0 place-items-center border border-[rgba(23,20,15,.22)] text-[16px] leading-none text-ink transition duration-300 hover:bg-ink hover:text-white active:scale-90">＋</button>
        </div>
        ${badges ? `<p class="mt-2 flex gap-2">${badges}</p>` : ''}
      </div>
    </div>
  </article>`;
}

function renderAlc() {
  const list = ALC.filter((a) => a.cat === S.cat);
  $('#alcList').innerHTML = list.map(alcCardHTML).join('');
  const hint = $('#alcHint');
  if (hint) {
    hint.textContent = (alcLocked() && loggedIn())
      ? '春節期間單點需搭配套餐，選好套餐後即可加點'
      : '菜色與價格一覽';
  }
}

/* -------- 冰／去冰／熱選擇（單點甜點、飲料） -------- */
function openTempPicker(itemId) {
  const item = ALC.find((a) => a.id === itemId);
  const temps = tempsOf(item.name);
  const mildAble = canNoSpicy(item.name);
  if (!temps.length && !mildAble) return addAlcLine(itemId, '');
  openModal(`
    <div class="flex items-start justify-between border-b border-[rgba(23,20,15,.1)] px-6 py-5">
      <div>
        <p class="caps">Option</p>
        <h3 class="serif mt-2 text-[19px] tracking-[.12em]">${esc(item.name)}</h3>
        <p class="mt-2 text-[11px] tracking-[.08em] text-ink-mute">${fmt(item.price)}・請選擇${esc(temps.join('／'))}</p>
      </div>
      <button data-close-modal class="grid h-8 w-8 shrink-0 place-items-center text-ink/40 transition hover:text-ink" aria-label="關閉">
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.2"/></svg>
      </button>
    </div>
    <div class="px-6 py-6">
      <div class="flex flex-wrap gap-2" id="tempChips">
        ${temps.map((t, i) => `<button class="chip ${i === 0 ? 'on' : ''}" data-temp="${esc(t)}">${esc(t)}</button>`).join('')}
      </div>
      ${mildAble ? `<p class="mt-4 text-[10px] tracking-[.22em] text-gold">辣度</p>
      <div class="mt-1.5 flex flex-wrap gap-2" id="mildChips">
        <button class="chip on" data-mild="0">正常</button>
        <button class="chip" data-mild="1">不辣</button>
      </div>` : ''}
      <button id="btnTempAdd" class="btn btn-solid mt-6 w-full text-[11.5px]">
        加入訂單
      </button>
    </div>`, {
    onMount: (root) => {
      let chosen = temps[0] || '';
      let mild = false;
      $$('[data-temp]', root).forEach((b) => b.addEventListener('click', () => {
        chosen = b.dataset.temp;
        $$('[data-temp]', root).forEach((x) => x.classList.toggle('on', x === b));
      }));
      $$('[data-mild]', root).forEach((b) => b.addEventListener('click', () => {
        mild = b.dataset.mild === '1';
        $$('[data-mild]', root).forEach((x) => x.classList.toggle('on', x === b));
      }));
      $('#btnTempAdd', root).addEventListener('click', () => {
        closeModal();
        if (needLogin()) return;
        if (hasOrder()) return toast('您已送出訂單，如需更改請聯繫門市開通修改', 3600);
        addAlcLine(itemId, chosen, mild ? '不辣' : '');
      });
    },
  });
}

function askMild(name, anchor) {
  document.querySelectorAll('.mild-pop').forEach((n) => n.remove());
  const on = !!((S.draft.mild || {})[name]);
  const pop = document.createElement('div');
  pop.className = 'mild-pop';
  pop.innerHTML = `<p>${esc(name)}</p><div class="row"><button data-mild-now="0" class="${on ? '' : 'on'}">正常</button><button data-mild-now="1" class="${on ? 'on' : ''}">不辣</button></div>`;
  document.body.appendChild(pop);
  const r = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : { left: window.innerWidth / 2 - 88, bottom: window.innerHeight / 2, width: 0 };
  pop.style.top = `${Math.max(10, Math.min(r.bottom + 8, window.innerHeight - 118))}px`;
  pop.style.left = `${Math.max(12, Math.min(r.left, window.innerWidth - 196))}px`;
  pop.addEventListener('click', (e) => {
    const b = e.target.closest('[data-mild-now]');
    if (!b) return;
    if (!S.draft.mild) S.draft.mild = {};
    if (b.dataset.mildNow === '1') S.draft.mild[name] = true;
    else delete S.draft.mild[name];
    pop.remove();
    syncDraftUI();
  });
  setTimeout(() => {
    const off = (ev) => {
      if (!pop.contains(ev.target)) { pop.remove(); document.removeEventListener('click', off, true); }
    };
    document.addEventListener('click', off, true);
  }, 0);
}

function addAlcLine(itemId, temp, spicy) {
  const item = ALC.find((a) => a.id === itemId);
  const line = S.cart.alc.find((l) => l.id === itemId && (l.temp || '') === (temp || '') && (l.spicy || '') === (spicy || ''));
  if (line) line.qty += 1; else S.cart.alc.push({ id: itemId, temp: temp || '', qty: 1, spicy: spicy || '' });
  persistCart();
  renderAll();
  toast(`${item.name}${temp ? `（${temp}）` : ''}${spicy ? `（${spicy}）` : ''} 已加入訂單`);
}

/* ================================================================ 訂單內容 */
function setLineHTML(line) {
  const def = SETS.find((s) => s.id === line.setId);
  if (!def) return '';
  const groups = def.groups.map((g) => {
    const picked = (line.picks[g.key] || []).map((p) => (line.mild || {})[p]
      ? esc(p) + '<span class="text-[9.5px] tracking-[.1em] text-gold">（不辣）</span>'
      : esc(p) + spicyHTML(p)).join('、') || '—';
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
      <p class="mt-0.5 text-[11px] text-ink-mute">${fmt(item.price)}／份 ${line.temp ? tempChip(line.temp) : ''}${line.spicy ? tempChip(line.spicy) : ''}</p>
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
        <p class="mt-2 font-black">訂單還是空的</p>
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
    <button id="btnCheckout" ${canCheckout || !loggedIn() ? '' : 'disabled'}
      class="btn mt-4 w-full text-[11.5px] ${canCheckout || !loggedIn() ? 'btn-solid' : 'btn-line is-disabled'}">
      ${!loggedIn() ? '登入' : (alcLocked() ? '請先選擇套餐' : '前往填寫訂購資料')}
    </button>
    <p class="mt-3 text-center text-[9.5px] tracking-[.16em] text-ink-mute">送出即代表同意門市訂購規則・現場結帳</p>`;

  $('#cartCountTop').textContent = c.count;
  $('#cartCountTop').classList.toggle('hidden', !c.count);
  $('#cartCountBar').textContent = c.count;
  $('#cartTotalBar').textContent = fmt(c.total);

  // 訂單頁面只在登入後出現（未登入純瀏覽菜單）
  const on = loggedIn();
  const topBtn = $('#btnCartTop');
  if (topBtn) {
    topBtn.classList.toggle('hidden', !on);
    // 已送出訂單 → 這顆按鈕就是「我的訂單」
    const lbl = topBtn.querySelector('[data-top-label]');
    if (lbl) lbl.textContent = hasOrder() ? '我的訂單' : '訂單';
  }
  const bar = $('#mobileBar');
  if (bar) bar.classList.toggle('hidden', !on || !c.count);   // 沒有餐點時不佔版面
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
      already_ordered: '這支手機已經送過訂單了，如需更改請聯繫門市',
      edit_locked: '訂單已送出，如需更改請聯繫門市開通修改',
      order_not_found: '找不到這筆訂單（可能已被取消）',
      no_order_id: '訂單編號遺失，請重新整理後再試',
    };
    throw new Error(`${map[data.error] || '寫入失敗'}〔${data.error || '未知'}／${payload.orderId}／${payload.action}〕`);
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
    <div class="flex items-start justify-between border-b border-[rgba(23,20,15,.1)] px-6 py-5">
      <div>
        <p class="caps">Reservation</p>
        <h3 class="serif mt-2 text-[19px] tracking-[.14em]">訂位客人登入</h3>
        <p class="mt-2 text-[11.5px] leading-relaxed text-ink-mute">${needVerifyCode()
          ? '請輸入訂位時留下的手機號碼，與門市提供的驗證碼'
          : '請填寫訂位時留下的手機號碼'}</p>
      </div>
      <button data-close-modal class="grid h-8 w-8 shrink-0 place-items-center text-ink/40 transition hover:text-ink" aria-label="關閉">
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.2"/></svg>
      </button>
    </div>
    <form id="loginForm" class="space-y-5 px-6 py-6">
      <label class="block">
        <span class="field-label">姓名</span>
        <input name="name" required value="${u ? esc(u.name) : ''}" placeholder="王小明" class="field">
      </label>
      <label class="block">
        <span class="field-label">手機號碼</span>
        <input name="phone" required inputmode="numeric" value="${u ? esc(u.phone) : ''}" placeholder="0912345678" maxlength="10" class="field">
      </label>
      ${needVerifyCode() ? `
      <label class="block">
        <span class="field-label">驗證碼</span>
        <input name="code" required inputmode="numeric" maxlength="6" placeholder="門市提供的 4 位數字"
               class="field tracking-[.4em]">
      </label>` : `
      <label class="block">
        <span class="field-label">自訂 4 位數密碼</span>
        <input name="pin" required inputmode="numeric" maxlength="4" placeholder="例如 1234" class="field tracking-[.4em]">
      </label>`}
      <div id="verifyMsg" class="hidden px-1 py-2 text-[11.5px] leading-relaxed"></div>
      <button type="submit" class="btn btn-solid w-full text-[11.5px]">登入</button>
      <p class="text-[10px] leading-[1.9] tracking-[.08em] text-ink-mute">
        帳號與訂單紀錄僅儲存在這支裝置的瀏覽器內；換裝置請重新登入。
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
        S.hasOrder = localHasOrder();
        // 登入後自動把「他已經點過的餐點」載出來（沒有訂單就維持正常點餐）
        refreshMyOrderState(true);
        const draft = S.draft;   // 若正在選套餐，登入後回到原畫面
        closeModal();
        renderAll();
        if (draft) openSetConfig(draft.setId, draft);
        toast(`歡迎，${name}！可以開始選購了`);
      });
    },
  });
}

/* ================================================================ 三條線選單 */
function openDrawer() {
  renderMember();
  $('#drawer').classList.remove('translate-x-full');
  $('#drawerOverlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}
function closeDrawer() {
  $('#drawer').classList.add('translate-x-full');
  $('#drawerOverlay').classList.add('hidden');
  document.body.style.overflow = '';
}
function toggleDrawer(on) {
  if (on === undefined) on = $('#drawer').classList.contains('translate-x-full');
  return on ? openDrawer() : closeDrawer();
}

function doLogout() {
  S.user = null;
  save(LS.user, null);
  closeDrawer();
  toggleCart(false);
  renderAll();
  toast('已登出，登出後只能瀏覽菜單');
}

/** 訂購說明（原本佔版面的說明文字，收進選單的彈窗） */
function openGuide() {
  const sp = '<img src="assets/img/spicy.png" alt="辣" class="inline-block h-3.5 w-auto align-[-2px]">';
  openModal(`
    <div class="flex items-start justify-between border-b border-ink/10 px-5 py-3">
      <h3 class="text-lg font-black">訂購說明</h3>
      <button data-close-modal class="grid h-9 w-9 place-items-center rounded-full bg-ink/5 hover:bg-ink/10" aria-label="關閉">✕</button>
    </div>
    <ol class="space-y-2 px-5 py-4 text-[13px] leading-relaxed text-ink-soft list-decimal pl-9">
      <li><b>限訂位客人</b>：用訂位時留的<b>手機號碼</b>＋門市提供的<b>驗證碼</b>登入後，才能選購與送出訂單；未登入僅能瀏覽菜單。</li>
      <li>春節期間<b>限點選任一「春節多人套餐」，方能進行單點加點</b>（本網站已自動鎖定單點區）。</li>
      <li>套餐與單點金額計算後，另加 <b>10% 服務費</b>；每人最低消費 <b>$600</b>。</li>
      <li>套餐內每個品類都需依「<b>選 N</b>」規則選滿（含飲料）；飲料可依杯選擇<b>冰／去冰／熱</b>。</li>
      <li>辣度依門市菜單標示：${sp}${sp} 較辣・${sp} 微辣・未標示者為不辣。</li>
      <li>甜點與飲料可選<b>冰／去冰／冷／熱</b>（摩摩喳喳：冰／去冰；椰香黑糯米：冷／熱；泰式奶茶：冰／去冰／熱）。</li>
      <li>完成訂購後畫面會顯示<b>訂單編號</b>；之後用同一支手機＋驗證碼登入，可在「我的訂單」<b>修改或取消</b>（修改會直接覆蓋門市試算表上的同一筆，不會多一列）。</li>
      <li>飲料「加價升級酒類／特調飲品」之價差依現場公告，於現場結帳時計算。</li>
      <li>本頁為預先點餐登記，<b>不含線上結帳與金流</b>，款項請於現場結清。</li>
      <li>僅供參考，菜單內容以現場供應為主。</li>
    </ol>
    <div class="border-t border-ink/10 px-5 py-3">
      <button data-close-modal class="w-full rounded-full bg-ink py-3 text-sm font-black text-white">知道了</button>
    </div>`);
}

/** 三條線選單的內容：會員區塊＋導覽＋用餐須知 */
function renderMember() {
  const cl = $('#coverLoginLabel');
  if (cl) cl.textContent = S.user ? '我的訂單' : '登入 / 我的訂單';
  const dot = $('#drawerDot');
  if (dot) dot.classList.toggle('hidden', !S.user);

  const body = $('#drawerBody');
  if (!body) return;
  const mine = S.user ? S.orders.filter((o) => o.phone === S.user.phone) : [];

  const member = S.user
    ? `<div class="rounded-2xl border border-ink/10 bg-white p-4 shadow-card">
        <div class="flex items-center gap-3">
          <span class="serif grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[rgba(23,20,15,.2)] text-[15px] tracking-wide">${esc(S.user.name.slice(0, 1))}</span>
          <div class="min-w-0">
            <p class="serif truncate text-[15px] tracking-[.1em]">${esc(S.user.name)}</p>
            <p class="mt-1 truncate text-[10.5px] tracking-[.12em] text-ink-mute">${esc(S.user.phone)}</p>
            <p class="mt-0.5 text-[10px]">${verifyStateText(S.user)}</p>
          </div>
        </div>
        <div class="mt-4 grid grid-cols-2 gap-2">
          <button data-menu-action="orders" class="btn btn-solid px-3 py-2.5 text-[10.5px]">我的訂單</button>
          <button data-menu-action="logout" class="btn btn-line px-3 py-2.5 text-[10.5px]">登出</button>
        </div>
      </div>`
    : `<div class="border border-[rgba(23,20,15,.13)] p-4">
        <p class="caps">Reservation</p>
        <p class="serif mt-2 text-[15px] tracking-[.1em]">訂位客人登入</p>
        <p class="mt-2 text-[10.5px] leading-[1.95] tracking-[.04em] text-ink-mute">
          請輸入訂位時留下的手機號碼、姓名與門市提供的驗證碼。
        </p>
        <button data-menu-action="login" class="btn btn-solid mt-4 w-full text-[10.5px]">登入</button>
      </div>`;

  body.innerHTML = `
    ${member}
    <nav class="mt-6 border-t border-[rgba(23,20,15,.12)]">
      <a href="#sets" data-drawer-close class="flex items-center justify-between border-b border-[rgba(23,20,15,.08)] py-3.5 text-[12.5px] tracking-[.12em] transition hover:text-gold">春節多人套餐 <span class="text-ink-mute">›</span></a>
      <a href="#alacarte" data-drawer-close class="flex items-center justify-between border-b border-[rgba(23,20,15,.08)] py-3.5 text-[12.5px] tracking-[.12em] transition hover:text-gold">單點加點 <span class="text-ink-mute">›</span></a>
      <button data-menu-action="guide" class="flex w-full items-center justify-between border-b border-[rgba(23,20,15,.08)] py-3.5 text-left text-[12.5px] tracking-[.12em] transition hover:text-gold">訂購說明 <span class="text-ink-mute">›</span></button>
      <button data-menu-action="cart" class="flex w-full items-center justify-between border-b border-[rgba(23,20,15,.08)] py-3.5 text-left text-[12.5px] tracking-[.12em] transition hover:text-gold">訂單內容 <span class="text-ink-mute">›</span></button>
    </nav>
    <div class="mt-7 border-t border-[rgba(23,20,15,.12)] pt-5 text-[10.5px] leading-[2] tracking-[.06em] text-ink-mute">
      <p class="caps mb-2.5">Notice</p>
      <p>・內用加收 10% 服務費・每人最低消費 $600</p>
      <p>・春節期間須先點選任一春節多人套餐，才能單點加點</p>
      <p>・送出後僅供檢視；如需更改請聯繫門市為您開啟修改</p>
      <p>・不含線上結帳，款項請於現場結清</p>
      ${CFG.brand.phone ? `<p class="mt-2 font-bold text-ink-soft">訂購專線 ${esc(CFG.brand.phone)}</p>` : ''}
    </div>
    <p class="mt-7 text-center"><a href="staff.html" class="text-[9.5px] tracking-[.24em] text-ink-mute/60 transition hover:text-ink-mute">員工專用</a></p>`;
}

/* ================================================================ 我的訂單 */
async function fetchMine() {
  if (!apiReady() || !S.user) return null;
  const url = `${API_BASE()}?mine=1&phone=${encodeURIComponent(S.user.phone)}&code=${encodeURIComponent(S.user.code || '')}&t=${Date.now()}`;
  const res = await fetch(url, { cache: 'no-store' });
  const data = await res.json();
  // 舊版 Apps Script 不認識 mine，會回傳登入結果（沒有 orders）→ 視為不可用
  if (!data || !data.ok || !Array.isArray(data.orders)) return null;
  return data;
}

function localAsMine() {
  return S.orders.filter((o) => o.phone === S.user.phone).map((o) => ({
    orderId: o.orderId, status: o.status, name: o.name, headcount: o.headcount,
    sets: o.summary, total: o.total, updated: '',
    editable: false, cart: o.cart || null, local: true,
  }));
}

function openMyOrders() {
  if (!S.user) return openLogin();
  openModal(`<div class="px-6 py-16 text-center text-[12px] tracking-[.22em] text-ink-mute">載入訂單中…</div>`);
  loadMyOrders();
}

async function loadMyOrders() {
  let list = null;
  try {
    const data = await fetchMine();
    if (data) list = data.orders;
  } catch (err) { /* 連線異常就用本機資料 */ }
  const offline = !list;
  if (offline) list = localAsMine();
  renderMyOrders(list, offline);
}

function renderMyOrders(list, offline) {
  const badge = { 新訂單: 'text-thai-green', 已修改: 'text-gold', 取消訂單: 'text-thai-red', 已取消: 'text-thai-red' };
  const cards = list.length ? list.map((o) => {
    const lines = String(o.sets || '').split(/\r?\n/).filter(Boolean);
    const head = lines[0] || '—';
    const rest = lines.slice(1);
    return `
    <div class="border border-[rgba(23,20,15,.12)] bg-white px-4 py-4">
      <div class="flex items-baseline justify-between gap-3">
        <p class="mono text-[12.5px]">${esc(o.orderId)}</p>
        <p class="text-[11px] tracking-[.14em] ${badge[o.status] || 'text-ink-mute'}">${esc(o.status)}</p>
      </div>
      <p class="mt-2 text-[13px]">${esc(head)}</p>
      ${rest.length ? `<ul class="mt-1 space-y-0.5 text-[10.5px] leading-[1.9] text-ink-mute">${rest.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}
      ${o.alacarte ? `<p class="mt-2 border-t border-[rgba(23,20,15,.08)] pt-2 text-[10.5px] leading-[1.9] text-ink-mute">單點：${esc(o.alacarte)}</p>` : ''}
      <p class="mt-2.5 flex items-baseline justify-between text-[11px] text-ink-mute">
        <span>${o.headcount || ''}${o.headcount ? ' 人' : ''}${o.updated ? '・' + esc(o.updated) : ''}</span>
        <span class="num text-[14px] text-ink">${fmt(o.total)}</span>
      </p>
      ${o.editable ? `
        <div class="mt-3 grid grid-cols-2 gap-2">
          <button data-edit-order="${esc(o.orderId)}" class="btn btn-solid px-3 py-2.5 text-[10.5px]">修改內容</button>
          <button data-cancel-order="${esc(o.orderId)}" class="btn btn-line px-3 py-2.5 text-[10.5px]">取消訂單</button>
        </div>`
      : `<p class="mt-3 border-t border-[rgba(23,20,15,.08)] pt-2.5 text-[10.5px] leading-relaxed text-ink-mute">
           已送出，僅供檢視。如需更改餐點請${tel('聯繫')}，由門市為您開啟修改。
         </p>`}
    </div>`;
  }).join('') : `<p class="py-10 text-center text-[12px] tracking-[.16em] text-ink-mute">這支手機還沒有訂單</p>`;

  openModal(`
    <div class="flex items-start justify-between border-b border-[rgba(23,20,15,.1)] px-6 py-5">
      <div>
        <p class="caps">My Order</p>
        <h3 class="serif mt-2 text-[19px] tracking-[.14em]">我的訂單</h3>
        <p class="mt-2 text-[11px] tracking-[.08em] text-ink-mute">${esc(S.user.name)}・${esc(S.user.phone)}</p>
      </div>
      <button data-close-modal class="grid h-8 w-8 shrink-0 place-items-center text-ink/40 transition hover:text-ink" aria-label="關閉">
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.2"/></svg>
      </button>
    </div>
    <div class="space-y-3 px-6 py-5">
      ${cards}
      ${offline ? `<div class="border-t border-[rgba(23,20,15,.1)] pt-3 text-[10px] leading-relaxed tracking-[.06em] text-ink-mute">
        目前讀不到門市系統，以下為這台裝置的紀錄。若您已重新部署仍看到這段，請下拉重新整理或稍候一分鐘。
        <button onclick="location.reload(true)" class="ml-1 underline underline-offset-2">重新整理</button>
      </div>` : ''}
    </div>`, {
    onMount: (root) => {
      const byId = (id) => list.find((o) => o.orderId === id);
      $$('[data-edit-order]', root).forEach((b) => b.addEventListener('click', () => {
        const o = byId(b.dataset.editOrder);
        if (!o) return toast('找不到這筆訂單，請重新整理後再試');
        if (o.cart) {
          S.cart = JSON.parse(JSON.stringify(o.cart));
        } else {
          S.cart = { sets: [], alc: [] };   // 舊訂單沒有存內容 → 讓客人重新選
        }
        persistCart();
        S.editing = o.orderId;
        closeModal();
        renderAll();
        toggleCart(true);
        toast(o.cart
          ? '已載入原訂單內容，改好後按「前往填寫訂購資料」重新送出'
          : '此訂單沒有可載入的內容，請重新選擇菜色後送出', 4200);
      }));
      $$('[data-cancel-order]', root).forEach((b) => b.addEventListener('click', () => {
        cancelOrder(b.dataset.cancelOrder);
      }));
    },
  });
}

/* ================================================================ 結帳 */
function openCheckout() {
  if (!loggedIn()) { toast('請先登入才能結帳'); return openLogin(); }
  if (alcLocked()) return toast('請先選擇一份春節套餐');
  if (!calc().count) return toast('訂單是空的');

  const c = calc();

  openModal(`
    <div class="flex items-start justify-between border-b border-[rgba(23,20,15,.1)] px-6 py-5">
      <div>
        <p class="caps">Order</p>
        <h3 class="serif mt-2 text-[19px] tracking-[.14em]">填寫訂購資料</h3>
        <p class="mt-2 text-[11px] tracking-[.08em] text-ink-mute">${S.editing ? `修改訂單 ${esc(S.editing)}` : '送出後我們會替您備餐'}</p>
      </div>
      <button data-close-modal class="grid h-8 w-8 shrink-0 place-items-center text-ink/40 transition hover:text-ink" aria-label="關閉">
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.2"/></svg>
      </button>
    </div>
    <form id="orderForm" class="space-y-5 px-6 py-6">
      <div class="grid gap-3 sm:grid-cols-2">
        <label class="block">
          <span class="field-label">姓名</span>
          <input name="name" required value="${esc(S.user.name)}"
                 class="field">
        </label>
        <label class="block">
          <span class="field-label">電話</span>
          <input name="phone" required inputmode="numeric" maxlength="10" value="${esc(S.user.phone)}"
                 class="field">
        </label>
      </div>
      <label class="block">
        <span class="field-label">備註</span>
        <textarea name="note" rows="2" class="field"></textarea>
      </label>

      <div class="border-t border-[rgba(23,20,15,.13)] pt-4 text-[11px] leading-[2] tracking-[.06em]">
        <p class="caps mb-2">Summary</p>
        <p class="text-ink-mute">用餐人數：${c.headcount} 人（依套餐人數計算）</p>
        <p class="text-ink-mute">套餐 ${fmt(c.setsSubtotal)} ・ 單點 ${fmt(c.alcSubtotal)} ・ 服務費 ${fmt(c.service)}</p>
        <p class="num mt-2 text-[17px] tracking-wide">總計 ${fmt(c.total)}</p>
        ${c.headcount && c.subtotal / c.headcount < CFG.rules.minSpendPerPerson
          ? `<p class="mt-1 font-bold text-thai-red">⚠ 每人平均 ${fmt(round(c.subtotal / c.headcount))}，未達最低消費 ${fmt(CFG.rules.minSpendPerPerson)}</p>` : ''}
      </div>

      ${(apiReady() || CFG.form.action) ? '' : `<p class="rounded-xl bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
        ⓘ <b>示範模式</b>：尚未連接門市系統（Apps Script 與 Google 表單都未設定），送出後訂單只會存在本機。設定方式見 SETUP.md。</p>`}

      <button id="btnSubmit" class="btn btn-solid w-full text-[11.5px]">
        確認送出訂單
      </button>
      <p class="text-center text-[9.5px] tracking-[.16em] text-ink-mute">本頁不含線上付款・款項請於現場結清</p>
    </form>`, {
    onMount: (root) => { $('#orderForm', root).addEventListener('submit', submitOrder); },
  });
}

/* ---------------- 訂單字串化（給 Google 表單用） ---------------- */
function buildSummary() {
  const setLines = S.cart.sets.map((line) => {
    const def = SETS.find((s) => s.id === line.setId);
    const rows = [`${def.name} ×${line.qty}`];
    // 每個選項類別各一行，門市一眼看出客人選了什麼
    def.groups.forEach((g) => {
      const chosen = (line.picks[g.key] || []).filter(Boolean);
      rows.push(`　${g.label}：${chosen.length ? chosen.map((nm) => (line.mild && line.mild[nm] ? nm + '（不辣）' : nm)).join('、') : '—'}`);
    });
    const drinks = (line.drinks || []).filter((d) => d.name)
      .map((d) => `${d.name}${d.temp ? `（${d.temp}）` : ''}`);
    rows.push(`　飲料：${drinks.length ? drinks.join('、') : '—'}`);
    rows.push(`　內含：${def.fixed.join('、')}`);
    if ((line.upgrades || []).length) rows.push(`　升級：${line.upgrades.join('、')}`);
    return rows.join('\n');
  });
  const alcLines = S.cart.alc.map((line) => {
    const item = ALC.find((a) => a.id === line.id);
    return `${item.name}${line.temp ? `(${line.temp})` : ''}${line.spicy ? `(${line.spicy})` : ''} x${line.qty}`;
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
  const note = f.note.value.trim();

  if (!name) return toast('請填寫姓名');
  if (!/^09\d{8}$/.test(phone)) return toast('電話格式錯誤（09 開頭共 10 碼）');
  if (alcLocked()) return toast('請先選擇春節套餐');
  if (!calc().count) return toast('訂單是空的');

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
    pickup: '',
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
        headcount: c.headcount,
        sets: setLines.join(' ｜ '), setsTotal: c.setsSubtotal,
        alacarte: alcLines.join('、'), alacarteTotal: c.alcSubtotal,
        service: c.service, total: c.total, note: values.note, ts: values.ts,
        cart: JSON.stringify(S.cart),
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
    return;   // 保留訂單內容，讓客人可以重試
  }

  const record = {
    orderId, phone, name, pickup: '', headcount: c.headcount, total: c.total,
    status: act, ts: Date.now(), note,
    code: S.user.code || '',
    summary: [...setLines, ...alcLines].join(' ｜ '),
    cart: JSON.parse(JSON.stringify(S.cart)),
    delivered,
    writeMode: writeInfo ? writeInfo.mode : (delivered ? 'form' : 'local'),
  };
  S.orders = S.orders.filter((o) => o.orderId !== orderId).concat(record);
  save(LS.orders, S.orders);
  S.hasOrder = true;                     // 送出後只能檢視

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
        <button id="btnGoOrders" class="btn btn-solid w-full text-[11.5px]">查看我的訂單</button>
        <button data-close-modal class="w-full rounded-full bg-ink/5 py-3 text-sm font-bold">繼續點餐</button>
      </div>
      <p class="mt-3 text-[10px] leading-relaxed tracking-[.06em] text-ink-mute">
        訂單已送出，內容如需更改請${tel('聯繫')}，由門市為您開啟修改。
      </p>
    </div>`, {
    onMount: (root) => $('#btnGoOrders', root).addEventListener('click', () => { closeModal(); openMyOrders(); }),
  });
  toast(delivered ? '訂單已送出' : '已建立本機訂單（示範模式）');
}

/* -------- 修改已送出的訂單：載回訂單內容 -------- */
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
  if (!confirm(`確定要取消訂單 ${orderId} 嗎？`)) return;
  try {
    await postOrderToApi({
      action: '取消', orderId, name: S.user.name, phone: S.user.phone,
      code: S.user.code || '', ts: new Date().toLocaleString('zh-TW', { hour12: false }),
    });
  } catch (err) {
    return toast(`${err.message || '取消失敗'}`, 4200);
  }
  // 本機紀錄同步
  const o = S.orders.find((x) => x.orderId === orderId);
  if (o) { o.status = '取消訂單'; o.ts = Date.now(); save(LS.orders, S.orders); }
  closeModal();
  renderAll();
  toast('已送出取消通知');
}

/* ================================================================ 事件綁定 */
function bindEvents() {
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-config-set],[data-pick],[data-mildpick],[data-upgrade],[data-add-set],[data-close-modal],[data-close-cart],[data-add-alc],[data-qty-alc],[data-del-alc],[data-qty-set],[data-del-set],[data-cat],[data-edit-order],[data-cancel-order],[data-menu-action],[data-drawer-close]');
    if (!t) return;
    const d = t.dataset;

    if (d.configSet !== undefined) return openSetConfig(d.configSet);
    if (d.closeModal !== undefined) return closeModal();

    /* 三條線選單 */
    if (d.drawerClose !== undefined) return closeDrawer();
    if (d.menuAction !== undefined) {
      closeDrawer();
      if (d.menuAction === 'login') return openLogin();
      if (d.menuAction === 'logout') return doLogout();
      if (d.menuAction === 'orders') return openMyOrders();
      if (d.menuAction === 'guide') return openGuide();
      if (d.menuAction === 'cart') return toggleCart(true);
      return;
    }

    if (d.pick !== undefined) {   // 空字串屬性也是假值，一律用 !== undefined 判斷
      const g = SETS.find((s) => s.id === S.draft.setId).groups.find((x) => x.key === d.pick);
      const arr = S.draft.picks[d.pick];
      const i = arr.indexOf(d.value);
      const nowOn = i < 0;
      if (i >= 0) arr.splice(i, 1);
      else if (arr.length < g.pick) arr.push(d.value);
      else { arr.shift(); arr.push(d.value); toast(`「${g.label}」最多選 ${g.pick} 道，已自動替換`); }
      syncDraftUI();
      // 辣菜：直接在點的位置彈出「正常／不辣」
      if (nowOn && canNoSpicy(d.value)) {
        askMild(d.value, document.querySelector(`[data-pick="${d.pick}"][data-value="${d.value}"]`));
      }
      return;
    }
    if (d.mildpick !== undefined) {
      S.draft.mild[d.mildpick] = !S.draft.mild[d.mildpick];
      return syncDraftUI();
    }
    if (d.upgrade !== undefined) {
      const i = S.draft.upgrades.indexOf(d.upgrade);
      if (i >= 0) S.draft.upgrades.splice(i, 1); else S.draft.upgrades.push(d.upgrade);
      return syncDraftUI();
    }
    if (d.addSet !== undefined) {
      if (hasOrder()) { closeModal(); return toast('您已送出訂單，如需更改請聯繫門市開通修改', 3600); }
      if (!draftComplete()) {
        S.draft.tried = true;
        syncDraftUI();
        const missing = $$('.group-box.bad').length;
        return toast(`還有 ${missing} 項沒選滿，已用紅框標出`);
      }
      if (!loggedIn()) return needLogin('請先登入才能把套餐加入訂單');
      const existing = S.cart.sets.findIndex((l) => l.lineId === S.draft.lineId);
      if (existing >= 0) S.cart.sets[existing] = S.draft; else S.cart.sets.push(S.draft);
      S.draft = null;
      persistCart(); closeModal(); renderAll();
      toast('套餐已加入訂單');
      return;
    }
    if (d.addAlc !== undefined) {
      if (needLogin('請先登入才能選購餐點')) return;
      if (hasOrder()) return toast('您已送出訂單，如需更改請聯繫門市開通修改', 3600);
      if (alcLocked()) return toast('請先選擇一份春節套餐才能加點單點');
      const item = ALC.find((a) => a.id === d.addAlc);
      if (tempsOf(item.name).length || canNoSpicy(item.name)) return openTempPicker(d.addAlc);
      return addAlcLine(d.addAlc, '');
    }
    if (d.qtyAlc !== undefined) {
      const [idTemp, spicy = ''] = d.qtyAlc.split('#');
      const [id, temp = ''] = idTemp.split('@');
      const line = S.cart.alc.find((l) => l.id === id && (l.temp || '') === temp && (l.spicy || '') === spicy);
      if (!line) return;
      line.qty += Number(d.delta);
      if (line.qty <= 0) S.cart.alc = S.cart.alc.filter((l) => l !== line);
      else if (line.qty > 20) { line.qty = 20; toast('單一品項最多 20 份'); }
      persistCart(); renderAll();
      return;
    }
    if (d.delAlc !== undefined) {
      const [idTemp2, spicy2 = ''] = d.delAlc.split('#');
      const [id, temp = ''] = idTemp2.split('@');
      S.cart.alc = S.cart.alc.filter((l) => !(l.id === id && (l.temp || '') === temp && (l.spicy || '') === spicy2));
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
    if (d.editOrder !== undefined) return;   // 由「我的訂單」彈窗自己的處理器負責（伺服器資料）
    if (d.cancelOrder !== undefined) return cancelOrder(d.cancelOrder);
    if (d.closeCart !== undefined) return toggleCart(false);
  });

  $('#btnCartTop').addEventListener('click', async () => {
    // 第一次點時狀態可能還沒抓回來 → 先確認再決定開哪一個
    if (loggedIn() && !S.hasOrder) await refreshMyOrderState(false);
    if (hasOrder()) openMyOrders(); else toggleCart();
  });
  $('#btnCartBar').addEventListener('click', () => toggleCart());
  $('#cartOverlay').addEventListener('click', () => toggleCart(false));

  /* 三條線選單 */
  $('#btnDrawer').addEventListener('click', openDrawer);
  $('#drawerOverlay').addEventListener('click', closeDrawer);

  /* 封面兩顆按鈕 */
  $('#btnStart').addEventListener('click', () => {
    if (!loggedIn()) return needLogin('請先登入（訂位手機號碼＋驗證碼）才能開始點餐');
    if (hasOrder()) return openMyOrders();
    document.querySelector('#sets').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $('#btnCoverLogin').addEventListener('click', () => (S.user ? openMyOrders() : openLogin()));

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    closeDrawer(); closeModal(); toggleCart(false);
  });
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
  initHeaderScroll();
  renderAll();
  initReveal();
  if (loggedIn()) refreshMyOrderState(false);   // 已登入就先把訂單狀態抓回來（不自動彈窗）
}

/* 頂部列：捲過封面後轉為紙色 */
function initHeaderScroll() {
  const h = $('#siteHeader');
  if (!h) return;
  const onScroll = () => h.classList.toggle('is-solid', window.scrollY > 48);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

/* 進場動畫（只播一次） */
function initReveal() {
  const els = $$('.reveal');
  if (!('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      en.target.classList.add('in');
      io.unobserve(en.target);
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });
  els.forEach((e) => io.observe(e));
}
document.addEventListener('DOMContentLoaded', init);

})(); /* end of IIFE */
