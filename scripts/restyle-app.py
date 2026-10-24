# -*- coding: utf-8 -*-
"""把 app.js 的樣板改成新版設計（髮絲線／襯線標題／移除紫色與鎖定文案）"""
import io, sys

p = 'js/app.js'
s = io.open(p, encoding='utf-8').read()
n = 0
fails = []

def rep(old, new, label):
    global s, n
    c = s.count(old)
    if c != 1:
        fails.append(f'{label}: 找到 {c} 次（需 1 次）')
        return
    s = s.replace(old, new)
    n += 1

# ── 1. toast 淡入淡出 ───────────────────────────────────────────────
rep("""function toast(msg, ms = 2200) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), ms);
}""",
"""function toast(msg, ms = 2400) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  requestAnimationFrame(() => { el.style.opacity = '1'; });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.classList.add('hidden'), 420);
  }, ms);
}""", 'toast')

# ── 2. 圖片區塊 ─────────────────────────────────────────────────────
rep("""  return `<div class="group relative ${aspect} w-full overflow-hidden rounded-xl img-fallback">
      <span class="absolute inset-0 grid place-items-center text-4xl">${emoji}</span>
      <span class="absolute inset-x-0 bottom-0 bg-black/35 px-2 py-1 text-[10px] font-bold text-white/90">饗泰多</span>
      <img src="${esc(src)}" alt="${esc(alt)}" loading="lazy"
           class="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
           onerror="this.style.display='none'">
    </div>`;""",
"""  return `<div class="media ${aspect} w-full img-fallback">
      <span class="absolute inset-0 grid place-items-center text-3xl opacity-60">${emoji}</span>
      <img src="${esc(src)}" alt="${esc(alt)}" loading="lazy"
           class="absolute inset-0 h-full w-full object-cover"
           onerror="this.style.display='none'">
    </div>`;""", 'imgBlock')

# ── 3. 套餐卡片 ─────────────────────────────────────────────────────
rep("""  const fixed = def.fixed.length
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
  </article>`;""",
"""  const fixed = def.fixed.length
    ? `<p class="mt-2.5 text-[11.5px] leading-[1.95] tracking-[.04em] text-ink-mute"><span class="text-ink">套餐特選</span>　${def.fixed.map((f) => esc(f) + spicyHTML(f)).join('、')}</p>`
    : '';
  const openLabel = loggedIn() ? '選擇菜色' : '查看菜色';
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
  </article>`;""", 'setCardHTML')

# ── 4. 分類頁籤 ─────────────────────────────────────────────────────
rep("""    return `<button data-cat="${c.key}" class="rounded-full px-4 py-2 text-sm font-black transition ${on ? 'bg-ink text-white' : 'bg-white text-ink-soft hover:bg-ink/5'}">${esc(c.label)}</button>`;""",
"""    return `<button data-cat="${c.key}" class="tab ${on ? 'on' : ''}">${esc(c.label)}</button>`;""", 'renderTabs')

# ── 5. 單點卡片（移除紫色、登入後選購、鎖定淡化） ───────────────────
rep("""function alcCardHTML(item) {
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
}""",
"""function alcCardHTML(item) {
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
                  class="grid h-8 w-8 shrink-0 place-items-center border border-[rgba(23,20,15,.22)] text-[15px] leading-none text-ink transition duration-300 hover:bg-ink hover:text-white active:scale-90">＋</button>
        </div>
        ${badges ? `<p class="mt-2 flex gap-2">${badges}</p>` : ''}
      </div>
    </div>
  </article>`;
}""", 'alcCardHTML')

# ── 6. 移除「單點尚未解鎖」與鎖頭 ───────────────────────────────────
rep("""function renderAlc() {
  const list = ALC.filter((a) => a.cat === S.cat);
  $('#alcList').innerHTML = list.map(alcCardHTML).join('');
  const locked = alcLocked();
  $('#alcLock').classList.toggle('hidden', !locked);
  $('#alcHint').textContent = locked
    ? (loggedIn() ? '先選一份春節套餐即可解鎖單點菜色。' : '登入並選擇一份春節套餐後，即可加點單點菜色。')
    : '單點已解鎖 ✓ 加點不受套餐規則限制（金額另加 10% 服務費）。';
}""",
"""function renderAlc() {
  const list = ALC.filter((a) => a.cat === S.cat);
  $('#alcList').innerHTML = list.map(alcCardHTML).join('');
  const hint = $('#alcHint');
  if (hint) {
    hint.textContent = (alcLocked() && loggedIn())
      ? '春節期間單點需搭配套餐，選好套餐後即可加點'
      : '菜色與價格一覽';
  }
}""", 'renderAlc')

