# -*- coding: utf-8 -*-
import io
p = 'index.html'
s = io.open(p, encoding='utf-8').read()
n = 0
def rep(o, nw, label):
    global s, n
    if s.count(o) != 1:
        print('FAIL', label, s.count(o)); return
    s = s.replace(o, nw); n += 1

# 手機版：文字欄底部留白加大，避免被固定底部列蓋住
rep('class="order-2 flex flex-col justify-center px-6 pb-16 pt-12 sm:px-12 lg:order-1 lg:px-14 lg:py-24 xl:px-20"',
    'class="order-2 flex flex-col justify-center px-6 pb-32 pt-12 sm:px-12 sm:pb-20 lg:order-1 lg:px-14 lg:py-24 xl:px-20"', 'mobile-pb')
# 手機版圖片高度略降，讓文字整塊進得了第一屏
rep('<div class="relative order-1 min-h-[44svh] overflow-hidden lg:order-2 lg:min-h-0">',
    '<div class="relative order-1 min-h-[40svh] overflow-hidden sm:min-h-[44svh] lg:order-2 lg:min-h-0">', 'img-h')
io.open(p, 'w', encoding='utf-8').write(s)

# 單點「＋」按鈕放大一點
a = 'js/app.js'
js = io.open(a, encoding='utf-8').read()
old = 'class="grid h-8 w-8 shrink-0 place-items-center border border-[rgba(23,20,15,.22)] text-[15px] leading-none text-ink transition duration-300 hover:bg-ink hover:text-white active:scale-90"'
new = 'class="grid h-9 w-9 shrink-0 place-items-center border border-[rgba(23,20,15,.22)] text-[16px] leading-none text-ink transition duration-300 hover:bg-ink hover:text-white active:scale-90"'
if js.count(old) == 1:
    js = js.replace(old, new); io.open(a, 'w', encoding='utf-8').write(js); n += 1
else:
    print('FAIL plus', js.count(old))
print('套用', n)
