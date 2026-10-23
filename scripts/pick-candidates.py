#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Download several Wikimedia Commons candidates per menu key into candidates/,
then build contact sheets so a human (or the agent) can pick the best photo.

After picking, copy the winner over assets/img/<key>.jpg and re-run
`python scripts/rebuild-credits.py` (or edit credits.json).
"""
import json
import os
import re
import sys
import time

import requests
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAND = os.path.join(ROOT, "candidates")
API = "https://commons.wikimedia.org/w/api.php"
UA = {"User-Agent": "XiangTaiDuo-Preorder/1.0 (school project; contact: Yuchen0614)"}

QUERIES = {
    "set2":  ["Thai food spread table dishes", "Thai cuisine dishes assortment"],
    "set4":  ["Thai restaurant table dishes", "Thai meal set many dishes"],
    "set6":  ["Thai food table variety dishes", "Thai banquet dishes table"],
    "set8":  ["Thai cuisine assortment table food", "Thai dinner table dishes"],
    "set10": ["Thai food feast table", "Thai banquet dishes"],
    "vegmixed": ["Stir fried mixed vegetables", "Pad pak ruam", "Chinese stir fried vegetables plate"],
    "vegsomtam": ["Green papaya salad plate", "Som tam salad bowl", "Papaya salad Thai vegetarian"],
    "waterlily": ["Ipomoea aquatica stir fried", "Stir fried water spinach dish", "Water snowflake stem vegetable"],
    "yellowcurry": ["Yellow curry chicken Thai", "Kaeng kari", "Thai yellow curry bowl"],
    "softshell": ["Soft shell crab fried", "Soft shell crab curry Thai", "Deep fried soft shell crab"],
    "lemonfish": ["Steamed fish with lime Thai", "Pla neung manao", "Steamed whole sea bass dish"],
    "cornshrimp": ["Sweet corn soup bowl", "Corn soup egg drop", "Creamy corn soup"],
    "crispychicken": ["Thai fried chicken", "Kai tod fried chicken", "Crispy fried chicken plate Asian"],
    "halibut": ["Steamed fish fillet plate", "Steamed fish with lemon sauce", "Fish fillet steamed vegetables"],
    "hero": ["Thai food table spread", "Thai cuisine dishes table top"],
}


def api(params):
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


def search(query, limit=6):
    data = api({"action": "query", "generator": "search", "gsrsearch": query,
                "gsrnamespace": 6, "gsrlimit": limit, "prop": "imageinfo",
                "iiprop": "url|size|extmetadata|mime", "iiurlwidth": 1100})
    out = []
    for page in ((data.get("query") or {}).get("pages") or {}).values():
        info = (page.get("imageinfo") or [{}])[0]
        if info.get("mime") not in ("image/jpeg", "image/png"):
            continue
        if (info.get("width") or 0) < 700:
            continue
        ex = info.get("extmetadata") or {}
        out.append({"title": page["title"], "thumb": info.get("thumburl") or info.get("url"),
                    "page": info.get("descriptionurl"),
                    "license": (ex.get("LicenseShortName") or {}).get("value", "?"),
                    "artist": re.sub(r"<[^>]+>", "", (ex.get("Artist") or {}).get("value", "?"))[:100]})
    return out


def grab(url, path):
    delay = 3.0
    for _ in range(5):
        r = requests.get(url, headers=UA, timeout=60)
        if r.status_code != 429:
            break
        time.sleep(delay)
        delay *= 2
    r.raise_for_status()
    open(path + ".tmp", "wb").write(r.content)
    im = Image.open(path + ".tmp").convert("RGB")
    if im.width > 1000:
        im = im.resize((1000, round(im.height * 1000 / im.width)), Image.LANCZOS)
    im.save(path, "JPEG", quality=82, optimize=True)
    os.remove(path + ".tmp")


def main():
    only = sys.argv[1].split(",") if len(sys.argv) > 1 and not sys.argv[1].startswith("-") else None
    os.makedirs(CAND, exist_ok=True)
    index = []
    for key, queries in QUERIES.items():
        if only and key not in only:
            continue
        seen, n = set(), 0
        for q in queries:
            if n >= 4:
                break
            try:
                cands = search(q)
            except Exception as exc:  # noqa: BLE001
                print("QUERY-FAIL", key, q, exc)
                continue
            for c in cands:
                if n >= 4:
                    break
                if c["title"] in seen:
                    continue
                seen.add(c["title"])
                n += 1
                dest = os.path.join(CAND, f"{key}_{n}.jpg")
                try:
                    grab(c["thumb"], dest)
                except Exception as exc:  # noqa: BLE001
                    print("DL-FAIL", key, n, exc)
                    continue
                index.append(dict(key=key, n=n, file=f"{key}_{n}.jpg", **c))
            time.sleep(1.0)
        print("KEY", key, "candidates", n)

    ipath = os.path.join(CAND, "index.json")
    old = json.load(open(ipath, encoding="utf-8")) if os.path.exists(ipath) else []
    keep = [x for x in old if x["key"] not in {i["key"] for i in index}]
    json.dump(keep + index, open(ipath, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    # contact sheets: one per 8 keys
    keys = sorted({i["key"] for i in index})
    COLS, CELL = 4, 340
    for si in range(0, len(keys), 8):
        chunk = keys[si:si + 8]
        rows = len(chunk)
        sheet = Image.new("RGB", (COLS * CELL, rows * (CELL + 26)), (255, 255, 255))
        d = ImageDraw.Draw(sheet)
        for r, k in enumerate(chunk):
            for c in range(COLS):
                p = os.path.join(CAND, f"{k}_{c+1}.jpg")
                if not os.path.exists(p):
                    continue
                im = Image.open(p).convert("RGB")
                im.thumbnail((CELL - 8, CELL - 8))
                x, y = c * CELL, r * (CELL + 26)
                sheet.paste(im, (x + 4, y + 4))
                d.text((x + 8, y + CELL + 6), f"{k}_{c+1}", fill=(0, 0, 0))
        out = os.path.join(CAND, f"sheet_{si // 8 + 1}.png")
        sheet.save(out)
        print("SHEET", out, sheet.size)


if __name__ == "__main__":
    main()
