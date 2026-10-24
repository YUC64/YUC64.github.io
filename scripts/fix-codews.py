# -*- coding: utf-8 -*-
"""Code.gs：電話欄保持文字（保留前導 0）＋ 修改/取消時不覆蓋未提供的欄位"""
import io, sys
p = 'scripts/google-apps-script/Code.gs'
s = io.open(p, encoding='utf-8').read()

old = """  const status = action === '取消' ? '已取消' : (action === '修改' ? '已修改' : '新訂單');
  const now = new Date();
  const values = [
    orderId, status, action, safe_(body.name), phone,
    safe_(body.pickup), Number(body.headcount) || '',
    safe_(body.sets), num_(body.setsTotal), safe_(body.alacarte), num_(body.alacarteTotal),
    num_(body.service), num_(body.total), safe_(body.note), now,
  ];

  if (rowIndex > 0) {
    sh.getRange(rowIndex, 1, 1, ORDER_HEADERS.length).setValues([values]);
    return jsonOut({ ok: true, orderId: orderId, mode: 'updated', row: rowIndex, status: status });
  }
  sh.appendRow(values);
  return jsonOut({ ok: true, orderId: orderId, mode: 'created', row: sh.getLastRow(), status: status });
}"""

new = """  const status = action === '取消' ? '已取消' : (action === '修改' ? '已修改' : '新訂單');
  const now = new Date();

  // 修改／取消時，前端沒帶的欄位沿用原值（例如取消只帶狀態，不能把餐點金額清空）
  const base = rowIndex > 0 ? sh.getRange(rowIndex, 1, 1, ORDER_HEADERS.length).getValues()[0] : null;
  const keep = function (v, i) {
    if (v === undefined || v === null) return base ? base[i] : '';
    if (typeof v === 'string' && v.trim() === '') return base ? base[i] : '';
    return v;
  };

  const values = [
    orderId, status, action,
    keep(body.name ? safe_(body.name) : '', 3),
    phone,                                              // 一律用驗證過的正規化電話（含前導 0）
    keep(body.pickup ? safe_(body.pickup) : '', 5),
    keep(body.headcount === undefined || body.headcount === '' ? '' : Number(body.headcount) || '', 6),
    keep(body.sets ? safe_(body.sets) : '', 7),
    keep(num_(body.setsTotal), 8),
    keep(body.alacarte ? safe_(body.alacarte) : '', 9),
    keep(num_(body.alacarteTotal), 10),
    keep(num_(body.service), 11),
    keep(num_(body.total), 12),
    keep(body.note ? safe_(body.note) : '', 13),
    now,
  ];

  if (rowIndex > 0) {
    // 先設文字格式，避免電話被當成數字而掉了前導 0
    sh.getRange(rowIndex, 5).setNumberFormat('@');
    sh.getRange(rowIndex, 1, 1, ORDER_HEADERS.length).setValues([values]);
    return jsonOut({ ok: true, orderId: orderId, mode: 'updated', row: rowIndex, status: status });
  }

  const newRow = sh.getLastRow() + 1;
  sh.getRange(newRow, 5).setNumberFormat('@');          // 電話欄先設文字
  sh.getRange(newRow, 1, 1, ORDER_HEADERS.length).setValues([values]);
  return jsonOut({ ok: true, orderId: orderId, mode: 'created', row: newRow, status: status });
}"""

if s.count(old) != 1:
    print('FAIL: 找不到要取代的區塊', s.count(old)); sys.exit(1)
s = s.replace(old, new)

# setupOrderSheet：電話／訂單編號整欄設文字格式（含未來新增的列）
old2 = "  sh.getRange('E2:E').setNumberFormat('@');"
new2 = "  sh.getRange('A2:A').setNumberFormat('@');   // 訂單編號當文字\n  sh.getRange('E2:E').setNumberFormat('@');   // 電話當文字（保留前導 0）"
if s.count(old2) == 1:
    s = s.replace(old2, new2)

io.open(p, 'w', encoding='utf-8').write(s)
print('Code.gs 已更新')
