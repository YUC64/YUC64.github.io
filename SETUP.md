# SETUP — 接上 Google 表單（5 分鐘）

> 2027 除夕版新增：`js/data.js` 多了辣度表（`SPICY`）與冰／去冰／熱選項（`TEMPS`）；
> 登入後才能選購；LOGO 與辣椒圖示放在 `assets/img/`。這些都不影響表單設定流程。

網站沒有任何後端，訂單是「假裝有人填 Google 表單」送出的：前端用 `fetch()` 把購物車內容 POST 到表單的
`/formResponse`，並用 `entry.xxxxx` 對應每個題目。所以只要做兩件事：**建表單** → **把 entry.ID 填進 `js/config.js`**。

---

## 步驟 1：建立 Google 表單

1. 開 <https://forms.google.com> → 空白表單，標題例如「饗泰多 2027 春節內用訂單」。
2. 依下表建立題目，**全部選「簡答題」**，標題文字要一模一樣（程式是靠標題自動對應的）：

| # | 題目標題 | 用途 |
|---|---|---|
| 1 | 訂單編號 | 例如 XT2701251830123 |
| 2 | 動作 | 新訂單／修改訂單／取消訂單 |
| 3 | 姓名 | |
| 4 | 手機號碼 | |
| 5 | 預計取餐時間 | 2027-02-18 18:30 |
| 6 | 用餐人數 | |
| 7 | 套餐內容 | 套餐＋所有選項的完整文字 |
| 8 | 套餐金額 | |
| 9 | 單點內容 | |
| 10 | 單點金額 | |
| 11 | 服務費 | 10% |
| 12 | 總金額 | 套餐＋單點＋服務費 |
| 13 | 備註 | 客人填的備註 |
| 14 | 送出時間 | |

> 訂單內容字串會包含冰熱與辣度資訊，例如
> `春節四人套餐 x1 [涼拌:酸辣海鮮涼拌 … | 飲料:泰式奶茶(冰)/泰式奶茶(熱)…]`、`摩摩喳喳(去冰) x1`。

3. 表單右上「傳送」→ 連結 → **勾選「縮短網址」與「知道連結的任何人可以回覆」** → 複製連結。

> 想改題目順序可以，但**標題文字**必須與上表一致；若要改標題，請同步修改
> `js/config.js` 裡的 `formFieldTitles`。

## 步驟 2：自動填入 entry.ID

```bash
node tools/form-entry-ids.mjs "https://docs.google.com/forms/d/e/1FAIpQLS.../viewform" --write
```

工具會抓取表單頁面、解析 `FB_PUBLIC_LOAD_DATA_`、依標題對應 14 個欄位，並直接改寫 `js/config.js` 的
`form.action` 與 `form.entries`。輸出長這樣：

```
對應結果（14/14）：
  ✓ orderId      entry.1234567890
  ✓ action       entry.1234567891
  ...
✓ 已寫入 js/config.js
```

（不加 `--write` 只會印出設定內容讓你自己貼。若顯示 `✗ 未對應到` 表示那個題目標題不同或漏建。）

**手動作法**：在表單右上「⋮ → 取得預先填入的連結」，隨便填一個答案後按「取得連結」，
網址中 `entry.1234567890=...` 的數字就是 entry ID；`form.action` 則是把連結的 `/viewform`
換成 `/formResponse`。

## 步驟 3：收單到 Google 試算表

表單「回應」分頁 → 綠色試算表圖示 → 「連結至試算表」→ 建立。之後每筆訂單都會變成一列。

### 建議：讓試算表只看「最新版本」的訂單

Google 表單只能**新增列**，不能修改既有列，所以「修改訂單／取消訂單」會是同一訂單編號的新的一列。
最簡單的處理方式：在試算表新增一個工作表，用公式取每個訂單編號的最後一列，例如：

```
=FILTER('表單回應 1'!A:N, '表單回應 1'!B:B = "新訂單")
```

或直接用資料透視／排序功能，依「送出時間」由新到舊排序，出餐時看同編號最上面那筆。

### （可選）用 Apps Script 做到真正的「覆寫更新」

如果你希望修改訂單時是**更新原本那一列**而不是新增一列，把 `js/config.js` 的 `form.action`
改成你自己的 Apps Script Web App 網址即可（前端程式完全不用改，因為它只是 POST 表單資料）：

