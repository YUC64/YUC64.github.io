#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Fetch free-licensed dish photos from Wikimedia Commons into assets/img/.

Each menu item maps to one or more Commons search queries. For every item we
query the Commons search API, prefer candidates whose file title contains the
primary keyword, download a ~1000px thumbnail, convert to JPEG, and record
attribution metadata in assets/img/credits.json.

Usage:  python scripts/fetch-images.py [--only key1,key2] [--force]
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
OUT = os.path.join(ROOT, "assets", "img")
API = "https://commons.wikimedia.org/w/api.php"
UA = {"User-Agent": "XiangTaiDuo-Preorder/1.0 (school project; contact: Yuchen0614)"}

# key -> (primary keyword for title ranking, [queries])
TARGETS = {
    # ---- 套餐代表圖 ----
    "set2":   ("fish cake",   ["Thai fish cakes tod mun", "tod mun pla"]),
    "set4":   ("curry",       ["Thai green curry chicken", "gaeng khiao wan"]),
    "set6":   ("tom yum",     ["Tom yum goong", "tom yam kung"]),
    "set8":   ("steamed fish", ["Steamed fish Thai style lemon", "pla neung manao"]),
    "set10":  ("pork ribs",   ["Grilled pork ribs Thai", "grilled ribs barbecue"]),
    "oysterbeef": ("beef", ["Stir fried beef oyster sauce", "beef with vegetables stir fry"]),
    "lemonfish": ("fish", ["Pla neung manao", "Steamed fish with lime and garlic", "Whole steamed fish dish"]),
    "ribs10": ("ribs", ["Barbecue pork ribs platter", "Chinese braised pork ribs dish"]),
    "hero": ("thai", ["Thai food table spread", "Thai cuisine dishes table"]),
    # ---- 涼拌 ----
    "beefsalad": ("nam tok",   ["Nam tok Thai beef salad", "Thai grilled beef salad"]),
    "seafoodsalad": ("yam talay", ["Yam talay Thai seafood salad", "Thai spicy seafood salad"]),
    "somitam": ("som tam",     ["Som tam green papaya salad", "papaya pok pok"]),
    # ---- 牛肉 ----
    "massaman": ("massaman",   ["Massaman curry beef", "gaeng massaman"]),
    "shortrib": ("ribs",       ["Grilled beef short ribs", "Korean grilled beef ribs"]),
    "stirfrybeef": ("kaphrao", ["Pad kaphrao beef", "Thai basil stir fried beef"]),
    # ---- 豬肉 ----
    "spareribs": ("ribs",      ["Grilled pork ribs", "barbecued pork ribs dish"]),
    "krapao": ("kra pao",      ["Pad kra pao pork rice", "Thai basil pork rice"]),
    "porkneck": ("moo yang",   ["Kor moo yang grilled pork neck", "grilled pork neck Thai"]),
    # ---- 雞肉 ----
    "yellowcurry": ("yellow curry", ["Thai yellow curry chicken", "gaeng kari"]),
    "crispychicken": ("fried chicken", ["Thai fried chicken", "crispy fried chicken plate"]),
    "panang": ("phanaeng",     ["Phanaeng curry chicken", "panang curry"]),
    # ---- 海鮮 ----
    "fishcake": ("fish cake",  ["Thai fish cakes", "tod mun pla fish cake"]),
    "softshell": ("soft shell crab", ["Soft shell crab curry Thai", "crispy soft shell crab"]),
    "halibut": ("steamed fish", ["Steamed fish with lemon Thai", "steamed fish dish"]),
    "squid": ("squid",         ["Grilled squid Thai", "Thai spicy squid salad"]),
    # ---- 蛋豆腐 ----
    "omelette": ("omelette",   ["Thai omelette kai chiao", "Thai style omelette"]),
    "shrimpegg": ("omelette",  ["Shrimp omelette", "prawn omelette Asian"]),
    "tofupot": ("tofu",        ["Tofu coconut curry", "Thai tofu claypot"]),
    # ---- 青菜 ----
    "watermimosa": ("morning glory", ["Stir fried morning glory", "pak boong fai daeng"]),
    "mixedveg": ("vegetables", ["Stir fried mixed vegetables Thai", "pad pak ruam"]),
    "peashoots": ("pea shoots", ["Stir fried pea shoots", "dau miao vegetables"]),
    # ---- 湯品 ----
    "tomyam": ("tom yum",      ["Tom yum goong soup", "tom yam kung"]),
    "cornshrimp": ("corn soup", ["Sweet corn soup", "shrimp corn soup"]),
    "tomkha": ("tom kha",      ["Tom kha kai coconut chicken soup", "tom kha gai"]),
    "sourtomsoup": ("tom yum", ["Tom yum seafood clear soup", "tom yum soup"]),
    # ---- 素食 ----
    "vegsomtam": ("papaya",    ["Vegetarian green papaya salad", "green papaya salad"]),
    "waterlily": ("water spinach", ["Stir fried water spinach", "water snowflake vegetable"]),
    "vegmixed": ("vegetables", ["Stir fried vegetables Chinese", "vegetable stir fry"]),
    "mushroomsoup": ("mushroom soup", ["Mushroom soup clear", "Asian mushroom soup"]),
    "mushroomcoconut": ("tom kha", ["Tom kha mushroom coconut soup", "coconut mushroom soup"]),
    # ---- 甜點 ----
    "momo": ("dessert",        ["Tub tim krob Thai dessert", "Thai dessert rubies coconut"]),
    "blackrice": ("sticky rice", ["Black sticky rice coconut Thai", "khao niao dam"]),
    # ---- 飲料 ----
    "thaitea": ("thai tea",    ["Thai tea drink", "cha yen Thai iced tea"]),
    "lemontea": ("lemon tea",  ["Iced lemon tea", "lemon iced tea glass"]),
    "lycheetea": ("iced tea",  ["Lychee iced tea", "bubble tea lychee"]),
    "changbeer": ("beer",      ["Chang beer Thailand", "Thai beer bottle glass"]),
    "craftbeer": ("beer",      ["Draft beer glass", "craft beer pour glass"]),
    "cola": ("cola",           ["Cola glass drink", "Coca Cola glass"]),
    # ---- 主食 ----
    "rice": ("jasmine rice",   ["Jasmine rice bowl", "cooked white rice bowl"]),
    "shrimppaste_rice": ("rice", ["Khao kluk kapi", "shrimp paste fried rice"]),
}


