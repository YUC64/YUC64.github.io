# -*- coding: utf-8 -*-
"""Code.gs：① 每人只能送一次  ② 員工可開放「修改權限」  ③ 顧客查自己的訂單  ④ 排序改依訂單編號"""
import io, sys
p = 'scripts/google-apps-script/Code.gs'
s = io.open(p, encoding='utf-8').read()
n = 0

def rep(old, new, label):
    global s, n
    c = s.count(old)
    if c != 1:
        print('FAIL', label, c); sys.exit(1)
    s = s.replace(old, new); n += 1

# ── 1. 欄位：最後加「修改權限」 ──
rep("""const ORDER_HEADERS = [
  '訂單編號', '狀態', '動作', '姓名', '電話', '預計取餐時間', '用餐人數',
  '套餐內容', '套餐金額', '單點內容', '單點金額', '服務費', '總金額', '備註', '最後更新',
];""",
"""const ORDER_HEADERS = [
  '訂單編號', '狀態', '動作', '姓名', '電話', '預計取餐時間', '用餐人數',
  '套餐內容', '套餐金額', '單點內容', '單點金額', '服務費', '總金額', '備註', '最後更新',
  '修改權限',   // 員工按「開放修改」時填 open，客人改完一次自動收回
];
const COL_FLAG = 15;   // 「修改權限」欄索引""", 'headers')

# ── 2. doPost：員工開放／收回修改權限（最前面處理） ──
rep("""  const phone = normPhone(body.phone);
  const code = String(body.code || '').trim();
  const action = String(body.action || '新增');
  const orderId = String(body.orderId || '').trim();
""",
"""  // 員工操作：開放／收回某張訂單的修改權限（用 staffPw 驗證，不需要客人驗證碼）
  if (body.staffPw !== undefined) {
    if (String(body.staffPw) !== STAFF_PASSWORD) return jsonOut({ ok: false, error: 'bad_password' });
    const staffAct = String(body.action || '');
    if (['開放修改', '收回修改'].indexOf(staffAct) < 0) return jsonOut({ ok: false, error: 'bad_action' });
    const oid = String(body.orderId || '').trim();
    if (!oid) return jsonOut({ ok: false, error: 'no_order_id' });
    const shS = orderSheet_().getSheetByName(ORDER_TAB);
    const lastS = shS ? shS.getLastRow() : 0;
    if (lastS < 2) return jsonOut({ ok: false, error: 'order_not_found' });
    const rowsS = shS.getRange(2, 1, lastS - 1, ORDER_HEADERS.length).getValues();
    for (let i = rowsS.length - 1; i >= 0; i--) {
      if (String(rowsS[i][0] || '').trim() === oid) {
        shS.getRange(i + 2, COL_FLAG + 1).setValues([[staffAct === '開放修改' ? 'open' : '']]);
        return jsonOut({ ok: true, orderId: oid, editable: staffAct === '開放修改' });
      }
    }
    return jsonOut({ ok: false, error: 'order_not_found' });
  }

  const phone = normPhone(body.phone);
  const code = String(body.code || '').trim();
  const action = String(body.action || '新增');
  const orderId = String(body.orderId || '').trim();
""", 'staff-action')

# ── 3. 重複下單 / 修改權限檢查 ──
rep("""  if (action !== '新增' && rowIndex < 0) return jsonOut({ ok: false, error: 'order_not_found' });
""",
"""  if (action !== '新增' && rowIndex < 0) return jsonOut({ ok: false, error: 'order_not_found' });

  // 每位客人只能送一次：同一支電話已有未取消的訂單就擋下
  if (action === '新增') {
    const dup = rows.some(function (r) {
      return normPhone(r[4]) === phone && String(r[1] || '').trim() !== '已取消';
    });
    if (dup) return jsonOut({ ok: false, error: 'already_ordered' });
  } else {
    // 修改／取消需要門市開放權限
    const flag = String((rows[rowIndex - 2] || [])[COL_FLAG] || '').trim();
    if (flag !== 'open') return jsonOut({ ok: false, error: 'edit_locked' });
  }
""", 'dup-and-flag')

