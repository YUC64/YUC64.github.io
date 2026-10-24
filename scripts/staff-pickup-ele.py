# -*- coding: utf-8 -*-
import io, re, sys

def load(p): return io.open(p, encoding='utf-8').read()
def store(p, s): io.open(p, 'w', encoding='utf-8').write(s)
def rep(s, old, new, label, expect=1):
    c = s.count(old)
    if c != expect:
        print('FAIL', label, c); sys.exit(1)
    return s.replace(old, new)

# ═══════════════ staff.html ═══════════════
p = 'staff.html'; s = load(p)
s = rep(s, """    .row-grid { grid-template-columns: 150px 1fr 150px 110px 110px 110px 90px; align-items: center; gap: 1rem; }""",
         """    .row-grid { grid-template-columns: 150px 1fr 100px 110px 110px 90px; align-items: center; gap: 1rem; }""", 'grid')
s = rep(s, """        <span>訂單編號</span><span>客人</span><span>取餐時間</span><span>人數</span><span>金額</span><span>狀態</span><span>更新</span>""",
         """        <span>訂單編號</span><span>客人</span><span>人數</span><span>金額</span><span>狀態</span><span>更新</span>""", 'thead')
s = rep(s, """          <option value="pickup">依取餐時間</option>
          <option value="recent">最新送出</option>""",
         """          <option value="recent">最新送出</option>
          <option value="oldest">最早送出</option>""", 'sortopts')
store(p, s)
print('staff.html ok')

# ═══════════════ staff.js ═══════════════
p = 'js/staff.js'; s = load(p)
s = rep(s, """    sort: 'pickup',       // pickup = 依取餐時間｜recent = 最新送出""",
         """    sort: 'oldest',       // oldest = 最早送出（出餐順序）｜recent = 最新送出""", 'sortstate')

s = rep(s, """  function sortList(arr) {
    const byId = (a, b) => String(a.orderId).localeCompare(String(b.orderId));
    if (S.sort === 'recent') return arr.sort((a, b) => byId(b, a));   // 訂單編號含時間，新的排前面
    return arr.sort((a, b) => {
      const pa = a.pickup || '', pb = b.pickup || '';
      if (pa !== pb) return pa < pb ? -1 : 1;                          // 取餐時間早的在前
      return byId(a, b);
    });
  }""",
"""  function sortList(arr) {
    const byId = (a, b) => String(a.orderId).localeCompare(String(b.orderId));
    return S.sort === 'recent' ? arr.sort((a, b) => byId(b, a)) : arr.sort((a, b) => byId(a, b));
  }""", 'sortfn')

# 列內容：移除取餐時間
s = rep(s, """          <div class="hidden text-[11.5px] md:block">${esc(o.pickup) || '—'}</div>
""", "", 'row-pickup')

s = rep(s, """            <p class="mt-1 flex flex-wrap gap-x-2 text-[10px] text-ink-mute md:hidden">
              <span>${esc(o.pickup) || '—'}</span><span>・${people}</span>
              <span class="ml-auto">${esc(o.updated).replace(/^\\d+\\/\\d+\\/\\s*/, '')}</span>
            </p>""",
"""            <p class="mt-1 flex flex-wrap gap-x-2 text-[10px] text-ink-mute md:hidden">
              <span>${people}</span>
              <span class="ml-auto">${esc(o.updated).replace(/^\\d+\\/\\d+\\/\\s*/, '')}</span>
            </p>""", 'row-mobile')

# 明細：加「修改權限」列與按鈕
s = rep(s, """          <div class="sm:col-span-2"><dt class="inline text-ink-mute">動作／更新：</dt><dd class="inline">${esc(o.action) || '—'}・${esc(o.updated) || '—'}</dd></div>""",
"""          <div class="sm:col-span-2"><dt class="inline text-ink-mute">動作／更新：</dt><dd class="inline">${esc(o.action) || '—'}・${esc(o.updated) || '—'}</dd></div>
          <div class="sm:col-span-2 flex items-center gap-3 border-t border-[rgba(23,20,15,.08)] pt-3">
            <span class="text-[11px] ${o.editable ? 'font-medium text-thai-green' : 'text-ink-mute'}">
              修改權限：${o.editable ? '已開放（客人可改一次）' : '未開放'}
            </span>
            <button data-toggle-edit="${esc(o.orderId)}" data-open="${o.editable ? '0' : '1'}"
              class="ml-auto border border-[rgba(23,20,15,.22)] px-3 py-1.5 text-[10.5px] tracking-[.1em] transition hover:bg-ink hover:text-white">
              ${o.editable ? '收回權限' : '開放修改'}
            </button>
          </div>""", 'detail-edit')

