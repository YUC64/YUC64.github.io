# -*- coding: utf-8 -*-
import io

extra = u"""
/* ========================================================= 頂部列（捲動轉紙色） */
#siteHeader {
  border-bottom: 1px solid transparent;
  transition: background-color .7s var(--ease), border-color .7s var(--ease);
}
#siteHeader.is-solid {
  background: rgba(250,247,242,.93);
  -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px);
  border-bottom-color: var(--line);
}
#siteHeader.is-solid .logo-ink { opacity: 1; }
#siteHeader.is-solid .logo-white { opacity: 0; }
.nav-link { color: rgba(255,255,255,.9); transition: color .5s var(--ease), letter-spacing .5s var(--ease); }
.nav-link:hover { color: #fff; }
.icon-btn { color: rgba(255,255,255,.9); transition: color .5s var(--ease), transform .4s var(--ease); }
.icon-btn:hover { transform: scale(1.08); }
#siteHeader.is-solid .nav-link, #siteHeader.is-solid .icon-btn { color: var(--ink); }
#siteHeader.is-solid #cartCountTop { background: var(--ink); color: #fff; }

/* ==================================================================== Toast / Modal */
#toast { opacity: 0; transition: opacity .42s var(--ease); }
#modalBox { animation: modalIn .5s var(--ease) both; }
@keyframes modalIn {
  from { opacity: 0; transform: translateY(16px) scale(.998); }
  to   { opacity: 1; transform: none; }
}

/* ============================ 面板內既有元素統一成髮絲線／直角，去掉圓滾滾的舊樣式 */
#drawerBody [class*="rounded-"], #cartBody [class*="rounded-"],
#cartFoot [class*="rounded-"], #modalBox [class*="rounded-"] { border-radius: 2px; }
#drawerBody [class*="shadow-"], #cartBody [class*="shadow-"] { box-shadow: none; }
#drawerBody .bg-siam-purple { background: var(--ink); }

/* 分類頁籤在手機上不擠 */
@media (max-width: 640px) { .tab { margin-right: 1.15rem; font-size: 12px; } }
"""

p = 'assets/css/style.css'
s = io.open(p, encoding='utf-8').read()
if 'siteHeader.is-solid' not in s:
    io.open(p, 'w', encoding='utf-8').write(s + extra)
    print('appended')
else:
    print('already there')
print('bytes now:', len(io.open(p, encoding='utf-8').read()))
