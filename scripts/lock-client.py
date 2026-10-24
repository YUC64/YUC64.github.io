# -*- coding: utf-8 -*-
"""① 訂單表多存「原始資料」（讓客人換裝置也能改單）
   ② 客人端我的訂單改讀伺服器，只有員工開放時才出現修改／取消"""
import io, re, sys

# ═══════════════ Code.gs ═══════════════
p = 'scripts/google-apps-script/Code.gs'
s = io.open(p, encoding='utf-8').read()

def rep(old, new, label, expect=1):
    global s
    c = s.count(old)
    if c != expect:
        print('FAIL', label, c); sys.exit(1)
    s = s.replace(old, new)

rep("""  '修改權限',   // 員工按「開放修改」時填 open，客人改完一次自動收回
];
const COL_FLAG = 15;   // 「修改權限」欄索引""",
"""  '修改權限',   // 員工按「開放修改」時填 open，客人改完一次自動收回
  '原始資料',   // 前端購物車 JSON（讓客人換裝置也能載回內容修改）
];
const COL_FLAG = 15;   // 「修改權限」欄索引
const COL_CART = 16;   // 「原始資料」欄索引""", 'headers')

rep("""    action === '修改' ? '' : String((base || [])[COL_FLAG] || ''),   // 改完就收回權限
  ];""",
"""    action === '修改' ? '' : String((base || [])[COL_FLAG] || ''),   // 改完就收回權限
    keep(body.cart ? safe_(body.cart) : '', COL_CART),
  ];""", 'values-cart')

rep("""        updated: tsStr_(r[14]),
        editable: String(r[COL_FLAG] || '').trim() === 'open',
      });""",
"""        updated: tsStr_(r[14]),
        editable: String(r[COL_FLAG] || '').trim() === 'open',
        cart: parseCart_(r[COL_CART]),
      });""", 'mine-cart')

rep("""/** 日期／文字統一轉成 'yyyy/MM/dd HH:mm' */""",
"""/** 取出前端存的購物車 JSON（壞掉就回 null） */
function parseCart_(v) {
  const t = String(v || '').trim();
  if (!t) return null;
  try {
    const o = JSON.parse(t);
    return (o && Array.isArray(o.sets) && Array.isArray(o.alc)) ? o : null;
  } catch (e) { return null; }
}

/** 日期／文字統一轉成 'yyyy/MM/dd HH:mm' */""", 'parseCart_')

io.open(p, 'w', encoding='utf-8').write(s)
print('Code.gs ok')

# ═══════════════ app.js ═══════════════
p = 'js/app.js'
a = io.open(p, encoding='utf-8').read()
changes = 0

def arep(old, new, label, expect=1):
    global a, changes
    c = a.count(old)
    if c != expect:
        print('FAIL', label, c); sys.exit(1)
    a = a.replace(old, new); changes += 1

# 1) 送出時帶上購物車內容
arep("""        service: c.service, total: c.total, note: values.note, ts: values.ts,""",
     """        service: c.service, total: c.total, note: values.note, ts: values.ts,
        cart: JSON.stringify(S.cart),""", 'payload-cart')

# 2) 錯誤訊息
arep("""      not_your_order: '這筆訂單不是這個手機號碼的',""",
"""      not_your_order: '這筆訂單不是這個手機號碼的',
      already_ordered: '這支手機已經送過訂單了，如需更改請聯繫門市',
      edit_locked: '訂單已送出，如需更改請聯繫門市開通修改',""", 'errors')

# 3) 我的訂單：改讀伺服器、依權限顯示按鈕
old_my = re.search(r"function openMyOrders\(\) \{.*?\n\}\n", a, re.S)
if not old_my:
    print('FAIL openMyOrders'); sys.exit(1)

new_my = """async function fetchMine() {
  if (!apiReady() || !S.user) return null;
  const url = `${API_BASE()}?mine=1&phone=${encodeURIComponent(S.user.phone)}&code=${encodeURIComponent(S.user.code || '')}&t=${Date.now()}`;
  const res = await fetch(url, { cache: 'no-store' });
  const data = await res.json();
  return data && data.ok ? data : null;
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
    const lines = String(o.sets || '').split(/\\r?\\n/).filter(Boolean);
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
      ${offline ? `<p class="text-[10px] leading-relaxed tracking-[.06em] text-ink-mute">
        目前無法連線門市系統，以下為這台裝置的紀錄。</p>` : ''}
    </div>`, {
    onMount: (root) => {
      const byId = (id) => list.find((o) => o.orderId === id);
      $$('[data-edit-order]', root).forEach((b) => b.addEventListener('click', () => {
        const o = byId(b.dataset.editOrder);
        if (!o) return;
        if (o.cart) { S.cart = JSON.parse(JSON.stringify(o.cart)); persistCart(); }
        S.editing = o.orderId;
        closeModal();
        renderAll();
        toggleCart(true);
        toast('已載入原訂單內容，改好後按「前往填寫訂購資料」重新送出');
      }));
      $$('[data-cancel-order]', root).forEach((b) => b.addEventListener('click', () => {
        cancelOrder(b.dataset.cancelOrder);
      }));
    },
  });
}
"""
a = a[:old_my.start()] + new_my + a[old_my.end():]
changes += 1

# 4) cancelOrder 改成用伺服器資料（不需要本機紀錄）
old_cancel = re.search(r"async function cancelOrder\(orderId\) \{.*?\n\}\n", a, re.S)
if old_cancel:
    new_cancel = """async function cancelOrder(orderId) {
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
"""
    a = a[:old_cancel.start()] + new_cancel + a[old_cancel.end():]
    changes += 1

# 5) 成功畫面文案
arep("""        <button id="btnGoOrders" class="w-full rounded-full bg-ink py-3 text-sm font-black text-white">查看我的訂單（可修改／取消）</button>""",
     """        <button id="btnGoOrders" class="btn btn-solid w-full text-[11.5px]">查看我的訂單</button>""", 'success-btn')
arep("""      <p class="mt-3 text-[11px] text-ink-mute">如需變更，請登入同一支手機號碼後於「我的訂單」修改，或${tel()}</p>""",
     """      <p class="mt-3 text-[10px] leading-relaxed tracking-[.06em] text-ink-mute">
        訂單已送出，內容如需更改請${tel('聯繫')}，由門市為您開啟修改。
      </p>""", 'success-note')

io.open(p, 'w', encoding='utf-8').write(a)
print('app.js 修改', changes, '處')
