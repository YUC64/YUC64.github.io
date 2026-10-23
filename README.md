# 饗泰多｜2027 春節內用年菜・線上預先點餐

純前端（HTML / Tailwind CSS CDN / Vanilla JS）的春節年菜預訂網站，資料以 **Google 表單 → Google 試算表** 收集，沒有任何後端伺服器與資料庫，可直接託管在 **GitHub Pages**。

> 菜單、套餐組合、「選 N」規則、單點價目與加收規則（10% 服務費、每人低消 $600、需先點套餐才能單點）皆依門市《2027 年春節內用菜單》PDF 實作。

---

## 功能

| 需求 | 實作 |
|---|---|
| 菜單展示（圖片／名稱／價格／加入） | 5 個春節套餐 + 42 道單點，12 個分類頁籤，卡片式排版，圖片皆有缺圖替代樣式 |
| 響應式設計 RWD | 手機 2 欄／平板 3 欄／桌機 4 欄；手機底部固定「查看購物車 + 總計」列 |
| 購物車系統 | 右側滑出面板，可展開/隱藏、動態增減數量、即時計算總額（套餐／單點／10% 服務費） |
| 先點套餐才能加點 | 未加入套餐前，單點區顯示 🔒 鎖定畫面、按鈕停用、送出被擋 |
| 套餐「選 N」規則 | 每個套餐的每個品類（涼拌／肉類／青菜／咖哩／蛋豆腐／湯品／飲料）都有選滿檢查，未選滿無法加入 |
| 手機號碼登入 | 手機號碼 + 姓名 + 自訂 4 位數密碼（存於該裝置 localStorage）；未登入無法結帳 |
| 訂購人資訊 | 姓名、電話、預計取餐日 + 時段、備註；即時顯示人數與每人平均 |
| 修改／取消自己的訂單 | 「我的訂單」可查看、載回購物車修改（同訂單編號、動作標記為「修改訂單」）、取消、以訂單編號查詢 |
| 背景送出 | `e.preventDefault()` + `fetch(action, {mode:'no-cors'})`，以 `entry.ID` 對應寫入 Google 表單 |
| 送出成功提示 | 訂購成功畫面顯示訂單編號、取餐時間、人數、總計 |

## 檔案結構

```
index.html                  版面（Tailwind CDN + 少量自訂 CSS）
assets/css/style.css        自訂樣式（晶片、數量按鈕、抽屜、動畫）
assets/img/*.jpg            菜品圖片（50 張）+ credits.json 授權清單
js/config.js                ← 唯一需要改的設定檔（品牌、規則、Google 表單）
js/data.js                  菜單資料（套餐、單點、分類）
js/app.js                   全部商業邏輯（購物車、登入、送出）
tools/form-entry-ids.mjs    自動從 Google 表單網址抓出 entry.ID 並寫回 config.js
scripts/fetch-images.py     從 Wikimedia Commons 抓免費授權菜品圖
scripts/pick-candidates.py  多抓幾個候選圖做人工挑圖對照表
SETUP.md                    ★ Google 表單設定步驟、部署、注意事項
```

## 本機預覽

```bash
python -m http.server 8765      # 然後開 http://127.0.0.1:8765/
```
（直接雙擊 index.html 也可以，但用 http server 較接近 GitHub Pages 環境）

## 部署到 GitHub Pages

```bash
git init && git add . && git commit -m "feat: 2027 春節線上預訂網站"
gh repo create eatthai-newyear-preorder --public --source=. --push
gh api -X POST repos/<你的帳號>/eatthai-newyear-preorder/pages \
  -f 'source[branch]=main' -f 'source[path]=/'
# 幾十秒後：https://<你的帳號>.github.io/eatthai-newyear-preorder/
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
- **飲料加價升級**：菜單未公告價差，網站以 $0 記錄並在訂單備註，現場依公告價差計收。
- **圖片**：多數為 Wikimedia Commons 免費授權照片（清單見 `assets/img/credits.json`）；套餐代表圖與主視覺取自門市菜單 PDF（© 饗泰多）。若要用門市實拍照片，直接把 `assets/img/<key>.jpg` 換掉即可，檔名不變。
