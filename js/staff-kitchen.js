/**
 * 內場出單：把所有「未取消」訂單彙總成廚房需要的份數
 *   - 掛在員工看板頁（staff.html），資料來源為 window.__staffOrders（由 staff.js 提供）
 *   - 套餐／套餐選項／飲料／單點 分別統計，並標示「不辣」
 */
(function () {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s) => String(s || '').replace(/[（(]/g, '(').replace(/[）)]/g, ')').trim();

  /* ── 解析：套餐內容 ──────────────────────────────
     格式： 春節四人套餐 ×1
           　涼拌：香煎瀑布牛涼拌
           　飲料：泰式奶茶（冰）、泰式奶茶（冰）
           　內含：冠軍月亮蝦餅、檸香蒸扁鱈
  ─────────────────────────────────────────────── */
  function parseSets(txt) {
    const out = [];
    String(txt || '').split('｜').forEach((block) => {
      const lines = block.split('\n').map((l) => l.replace(/^\u3000+/, '').trim()).filter(Boolean);
      if (!lines.length) return;
      const head = lines.shift();
      const m = head.match(/^(.*?)\s*[×x]\s*(\d+)\s*$/);
      const item = { name: m ? m[1].trim() : head, qty: m ? Number(m[2]) : 1, groups: [], fixed: [], drinks: [] };
      lines.forEach((l) => {
        const gi = l.indexOf('：');
        if (gi < 0) return;
        const label = l.slice(0, gi).trim();
        const vals = l.slice(gi + 1).split('、').map((v) => v.trim()).filter(Boolean);
        if (/^(內含|特選|贈)/.test(label)) item.fixed.push(...vals);
        else if (label === '飲料') item.drinks.push(...vals);
        else item.groups.push({ label, vals });
      });
      out.push(item);
    });
    return out;
  }

  /* ── 解析：單點內容（菜名(不辣) x2、菜名（熱）x1） ── */
  function parseAlc(txt) {
    const out = [];
    String(txt || '').split('、').forEach((raw) => {
      const s = raw.trim();
      if (!s) return;
      const m = s.match(/^(.*?)\s*[×x]\s*(\d+)\s*$/);
      const body = m ? m[1].trim() : s;
      const qty = m ? Number(m[2]) : 1;
      let name = body, tags = [];
      const t = body.match(/^(.*?)[（(]([^）)]*)[）)]\s*$/);
      if (t) { name = t[1].trim(); tags = t[2].split(/[、,]/).map((x) => x.trim()).filter(Boolean); }
      out.push({ name, tags, qty });
    });
    return out;
  }

  /* ── 彙總 ─────────────────────────────────────── */
  function build() {
    const orders = (window.__staffOrders || []).filter((o) => o.status !== '已取消');
    const setCount = {};                         // 套餐 → 份數
    const byLabel = {};                          // 選項類別 → { 菜名: {qty, mild} }
    const drinks = {};                           // 飲料（含冰熱）→ 份數
    const fixed = {};                            // 隨餐附贈 → 份數
    const alc = {};                              // 單點（含標記）→ 份數

    const bump = (map, key, n) => { map[key] = (map[key] || 0) + n; };
    const bumpLabel = (label, name, n, mild) => {
      byLabel[label] = byLabel[label] || {};
      const cur = byLabel[label][name] || { qty: 0, mild: 0 };
      cur.qty += n; if (mild) cur.mild += n;
      byLabel[label][name] = cur;
    };
    const splitMild = (v) => {
      const mm = v.match(/^(.*?)\s*[（(]\s*不辣\s*[）)]\s*$/);
      return mm ? { name: mm[1].trim(), mild: true } : { name: v.trim(), mild: false };
    };

    orders.forEach((o) => {
      parseSets(o.sets).forEach((st) => {
        bump(setCount, st.name, st.qty);
        st.groups.forEach((g) => g.vals.forEach((v) => { const p = splitMild(v); bumpLabel(g.label, p.name, st.qty, p.mild); }));
        st.drinks.forEach((d) => bump(drinks, norm(d), st.qty));
        st.fixed.forEach((f) => { const p = splitMild(f); bump(fixed, p.name + (p.mild ? '（不辣）' : ''), st.qty); });
      });
      parseAlc(o.alacarte).forEach((a) => {
        const tag = a.tags.length ? `（${a.tags.join('、')}）` : '';
        bump(alc, a.name + tag, a.qty);
      });
    });

    return { orders, setCount, byLabel, drinks, fixed, alc };
  }

  const sorted = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));

  function html() {
    const k = build();
    const totalSets = Object.values(k.setCount).reduce((a, b) => a + b, 0);
    const now = new Date().toLocaleString('zh-TW', { hour12: false });

    const li = (name, n, extra) => `<div class="kk-row"><span class="kk-name">${esc(name)}${extra || ''}</span><span class="kk-qty">×${n}</span></div>`;
    const sec = (title, body, note) => body
      ? `<section class="kk-sec"><h3>${esc(title)}${note ? `<span class="kk-note">${note}</span>` : ''}</h3>${body}</section>` : '';

    let out = '';
    out += sec('套餐份數', sorted(k.setCount).map(([n, q]) => li(n, q)).join(''));
    Object.keys(k.byLabel).forEach((label) => {
      out += sec(`套餐選項：${label}`, sorted(k.byLabel[label]).map(([n, v]) =>
        li(n, v.qty, v.mild ? `<span class="kk-mild">不辣 ${v.mild}</span>` : '')).join(''));
    });
    out += sec('飲料', sorted(k.drinks).map(([n, q]) => li(n, q)).join(''));
    out += sec('隨餐附贈', sorted(k.fixed).map(([n, q]) => li(n, q)).join(''));
    out += sec('單點加點', sorted(k.alc).map(([n, q]) => li(n, q)).join(''));

    const orderList = k.orders.map((o) => `<div class="kk-row"><span class="kk-name">${esc(o.orderId)}　${esc(o.name)}
      <span class="kk-note">${esc((o.sets || '').split('\n')[0].split('｜')[0])}</span></span>
      <span class="kk-qty">${esc(o.car ? o.car : '')}</span></div>`).join('');

    return `<div class="kk-head">
        <div>
          <p class="caps">Kitchen</p>
          <h2>內場出單</h2>
          <p class="kk-sub">${esc(now)}・有效訂單 ${k.orders.length} 張・套餐共 ${totalSets} 份</p>
        </div>
        <div class="kk-actions">
          <button data-kk-print>列印</button>
          <button data-kk-close>關閉</button>
        </div>
      </div>
      <div class="kk-body">
        ${totalSets || Object.keys(k.alc).length ? out : '<p class="kk-empty">目前沒有有效訂單</p>'}
        ${orderList ? sec('訂單清單', orderList) : ''}
      </div>`;
  }

  function open() {
    let p = document.getElementById('kitchenPanel');
    if (!p) {
      p = document.createElement('div');
      p.id = 'kitchenPanel';
      document.body.appendChild(p);
      p.addEventListener('click', (e) => {
        if (e.target.closest('[data-kk-close]')) p.classList.remove('open');
        if (e.target.closest('[data-kk-print]')) window.print();
      });
    }
    p.innerHTML = html();
    p.classList.add('open');
  }

  /* ── 按鈕：掛在員工看板標題列 ── */
  function mountBtn() {
    const old = document.getElementById('btnKitchen');
    const host = document.getElementById('btnExport');        // 掛在「匯出 CSV」旁邊（一定在員工看板內）
    const fallback = document.getElementById('btnRefresh');
    const anchor = host || fallback;
    if (!anchor) return;
    if (old && old.parentElement === anchor.parentElement) return;   // 已經在同一列
    if (old) old.remove();
    const btn = document.createElement('button');
    btn.id = 'btnKitchen';
    btn.type = 'button';
    btn.className = 'btn btn-line px-3.5 py-1.5 text-[10px]';
    btn.textContent = '內場出單';
    btn.addEventListener('click', open);
    if (host) host.parentElement.insertBefore(btn, host);
    else anchor.parentElement.insertBefore(btn, anchor.nextSibling);
  }

  function css() {
    const st = document.createElement('style');
    st.textContent = `
    #btnKitchen{white-space:nowrap}
    #kitchenPanel{position:fixed;inset:0;z-index:80;background:rgba(23,20,15,.45);display:none;padding:16px}
    #kitchenPanel.open{display:block}
    #kitchenPanel .kk-head{background:#FAF7F2;border:1px solid rgba(23,20,15,.14);border-bottom:0;
      padding:14px 18px;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;
      max-width:920px;margin:0 auto}
    #kitchenPanel h2{font-family:var(--serif,serif);font-size:20px;letter-spacing:.1em;margin:4px 0 0}
    .kk-sub{font-size:11px;color:#6b6357;margin-top:4px}
    .kk-actions{display:flex;gap:8px}
    .kk-actions button{border:1px solid rgba(23,20,15,.2);background:transparent;padding:7px 14px;
      font-size:11px;letter-spacing:.12em;transition:.2s}
    .kk-actions button:hover{background:#17140F;color:#fff}
    .kk-body{background:#fff;border:1px solid rgba(23,20,15,.14);max-width:920px;margin:0 auto;
      padding:6px 18px 22px;overflow:auto;max-height:calc(100vh - 150px)}
    .kk-sec{margin-top:16px}
    .kk-sec h3{font-size:12px;font-weight:800;letter-spacing:.12em;border-bottom:1px solid rgba(23,20,15,.12);
      padding-bottom:6px;margin-bottom:6px}
    .kk-note{font-weight:400;color:#6b6357;margin-left:8px;font-size:10.5px}
    .kk-row{display:flex;justify-content:space-between;gap:12px;padding:5px 0;
      border-bottom:1px dashed rgba(23,20,15,.08);font-size:13px}
    .kk-name{flex:1;min-width:0}
    .kk-qty{font-weight:800;white-space:nowrap;font-variant-numeric:tabular-nums}
    .kk-mild{display:inline-block;margin-left:6px;font-size:10px;color:#A67C52;border:1px solid rgba(166,124,82,.5);
      padding:0 5px;border-radius:99px}
    .kk-empty{padding:22px 0;text-align:center;color:#6b6357;font-size:12px}
    @media print{
      body *{visibility:hidden}
      #kitchenPanel,#kitchenPanel *{visibility:visible}
      #kitchenPanel{position:static;background:#fff;padding:0}
      #kitchenPanel .kk-body{max-height:none;border:0;overflow:visible}
      .kk-actions{display:none}
    }`;
    document.head.appendChild(st);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { css(); mountBtn(); });
  else { css(); mountBtn(); }
  setInterval(mountBtn, 1500);   // 登入後看板才出現，持續確保按鈕掛在正確位置
  window.kitchenOpen = open;
})();
