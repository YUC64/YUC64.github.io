# -*- coding: utf-8 -*-
import io, sys
p = 'js/app.js'
s = io.open(p, encoding='utf-8').read()
n = 0

def rep_all(old, new, label, expect=None):
    global s, n
    c = s.count(old)
    if c == 0 or (expect is not None and c != expect):
        print('FAIL', label, c); sys.exit(1)
    s = s.replace(old, new); n += c
    print(f'  {label} ×{c}')

# 1. 結帳彈窗抬頭
rep_all("""    <div class="flex items-start justify-between border-b border-ink/10 px-4 py-3">
      <div>
        <h3 class="text-lg font-black">填寫訂購資料</h3>
        <p class="text-[12px] text-ink-mute">${S.editing ? `修改訂單 ${esc(S.editing)}` : '送出後我們會替您備餐'}</p>
      </div>
      <button data-close-modal class="grid h-9 w-9 place-items-center rounded-full bg-ink/5">✕</button>
    </div>
    <form id="orderForm" class="space-y-3 px-4 py-4">""",
"""    <div class="flex items-start justify-between border-b border-[rgba(23,20,15,.1)] px-6 py-5">
      <div>
        <p class="caps">Order</p>
        <h3 class="serif mt-2 text-[19px] tracking-[.14em]">填寫訂購資料</h3>
        <p class="mt-2 text-[11px] tracking-[.08em] text-ink-mute">${S.editing ? `修改訂單 ${esc(S.editing)}` : '送出後我們會替您備餐'}</p>
      </div>
      <button data-close-modal class="grid h-8 w-8 shrink-0 place-items-center text-ink/40 transition hover:text-ink" aria-label="關閉">
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.2"/></svg>
      </button>
    </div>
    <form id="orderForm" class="space-y-5 px-6 py-6">""", 'checkout-head')

# 2. 所有欄位改用 .field
rep_all('class="mt-1 w-full rounded-xl border border-ink/15 px-3 py-2.5 text-sm outline-none focus:border-ink"',
        'class="field"', 'field-inputs')

# 3. 欄位標籤
rep_all('<span class="text-[12px] font-black">姓名 *</span>', '<span class="field-label">姓名</span>', 'label-name')
rep_all('<span class="text-[12px] font-black">電話 *</span>', '<span class="field-label">電話</span>', 'label-phone')
rep_all('<span class="text-[12px] font-black">預計取餐日 *</span>', '<span class="field-label">預計取餐日</span>', 'label-date')
rep_all('<span class="text-[12px] font-black">預計取餐時間 *</span>', '<span class="field-label">預計取餐時間</span>', 'label-time')
rep_all('<span class="text-[12px] font-black">備註 <span class="font-normal text-ink-mute">（素食、兒童座椅、飲料升級說明…）</span></span>',
        '<span class="field-label">備註</span>', 'label-note')

# 4. 訂單摘要
rep_all("""      <div class="rounded-2xl bg-[#F7F4EC] p-3 text-[12px] leading-relaxed">
        <p class="font-black">訂單摘要</p>
        <p class="mt-1 text-ink-soft">用餐人數：${c.headcount} 人（依套餐人數計算）</p>
        <p class="text-ink-soft">套餐 ${fmt(c.setsSubtotal)} + 單點 ${fmt(c.alcSubtotal)} + 服務費 ${fmt(c.service)}</p>
        <p class="mt-1 text-base font-black">總計 ${fmt(c.total)}</p>""",
"""      <div class="border-t border-[rgba(23,20,15,.13)] pt-4 text-[11px] leading-[2] tracking-[.06em]">
        <p class="caps mb-2">Summary</p>
        <p class="text-ink-mute">用餐人數：${c.headcount} 人（依套餐人數計算）</p>
        <p class="text-ink-mute">套餐 ${fmt(c.setsSubtotal)} ・ 單點 ${fmt(c.alcSubtotal)} ・ 服務費 ${fmt(c.service)}</p>
        <p class="num mt-2 text-[17px] tracking-wide">總計 ${fmt(c.total)}</p>""", 'summary')

# 5. 送出按鈕
rep_all('<button id="btnSubmit" class="w-full rounded-full bg-brand py-3.5 text-sm font-black text-ink transition hover:bg-brand-dark">',
        '<button id="btnSubmit" class="btn btn-solid w-full text-[11.5px]">', 'submit-btn')

# 6. 底部小字
rep_all('<p class="text-center text-[11px] text-ink-mute">本頁不含線上付款，款項請於現場結清</p>',
        '<p class="text-center text-[9.5px] tracking-[.16em] text-ink-mute">本頁不含線上付款・款項請於現場結清</p>', 'foot-note')

io.open(p, 'w', encoding='utf-8').write(s)
print('總計', n, '處')