# ── 7. 套餐彈窗的加入按鈕 ───────────────────────────────────────────
rep("""  if (!ok) {
    btn.className = 'w-full rounded-full py-3 text-sm font-black transition bg-gray-200 text-gray-400';
    btn.textContent = '加入購物車';
  } else if (!loggedIn()) {
    btn.className = 'w-full rounded-full py-3 text-sm font-black transition bg-siam-purple text-white hover:bg-siam-dark';
    btn.textContent = '登入後加入購物車';
  } else {
    btn.className = 'w-full rounded-full py-3 text-sm font-black transition bg-brand text-ink hover:bg-brand-dark';
    btn.textContent = '加入購物車';
  }""",
"""  if (!ok) {
    btn.className = 'btn btn-line is-disabled w-full text-[11.5px]';
    btn.textContent = '請選滿內容';
  } else if (!loggedIn()) {
    btn.className = 'btn btn-line w-full text-[11.5px]';
    btn.textContent = '登入後加入';
  } else {
    btn.className = 'btn btn-solid w-full text-[11.5px]';
    btn.textContent = '加入購物車';
  }""", 'syncDraftUI-btn')

# ── 8. 登入彈窗（標題、文案、欄位、按鈕） ───────────────────────────
rep("""    <div class="flex items-start justify-between border-b border-ink/10 px-4 py-3">
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
    </form>`""",
"""    <div class="flex items-start justify-between border-b border-[rgba(23,20,15,.1)] px-6 py-5">
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
    </form>`""", 'openLogin')

# ── 9. 會員頭像（紫→墨） ─────────────────────────────────────────────
rep("""<span class="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-siam-purple text-lg font-black text-white">${esc(S.user.name.slice(0, 1))}</span>""",
"""<span class="serif grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[rgba(23,20,15,.2)] text-[15px] tracking-wide">${esc(S.user.name.slice(0, 1))}</span>""", 'renderMember-avatar')

# ── 10. 購物車結帳按鈕（未登入時直接是「登入」） ────────────────────
rep("""    <button id="btnCheckout" ${canCheckout ? '' : 'disabled'}
      class="mt-3 w-full rounded-full py-3.5 text-sm font-black transition ${canCheckout ? 'bg-brand text-ink hover:bg-brand-dark' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}">
      ${!loggedIn() ? '登入後才能結帳' : (alcLocked() ? '請先選擇春節套餐' : '前往填寫訂購資料')}
    </button>
    <p class="mt-2 text-center text-[11px] text-ink-mute">送出即代表同意門市訂購規則；現場結帳（無線上金流）</p>`;""",
"""    <button id="btnCheckout" ${canCheckout || !loggedIn() ? '' : 'disabled'}
      class="btn mt-4 w-full text-[11.5px] ${canCheckout || !loggedIn() ? 'btn-solid' : 'btn-line is-disabled'}">
      ${!loggedIn() ? '登入' : (alcLocked() ? '請先選擇套餐' : '前往填寫訂購資料')}
    </button>
    <p class="mt-3 text-center text-[9.5px] tracking-[.16em] text-ink-mute">送出即代表同意門市訂購規則・現場結帳</p>`;""", 'renderCart-checkout')

# ── 11. init：加上頂部列捲動 + 進場動畫 ─────────────────────────────
rep("""  bindEvents();
  renderAll();
}
document.addEventListener('DOMContentLoaded', init);""",
"""  bindEvents();
  initHeaderScroll();
  renderAll();
  initReveal();
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
document.addEventListener('DOMContentLoaded', init);""", 'init')

io.open(p, 'w', encoding='utf-8').write(s)
print('已套用', n, '處修改')
if fails:
    print('失敗：')
    [print(' -', f) for f in fails]
    sys.exit(1)
