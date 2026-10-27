/* =============================================================================
 *  員工訂單看板
 *  資料來源：Apps Script  GET ?staff=1&pw=<密碼>  → { ok, count, orders[] }
 *  密碼只存在這台裝置（sessionStorage／可選 localStorage），不會寫在程式碼裡
 * ========================================================================== */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const CFG = window.CONFIG || {};
  const ENDPOINT = String((CFG.api && CFG.api.endpoint) || '').trim();

  const LS_PW = 'siam.staff.pw';
  const SS_PW = 'siam.staff.pw.session';
  const REFRESH_MS = 60000;

  const S = {
    pw: '',
    orders: [],
    seen: new Set(),      // 上一次就存在的訂單（用來標記新進單）
    filter: 'active',     // active | 新訂單 | 已修改 | 已取消 | all
    sort: 'oldest',       // oldest = 最早送出（出餐順序）｜recent = 最新送出
    q: '',
    timer: null,
    loading: false,
  };

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => (n === '' || n == null || isNaN(Number(n))) ? '—' : '$' + Number(n).toLocaleString('zh-TW');
  const num = (n) => (n === '' || n == null || isNaN(Number(n))) ? 0 : Number(n);
  const isCancelled = (o) => o.status === '已取消';
  const lines = (t) => String(t || '').split(String.fromCharCode(10)).map((l) => esc(l)).join('<br>');
  const badgeClass = (st) => st === '已取消' ? 'badge-cancel' : (st === '已修改' ? 'badge-edit' : 'badge-new');

  /* ───────────────────────── 密碼 ───────────────────────── */
  function loadPw() {
    try { return localStorage.getItem(LS_PW) || sessionStorage.getItem(SS_PW) || ''; } catch (e) { return ''; }
  }
  function savePw(pw, remember) {
    try {
      if (remember) { localStorage.setItem(LS_PW, pw); sessionStorage.removeItem(SS_PW); }
      else { sessionStorage.setItem(SS_PW, pw); localStorage.removeItem(LS_PW); }
    } catch (e) { /* 私密模式 */ }
  }
  function clearPw() {
    try { localStorage.removeItem(LS_PW); sessionStorage.removeItem(SS_PW); } catch (e) {}
  }

  /* ───────────────────────── 抓資料 ───────────────────────── */
  async function fetchOrders() {
    if (!ENDPOINT) throw new Error('尚未設定 API 網址（js/config.js 的 api.endpoint）');
    const url = ENDPOINT + '?staff=1&pw=' + encodeURIComponent(S.pw) + '&t=' + Date.now();
    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json();
    if (!data.ok) {
      const err = new Error(data.error || 'unknown');
      err.code = data.error;
      err.remaining = data.remaining;
      throw err;
    }
    return data.orders || [];
  }

  async function refresh(manual = false) {
    if (S.loading) return;
    S.loading = true;
    if (manual) $('#btnRefresh').textContent = '更新中…';
    try {
      const orders = await fetchOrders();
      const fresh = [];
      orders.forEach((o) => { if (!S.seen.has(o.orderId) && S.seen.size) fresh.push(o.orderId); });
      S.orders = orders;
      render(fresh);
      $('#errBox').classList.add('hidden');
      $('#lastUpdated').textContent = '更新 ' + new Date().toLocaleTimeString('zh-TW', { hour12: false });
      S.seen = new Set(orders.map((o) => o.orderId));
    } catch (err) {
      if (err.code === 'bad_password' || err.code === 'locked') {
        clearPw();
        showLock(err.code === 'locked'
          ? '嘗試次數過多，請等 15 分鐘後再試（或到 Apps Script 改密碼後重新部署）。'
          : '密碼不正確' + (err.remaining != null ? `（還可嘗試 ${err.remaining} 次）` : ''));
        return;
      }
      const box = $('#errBox');
      box.classList.remove('hidden');
      if (err.code === 'bad_phone' || err.code === 'need_code') {
        // 舊版 Apps Script 還沒有員工 API，會走到顧客驗證分支
        box.innerHTML = `伺服器還是舊版：請到 Apps Script 貼上新版 <b>Code.gs</b>，然後
          「部署 → 管理部署作業 → 編輯 → 版本：新版本 → 部署」。`;
        return;
      }
      box.innerHTML = `讀取失敗：<b>${esc(err.message)}</b><br>
        請確認：① Apps Script 已貼上新版並「重新部署」 ② 網路正常 ③ 網址是 /exec 結尾。`;
    } finally {
      S.loading = false;
      const b = $('#btnRefresh');
      if (b) b.textContent = '重新整理';
    }
  }

  /* ───────────────────────── 畫面 ───────────────────────── */
  function showLock(msg) {
    $('#staffApp').classList.add('hidden');
    $('#staffLock').classList.remove('hidden');
    if (msg) {
      const m = $('#pwMsg');
      m.textContent = msg;
      m.classList.remove('hidden');
    }
    stopAuto();
    $('#pwInput').focus();
  }
  function showApp() {
    $('#staffLock').classList.add('hidden');
    $('#staffApp').classList.remove('hidden');
  }

  const TABS = [
    { key: 'active', label: '進行中' },
    { key: 'all', label: '全部' },
    { key: '新訂單', label: '新訂單' },
    { key: '已修改', label: '已修改' },
    { key: '已取消', label: '已取消' },
  ];

  function renderTabs() {
    $('#tabs').innerHTML = TABS.map((t) => `
      <button data-tab="${esc(t.key)}" class="tab ${S.filter === t.key ? 'on' : ''}">${esc(t.label)}</button>`).join('');
  }

  function sortList(arr) {
    const byId = (a, b) => String(a.orderId).localeCompare(String(b.orderId));
    return S.sort === 'recent' ? arr.sort((a, b) => byId(b, a)) : arr.sort((a, b) => byId(a, b));
  }

  function filtered() {
    const q = S.q.trim().toLowerCase();
    return sortList(S.orders.filter((o) => {
      if (S.filter === 'active' && isCancelled(o)) return false;
      if (S.filter !== 'active' && S.filter !== 'all' && o.status !== S.filter) return false;
      if (!q) return true;
      return [o.orderId, o.name, o.phone, o.sets, o.alacarte, o.note]
        .join(' ').toLowerCase().includes(q);
    }));
  }

  function rowHTML(o, isNew) {
    const people = o.headcount ? `${num(o.headcount)} 人` : '—';
    return `
    <article class="row ${isNew ? 'flash' : ''}" data-order="${esc(o.orderId)}">
      <div class="px-4 py-3 cursor-pointer" data-toggle="${esc(o.orderId)}">
        <div class="row-grid">
          <div class="flex items-center gap-2">
            <span class="mono text-[12px]">${esc(o.orderId)}</span>
          </div>
          <div class="min-w-0">
            <p class="truncate text-[13px]">${esc(o.name) || '（未填姓名）'}
              <span class="mono ml-1.5 text-[11px] text-ink-mute">${esc(o.phone)}</span>
            </p>
            <p class="mt-1 flex flex-wrap gap-x-2 text-[10px] text-ink-mute md:hidden">
              <span>${people}</span>
              <span class="ml-auto">${esc(o.updated).replace(/^\d+\/\d+\/\s*/, '')}</span>
            </p>
          </div>
          <div class="hidden text-[11.5px] md:block">${people}</div>
          <div class="mono text-[13px] ${isCancelled(o) ? 'text-ink-mute line-through' : ''}">${money(o.total)}</div>
          <div><span class="badge ${badgeClass(o.status)}">${esc(o.status)}</span></div>
          <div class="hidden text-[9.5px] text-ink-mute md:block">${esc(o.updated).replace(/^\d+\//, '')}</div>
        </div>
      </div>
      <div class="detail hidden px-4 pb-4 pt-1">
        <dl class="grid gap-2 text-[11.5px] leading-relaxed sm:grid-cols-2">
          <div class="sm:col-span-2"><dt class="mb-1 text-ink-mute">套餐內容</dt>
            <dd class="border-l-2 border-[rgba(23,20,15,.15)] pl-3 leading-[1.9]">${o.sets ? lines(o.sets) : '—'}</dd></div>
          <div class="sm:col-span-2"><dt class="mb-1 text-ink-mute">單點內容</dt>
            <dd class="border-l-2 border-[rgba(23,20,15,.15)] pl-3 leading-[1.9]">${o.alacarte ? lines(o.alacarte) : '—'}</dd></div>
          <div><dt class="inline text-ink-mute">套餐金額：</dt><dd class="inline mono">${money(o.setsTotal)}</dd></div>
          <div><dt class="inline text-ink-mute">單點金額：</dt><dd class="inline mono">${money(o.alacarteTotal)}</dd></div>
          <div><dt class="inline text-ink-mute">服務費：</dt><dd class="inline mono">${money(o.service)}</dd></div>
          <div><dt class="inline text-ink-mute">總計：</dt><dd class="inline mono font-medium">${money(o.total)}</dd></div>
          <div class="sm:col-span-2"><dt class="inline text-ink-mute">車號：</dt><dd class="inline font-bold">${esc(o.car) || '—'}</dd></div>
          <div class="sm:col-span-2"><dt class="inline text-ink-mute">備註：</dt><dd class="inline">${esc(o.note) || '—'}</dd></div>
          <div class="sm:col-span-2"><dt class="inline text-ink-mute">動作／更新：</dt><dd class="inline">${esc(o.action) || '—'}・${esc(o.updated) || '—'}</dd></div>
          <div class="sm:col-span-2 flex items-center gap-3 border-t border-[rgba(23,20,15,.08)] pt-3">
            <span class="text-[11px] ${o.editable ? 'font-medium text-thai-green' : 'text-ink-mute'}">
              修改權限：${o.editable ? '已開放（客人可改一次）' : '未開放'}
            </span>
            <button data-toggle-edit="${esc(o.orderId)}" data-open="${o.editable ? '0' : '1'}"
              class="ml-auto border border-[rgba(23,20,15,.22)] px-3 py-1.5 text-[10.5px] tracking-[.1em] transition hover:bg-ink hover:text-white">
              ${o.editable ? '收回權限' : '開放修改'}
            </button>
            <button data-del-order="${esc(o.orderId)}"
              class="border border-thai-red/40 px-3 py-1.5 text-[10.5px] tracking-[.1em] text-thai-red transition hover:bg-thai-red hover:text-white">
              刪除訂單
            </button>
          </div>
        </dl>
      </div>
    </article>`;
  }

  function render(fresh = []) {
    renderTabs();
    const list = filtered();

    // KPI（以全部資料計算，不受篩選影響）
    const live = S.orders.filter((o) => !isCancelled(o));
    const cancelled = S.orders.filter(isCancelled);
    $('#statActive').textContent = live.length;
    $('#statMoney').textContent = money(live.reduce((s, o) => s + num(o.total), 0));
    $('#statPeople').textContent = live.reduce((s, o) => s + num(o.headcount), 0);
    $('#statCancelled').textContent = cancelled.length;

    $('#list').innerHTML = list.map((o) => rowHTML(o, fresh.includes(o.orderId))).join('');
    $('#empty').classList.toggle('hidden', list.length > 0);
    $('#listHead').classList.toggle('is-empty', list.length === 0);
    $('#listInfo').textContent = `顯示 ${list.length} / ${S.orders.length} 筆`;

    // 展開明細
    $$('#list [data-toggle]').forEach((el) => {
      el.addEventListener('click', () => {
        const row = el.closest('.row');
        const d = $('.detail', row);
        const open = !row.classList.contains('open');
        row.classList.toggle('open', open);
        d.classList.toggle('hidden', !open);
      });
    });
  }

  /* ───────────────────────── 匯出 / 列印 ───────────────────────── */
  function csv() {
    const cols = ['訂單編號', '狀態', '動作', '姓名', '電話', '用餐人數', '套餐內容', '套餐金額', '單點內容', '單點金額', '服務費', '總金額', '備註', '車號', '最後更新', '修改權限'];
    const rows = filtered().map((o) => [
      o.orderId, o.status, o.action, o.name, o.phone, o.headcount,
      o.sets, o.setsTotal, o.alacarte, o.alacarteTotal, o.service, o.total, o.note, o.updated,
      o.editable ? '已開放' : '',
    ]);
    const q = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    const body = [cols, ...rows].map((r) => r.map(q).join(',')).join('\r\n');
    return '\ufeff' + body;   // BOM：Excel 開啟中文不亂碼
  }

  function download() {
    const blob = new Blob([csv()], { type: 'text/csv;charset=utf-8' });
    const d = new Date();
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `饗泰多訂單_${stamp}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /* ───────────────────────── 自動更新 ───────────────────────── */
  function startAuto() {
    stopAuto();
    if ($('#autoRefresh').checked) S.timer = setInterval(() => { if (!document.hidden) refresh(); }, REFRESH_MS);
  }
  function stopAuto() {
    if (S.timer) clearInterval(S.timer);
    S.timer = null;
  }

  /* ───────────────────────── 啟動 ───────────────────────── */
  function start(pw) {
    S.pw = pw;
    showApp();
    refresh();
    startAuto();
  }

  document.addEventListener('DOMContentLoaded', () => {
    // 事件
    $('#pwForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const pw = $('#pwInput').value.trim();
      if (!pw) return;
      S.pw = pw;
      const btn = $('#pwForm button[type=submit]');
      btn.disabled = true; btn.textContent = '檢查中…';
      try {
        await fetchOrders();
        savePw(pw, $('#pwRemember').checked);
        $('#pwMsg').classList.add('hidden');
        start(pw);
      } catch (err) {
        $('#pwMsg').textContent = err.code === 'bad_password'
          ? '密碼不正確' + (err.remaining != null ? `（還可嘗試 ${err.remaining} 次）` : '')
          : err.code === 'locked' ? '嘗試次數過多，請 15 分鐘後再試'
          : (err.code === 'bad_phone' || err.code === 'need_code')
            ? '伺服器還是舊版：請在 Apps Script 貼上新版 Code.gs，重新部署後再試'
          : `無法連線：${err.message}`;
        $('#pwMsg').classList.remove('hidden');
      } finally {
        btn.disabled = false; btn.textContent = '進入看板';
      }
    });

    $('#btnLogout').addEventListener('click', () => { clearPw(); S.pw = ''; S.orders = []; showLock(); });
    $('#btnRefresh').addEventListener('click', () => refresh(true));
    $('#btnExport').addEventListener('click', download);
    $('#btnPrint').addEventListener('click', () => window.print());
    $('#autoRefresh').addEventListener('change', startAuto);
    $('#search').addEventListener('input', (e) => { S.q = e.target.value; render(); });
    $('#sortBy').addEventListener('change', (e) => { S.sort = e.target.value; render(); });
    $('#list').addEventListener('click', async (e) => {
      // 刪除訂單（客人的單會被移掉，之後可以重新點餐）
      const del = e.target.closest('[data-del-order]');
      if (del) {
        e.stopPropagation();
        const oid = del.dataset.delOrder;
        if (!confirm(`確定要刪除訂單 ${oid} 嗎？
刪除後這位客人可以重新點餐，且無法復原。`)) return;
        del.disabled = true;
        del.textContent = '刪除中…';
        const box = $('#errBox');
        try {
          const url = `${ENDPOINT}?staff=1&pw=${encodeURIComponent(S.pw)}&delorder=${encodeURIComponent(oid)}&t=${Date.now()}`;
          const res = await fetch(url, { cache: 'no-store' });
          const data = await res.json();
          if (!data.ok) throw new Error(data.error || 'failed');
          await refresh();
          box.classList.remove('hidden');
          box.className = 'mt-4 border border-thai-green/30 bg-thai-green/5 px-4 py-3 text-[11.5px] leading-relaxed text-thai-green';
          box.innerHTML = `已刪除訂單 <b>${esc(oid)}</b>${data.tab ? '（' + esc(data.tab) + '）' : ''}。這位客人現在可以重新點餐。`;
        } catch (err) {
          box.classList.remove('hidden');
          box.className = 'mt-4 border border-thai-red/30 bg-thai-red/5 px-4 py-3 text-[11.5px] leading-relaxed text-thai-red';
          box.textContent = `刪除失敗：${err.message}`;
          del.disabled = false;
          del.textContent = '刪除訂單';
        }
        return;
      }
      const b = e.target.closest('[data-toggle-edit]');
      if (!b) return;
      e.stopPropagation();
      const open = b.dataset.open === '1';
      const oid = b.dataset.toggleEdit;
      b.disabled = true;
      b.textContent = open ? '開通中…' : '收回中…';
      const box = $('#errBox');
      try {
        const url = `${ENDPOINT}?staff=1&pw=${encodeURIComponent(S.pw)}&setedit=${encodeURIComponent(oid)}&open=${open ? '1' : '0'}&t=${Date.now()}`;
        const res = await fetch(url, { cache: 'no-store' });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || 'failed');
        await refresh();
        box.classList.remove('hidden');
        box.className = 'mt-4 border border-thai-green/30 bg-thai-green/5 px-4 py-3 text-[11.5px] leading-relaxed text-thai-green';
        box.innerHTML = open
          ? `已開放訂單 <b>${esc(oid)}</b> 的修改權限（<b>客人只能修改一次</b>，改完自動收回）。請通知客人重新登入後到「我的訂單」修改。`
          : `已收回訂單 <b>${esc(oid)}</b> 的修改權限。`;
      } catch (err) {
        box.classList.remove('hidden');
        box.className = 'mt-4 border border-thai-red/30 bg-thai-red/5 px-4 py-3 text-[11.5px] leading-relaxed text-thai-red';
        box.textContent = `操作失敗：${err.message}（請確認 Code.gs 已更新並重新部署）`;
        b.disabled = false;
        b.textContent = open ? '開放修改' : '收回權限';
      }
    });

    $('#tabs').addEventListener('click', (e) => {
      const b = e.target.closest('[data-tab]');
      if (!b) return;
      S.filter = b.dataset.tab;
      render();
    });
    document.addEventListener('visibilitychange', () => { if (!document.hidden && S.pw) refresh(); });

    // 已記住的密碼直接進場
    const saved = loadPw();
    if (saved) {
      $('#pwInput').value = saved;
      S.pw = saved;
      fetchOrders()
        .then((orders) => { S.seen = new Set(orders.map((o) => o.orderId)); start(saved); })
        .catch(() => { clearPw(); showLock(); });
    } else {
      $('#pwInput').focus();
    }
  });
})();
