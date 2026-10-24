#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""本機模擬 Apps Script（員工看板 + 客人查訂單 + 送出 + 開放修改）
   python scripts/mock-staff.py 8790
"""
import json
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs

PW = '8888'
NL = chr(10)
PHONE = '0937745327'
CODE = '1020'


def L(*parts):
    return NL.join(parts)


ORDERS = [
    dict(orderId='XT2610241205865', status='新訂單', action='新增', name='謝寓臣', phone=PHONE,
         headcount='6', editable=False,
         sets=L('春節六人套餐 ×1', '　涼拌：酸辣海鮮涼拌', '　肉類：泰香炙烤牛小排',
                '　飲料：泰式奶茶（熱）', '　內含：清香檸檬魚、冠軍月亮蝦餅'),
         setsTotal=5280, alacarte=L('摩摩喳喳（冰）x2'), alacarteTotal=260,
         service=554, total=6094, note='一位素食', updated='2026/10/24 12:05'),
    dict(orderId='XT2610241209130', status='新訂單', action='新增', name='陳大文', phone='0987654321',
         headcount='4', editable=False,
         sets=L('春節四人套餐 ×1', '　肉類：黃咖哩軟殼蟹', '　飲料：泰式奶茶（冰）'),
         setsTotal=3280, alacarte='', alacarteTotal=0,
         service=328, total=3608, note='', updated='2026/10/24 12:12'),
    dict(orderId='XT2610241210345', status='已取消', action='取消', name='張志豪', phone='0955666777',
         headcount='2', editable=False,
         sets='春節雙人套餐 ×1', setsTotal=1760, alacarte='', alacarteTotal=0,
         service=176, total=1936, note='客人臨時取消', updated='2026/10/24 12:31'),
]


def pub(o):
    return {k: o[k] for k in ('orderId', 'status', 'action', 'name', 'phone', 'headcount',
                              'sets', 'setsTotal', 'alacarte', 'alacarteTotal',
                              'service', 'total', 'note', 'updated', 'editable')}


class H(BaseHTTPRequestHandler):
    def _send(self, out):
        body = json.dumps(out, ensure_ascii=False).encode('utf-8')
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        q = parse_qs(urlparse(self.path).query)
        g = lambda k: (q.get(k) or [''])[0]

        if g('staff'):
            if g('pw') != PW:
                return self._send({'ok': False, 'error': 'bad_password', 'remaining': 19})
            return self._send({'ok': True, 'count': len(ORDERS), 'orders': [pub(o) for o in ORDERS]})

        if g('mine'):
            if g('code') != CODE:
                return self._send({'ok': False, 'error': 'bad_code'})
            mine = [o for o in ORDERS if o['phone'] == g('phone')]
            return self._send({'ok': True, 'count': len(mine), 'orders': [pub(o) for o in mine]})

        if g('phone'):
            if g('phone') == PHONE and g('code') == CODE:
                return self._send({'ok': True, 'name': '謝寓臣'})
            return self._send({'ok': False, 'error': 'bad_code'})

        return self._send({'ok': False, 'error': 'bad_phone'})

    def do_POST(self):
        n = int(self.headers.get('Content-Length') or 0)
        raw = self.rfile.read(n).decode('utf-8', 'replace')
        try:
            body = json.loads(raw)
        except Exception:
            return self._send({'ok': False, 'error': 'bad_json'})

        # 員工開放／收回
        if 'staffPw' in body:
            if body.get('staffPw') != PW:
                return self._send({'ok': False, 'error': 'bad_password'})
            o = next((x for x in ORDERS if x['orderId'] == body.get('orderId')), None)
            if not o:
                return self._send({'ok': False, 'error': 'order_not_found'})
            o['editable'] = body.get('action') == '開放修改'
            return self._send({'ok': True, 'orderId': o['orderId'], 'editable': o['editable']})

        # 客人送出／修改／取消
        act = body.get('action')
        if act == '新增':
            if any(x['phone'] == body.get('phone') and x['status'] != '已取消' for x in ORDERS):
                return self._send({'ok': False, 'error': 'already_ordered'})
            ORDERS.append(dict(orderId=body.get('orderId'), status='新訂單', action='新增',
                               name=body.get('name'), phone=body.get('phone'),
                               headcount=str(body.get('headcount') or ''), editable=False,
                               sets=body.get('sets'), setsTotal=body.get('setsTotal'),
                               alacarte=body.get('alacarte'), alacarteTotal=body.get('alacarteTotal'),
                               service=body.get('service'), total=body.get('total'),
                               note=body.get('note'), updated='2026/10/24 13:00'))
            return self._send({'ok': True, 'mode': 'created', 'status': '新訂單'})

        o = next((x for x in ORDERS if x['orderId'] == body.get('orderId')), None)
        if not o:
            return self._send({'ok': False, 'error': 'order_not_found'})
        if not o['editable']:
            return self._send({'ok': False, 'error': 'edit_locked'})
        o['editable'] = False
        if act == '取消':
            o['status'] = '已取消'
            o['action'] = '取消'
            return self._send({'ok': True, 'mode': 'updated', 'status': '已取消'})
        o['status'] = '已修改'
        o['action'] = '修改'
        if body.get('total'):
            o['total'] = body.get('total')
        return self._send({'ok': True, 'mode': 'updated', 'status': '已修改'})

    def log_message(self, *a):
        pass


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8790
    print('mock API on http://127.0.0.1:%d/exec  (staff pw=%s, customer %s/%s)' % (port, PW, PHONE, CODE))
    HTTPServer(('127.0.0.1', port), H).serve_forever()
