# 饗泰多 SIAM MORE｜除夕線上預點餐

純前端（HTML / Tailwind CSS CDN / Vanilla JS）的除夕年菜線上預訂網站，資料以 **Google 表單 → Google 試算表** 收集，沒有任何後端伺服器與資料庫，可直接託管在 **GitHub Pages**。

> 菜單、套餐組合、「選 N」規則、單點價目、**辣度標示（辣椒圖示數量）**、加收規則（10% 服務費、每人低消 $600、需先點套餐才能單點）皆依門市《2027 年春節內用菜單》PDF 實作。

---

## 功能

| 需求 | 實作 |
|---|---|
| 未登入只能看菜單 | 未登入時所有「加入」按鈕變成「登入後選購」，點擊會跳出登入視窗；購物車與結帳也都要求登入 |
| 手機號碼登入 | 手機號碼 + 姓名 + 自訂 4 位數密碼（存於該裝置 localStorage）；登入後才能選購與送出 |
| 菜單展示 | 5 個春節套餐 + 42 道單點、12 個分類頁籤、卡片式排版，缺圖自動以品牌色卡片代替 |
| 辣度標示 | 依 PDF 辣椒圖示數量顯示（🌶 微辣／🌶🌶 較辣），套餐選項、特選、單點與購物車都有標示 |
| 冰／去冰／熱 | 摩摩喳喳（冰／去冰）、椰香黑糯米（冷／熱）、泰式奶茶（冰／去冰／熱）；單點點「加入」會先選冰熱 |
| 套餐飲料逐杯選擇 | 套餐的每一杯飲料都能單獨選品項與冰／去冰／熱 |
| 先點套餐才能加點 | 未加入套餐前單點區顯示 🔒 鎖定、按鈕停用、送出被擋 |
| 套餐「選 N」規則 | 每個品類（涼拌／肉類／青菜／咖哩／蛋豆腐／湯品／飲料）都要選滿才能加入購物車 |
| 購物車系統 | 右側滑出面板、動態增減數量、即時計算（套餐／單點／10% 服務費／每人平均） |
| 訂購人資訊 | 姓名、電話、預計取餐日 + 時段、備註 |
| 修改／取消自己的訂單 | 「我的訂單」可查看、載回購物車修改（同訂單編號、動作標記「修改訂單」）、取消、用訂單編號查詢 |
| 背景送出 | `e.preventDefault()` + `fetch(action, {mode:'no-cors'})`，以 `entry.ID` 對應寫入 Google 表單 |
| 品牌識別 | 使用門市 LOGO（去背 + 白色版 + 大象 mark 作為 favicon），說明區塊置於頁面上方 |

## 檔案結構

```
index.html                  版面（Tailwind CDN + 少量自訂 CSS）
assets/css/style.css        自訂樣式（晶片、數量按鈕、抽屜、動畫）
assets/img/*.jpg            菜品圖片（50 張）+ credits.json 授權清單
assets/img/logo.png         門市 LOGO（去背，淺色底用）
assets/img/logo-white.png   門市 LOGO（白色版，深色底用）
assets/img/logo-mark.png    大象 mark（登入提示卡）
assets/img/favicon.png      favicon（大象 mark）
assets/img/spicy.png        辣度辣椒圖示（取自門市菜單 PDF）
js/config.js                ← 唯一需要改的設定檔（品牌、規則、Google 表單）
js/data.js                  菜單資料（套餐、單點、分類、辣度表、冰熱選項）
js/app.js                   全部商業邏輯（購物車、登入、送出）
tools/form-entry-ids.mjs    自動從 Google 表單網址抓出 entry.ID 並寫回 config.js
scripts/fetch-images.py     從 Wikimedia Commons 抓免費授權菜品圖
scripts/pick-candidates.py  多抓幾個候選圖做人工挑圖對照表
scripts/render-pdf.ps1      用 Windows 內建 PDF API 把菜單 PDF 轉成高解析 PNG
SETUP.md                    ★ Google 表單設定步驟、部署、注意事項
```

## 本機預覽

```bash
python -m http.server 8765      # 然後開 http://127.0.0.1:8765/
```

## 部署到 GitHub Pages

```bash
git init && git add . && git commit -m "feat: 除夕線上預點餐"
gh repo create eatthai-newyear-preorder --public --source=. --push
gh api -X POST repos/<你的帳號>/eatthai-newyear-preorder/pages \
  -f 'source[branch]=main' -f 'source[path]=/'
```

## 接上 Google 表單（重要）

網站預設為「示範模式」：未設定表單時，訂單只存在本機並於畫面明確提示。設定方式見 **[SETUP.md](SETUP.md)**，最短路徑：

```bash
node tools/form-entry-ids.mjs "https://docs.google.com/forms/d/e/XXXXX/viewform" --write
```

## 技術與限制（誠實說明）

- **無後端、無金流**：款項現場結清；網站不處理付款。
- **登入不是真正的身分驗證**：帳密只存在瀏覽器 localStorage，換裝置／清除資料即失效。要真正跨裝置登入需後端或 Google 帳號驗證。
- **Google 表單只能新增列、不能改列**：因此「修改訂單／取消訂單」是以**同一個訂單編號**再送出一筆、並在「動作」欄標記，門市請以同訂單編號的**最後一筆**為準（SETUP.md 附上可選的 Apps Script 版本，可做到真正的覆寫更新）。
- **飲料加價升級**：菜單未公告價差，網站以 $0 記錄並寫進訂單內容，現場依公告價差計收。
- **辣度**：完全對應 PDF 上的辣椒圖示數量（1 根＝微辣、2 根＝較辣），未標示者視為不辣。
- **圖片**：多數為 Wikimedia Commons 免費授權照片（清單見 `assets/img/credits.json`）；套餐代表圖、主視覺與 LOGO 取自門市素材（© 饗泰多）。若要用門市實拍照片，直接把 `assets/img/<key>.jpg` 換掉即可，檔名不變。
