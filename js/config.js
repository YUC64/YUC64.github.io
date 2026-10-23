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
    sheetUrl: '',
    // 訂單回應試算表（Google 表單回應匯集處）
    ordersSheetUrl: '',
    // 值班電話（員工頁顯示）
    dutyPhone: '',
  },

  reservation: {
    // off       = 不驗證，任何電話都能登入點餐（尚未設定的預設值）
    // endpoint  = 呼叫 Google Apps Script 驗證（推薦，名單不外流）
    // hashfile  = 讀取公開的雜湊檔驗證（不需後端，但電話可被暴力反推，見 SETUP.md）
    mode: 'off',
    // mode='endpoint' 時的 Apps Script Web App 網址（結尾 /exec）
    endpoint: '',
    // mode='hashfile' 時的雜湊檔路徑
    hashFile: 'data/reservations.json',
    // 驗證服務異常（斷線／Apps Script 掛掉）時：allow = 先讓客人點（訂單會標記未驗證）
    //                                        block = 擋下並請客人來電
    onError: 'allow',
    // 通過驗證後是否要求客人自行填寫姓名
    askName: true,
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
