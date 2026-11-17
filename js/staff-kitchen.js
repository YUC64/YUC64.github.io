/**
 * 內場出單：把所有有效訂單的「菜色份數」彙總成一張清單
 *   - 只輸出「菜名 → 幾份」
 *   - 辣／不辣分開列
 *   - 不顯示套餐份數、訂單清單、附贈/套餐/單點等分類
 */
(function () {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s) => String(s || '').replace(/[（(]/g, '(').replace(/[）)]/g, ')').trim();

  function parseSets(txt) {
    const out = [];
    String(txt || '').split('｜').forEach((block) => {
      const lines = block.split('\n').map((l) => l.replace(/^\u3000+/, '').trim()).filter(Boolean);
      if (!lines.length) return;
      const head = lines.shift();
      const m = head.match(/^(.*?)\s*[×x]\s*(\d+)\s*$/);
      const item = { qty: m ? Number(m[2]) : 1, groups: [], fixed: [], drinks: [] };
      lines.forEach((l) => {
        const gi = l.indexOf('：');
        if (gi < 0) return;
        const label = l.slice(0, gi).trim();
        const vals = l.slice(gi + 1).split('、').map((v) => v.trim()).filter(Boolean);
        if (/^(內含|特選|贈)/.test(label)) item.fixed.push(...vals);
        else if (label === '飲料') item.drinks.push(...vals);
        else item.groups.push(vals);
      });
      out.push(item);
    });
    return out;
  }

  function parseAlc(txt) {
    const out = [];
    String(txt || '').split('、').forEach((raw) => {
      const s = raw.trim();
      if (!s) return;
      const m = s.match(/^(.*?)\s*[×x]\s*(\d+)\s*$/);
      const body = m ? m[1].trim() : s;
      const qty = m ? Number(m[2]) : 1;
      let name = body, tag = '';
      const t = body.match(/^(.*?)[（(]([^）)]*)[）)]\s*$/);
      if (t) { name = t[1].trim(); tag = t[2].trim(); }
      out.push({ name, tag, qty });
    });
    return out;
  }

  function splitMild(v) {
    const mm = String(v).match(/^(.*?)\s*[（(]\s*不辣\s*[）)]\s*$/);
    return mm ? { name: mm[1].trim(), mild: true } : { name: String(v).trim(), mild: false };
  }

  function build() {
    const orders = (window.__staffOrders || []).filter((o) => o.status !== '已取消');
    const count = {};
    const bump = (name, n) => { const k = String(name).trim(); if (!k) return; count[k] = (count[k] || 0) + n; };

    orders.forEach((o) => {
      parseSets(o.sets).forEach((st) => {
        st.groups.forEach((vals) => vals.forEach((v) => {
          const p = splitMild(v);
          bump(p.mild ? p.name + '（不辣）' : p.name, st.qty);
        }));
        st.fixed.forEach((f) => {
          const p = splitMild(f);
          bump(p.mild ? p.name + '（不辣）' : p.name, st.qty);
        });
        st.drinks.forEach((d) => bump(norm(d).replace('(', '（').replace(')', '）'), st.qty));
      });
      parseAlc(o.alacarte).forEach((a) => {
        const mild = a.tag === '不辣';
        const suffix = mild ? '（不辣）' : (a.tag ? '（' + a.tag + '）' : '');
        bump(a.name + suffix, a.qty);
      });
    });

    const rows = Object.entries(count).map(([name, qty]) => {
      const mild = /（不辣）$/.test(name);
      return { name, qty, mild, group: name.replace(/（不辣）$/, '') };
    }).sort((a, b) => (a.group === b.group ? (a.mild - b.mild) : (a.group < b.group ? -1 : 1)));

    const total = rows.reduce((s, r) => s + r.qty, 0);
    return { orders, rows, total };
  }

  function html() {
    const k = build();
    const now = new Date().toLocaleString('zh-TW', { hour12: false });
    const list = k.rows.map((r) => `<div class="kk-row${r.mild ? ' kk-mildrow' : ''}">
        <span class="kk-name">${esc(r.group)}${r.mild ? '<span class="kk-tag">不辣</span>' : ''}</span>
        <span class="kk-qty">${r.qty}</span>
      </div>`).join('');

    return `<div class="kk-head">
        <div>
          <p class="caps">Kitchen</p>
          <h2>內場出單</h2>
          <p class="kk-sub">${esc(now)}・有效訂單 ${k.orders.length} 張・共 ${k.total} 份</p>
        </div>
        <div class="kk-actions">
          <button data-kk-print>列印</button>
          <button data-kk-close>關閉</button>
        </div>
      </div>
      <div class="kk-body">
        ${k.rows.length ? list : '<p class="kk-empty">目前沒有有效訂單</p>'}
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

  function mountBtn() {
    const old = document.getElementById('btnKitchen');
    const host = document.getElementById('btnExport');
    const anchor = host || document.getElementById('btnRefresh');
    if (!anchor) return;
    if (old && old.parentElement === anchor.parentElement) return;
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
      max-width:760px;margin:0 auto}
    #kitchenPanel h2{font-family:var(--serif,serif);font-size:20px;letter-spacing:.1em;margin:4px 0 0}
    .kk-sub{font-size:11px;color:#6b6357;margin-top:4px}
    .kk-actions{display:flex;gap:8px}
    .kk-actions button{border:1px solid rgba(23,20,15,.2);background:transparent;padding:7px 14px;
      font-size:11px;letter-spacing:.12em;transition:.2s}
    .kk-actions button:hover{background:#17140F;color:#fff}
    .kk-body{background:#fff;border:1px solid rgba(23,20,15,.14);max-width:760px;margin:0 auto;
      padding:8px 18px 22px;overflow:auto;max-height:calc(100vh - 150px)}
    .kk-row{display:flex;align-items:baseline;justify-content:space-between;gap:14px;
      padding:11px 0;border-bottom:1px dashed rgba(23,20,15,.1);font-size:16px}
    .kk-name{flex:1;min-width:0;font-weight:600}
    .kk-qty{font-size:20px;font-weight:800;white-space:nowrap;font-variant-numeric:tabular-nums}
    .kk-mildrow .kk-name{color:#6b6357}
    .kk-tag{display:inline-block;margin-left:7px;font-size:10px;font-weight:700;color:#A67C52;
      border:1px solid rgba(166,124,82,.55);padding:1px 6px;border-radius:99px;vertical-align:2px}
    .kk-empty{padding:24px 0;text-align:center;color:#6b6357;font-size:12px}
    @media print{
      body *{visibility:hidden}
      #kitchenPanel,#kitchenPanel *{visibility:visible}
      #kitchenPanel{position:static;background:#fff;padding:0}
      #kitchenPanel .kk-body{max-height:none;border:0;overflow:visible}
      .kk-actions{display:none}
      .kk-row{font-size:15px}
    }`;
    document.head.appendChild(st);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { css(); mountBtn(); });
  else { css(); mountBtn(); }
  setInterval(mountBtn, 1500);
  window.kitchenOpen = open;
})();
