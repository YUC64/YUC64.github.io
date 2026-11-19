/**
 * 內場出單：依「用餐時段」分組，統計 each 菜色份數（辣／不辣分開）
 *   時段由門市在訂單表「用餐時段」欄手動填（17:00 / 19:30 …）
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

  /* 回傳 { '17:00': { rows:[…], orders:n, total:m }, ... } */
  function build() {
    const orders = (window.__staffOrders || []).filter((o) => o.status !== '已取消');
    const slots = {};
    const ensure = (k) => { if (!slots[k]) slots[k] = { count: {}, orders: 0, total: 0 }; return slots[k]; };

    orders.forEach((o) => {
      const slot = String(o.slot || '').trim() || '未指定時段';
      const g = ensure(slot);
      g.orders += 1;
      const bump = (name, n) => {
        const k = String(name).trim();
        if (!k) return;
        g.count[k] = (g.count[k] || 0) + n;
        g.total += n;
      };
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
        const suffix = a.tag === '不辣' ? '（不辣）' : (a.tag ? '（' + a.tag + '）' : '');
        bump(a.name + suffix, a.qty);
      });
    });

    // 每個時段內排序：同菜名相鄰、辣的在前
    Object.keys(slots).forEach((k) => {
      slots[k].rows = Object.entries(slots[k].count).map(([name, qty]) => {
        const mild = /（不辣）$/.test(name);
        return { name, qty, mild, group: name.replace(/（不辣）$/, '') };
      }).sort((a, b) => (a.group === b.group ? (a.mild - b.mild) : (a.group < b.group ? -1 : 1)));
    });

    // 時段排序：有時間的照時間，未指定放最後
    const keys = Object.keys(slots).sort((a, b) => {
      if (a === '未指定時段') return 1;
      if (b === '未指定時段') return -1;
      return a < b ? -1 : 1;
    });
    return { slots, keys, orderCount: orders.length };
  }

  function html() {
    const k = build();
    const now = new Date().toLocaleString('zh-TW', { hour12: false });
    const totalAll = k.keys.reduce((s, key) => s + k.slots[key].total, 0);

    const sections = k.keys.map((key) => {
      const g = k.slots[key];
      const rows = g.rows.map((r) => `<div class="kk-row${r.mild ? ' kk-mildrow' : ''}">
          <span class="kk-name">${esc(r.group)}${r.mild ? '<span class="kk-tag">不辣</span>' : ''}</span>
          <span class="kk-qty">${r.qty}</span>
        </div>`).join('');
      return `<section class="kk-slot">
          <h3 class="kk-slothead">${esc(key)}<span class="kk-slotmeta">${g.orders} 張・${g.total} 份</span></h3>
          ${rows || '<p class="kk-empty">（此為空）</p>'}
        </section>`;
    }).join('');

    return `<div class="kk-head">
        <div>
          <p class="caps">Kitchen</p>
          <h2>內場出單</h2>
          <p class="kk-sub">${esc(now)}・有效訂單 ${k.orderCount} 張・共 ${totalAll} 份</p>
        </div>
        <div class="kk-actions">
          <button data-kk-print>列印</button>
          <button data-kk-close>關閉</button>
        </div>
      </div>
      <div class="kk-body">
        ${k.keys.length ? sections : '<p class="kk-empty">目前沒有有效訂單</p>'}
      </div>`;
  }

  function open() {
    let p = document.getElementById('kitchenPanel');
    if (!p) {
      p = document.createElement('div');
      p.id = 'kitchenPanel';
      document.body.appendChild(p);
      p.addEventListener('click', (e) => {
        if (e.target.closest('[data-kk-close]')) {
          p.classList.remove('open');
          document.body.classList.remove('kk-printing');
        }
        if (e.target.closest('[data-kk-print]')) window.print();
      });
    }
    p.innerHTML = html();
    p.classList.add('open');
    document.body.classList.add('kk-printing');
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
    .kk-slot{margin-top:14px}
    .kk-slothead{display:flex;align-items:baseline;justify-content:space-between;gap:10px;
      font-size:15px;font-weight:800;letter-spacing:.08em;color:#17140F;
      border-bottom:2px solid #17140F;padding-bottom:6px;margin-bottom:2px}
    .kk-slotmeta{font-size:10.5px;font-weight:400;letter-spacing:.06em;color:#6b6357}
    .kk-row{display:flex;align-items:baseline;justify-content:space-between;gap:14px;
      padding:11px 0;border-bottom:1px dashed rgba(23,20,15,.1);font-size:16px}
    .kk-name{flex:1;min-width:0;font-weight:600}
    .kk-qty{font-size:20px;font-weight:800;white-space:nowrap;font-variant-numeric:tabular-nums}
    .kk-mildrow .kk-name{color:#6b6357}
    .kk-tag{display:inline-block;margin-left:7px;font-size:10px;font-weight:700;color:#A67C52;
      border:1px solid rgba(166,124,82,.55);padding:1px 6px;border-radius:99px;vertical-align:2px}
    .kk-empty{padding:16px 0;text-align:center;color:#6b6357;font-size:12px}
    @media print{
      @page{margin:14mm}
      html,body{background:#fff !important;height:auto !important;overflow:visible !important}
    }
    @media print{
      body.kk-printing #staffLock, body.kk-printing #staffApp,
      body.kk-printing > *:not(#kitchenPanel){display:none !important}
      body.kk-printing{overflow-x:hidden !important}
      body.kk-printing #kitchenPanel{width:auto !important;max-width:100% !important;margin:0 !important;
        padding:0 6mm !important;box-sizing:border-box !important;position:static !important;inset:auto !important;
        display:block !important;background:#fff !important;height:auto !important}
      body.kk-printing #kitchenPanel .kk-head{max-width:none;border:0;background:#fff;padding:0 0 10px;
        border-bottom:2px solid #17140F}
      body.kk-printing #kitchenPanel .kk-body{max-height:none !important;max-width:100% !important;width:auto !important;
        border:0;padding:6px 0 0;overflow:visible !important}
      body.kk-printing .kk-actions{display:none !important}
      body.kk-printing .kk-row{font-size:14px;padding:7px 0;break-inside:avoid;page-break-inside:avoid}
      body.kk-printing .kk-qty{font-size:16px}
      body.kk-printing .kk-slot{break-inside:avoid}
    }`;
    document.head.appendChild(st);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { css(); mountBtn(); });
  else { css(); mountBtn(); }
  setInterval(mountBtn, 1500);
  window.kitchenOpen = open;
})();
