#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""本機模擬 Apps Script 的 doGet / doPost，用來在沒有 Google 帳號的情況下測完整流程。

模擬的行為與 scripts/google-apps-script/Code.gs 一致：
  GET  ?phone=&code=           → {ok, name} / {ok:false, error}
  POST (text/plain JSON body)  → 以訂單編號 upsert，回 {ok, mode:'created'|'updated', row}
  GET  /rows                   → 印出目前「訂單表」所有列（測試用）
  GET  /reservations           → 印出目前「訂位名單」（測試用）

用法：
    python scripts/mock-apps-script.py            # 預設 port 8770
然後在瀏覽器 console 設定：
    window.CONFIG.api.endpoint = 'http://127.0.0.1:8770/exec';
    window.CONFIG.reservation.mode = 'endpoint';
    window.CONFIG.ordersWrite.mode = 'apps-script';
"""
import json
import re
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8770

# 模擬「訂位名單」：姓名 / 電話 / 驗證碼
RESERVATIONS = [
    {'name': '王小明', 'phone': '0912345678', 'code': '1234'},
    {'name': '陳大文', 'phone': '0987654321', 'code': '5678'},
]
ORDER_HEADERS = ['訂單編號', '狀態', '動作', '姓名', '電話', '預計取餐時間', '用餐人數',
                 '套餐內容', '套餐金額', '單點內容', '單點金額', '服務費', '總金額', '備註', '最後更新']
ORDERS = []   # list[list]
FAILS = {}


def norm_phone(v):
    d = re.sub(r'\D', '', str(v or ''))
    if re.match(r'^8869\d{8}$', d):
        return '0' + d[3:]
    if re.match(r'^9\d{8}$', d):
        return '0' + d
    return d


def find_reservation(phone):
    for r in RESERVATIONS:
        if norm_phone(r['phone']) == phone:
            return r
    return None


def json_out(handler, obj):
    body = json.dumps(obj, ensure_ascii=False).encode('utf-8')
    handler.send_response(200)
    handler.send_header('Content-Type', 'application/json; charset=utf-8')
    handler.send_header('Access-Control-Allow-Origin', '*')
    handler.send_header('Content-Length', str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


class Handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
        self.end_headers()

    def do_GET(self):
        path, _, query = self.path.partition('?')
        params = {}
        for kv in query.split('&'):
            if '=' in kv:
                k, v = kv.split('=', 1)
                params[k] = v

        if path.endswith('/rows'):
            return json_out(self, {'headers': ORDER_HEADERS, 'rows': ORDERS})
        if path.endswith('/reservations'):
            return json_out(self, RESERVATIONS)

        phone = norm_phone(params.get('phone'))
        code = (params.get('code') or '').strip()
        if not re.match(r'^09\d{8}$', phone):
            return json_out(self, {'ok': False, 'error': 'bad_phone'})
        if not code:
            return json_out(self, {'ok': False, 'error': 'need_code'})
        if FAILS.get(phone, 0) >= 8:
            return json_out(self, {'ok': False, 'error': 'too_many_attempts'})

        hit = find_reservation(phone)
        if not hit:
            return json_out(self, {'ok': False, 'error': 'not_found'})
        if hit['code'] != code:
            FAILS[phone] = FAILS.get(phone, 0) + 1
            return json_out(self, {'ok': False, 'error': 'bad_code',
                                   'remaining': max(0, 8 - FAILS[phone])})
        FAILS.pop(phone, None)
        return json_out(self, {'ok': True, 'name': hit['name']})

    def do_POST(self):
        n = int(self.headers.get('Content-Length', 0))
        try:
            raw = self.rfile.read(n).decode('utf-8')
        except UnicodeDecodeError:
            # 例如用 Windows 主控台（Big5）送中文測試資料；瀏覽器一律是 UTF-8
            return json_out(self, {'ok': False, 'error': 'bad_encoding'})
        try:
            body = json.loads(raw or '{}')
        except Exception:
            return json_out(self, {'ok': False, 'error': 'bad_json'})

        phone = norm_phone(body.get('phone'))
        code = str(body.get('code') or '').strip()
        action = str(body.get('action') or '新增')
        order_id = str(body.get('orderId') or '').strip()

        if not re.match(r'^09\d{8}$', phone):
            return json_out(self, {'ok': False, 'error': 'bad_phone'})
        if not order_id:
            return json_out(self, {'ok': False, 'error': 'no_order_id'})
        if action not in ('新增', '修改', '取消'):
            return json_out(self, {'ok': False, 'error': 'bad_action'})
        hit = find_reservation(phone)
        if not hit:
            return json_out(self, {'ok': False, 'error': 'not_found'})
        if hit['code'] != code:
            return json_out(self, {'ok': False, 'error': 'bad_code'})

        row_index = -1
        for i in range(len(ORDERS) - 1, -1, -1):
            if str(ORDERS[i][0]).strip() == order_id:
                if norm_phone(ORDERS[i][4]) != phone:
                    return json_out(self, {'ok': False, 'error': 'not_your_order'})
                row_index = i
                break
        if action != '新增' and row_index < 0:
            return json_out(self, {'ok': False, 'error': 'order_not_found'})

        status = '已取消' if action == '取消' else ('已修改' if action == '修改' else '新訂單')
        row = [
            order_id, status, action, body.get('name', ''), phone,
            body.get('pickup', ''), body.get('headcount', ''),
            body.get('sets', ''), body.get('setsTotal', ''), body.get('alacarte', ''),
            body.get('alacarteTotal', ''), body.get('service', ''), body.get('total', ''),
            body.get('note', ''), body.get('ts', ''),
        ]
        if row_index >= 0:
            ORDERS[row_index] = row
            return json_out(self, {'ok': True, 'orderId': order_id, 'mode': 'updated',
                                   'row': row_index + 2, 'status': status})
        ORDERS.append(row)
        return json_out(self, {'ok': True, 'orderId': order_id, 'mode': 'created',
                               'row': len(ORDERS) + 1, 'status': status})

    def log_message(self, *a):
        pass


if __name__ == '__main__':
    print(f'mock Apps Script 跑在 http://127.0.0.1:{PORT}/exec')
    print('訂位名單：0912345678/1234 (王小明)、0987654321/5678 (陳大文)')
    ThreadingHTTPServer(('127.0.0.1', PORT), Handler).serve_forever()
