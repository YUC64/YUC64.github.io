#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""本機模擬「員工看板 API」，用來離線測試 staff.html
   python scripts/mock-staff.py 8790
   GET /exec?staff=1&pw=8888
"""
import json
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs

PW = '8888'
NL = chr(10)


def L(*parts):
    """把多行內容組成一個字串（避免在原始碼裡寫跳脫字元）"""
    return NL.join(parts)


ORDERS = [
    dict(orderId='XT2610241205865', status='新訂單', action='新增', name='王小明', phone='0912345678',
         pickup='', headcount='6',
         sets=L('春節六人套餐 ×1',
                '　涼拌：酸辣海鮮涼拌',
                '　咖哩：綠咖哩雞',
                '　肉類：泰香炙烤牛小排',
                '　蛋豆腐：打拋豬蛋豆腐',
                '　青菜：蝦醬高麗菜',
                '　湯品：冬蔭功湯',
                '　飲料：泰式奶茶（熱）、荔枝冰茶啵啵（冰）',
                '　內含：清香檸檬魚、冠軍月亮蝦餅',
                '　升級：泰象啤酒'),
         setsTotal=5280, alacarte=L('摩摩喳喳（冰）x2', '泰式奶茶（熱）x6'), alacarteTotal=780,
         service=606, total=6666, note='一位素食，請協助', updated='2026/10/24 下午 12:05:31'),
    dict(orderId='XT2610241209130', status='已修改', action='修改', name='陳大文', phone='0987654321',
         pickup='', headcount='4',
         sets=L('春節四人套餐 ×1',
                '　涼拌：黃咖哩軟殼蟹',
                '　肉類：檸香酸辣小卷',
                '　青菜：炒什錦蔬菜',
                '　湯品：香茅湯',
                '　飲料：泰式奶茶（冰）x4'),
         setsTotal=3280, alacarte='香菜花生春捲 x1', alacarteTotal=180,
         service=346, total=3806, note='先去冰', updated='2026/10/24 下午 12:12:08'),
    dict(orderId='XT2610241209902', status='新訂單', action='新增', name='林怡君', phone='0922333444',
         pickup='', headcount='10',
         sets=L('春節十人套餐 ×1',
                '　涼拌：泰式涼拌海鮮',
                '　肉類：泰香炙烤牛小排',
                '　青菜：蝦醬高麗菜',
                '　湯品：冬蔭功湯',
                '　飲料：泰式奶茶（冰）x10'),
         setsTotal=9880, alacarte='泰象啤酒 x10', alacarteTotal=1200,
         service=1108, total=12188, note='需兒童座椅 2 張', updated='2026/10/24 下午 12:20:45'),
    dict(orderId='XT2610241210345', status='已取消', action='取消', name='張志豪', phone='0955666777',
         pickup='', headcount='2',
         sets='春節雙人套餐 ×1', setsTotal=1760,
         alacarte='', alacarteTotal=0, service=176, total=1936,
         note='客人臨時取消', updated='2026/10/24 下午 12:31:02'),
    dict(orderId='XT2610241211776', status='新訂單', action='新增', name='黃雅婷', phone='0966777888',
         pickup='', headcount='8',
         sets=L('春節八人套餐 ×1',
                '　肉類：泰式檸檬魚',
                '　青菜：炒河粉',
                '　湯品：酸辣湯',
                '　飲料：荔枝冰茶啵啵（去冰）x8'),
         setsTotal=6980, alacarte='', alacarteTotal=0,
         service=698, total=7678, note='無', updated='2026/10/24 下午 12:40:19'),
]


class H(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')

    def do_GET(self):
        u = urlparse(self.path)
        q = parse_qs(u.query)

        def g(k):
            return (q.get(k) or [''])[0]

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
    print('mock staff API on http://127.0.0.1:%d/exec  (pw=%s)' % (port, PW))
    HTTPServer(('127.0.0.1', port), H).serve_forever()
