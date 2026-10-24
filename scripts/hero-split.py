# -*- coding: utf-8 -*-
"""封面改成左文右圖（雜誌式），解決白字壓亮圖的對比問題"""
import io, sys

p = 'index.html'
s = io.open(p, encoding='utf-8').read()

start = s.index('<!-- ══════════════════════════════ 封面')
end = s.index('<!-- ══════════════════════════════ 一行須知')

elephant = """      <!-- 小象跑步 -->
      <div class="ele-stage" aria-hidden="true">
        <div class="ele-run">
          <svg class="ele" viewBox="0 0 140 98" fill="none">
            <g class="ele-bob">
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
            </g>
          </svg>
          <div class="dust"><i></i><i></i><i></i></div>
        </div>
      </div>
"""

new = """<!-- ══════════════════════════════ 封面（左文右圖） ══════════════════════════════ -->
<section class="relative bg-ink">
  <div class="grid min-h-[94svh] grid-cols-1 lg:grid-cols-[44%_56%]">

    <!-- 影像 -->
    <div class="relative order-1 min-h-[44svh] overflow-hidden lg:order-2 lg:min-h-0">
      <picture>
        <source media="(max-width: 1024px)" srcset="assets/img/hero-mobile.jpg">
        <img src="assets/img/hero.jpg" alt="" class="kenburns absolute inset-0 h-full w-full object-cover">
      </picture>
      <div class="absolute inset-0 bg-gradient-to-b from-ink/55 via-ink/5 to-ink/60"></div>
      <div class="absolute inset-y-0 -left-1 hidden w-28 bg-gradient-to-r from-ink via-ink/70 to-transparent lg:block"></div>

__ELE__
    </div>

    <!-- 文字 -->
    <div class="order-2 flex flex-col justify-center px-6 pb-16 pt-12 sm:px-12 lg:order-1 lg:px-14 lg:py-24 xl:px-20">
      <p class="rise caps text-gold-soft" style="--d:150ms">Siam More · Chinese New Year 2027</p>

      <div class="rule-grow mt-6 h-px w-14 bg-gold-soft/60" style="--d:400ms"></div>

      <h1 class="rise serif mt-8 text-[clamp(31px,5.2vw,56px)] leading-[1.2] tracking-[.06em] text-[#F8F3EA]" style="--d:260ms">
        除夕線上預點餐
      </h1>

      <p class="rise mt-7 max-w-[23rem] text-[12.5px] leading-[2.1] tracking-[.09em] text-white/55" style="--d:560ms">
        先挑一份春節套餐，再依喜好加點菜色。<br>到店直接入座，把時間留給團圓。
      </p>

      <div class="rise mt-11 flex flex-col gap-3 sm:flex-row sm:gap-4" style="--d:780ms">
        <button id="btnStart" class="btn btn-light w-full sm:w-auto">開始點餐</button>
        <button id="btnCoverLogin" class="btn btn-on-dark w-full sm:w-auto">
          <span id="coverLoginLabel">登入 / 我的訂單</span>
        </button>
      </div>

      <div class="rise mt-12 h-px w-full max-w-[23rem] bg-white/12" style="--d:920ms"></div>

      <p class="rise mt-5 max-w-[23rem] text-[9.5px] leading-[2] tracking-[.22em] text-white/30" style="--d:980ms">
        限訂位客人・內用加收 10% 服務費・每人最低消費 $600
      </p>
    </div>
  </div>
</section>

""".replace('__ELE__', elephant)

s = s[:start] + new + s[end:]
io.open(p, 'w', encoding='utf-8').write(s)
print('封面已改為左文右圖，bytes:', len(s))