```javascript
// Google 試算表 → 擴充功能 → Apps Script → 貼上 → 部署為網頁應用程式（存取權：任何人）
function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSheet();
  const p = e.parameter;                      // 欄位名稱 = entry.ID，需自行改成語意名稱
  const rows = sheet.getDataRange().getValues();
  for (let i = rows.length - 1; i >= 1; i--) {
    if (String(rows[i][0]) === p.orderId) {   // 找到同訂單編號 → 覆寫該列
      sheet.getRange(i + 1, 1, 1, 14).setValues([[
        p.orderId, p.action, p.name, p.phone, p.pickup, p.headcount,
        p.sets, p.setsTotal, p.alacarte, p.alacarteTotal, p.service, p.total, p.note, p.ts,
      ]]);
      return ContentService.createTextOutput('updated');
    }
  }
  sheet.appendRow([p.orderId, p.action, p.name, p.phone, p.pickup, p.headcount,
    p.sets, p.setsTotal, p.alacarte, p.alacarteTotal, p.service, p.total, p.note, p.ts]);
  return ContentService.createTextOutput('appended');
}
```

> 注意：這已經算是「有後端」了，若作業要求是純 Google 表單，就維持預設做法。

---

## 讓「客人用電話登入」時驗證訂位（推薦做法）

需求：**只有訂位的客人**能用電話登入點餐。純前端做不到「私下查名單」——把名單放進網站等於公開全部客人的姓名電話。所以用一支免費的 Google Apps Script 當查詢窗口：名單留在**私有試算表**，只回傳「這支電話有沒有訂位」。

### 1. 建訂位名單試算表

- 新增 Google 試算表，工作表名稱設為 `訂位名單`（或改程式裡的 `SHEET_NAME`）。
- 第一列標題：`姓名` | `電話`（可再加「人數」「桌號」「已報到」）。
- 電話統一寫 `09xxxxxxxx`（程式也會自動處理 `+886912345678`）。
- **分享權限只給員工的 Google 帳號**，千萬不要設成「知道連結的任何人」。

### 2. 試算表 → 擴充功能 → Apps Script，貼上：

```javascript
const SHEET_NAME = '訂位名單';

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
function norm(v) {                                  // 0912-345-678 / +886912345678 → 0912345678
  const d = String(v || '').replace(/\D/g, '');
  if (/^8869\d{8}$/.test(d)) return '0' + d.slice(3);
  if (/^9\d{8}$/.test(d)) return '0' + d;
  return d;
}

function doGet(e) {
  const phone = norm(e && e.parameter ? e.parameter.phone : '');
  if (!/^09\d{8}$/.test(phone)) return json({ ok: false, error: 'bad_phone' });

  // 節流：同一支電話每分鐘最多查 10 次（避免被拿來逐一試探名單）
  const cache = CacheService.getScriptCache();
  const key = 'q' + phone;
  const n = Number(cache.get(key) || 0);
  if (n >= 10) return json({ ok: false, error: 'rate_limited' });
  cache.put(key, String(n + 1), 60);

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME)
             || SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  const rows = sheet.getDataRange().getValues();
  if (!rows.length) return json({ ok: false, error: 'empty_sheet' });
  const head = rows.shift().map(function (h) { return String(h).trim(); });
  const pi = head.findIndex(function (h) { return /電話|手機|phone|tel/i.test(h); });
  const ni = head.findIndex(function (h) { return /姓名|名字|name/i.test(h); });
  if (pi < 0) return json({ ok: false, error: 'no_phone_column' });

  for (var i = 0; i < rows.length; i++) {
    if (norm(rows[i][pi]) === phone) {
      return json({ ok: true, name: ni >= 0 ? String(rows[i][ni] || '') : '' });
    }
  }
  return json({ ok: false });
}

// 想更嚴謹可改成「電話 + 姓名」同時符合才算通過：
// 前端只要多帶一個 &name= 參數，這裡再多比對一個欄位即可。
```

### 3. 部署

- 右上「部署」→「新增部署作業」→ 類型選 **網頁應用程式**
- 執行身分：**我**；誰可以存取：**任何人**（客人的瀏覽器要能匿名查詢）
- 複製結尾是 `/exec` 的網址

### 4. 填回網站設定

