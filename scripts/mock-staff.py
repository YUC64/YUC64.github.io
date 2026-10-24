#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""本機模擬「員工看板 API」，用來離線測試 staff.html
   python scripts/mock-staff.py 8790
   GET /exec?staff=1&pw=SIAMMORE2027
"""
import json
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs

PW = 'SIAMMORE2027'

ORDERS = [
    dict(orderId='XT2610241210345', status='已取消', action='取消', name='張志豪', phone='0955666777',
         pickup='2027-02-06 18:00', headcount='2',
         sets='【二人套餐】春節雙人饗宴', setsTotal=1760,
         alacarte='', alacarteTotal=0, service=176, total=1936,
         note='客人臨時取消', updated='2026/10/24 下午 12:31:02'),
    dict(orderId='XT2610241205865', status='新訂單', action='新增', name='王小明', phone='0912345678',
         pickup='2027-02-06 11:30', headcount='6',
         sets='【六人套餐】泰香炙烤牛小排 ｜ 冠軍月亮蝦餅 ｜ 蝦醬高麗菜 ｜ 冬蔭功湯',
         setsTotal=5280, alacarte='摩摩喳喳（冰）x2、泰式奶茶（熱）x6', alacarteTotal=780,
         service=606, total=6666, note='一位素食，請協助', updated='2026/10/24 下午 12:05:31'),
    dict(orderId='XT2610241211776', status='新訂單', action='新增', name='黃雅婷', phone='0966777888',
         pickup='2027-02-06 19:00', headcount='8',
         sets='【八人套餐】泰式檸檬魚 ｜ 綠咖哩雞 ｜ 椒麻雞 ｜ 炒河粉 ｜ 酸辣湯',
         setsTotal=6980, alacarte='', alacarteTotal=0,
         service=698, total=7678, note='無', updated='2026/10/24 下午 12:40:19'),
    dict(orderId='XT2610241209130', status='已修改', action='修改', name='陳大文', phone='0987654321',
         pickup='2027-02-06 12:00', headcount='4',
         sets='【四人套餐】黃咖哩軟殼蟹 ｜ 檸香酸辣小卷 ｜ 炒什錦蔬菜 ｜ 香茅湯',
         setsTotal=3280, alacarte='香菜花生春捲 x1', alacarteTotal=180,
         service=346, total=3806, note='先去冰', updated='2026/10/24 下午 12:12:08'),
    dict(orderId='XT2610241209902', status='新訂單', action='新增', name='林怡君', phone='0922333444',
         pickup='2027-02-06 17:30', headcount='10',
         sets='【十人套餐】泰香炙烤牛小排 x2 ｜ 月亮蝦餅 x2 ｜ 檸檬魚 ｜ 打拋豬 ｜ 綠咖哩雞',
         setsTotal=9880, alacarte='泰象啤酒 x10', alacarteTotal=1200,
         service=1108, total=12188, note='需兒童座椅 2 張', updated='2026/10/24 下午 12:20:45'),
]

class H(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')

    def do_GET(self):
        u = urlparse(self.path)
        q = parse_qs(u.query)
        g = lambda k: (q.get(k) or [''])[0]

        if g('staff'):
            if g('pw') != PW:
                out = {'ok': False, 'error': 'bad_password', 'remaining': 19}
            else:
                out = {'ok': True, 'count': len(ORDERS), 'orders': ORDERS,
                       'updatedAt': '2026-10-24T12:45:00+08:00'}
        else:
            out = {'ok': False, 'error': 'bad_phone'}

        body = json.dumps(out, ensure_ascii=False).encode('utf-8')
        self.send_response(200)
        self._cors()
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *a):
        pass

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8790
    print(f'mock staff API on http://127.0.0.1:{port}/exec  (pw={PW})')
    HTTPServer(('127.0.0.1', port), H).serve_forever()
