# -*- coding: utf-8 -*-
"""抽屜內容：換成新設計（墨黑按鈕、襯線姓名、細字選單）"""
import io, sys
p = 'js/app.js'
s = io.open(p, encoding='utf-8').read()
n = 0; fails = []
def rep(o, nw, label):
    global s, n
    if s.count(o) != 1:
        fails.append(f'{label}: {s.count(o)}'); return
    s = s.replace(o, nw); n += 1

# 已登入會員卡
rep("""            <p class="truncate font-black">${esc(S.user.name)} <span class="text-[11px] font-normal text-ink-mute">已登入</span></p>
            <p class="truncate text-[12px] text-ink-mute">${esc(S.user.phone)}・本機訂單 ${mine.length} 筆</p>
            <p class="text-[12px]">${verifyStateText(S.user)}</p>
          </div>
        </div>
        <div class="mt-3 grid grid-cols-2 gap-2">
          <button data-menu-action="orders" class="rounded-full bg-ink px-4 py-2.5 text-[13px] font-black text-white">我的訂單</button>
          <button data-menu-action="logout" class="rounded-full bg-ink/5 px-4 py-2.5 text-[13px] font-bold">登出</button>
        </div>
      </div>`""",
"""            <p class="serif truncate text-[15px] tracking-[.1em]">${esc(S.user.name)}</p>
            <p class="mt-1 truncate text-[10.5px] tracking-[.12em] text-ink-mute">${esc(S.user.phone)}</p>
            <p class="mt-0.5 text-[10px]">${verifyStateText(S.user)}</p>
          </div>
        </div>
        <div class="mt-4 grid grid-cols-2 gap-2">
          <button data-menu-action="orders" class="btn btn-solid px-3 py-2.5 text-[10.5px]">我的訂單</button>
          <button data-menu-action="logout" class="btn btn-line px-3 py-2.5 text-[10.5px]">登出</button>
        </div>
      </div>`""", 'member-logged-in')

# 未登入會員卡
rep("""    : `<div class="rounded-2xl border border-ink/10 bg-white p-4 shadow-card">
        <p class="font-black">訂位客人登入</p>
        <p class="mt-2 text-[11px] leading-relaxed text-ink-mute">請輸入訂位時留下的手機號碼、姓名與門市提供的驗證碼。</p>
        <button data-menu-action="login" class="mt-3 w-full rounded-full bg-brand px-4 py-3 text-sm font-black text-ink">登入 / 註冊</button>
      </div>`;""",
"""    : `<div class="border border-[rgba(23,20,15,.13)] p-4">
        <p class="caps">Reservation</p>
        <p class="serif mt-2 text-[15px] tracking-[.1em]">訂位客人登入</p>
        <p class="mt-2 text-[10.5px] leading-[1.95] tracking-[.04em] text-ink-mute">
          請輸入訂位時留下的手機號碼、姓名與門市提供的驗證碼。
        </p>
        <button data-menu-action="login" class="btn btn-solid mt-4 w-full text-[10.5px]">登入</button>
      </div>`;""", 'member-logged-out')

# 選單項目
for label, href_action, text in [('sets', 'a', '春節多人套餐'), ('alacarte', 'a', '單點加點')]:
    pass

rep("""      <a href="#sets" data-drawer-close class="flex items-center justify-between px-4 py-3 text-[14px] font-bold hover:bg-brand/10">春節多人套餐 <span class="text-ink-mute">›</span></a>
      <a href="#alacarte" data-drawer-close class="flex items-center justify-between border-t border-ink/10 px-4 py-3 text-[14px] font-bold hover:bg-brand/10">單點加點 <span class="text-ink-mute">›</span></a>
      <button data-menu-action="guide" class="flex w-full items-center justify-between border-t border-ink/10 px-4 py-3 text-left text-[14px] font-bold hover:bg-brand/10">訂購說明 <span class="text-ink-mute">›</span></button>
      <button data-menu-action="cart" class="flex w-full items-center justify-between border-t border-ink/10 px-4 py-3 text-left text-[14px] font-bold hover:bg-brand/10">我的購物車 <span class="text-ink-mute">›</span></button>""",
"""      <a href="#sets" data-drawer-close class="flex items-center justify-between border-b border-[rgba(23,20,15,.08)] py-3.5 text-[12.5px] tracking-[.12em] transition hover:text-gold">春節多人套餐 <span class="text-ink-mute">›</span></a>
      <a href="#alacarte" data-drawer-close class="flex items-center justify-between border-b border-[rgba(23,20,15,.08)] py-3.5 text-[12.5px] tracking-[.12em] transition hover:text-gold">單點加點 <span class="text-ink-mute">›</span></a>
      <button data-menu-action="guide" class="flex w-full items-center justify-between border-b border-[rgba(23,20,15,.08)] py-3.5 text-left text-[12.5px] tracking-[.12em] transition hover:text-gold">訂購說明 <span class="text-ink-mute">›</span></button>
      <button data-menu-action="cart" class="flex w-full items-center justify-between border-b border-[rgba(23,20,15,.08)] py-3.5 text-left text-[12.5px] tracking-[.12em] transition hover:text-gold">我的購物車 <span class="text-ink-mute">›</span></button>""", 'nav-items')

# 員工專用連結
rep('<p class="mt-5 text-center"><a href="staff.html" class="text-[11px] text-ink-mute/60 hover:text-ink-mute">員工專用</a></p>',
    '<p class="mt-7 text-center"><a href="staff.html" class="text-[9.5px] tracking-[.24em] text-ink-mute/60 transition hover:text-ink-mute">員工專用</a></p>', 'staff-link')

io.open(p, 'w', encoding='utf-8').write(s)
print('套用', n)
if fails:
    print('失敗:', fails); sys.exit(1)
