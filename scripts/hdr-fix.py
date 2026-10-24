# -*- coding: utf-8 -*-
import io
p = 'index.html'
s = io.open(p, encoding='utf-8').read()
old = '<div class="flex items-center gap-6 sm:gap-8">'
assert s.count(old) == 1, s.count(old)
s = s.replace(old, '<div class="header-actions flex items-center gap-6 sm:gap-8">')
io.open(p, 'w', encoding='utf-8').write(s)

c = 'assets/css/style.css'
css = io.open(c, encoding='utf-8').read()
extra = u"""
/* 右上角操作區：在亮色照片上也看得清楚 */
.header-actions {
  background: rgba(23, 20, 15, .34);
  -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px);
  padding: .5rem .9rem;
  border-radius: 2px;
  transition: background-color .7s var(--ease);
}
#siteHeader.is-solid .header-actions { background: transparent; padding: .5rem .9rem; }

/* 封面照片：略微收斂飽和度，質感更沉穩 */
.kenburns { filter: saturate(.9) contrast(1.04) brightness(.97); }
"""
if 'header-actions' not in css:
    css = css + extra
io.open(c, 'w', encoding='utf-8').write(css)
print('ok')
