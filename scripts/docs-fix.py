# -*- coding: utf-8 -*-
import io, sys
def load(p): return io.open(p, encoding='utf-8').read()
def store(p, s): io.open(p, 'w', encoding='utf-8').write(s)
def rep(s, old, new, label, expect=1):
    c = s.count(old)
    if c != expect:
        print('FAIL', label, c); sys.exit(1)
    return s.replace(old, new)

# README
p = 'README.md'; s = load(p)
s = rep(s, '| 員工專用頁 | 頁尾一個很小的「員工專用」連結 → `staff.html`：試算表入口、客人電話查詢、除夕當天流程。**不放密碼、不顯示客人資料**（真的資料都在權限受控的 Google 試算表）|\n', '', 'readme-staff-row')
s = rep(s, 'staff.html                  ★ 員工專用頁（頁尾小連結進入；不放密碼、不顯示客人資料）\n', '', 'readme-staff-file')
s = rep(s, '- **員工頁沒有密碼是故意的**：靜態網站藏不住密碼，硬塞一個只是自欺欺人。員工的權限改由 **Google 試算表的分享權限**控管（只有被分享的員工帳號開得起來），網站只放連結。',
        '- **網站沒有員工介面**：員工直接在權限受控的 Google 試算表作業（訂位名單、訂單表），網站本體只給客人用，不暴露任何管理入口。', 'readme-staff-sec')
store(p, s)

# SETUP
p = 'SETUP.md'; s = load(p)
s = rep(s, '  [客人網站] 訂位登入 → 點餐 → 送出      [員工頁 /staff.html] 查訂位',
        '  [客人網站] 訂位登入 → 點餐 → 送出      [員工直接在試算表作業]', 'setup-diagram')
s = rep(s, "  sheetUrl: '訂位表的網址',        // 員工頁的開啟按鈕（權限由 Google 帳號控管）\n  ordersSheetUrl: '訂單表的網址',\n  dutyPhone: '當班電話',\n",
        "  ordersSheetUrl: '訂單表的網址（Apps Script 寫入的目標，僅供備查）',\n", 'setup-config')
s = rep(s, '除夕當天在 `/staff.html` 查客人電話＋驗證碼是否有效，再到訂單表用訂單編號查餐點。',
        '除夕當天員工直接在「訂位表」核對電話＋驗證碼、在「訂單表」用訂單編號查餐點（網站沒有員工介面）。', 'setup-staff-flow')
store(p, s)
print('docs ok')