# 事件：開放／收回
s = rep(s, """    $('#tabs').addEventListener('click', (e) => {""",
"""    $('#list').addEventListener('click', async (e) => {
      const b = e.target.closest('[data-toggle-edit]');
      if (!b) return;
      e.stopPropagation();
      const open = b.dataset.open === '1';
      b.disabled = true;
      b.textContent = open ? '開通中…' : '收回中…';
      try {
        const res = await fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: open ? '開放修改' : '收回修改', orderId: b.dataset.toggleEdit, staffPw: S.pw }),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || 'failed');
        if (open) {
          try { await navigator.clipboard.writeText(`${b.dataset.toggleEdit}`); } catch (e2) {}
        }
        await refresh();
        const box = $('#errBox');
        box.classList.remove('hidden');
        box.className = 'mt-4 border border-thai-green/30 bg-thai-green/5 px-4 py-3 text-[11.5px] leading-relaxed text-thai-green';
        box.innerHTML = open
          ? `已開放訂單 <b>${esc(b.dataset.toggleEdit)}</b> 的修改權限（<b>客人只能修改一次</b>，改完自動收回）。請通知客人重新登入後到「我的訂單」修改。`
          : `已收回訂單 <b>${esc(b.dataset.toggleEdit)}</b> 的修改權限。`;
      } catch (err) {
        const box = $('#errBox');
        box.classList.remove('hidden');
        box.className = 'mt-4 border border-thai-red/30 bg-thai-red/5 px-4 py-3 text-[11.5px] leading-relaxed text-thai-red';
        box.textContent = `操作失敗：${err.message}`;
        b.disabled = false;
        b.textContent = open ? '開放修改' : '收回權限';
      }
    });

    $('#tabs').addEventListener('click', (e) => {""", 'toggle-handler')

# CSV 移除取餐欄
s = rep(s, """    const cols = ['訂單編號', '狀態', '動作', '姓名', '電話', '預計取餐時間', '用餐人數', '套餐內容', '套餐金額', '單點內容', '單點金額', '服務費', '總金額', '備註', '最後更新'];
    const rows = filtered().map((o) => [
      o.orderId, o.status, o.action, o.name, o.phone, o.pickup, o.headcount,
      o.sets, o.setsTotal, o.alacarte, o.alacarteTotal, o.service, o.total, o.note, o.updated,
    ]);""",
"""    const cols = ['訂單編號', '狀態', '動作', '姓名', '電話', '用餐人數', '套餐內容', '套餐金額', '單點內容', '單點金額', '服務費', '總金額', '備註', '最後更新', '修改權限'];
    const rows = filtered().map((o) => [
      o.orderId, o.status, o.action, o.name, o.phone, o.headcount,
      o.sets, o.setsTotal, o.alacarte, o.alacarteTotal, o.service, o.total, o.note, o.updated,
      o.editable ? '已開放' : '',
    ]);""", 'csv')
store(p, s)
print('staff.js ok')

# ═══════════════ style.css ═══════════════
p = 'assets/css/style.css'; s = load(p)

# 小象改成 Logo 紫
s = rep(s, """.ele { width: 100%; height: 100%; color: rgba(255,255,255,.94); display: block; filter: drop-shadow(0 6px 18px rgba(0,0,0,.35)); }""",
        """.ele {
  width: 100%; height: 100%;
  color: #A848E8;                       /* 品牌 Logo 的紫 */
  display: block;
  filter: drop-shadow(0 6px 16px rgba(0,0,0,.4)) drop-shadow(0 0 1px rgba(255,255,255,.55));
}""", 'ele-color')

# 減少動態：改成柔和版（不要整個凍結）
s = rep(s, """/* 減少動態偏好 */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .001ms !important; animation-iteration-count: 1 !important;
    transition-duration: .001ms !important;
  }
  html { scroll-behavior: auto; }
  .reveal { opacity: 1; transform: none; filter: none; }
  .rise { opacity: 1; }
}""",
"""/* 減少動態偏好：保留「淡入」與緩慢的小象，只拿掉位移、推鏡與模糊 */
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }

  @keyframes fadeOnly { from { opacity: 0; } to { opacity: 1; } }
  .rise { animation: fadeOnly .9s var(--ease) forwards !important; }

  .kenburns { animation: none !important; transform: none !important; }
  .reveal {
    opacity: 1 !important; transform: none !important;
    filter: none !important; transition: none !important;
  }
  .ele-run { animation-duration: 46s !important; }
  .ele-bob, .ele .leg, .ele-ear, .ele-trunk, .ele-tail { animation: none !important; }
  .dust { display: none; }
  .nudge { animation: none !important; }
}""", 'reduced-motion')
store(p, s)
print('style.css ok')
