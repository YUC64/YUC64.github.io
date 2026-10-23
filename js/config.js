/* =============================================================================
 *  網站設定檔 —— 只要改這一個檔案就能上線
 *  Google 表單設定方式見 SETUP.md（或執行 `node tools/form-entry-ids.mjs <表單網址>`）
 *  自動產生：把表單網址貼給工具，會直接印出下面 form.entries 的內容
 * ========================================================================== */

window.CONFIG = {
  brand: {
    name: '饗泰多',
    enName: 'EAT THAI, FEEL HIGH!',
    year: '2027',
    subtitle: '春節內用年菜・線上預先點餐',
    phone: '02-0000-0000',        // ← 改成店內電話（顯示於頁尾與確認頁）
    address: '',                   // ← 可填門市地址
  },

  orders: {
    // 春節期間訂單截止時間（ISO，超過就不再收單；設 null 表示不限制）
    deadline: '2027-02-14T23:59:00+08:00',
    // 預計取餐時段的候選時段
    timeSlots: [
      '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
      '14:00', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30',
    ],
    // 開始收單的日期（供日期選擇器 min）
    openFrom: '2027-01-20',
    // 最晚可選用餐日（供日期選擇器 max）
    openTo: '2027-02-21',
  },

  rules: {
    // PDF：「春節期間限點選任一春節多人套餐，方能進行單點加點。」
    requireSetBeforeAlcarte: true,
    // PDF：「春節期間本店需加收 10% 服務費」
    serviceChargeRate: 0.1,
    // PDF：「每人最低消費 $600」
    minSpendPerPerson: 600,
  },

  // ---------------------------------------------------------------------------
  // 員工專用頁（/staff.html）與訂位驗證設定
  // ---------------------------------------------------------------------------
  staff: {
    // 訂位名單試算表：只分享給員工的 Google 帳號（不要把連結公開）
    sheetUrl: 'https://docs.google.com/spreadsheets/d/1vDdLKtOsXu_DbLqwxDzd8i_Dlr_Ya95NddFEBKFXOOQ/edit',
    // 訂單回應試算表（Google 表單回應匯集處）
    ordersSheetUrl: '',
    // 值班電話（員工頁顯示）
    dutyPhone: '',
  },

  // ---------------------------------------------------------------------------
  // Apps Script API（同一個網址同時提供「訂位驗證」與「訂單寫入」）
  //   部署方式見 SETUP.md：Apps Script → 部署 → 網頁應用程式（執行身分：我／存取權：任何人）
  // ---------------------------------------------------------------------------
  api: {
    endpoint: 'https://script.google.com/macros/s/AKfycbyr2cDkJg03gslxl03pzwxmR573WKShHHUDOGaUehTu4dAPtPioZtb2F7Uem7CrmXRm/exec',
  },

  reservation: {
    // off      = 不驗證，任何電話都能登入（尚未設定的預設值）
    // endpoint = 用 api.endpoint 驗證「電話 + 驗證碼」（推薦）
    // hashfile = 讀公開雜湊檔（不需後端，但電話可被暴力反推，見 SETUP.md）
    mode: 'endpoint',
    // mode='hashfile' 時的雜湊檔路徑
    hashFile: 'data/reservations.json',
    // 需要驗證碼（員工在訂位表給客人的 4 位數）
    requireCode: true,
    // 驗證服務異常（斷線／Apps Script 掛掉）時：allow = 先讓客人點（訂單標記待確認）
    //                                        block = 擋下並請客人來電
    onError: 'allow',
  },

  ordersWrite: {
    // apps-script = 直接寫入 Google 試算表（推薦：同一訂單編號會覆蓋同一列，送出後有回應）
    // google-form = 舊做法：POST 到 Google 表單（只能新增列，修改會變兩筆）
    // off         = 只存本機（示範模式）
    mode: 'apps-script',
  },

  // ---------------------------------------------------------------------------
  // Google 表單設定
  //   form.action : 表單的 /formResponse 網址
  //   form.entries: 欄位 -> entry.ID（例如 'entry.1234567890'）
  //   把 formId 或 action 留空 → 網站進入「示範模式」：訂單只存在本機，
  //   並在畫面明確提示尚未連接 Google 表單。
  // ---------------------------------------------------------------------------
  form: {
    action: '',
    // 表單的作答網址（僅供「示範模式」提示與工具使用）
    formUrl: '',
    entries: {
      orderId:   '',   // 訂單編號
      action:    '',   // 動作（新訂單／修改訂單／取消訂單）
      name:      '',   // 姓名
      phone:     '',   // 手機號碼
      pickup:    '',   // 預計取餐時間
      headcount: '',   // 用餐人數
      sets:      '',   // 套餐內容
      setsTotal: '',   // 套餐金額
      alacarte:  '',   // 單點內容
      alacarteTotal: '', // 單點金額
      service:   '',   // 服務費（10%）
      total:     '',   // 總金額
      note:      '',   // 備註
      ts:        '',   // 送出時間
    },
  },

  // 建立 Google 表單時，問題請「依以下順序與標題」建立，
  // tools/form-entry-ids.mjs 會用標題自動對應 entry.ID。
  formFieldTitles: {
    orderId:   '訂單編號',
    action:    '動作',
    name:      '姓名',
    phone:     '手機號碼',
    pickup:    '預計取餐時間',
    headcount: '用餐人數',
    sets:      '套餐內容',
    setsTotal: '套餐金額',
    alacarte:  '單點內容',
    alacarteTotal: '單點金額',
    service:   '服務費',
    total:     '總金額',
    note:      '備註',
    ts:        '送出時間',
  },
};
