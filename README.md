# 饗泰多 SIAM MORE｜除夕線上預點餐

純前端（HTML / Tailwind CSS CDN / Vanilla JS）的除夕年菜線上預訂網站，託管在 **GitHub Pages**，
資料透過一支免費的 **Google Apps Script** 直接寫入 Google 試算表（不需要自架伺服器、不使用 Google 表單）。

> 菜單、套餐組合、「選 N」規則、單點價目、**辣度標示（辣椒圖示數量）**、加收規則（10% 服務費、每人低消 $600、需先點套餐才能單點）皆依門市《2027 年春節內用菜單》PDF 實作。

---

## 功能

| 需求 | 實作 |
|---|---|
| 未登入只能看菜單 | 未登入時所有「加入」按鈕變成「登入後選購」，點擊會跳出登入視窗；購物車與結帳也都要求登入 |
| 訂位客人才能點餐 | 用**手機號碼＋驗證碼**（員工在訂位表發給客人）登入，由 Apps Script 查核私有名單（名單不外流）；錯 8 次自動鎖 1 小時。可切換 `off`／`endpoint`／`hashfile` 三種模式 |
| 員工專用頁 | 頁尾一個很小的「員工專用」連結 → `staff.html`：試算表入口、客人電話查詢、除夕當天流程。**不放密碼、不顯示客人資料**（真的資料都在權限受控的 Google 試算表）|
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
| 背景送出 | `e.preventDefault()` + `fetch()` POST JSON 給 Apps Script，**可讀取回應**（真的知道成功／失敗，失敗會保留購物車讓客人重試）|
| 真正可改單 | 以「訂單編號」為 key，改單會**覆蓋試算表同一列**（不是新增一筆）|
| 品牌識別 | 使用門市 LOGO（去背 + 白色版 + 大象 mark 作為 favicon），說明區塊置於頁面上方 |

## 檔案結構

```
index.html                  客人點餐頁（Tailwind CDN + 少量自訂 CSS）
staff.html                  ★ 員工專用頁（頁尾小連結進入；不放密碼、不顯示客人資料）
data/reservations.json      訂位名單雜湊檔（只有 hashfile 模式需要）
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
scripts/google-apps-script/Code.gs  ★ Google 端主程式（驗證 API + 訂單寫入 + 設定工具）
scripts/mock-apps-script.py  本機模擬 Apps Script，離線測完整流程
tools/form-entry-ids.mjs    （舊做法）自動從 Google 表單網址抓出 entry.ID 並寫回 config.js
tools/make-reservation-hashes.mjs  訂位名單 CSV → 公開雜湊檔（hashfile 模式用）
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
- **登入不是真正的身分驗證**：帳密只存在瀏覽器 localStorage，換裝置／清除資料即失效。要真正跨裝置登入需後端或 Google 帳號驗證。真正有把關的是「訂位驗證」那一層。
- **訂位驗證一定要有一個「能私下查名單」的地方**：純前端做不到——把名單放進網站＝公開所有客人姓名電話。所以預設是 `mode:'off'`（任何電話都能登入），要用時得接 Apps Script（推薦）或公開雜湊檔（有被反推風險，SETUP.md 有實測估算）。沒接之前，網站等於沒有訂位管制。
- **員工頁沒有密碼是故意的**：靜態網站藏不住密碼，硬塞一個只是自欺欺人。員工的權限改由 **Google 試算表的分享權限**控管（只有被分享的員工帳號開得起來），網站只放連結。
- **Google 表單只能新增列、不能改列**：因此「修改訂單／取消訂單」是以**同一個訂單編號**再送出一筆、並在「動作」欄標記，門市請以同訂單編號的**最後一筆**為準（SETUP.md 附上可選的 Apps Script 版本，可做到真正的覆寫更新）。
- **飲料加價升級**：菜單未公告價差，網站以 $0 記錄並寫進訂單內容，現場依公告價差計收。
- **辣度**：完全對應 PDF 上的辣椒圖示數量（1 根＝微辣、2 根＝較辣），未標示者視為不辣。
- **圖片與文案來源**：菜色照片、套餐組合圖、主視覺與菜品介紹文案都取自**饗泰多官方網站**（© 饗賓餐旅股份有限公司，見 `assets/img/credits.json`）。
  重新抓取：`python scripts/fetch-official-photos.py`（改 `KEY_TO_DISH` 對應表即可增修）。官網沒有的品項（瑪莎曼燉牛肉、蒜香乾蝦小豆苗、清炒水蓮）保留 Wikimedia Commons 免費授權照片。
- **官網與春節菜單的差異**（已保留 PDF 價格，供門市確認）：泰香炙烤牛小排 PDF $710／官網 $699；泰國香米飯 PDF $40／人／官網 $35；檸香酸辣小卷 PDF $480／官網「分店限定小份」$280；另 PDF 單點頁寫「蜜醬炙烤肋排」、同一份 PDF 的十人套餐與官網都寫「秘醬炙烤肋排」。
