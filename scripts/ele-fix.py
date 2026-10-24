# -*- coding: utf-8 -*-
"""把封面小象換成清楚的版本，並加強文字對比"""
import io, sys

p = 'index.html'
s = io.open(p, encoding='utf-8').read()
n = 0
fails = []

def rep(old, new, label):
    global s, n
    c = s.count(old)
    if c != 1:
        fails.append(f'{label}: {c} 次')
        return
    s = s.replace(old, new)
    n += 1

# 1. 小象 SVG
old_ele = """        <g class="ele-bob">
          <path class="ele-tail" d="M22 38c-6-2-9-7-8-13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <rect class="leg leg-a" x="26" y="52" width="8" height="26" rx="4" fill="currentColor" opacity=".45"/>
          <rect class="leg leg-c" x="60" y="52" width="8" height="26" rx="4" fill="currentColor" opacity=".45"/>
          <ellipse cx="52" cy="40" rx="30" ry="17" fill="currentColor"/>
          <circle cx="88" cy="38" r="14" fill="currentColor"/>
          <path class="ele-trunk" d="M99 47c4 6 6 13 4 19" stroke="currentColor" stroke-width="5.5" stroke-linecap="round"/>
          <path d="M96 52c3 2 4 5 4 8" stroke="#fff" stroke-opacity=".4" stroke-width="1.8" stroke-linecap="round"/>
          <ellipse class="ele-ear" cx="81" cy="40" rx="8.5" ry="11.5" fill="currentColor" opacity=".8"/>
          <circle cx="93" cy="32.5" r="1.7" fill="#fff" opacity=".85"/>
          <rect class="leg leg-b" x="38" y="52" width="8.5" height="26" rx="4" fill="currentColor"/>
          <rect class="leg leg-d" x="72" y="52" width="8.5" height="26" rx="4" fill="currentColor"/>
        </g>"""
new_ele = """        <g class="ele-bob">
          <path class="ele-tail" d="M29 45c-8-1-12-7-12-14" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
          <rect class="leg leg-a" x="38" y="58" width="11" height="34" rx="5.5" fill="currentColor" opacity=".38"/>
          <rect class="leg leg-c" x="74" y="58" width="11" height="34" rx="5.5" fill="currentColor" opacity=".38"/>
          <ellipse cx="62" cy="48" rx="37" ry="23" fill="currentColor"/>
          <circle cx="99" cy="41" r="17.5" fill="currentColor"/>
          <path class="ele-trunk" d="M112 54c2.5 7 2.5 14 0 19-2 4-5.5 6-9.5 6" stroke="currentColor" stroke-width="9" stroke-linecap="round"/>
          <ellipse class="ele-ear" cx="93" cy="40" rx="12.5" ry="15.5" fill="currentColor"/>
          <ellipse cx="93" cy="40" rx="7" ry="9.5" fill="#17140F" opacity=".13"/>
          <circle cx="108" cy="34" r="2.6" fill="#17140F"/>
          <rect class="leg leg-b" x="48" y="60" width="11.5" height="32" rx="5.75" fill="currentColor"/>
          <rect class="leg leg-d" x="86" y="60" width="11.5" height="32" rx="5.75" fill="currentColor"/>
        </g>"""
rep(old_ele, new_ele, 'elephant')

# 2. 遮罩加深一點，文字更清楚
rep('<div class="absolute inset-0 bg-gradient-to-b from-ink/80 via-ink/60 to-ink/92"></div>',
    '<div class="absolute inset-0 bg-gradient-to-b from-ink/88 via-ink/74 to-ink/94"></div>', 'overlay')

# 3. 文字可讀性
rep('class="rise mx-auto mt-7 max-w-[26rem] text-[13px] leading-[2] tracking-[.08em] text-white/70 sm:text-[14px]"',
    'class="rise mx-auto mt-7 max-w-[26rem] text-[13px] leading-[2] tracking-[.08em] text-white/80 [text-shadow:0_1px_24px_rgba(0,0,0,.5)] sm:text-[14px]"', 'tagline')
rep('class="rise mt-10 text-[10px] leading-relaxed tracking-[.24em] text-white/35"',
    'class="rise mt-10 text-[10px] leading-relaxed tracking-[.24em] text-white/50 [text-shadow:0_1px_18px_rgba(0,0,0,.6)]"', 'smallprint')

# 4. 小象位置／尺寸（CSS）
c = 'assets/css/style.css'
css = io.open(c, encoding='utf-8').read()
css = css.replace(""".ele-stage {
  position: absolute; left: 0; right: 0; bottom: 6%;
  height: 92px; pointer-events: none; overflow: hidden;
}
.ele-run {
  position: absolute; bottom: 0; left: 0;
  width: 112px; height: 76px;
  animation: eleRun 21s linear infinite;
}""",
""".ele-stage {
  position: absolute; left: 0; right: 0; bottom: 7.5%;
  height: 104px; pointer-events: none; overflow: hidden;
}
.ele-run {
  position: absolute; bottom: 0; left: 0;
  width: 132px; height: 92px;
  animation: eleRun 23s linear infinite;
}""")
css = css.replace(".ele { width: 100%; height: 100%; color: rgba(255,255,255,.9); display: block; }",
                  ".ele { width: 100%; height: 100%; color: rgba(255,255,255,.94); display: block; filter: drop-shadow(0 6px 18px rgba(0,0,0,.35)); }")
css = css.replace(""".ele-stage { bottom: 3.5%; height: 66px; }
  .ele-run { width: 84px; height: 57px; animation-duration: 26s; }
  .dust { width: 84px; }""",
""".ele-stage { bottom: 5%; height: 74px; }
  .ele-run { width: 96px; height: 67px; animation-duration: 27s; }
  .dust { width: 96px; }""")
io.open(c, 'w', encoding='utf-8').write(css)

io.open(p, 'w', encoding='utf-8').write(s)
print('套用', n, '處；CSS 已更新')
if fails:
    print('失敗:', fails); sys.exit(1)