# ── 4. values 帶上修改權限（修改後收回） ──
rep("""    keep(body.note ? safe_(body.note) : '', 13),
    now,
  ];""",
"""    keep(body.note ? safe_(body.note) : '', 13),
    now,
    action === '修改' ? '' : String((base || [])[COL_FLAG] || ''),   // 改完就收回權限
  ];""", 'values-flag')

# ── 5. 員工看板：多回傳 editable、排序改依訂單編號 ──
rep("""      updated: String(d[14] || '').trim(),
      src: src.tab,""",
"""      updated: String(d[14] || '').trim(),
      editable: String(r[COL_FLAG] || '').trim() === 'open',
      src: src.tab,""", 'staff-editable')

rep("""  orders.sort(function (a, b) {
    if (a.pickup !== b.pickup) return a.pickup < b.pickup ? -1 : 1;
    return String(a.orderId) < String(b.orderId) ? -1 : 1;
  });""",
"""  orders.sort(function (a, b) {
    return String(a.orderId) < String(b.orderId) ? -1 : 1;   // 依下單順序
  });""", 'staff-sort')

# ── 6. 顧客查自己的訂單：GET ?mine=1&phone=&code= ──
rep("""  // 員工看板：?staff=1&pw=密碼 → 回傳訂單清單（需密碼，因為含客人姓名電話）
  if (p.staff) return staffOrders_(p);
""",
"""  // 員工看板：?staff=1&pw=密碼 → 回傳訂單清單（需密碼，因為含客人姓名電話）
  if (p.staff) return staffOrders_(p);

  // 客人查自己的訂單：?mine=1&phone=09xxxxxxxx&code=1234
  if (p.mine) return myOrders_(p);
""", 'mine-route')

rep("""/** 依電話找訂位列，回傳 {row, name, code, phone} */""",
"""/** 客人查自己的訂單（只回傳這支電話的，需驗證碼） */
function myOrders_(p) {
  const phone = normPhone(p.phone);
  const code = String(p.code || '').trim();
  if (!/^09\\d{8}$/.test(phone)) return jsonOut({ ok: false, error: 'bad_phone' });
  const hit = findReservation_(phone);
  if (!hit) return jsonOut({ ok: false, error: 'not_found' });
  if (String(hit.code) !== code) return jsonOut({ ok: false, error: 'bad_code' });

  const ss = orderSheet_();
  const out = [];
  [ORDER_TAB, ARCHIVE_TAB].forEach(function (name) {
    const sh = ss.getSheetByName(name);
    if (!sh) return;
    const last = sh.getLastRow();
    if (last < 2) return;
    const rows = sh.getRange(2, 1, last - 1, ORDER_HEADERS.length).getValues();
    rows.forEach(function (r) {
      if (normPhone(r[4]) !== phone) return;
      const id = String(r[0] || '').trim();
      if (!id) return;
      out.push({
        orderId: id,
        status: String(r[1] || '').trim(),
        name: String(r[3] || '').trim(),
        headcount: num_(r[6]),
        sets: String(r[7] || '').trim(),
        setsTotal: num_(r[8]),
        alacarte: String(r[9] || '').trim(),
        alacarteTotal: num_(r[10]),
        service: num_(r[11]),
        total: num_(r[12]),
        note: String(r[13] || '').trim(),
        updated: tsStr_(r[14]),
        editable: String(r[COL_FLAG] || '').trim() === 'open',
      });
    });
  });
  out.sort(function (a, b) { return String(a.orderId) < String(b.orderId) ? 1 : -1; });
  return jsonOut({ ok: true, count: out.length, orders: out });
}

/** 日期／文字統一轉成 'yyyy/MM/dd HH:mm' */
function tsStr_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Taipei', 'yyyy/MM/dd HH:mm');
  return String(v == null ? '' : v).trim();
}

/** 依電話找訂位列，回傳 {row, name, code, phone} */""", 'myOrders_')

io.open(p, 'w', encoding='utf-8').write(s)
print('Code.gs 更新完成，共', n, '處')
