/**
 * 自動更新：偵測到網站有新版本就自動重新載入一次
 *   - 每 3 分鐘檢查 index.html 裡引用的 app.js 版本號
 *   - 版本不同 → 重新載入（若正在填寫表單則延後到下次）
 */
(function () {
  const current = (document.currentScript && document.currentScript.src || '').split('?')[0];
  function loadedBuild() {
    const s = document.querySelector('script[src*="app.js?v="]');
    if (!s) return '';
    const m = s.getAttribute('src').match(/app\.js\?v=([0-9a-z]+)/i);
    return m ? m[1] : '';
  }
  function busy() {
    const phone = document.querySelector('#orderForm [name="phone"]');
    return !!(phone && phone.value && phone.value.length >= 8);
  }
  async function check() {
    try {
      const res = await fetch(`index.html?_=${Date.now()}`, { cache: 'no-store' });
      const html = await res.text();
      const m = html.match(/app\.js\?v=([0-9a-z]+)/i);
      if (!m) return;
      const mine = loadedBuild();
      if (mine && m[1] !== mine && !busy()) {
        location.reload();
      }
    } catch (e) { /* 離線就跳過 */ }
  }
  setInterval(check, 180000);          // 每 3 分鐘
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
})();