```javascript
// js/config.js
reservation: {
  mode: 'endpoint',
  endpoint: 'https://script.google.com/macros/s/AKfycb.../exec',
  onError: 'allow',   // 驗證服務掛掉時先讓客人點（訂單會標記待確認）
},
staff: {
  sheetUrl: '訂位名單的試算表網址',        // 員工頁的「開啟」按鈕（Google 會用帳號擋權限）
  ordersSheetUrl: '表單回應的試算表網址',
},
```

之後客人輸入手機號碼 → 網站問 Apps Script → Apps Script 查私有試算表 → 只回傳 `{ok:true}` →
通過才能選購。**名單一筆都不會出現在網站上**，`/staff.html` 的查詢工具也共用同一個來源。

### 已知限制（老實說）

- 這個 `/exec` 網址是公開的，所以任何人可以拿電話號碼來「問有沒有訂位」→ 屬於可被逐一試探的風險（不會一次拿到整份名單）。程式已加節流；要更嚴謹就改成「電話＋姓名」都比對。
- Apps Script 免費額度：每天 20,000 次執行、同時 30 個，一個晚上的活動非常夠用。
- **掛掉時**：`onError: 'allow'` 會先讓客人點餐並在訂單備註標記 `[未通過訂位驗證]`，門市現場再人工核對；`'block'` 則直接擋下並請客人來電。除夕當天建議用 `allow`，免得整晚收不到單。

### 替代方案：不需要任何後端的 `hashfile` 模式

```bash
node tools/make-reservation-hashes.mjs 訂位名單.csv --iterations 200000
# → 產生 data/reservations.json（只有雜湊，預設不含姓名）
```
再把 `reservation.mode` 設成 `'hashfile'`。**但風險要知道**：檔案公開在 GitHub Pages，
而台灣手機號碼只有 `09xxxxxxxx` 一種格式（約 1 億組），用一張高階顯示卡搭配 PBKDF2 20 萬次迭代，
**估計數十分鐘內就能反推出全部號碼**。所以這只適合「完全不想碰 Apps Script、且可接受風險」的情況，
而且名單每次異動都要重新產生檔案並重新 push。

---

## 其他設定（`js/config.js`）

| 設定 | 說明 |
|---|---|
| `brand.phone` / `brand.address` | 顯示在頁尾與訂購成功畫面；**記得改成門市電話** |
| `orders.deadline` | 收單截止時間（ISO），過期後頁面顯示截止提示 |
| `orders.openFrom` / `openTo` | 日期選擇器的可選範圍 |
| `orders.timeSlots` | 預計取餐時段清單 |
| `rules.serviceChargeRate` | 服務費比例（0.1 = 10%） |
| `rules.minSpendPerPerson` | 每人最低消費（600），未達標時購物車會警示 |
| `rules.requireSetBeforeAlcarte` | 是否強制「先點套餐才能單點」（預設 true） |

## 換菜品圖片

把 `assets/img/<key>.jpg` 直接覆蓋即可（檔名對應見 `js/data.js` 的 `IMG('key')`）。
圖片會自動以 4:3 裁切；若某張圖不存在，卡片會自動顯示品牌色替代樣式，不會破圖。

重新從 Wikimedia Commons 抓圖（免費授權，並自動更新 `credits.json`）：

```bash
python scripts/fetch-images.py            # 抓缺的
python scripts/fetch-images.py --force     # 全部重抓
python scripts/pick-candidates.py          # 產生候選圖對照表 candidates/sheet_*.png 供挑圖
```

把菜單 PDF 轉成高解析圖片（Windows 內建 API，方便核對辣度或做素材）：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/render-pdf.ps1 `
  -Pdf "C:\path\menu.pdf" -OutDir "C:\path\pages" -Scale 2.2
```

## 部署到 GitHub Pages

```bash
git add -A && git commit -m "update" && git push
gh api -X POST repos/<帳號>/<repo>/pages -f 'source[branch]=main' -f 'source[path]=/'
```

網站是純靜態檔案，推到 `main` 之後 GitHub Pages 會自動重新部署（約 30–60 秒）。

## 常見問題

- **送出後試算表沒東西？** 表單權限必須是「知道連結的任何人可以回覆」；`form.action` 必須是 `/formResponse` 結尾；
  entry ID 必須是同一份表單的（表單重新建立後 ID 會變，要重跑工具）。
- **按「送出」只在本機看到訂單？** 那是示範模式：`js/config.js` 的 `form.action` 還是空的。
- **換手機看不到自己的訂單？** 純前端限制，本機 localStorage 才有紀錄。請保留訂單編號，或改用上面的 Apps Script 版本。