def api(params):
    """GET the Commons API, backing off hard on HTTP 429 (rate limit)."""
    params = dict(params, format="json")
    delay = 3.0
    for attempt in range(5):
        try:
            r = requests.get(API, params=params, headers=UA, timeout=30)
            if r.status_code == 429:
                raise requests.HTTPError("429")
            r.raise_for_status()
            return r.json()
        except Exception:  # noqa: BLE001
            if attempt == 4:
                raise
            time.sleep(delay)
            delay *= 2
    return {}


def search(query, limit=8):
    data = api({
        "action": "query", "generator": "search", "gsrsearch": query,
        "gsrnamespace": 6, "gsrlimit": limit,
        "prop": "imageinfo", "iiprop": "url|size|extmetadata|mime",
        "iiurlwidth": 1100,
    })
    pages = (data.get("query") or {}).get("pages") or {}
    out = []
    for page in pages.values():
        info = (page.get("imageinfo") or [{}])[0]
        if not info or info.get("mime") not in ("image/jpeg", "image/png"):
            continue
        if (info.get("width") or 0) < 700:
            continue
        out.append({
            "title": page["title"],
            "index": page.get("index", 99),
            "thumb": info.get("thumburl") or info.get("url"),
            "page": info.get("descriptionurl"),
            "license": ((info.get("extmetadata") or {}).get("LicenseShortName") or {}).get("value", "?"),
            "artist": re.sub(r"<[^>]+>", "", ((info.get("extmetadata") or {}).get("Artist") or {}).get("value", "?"))[:120],
        })
    return out


def rank(cands, keyword):
    kw = keyword.lower().split()
    def score(c):
        t = c["title"].lower()
        hits = sum(1 for w in kw if w in t)
        return (-hits, c["index"])
    return sorted(cands, key=score)


def download(url, path):
    """Download a thumbnail, backing off on 429 as well."""
    delay, r = 3.0, None
    for attempt in range(5):
        r = requests.get(url, headers=UA, timeout=60)
        if r.status_code != 429:
            break
        time.sleep(delay)
        delay *= 2
    r.raise_for_status()
    tmp = path + ".tmp"
    with open(tmp, "wb") as fh:
        fh.write(r.content)
    im = Image.open(tmp).convert("RGB")
    if im.width > 1100:
        im = im.resize((1100, round(im.height * 1100 / im.width)), Image.LANCZOS)
    im.save(path, "JPEG", quality=82, optimize=True)
    os.remove(tmp)
    return im.size


def main():
    args = sys.argv[1:]
    only = None
    if "--only" in args:
        only = set(args[args.index("--only") + 1].split(","))
    force = "--force" in args
    os.makedirs(OUT, exist_ok=True)
    credits_path = os.path.join(OUT, "credits.json")
    credits = {}
    if os.path.exists(credits_path):
        credits = json.load(open(credits_path, encoding="utf-8"))

    fails, ok = [], []
    for key, (keyword, queries) in TARGETS.items():
        if only and key not in only:
            continue
        dest = os.path.join(OUT, key + ".jpg")
        if os.path.exists(dest) and not force:
            ok.append(key)
            continue
        chosen = None
        for q in queries:
            try:
                cands = search(q)
            except Exception as exc:  # noqa: BLE001
                print("QUERY-FAIL", key, q, exc)
                continue
            for c in rank(cands, keyword):
                chosen = c
                break
            if chosen:
                break
            time.sleep(0.3)
        if not chosen:
            fails.append(key)
            print("NO-MATCH", key, keyword)
            continue
        try:
            size = download(chosen["thumb"], dest)
        except Exception as exc:  # noqa: BLE001
            fails.append(key)
            print("DL-FAIL", key, exc)
            continue
        credits[key] = {
            "file": os.path.basename(dest), "title": chosen["title"],
            "license": chosen["license"], "artist": chosen["artist"],
            "source": chosen["page"], "size": list(size),
        }
        ok.append(key)
        time.sleep(1.2)

    json.dump(credits, open(credits_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1, sort_keys=True)
    print("OK", len(ok), "FAIL", len(fails))
    if fails:
        print("failed keys:", ",".join(fails))


if __name__ == "__main__":
    main()
