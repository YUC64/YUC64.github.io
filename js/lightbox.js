/**
 * 圖片放大檢視（手機看停車動線圖的細節用）
 *   - 任何 <img data-zoom> 點一下 → 全螢幕檢視，再點一下或按 Esc 關閉
 */
(function () {
  const st = document.createElement('style');
  st.textContent = `
  #lightbox{position:fixed;inset:0;z-index:90;background:rgba(23,20,15,.94);display:none;
    padding:12px;overflow:auto;-webkit-overflow-scrolling:touch}
  #lightbox.open{display:flex;align-items:center;justify-content:center}
  #lightbox img{max-width:100%;height:auto;display:block}
  #lightbox .lb-hint{position:fixed;left:0;right:0;bottom:14px;text-align:center;color:rgba(255,255,255,.62);
    font-size:11px;letter-spacing:.16em}
  #lightbox .lb-x{position:fixed;top:12px;right:14px;width:38px;height:38px;color:#fff;font-size:20px;
    line-height:1;background:rgba(255,255,255,.12);border-radius:99px}
  body.lb-lock{overflow:hidden}`;
  document.head.appendChild(st);

  let box = null;
  function close() {
    if (!box) return;
    box.classList.remove('open');
    document.body.classList.remove('lb-lock');
  }
  function open(src, alt) {
    if (!box) {
      box = document.createElement('div');
      box.id = 'lightbox';
      document.body.appendChild(box);
      box.addEventListener('click', close);
    }
    box.innerHTML = `<img src="${src}" alt="${alt || ''}">
      <button class="lb-x" type="button" aria-label="關閉">✕</button>
      <p class="lb-hint">點畫面任一處關閉</p>`;
    box.classList.add('open');
    document.body.classList.add('lb-lock');
  }

  document.addEventListener('click', (e) => {
    const img = e.target.closest('img[data-zoom]');
    if (!img) return;
    e.preventDefault();
    open(img.getAttribute('src'), img.getAttribute('alt'));
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
})();
