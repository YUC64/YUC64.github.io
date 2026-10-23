#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""用饗泰多官方網站（siammore.com.tw）的菜色照片取代圖庫佔位圖。

流程：
  1. 抓 /zh-TW/menu/menuSingle 與 /zh-TW/menu/menuSet 的原始 HTML
  2. 解析出「菜名 → 官方圖片網址 → 官方價格」
  3. 依 data.js 的圖片 key 對應下載、轉成 <1100px JPEG 存到 assets/img/
  4. 更新 assets/img/credits.json，記錄來源與版權（© 饗賓餐旅股份有限公司）

用法：python scripts/fetch-official-photos.py [--check]     # --check 只比對不下載
"""
import json
import os
import re
import sys
import time
import urllib.parse

import requests
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG_DIR = os.path.join(ROOT, "assets", "img")
BASE = "https://www.siammore.com.tw"
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36"}
PAGES = {"menusingle": "/zh-TW/menu/menuSingle", "menuset": "/zh-TW/menu/menuSet"}

# data.js 的圖片 key → 官方網站上的菜名（None = 官網沒有這道，保留原圖）
KEY_TO_DISH = {
    "beefsalad": "香煎瀑布牛涼拌", "seafoodsalad": "酸辣海鮮涼拌", "somitam": "現搗青木瓜涼拌",
    "massaman": None,                                  # 官網已無此菜
    "shortrib": "泰香炙烤牛小排", "stirfrybeef": "爆爽辣炒牛", "oysterbeef": "蠔氣爆炒牛",
    "spareribs": "秘醬炙烤肋排", "krapao": "扒飯打拋豬", "porkneck": "香烤松阪豬",
    "yellowcurry": "黃金咖哩雞", "crispychicken": "咔滋椒麻雞", "panang": "帕能咖哩雞",
    "fishcake": "冠軍月亮蝦餅", "softshell": "黃咖哩軟殼蟹", "halibut": "檸香蒸扁鱈",
    "squid": "【分店限定】檸香酸辣小卷（小）",
    "omelette": "厚煎海鮮烘蛋", "shrimpegg": "泰滑蝦扯蛋", "tofupot": "金湯椰香豆腐煲",
    "watermimosa": "泰香炒野蓮", "mixedveg": "泰炒什錦蔬菜", "peashoots": None,   # 官網無
    "tomyam": "冬蔭海鮮湯", "cornshrimp": "蝦仁玉米湯", "tomkha": "香茅椰肉蛤蜊雞湯",
    "sourtomsoup": "青檸酸辣海鮮湯",
    "vegsomtam": "蛋素青木瓜涼拌", "waterlily": None, "vegmixed": "清炒什錦蔬菜",
    "mushroomsoup": "鮮菇玉米湯", "mushroomcoconut": "香茅椰肉野菇湯",
    "momo": "摩摩喳喳", "blackrice": "椰香黑糯米(冷/熱)",
    "thaitea": "泰式奶茶(冰/熱)", "lemontea": "檸檬茶", "lycheetea": "荔枝冰茶啵啵",
    "changbeer": "泰象啤酒", "craftbeer": "臺虎嗨啤", "cola": "可樂",
    "rice": "泰國香米飯", "shrimppaste_rice": "蒜酥松阪蝦醬拌飯",
    "lemonfish": "清香檸檬魚",                          # 套餐特選（清香檸檬魚）
}

SET_IMAGES = {
    "set2": "【二人套餐】4菜．2飲料",
    "set4": "【四人套餐】6菜．1湯．4飲料．4甜點",
    "set6": "【六人套餐】8菜．1湯．6飲料．6甜點",
    "set8": "【八人套餐】11菜．1湯．8飲料．8甜點",
    "set10": "【十人套餐】11菜．2湯．10飲料．10甜點",
}


def fetch_page(folder, path):
    r = requests.get(BASE + path, headers=UA, timeout=40)
    r.raise_for_status()
    return r.text


def parse_menu(html_text, folder):
    """回傳 {菜名: {img, price}}；優先採用 .jpeg 實照，跳過分類用的 Hover_IMG.png"""
    out = {}
    for m in re.finditer(r'<img src="(/storage/website/%s/[^"]+)"[^>]*alt="([^"]*)"' % folder, html_text):
        src = m.group(1)
        if "_Hover_IMG" in src or src.lower().endswith(".png"):
            continue
        tail = html_text[m.end():m.end() + 1400]
        price = re.search(r'<div class="price">\s*<span>\$?([\d,]+)', tail)
        name = re.search(r'<h5>([^<]+)</h5>', tail)
        dish = (name.group(1).strip() if name else m.group(2).strip())
        out.setdefault(dish, {"img": src, "price": price.group(1) if price else None,
                              "alt": m.group(2).strip()})
    return out


def download(src, dest):
    url = src if src.startswith("http") else BASE + urllib.parse.quote(src)
    for attempt in range(3):
        r = requests.get(url, headers=UA, timeout=60)
        if r.status_code == 200:
            break
        time.sleep(2)
    r.raise_for_status()
    tmp = dest + ".tmp"
    with open(tmp, "wb") as fh:
        fh.write(r.content)
    im = Image.open(tmp).convert("RGB")
    if im.width > 1100:
        im = im.resize((1100, round(im.height * 1100 / im.width)), Image.LANCZOS)
    im.save(dest, "JPEG", quality=85, optimize=True)
    os.remove(tmp)
    return im.size


def main():
    check_only = "--check" in sys.argv
    dishes, sets = {}, {}
    for folder, path in PAGES.items():
        html_text = fetch_page(folder, path)
        parsed = parse_menu(html_text, folder)
        (dishes if folder == "menusingle" else sets).update(parsed)
        print(f"解析 {path}：{len(parsed)} 筆")

    credits_path = os.path.join(IMG_DIR, "credits.json")
    credits = json.load(open(credits_path, encoding="utf-8")) if os.path.exists(credits_path) else {}

    print("\n--- 單點 ---")
    ok = miss = 0
    for key, dish in KEY_TO_DISH.items():
        if dish is None:
            print(f"  ⏭  {key:18} 官網沒有這道，保留原圖")
            continue
        hit = dishes.get(dish)
        if not hit:
            print(f"  ✗ {key:18} 找不到「{dish}」")
            miss += 1
            continue
        if check_only:
            print(f"  ✓ {key:18} {dish} (${hit['price']}) {hit['img'].split('/')[-1]}")
            ok += 1
            continue
        size = download(hit["img"], os.path.join(IMG_DIR, key + ".jpg"))
        credits[key] = {"file": key + ".jpg", "title": dish, "officialPrice": hit["price"],
                        "license": "© 饗賓餐旅股份有限公司（饗泰多官網素材）",
                        "artist": "饗泰多 SIAM MORE", "source": BASE + hit["img"], "size": list(size)}
        print(f"  ✓ {key:18} {dish} (${hit['price']}) {size[0]}×{size[1]}")
        ok += 1
        time.sleep(0.3)

    print("\n--- 套餐 ---")
    for key, name in SET_IMAGES.items():
        hit = sets.get(name) or next((v for k, v in sets.items() if k.startswith(name[:5])), None)
        if not hit:
            print(f"  ✗ {key} 找不到「{name}」")
            continue
        if check_only:
            print(f"  ✓ {key} {name} {hit['img'].split('/')[-1]}")
            continue
        size = download(hit["img"], os.path.join(IMG_DIR, key + ".jpg"))
        credits[key] = {"file": key + ".jpg", "title": name,
                        "license": "© 饗賓餐旅股份有限公司（饗泰多官網素材）",
                        "artist": "饗泰多 SIAM MORE", "source": BASE + hit["img"], "size": list(size)}
        print(f"  ✓ {key} {name} {size[0]}×{size[1]}")
        time.sleep(0.3)

    if not check_only:
        json.dump(credits, open(credits_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1, sort_keys=True)
        print(f"\n已更新 credits.json（{len(credits)} 筆）")
    print(f"\n成功 {ok}，缺 {miss}")


if __name__ == "__main__":
    main()
