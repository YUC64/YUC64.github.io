#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""把饗泰多官網的菜品介紹文案，加進 js/data.js 的單點品項（desc 欄位）。

來源：scripts/fetch-official-photos.py 抓下來的菜單頁（或直接用快取的 siam_menu.json）。
官網文案是餐廳自己的內容，只取單點品項、截短到 90 字，避免卡片太長。
"""
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.environ.get("SIAM_MENU_JSON", r"C:\Users\user\AppData\Local\Temp\siam_menu.json")

def norm(name):
    return re.sub(r"[（(][^）)]*[）)]", "", name).replace(" ", "").strip()

def main():
    menu = json.load(open(CACHE, encoding="utf-8"))
    desc = {}
    for it in menu["single"]:
        text = (it.get("desc") or "").strip()
        if len(text) > 8 and it["name"] not in desc:
            desc[it["name"]] = text
    idx = {norm(k): v for k, v in desc.items()}
    print(f"官網有文案的菜品：{len(desc)}")

    path = os.path.join(ROOT, "js", "data.js")
    src = open(path, encoding="utf-8").read()

    def clean(text):
        return text.replace("\\", "").replace("'", "\\'")[:90]

    added = [0]

    def repl(match):
        body = match.group(0)
        name = match.group(1)
        if "desc:" in body:
            return body
        text = idx.get(norm(name))
        if not text:
            return body
        added[0] += 1
        return body.replace(f"name: '{name}'", f"name: '{name}', desc: '{clean(text)}'")

    out = re.sub(r"\{ id: 'a\d+',[^}]*?name: '([^']+)'[^}]*?\}", repl, src)
    open(path, "w", encoding="utf-8").write(out)
    print(f"已加入 desc：{added[0]} 筆")

    items = re.findall(r"\{ id: 'a\d+'.*?\}", out)
    missing = [re.search(r"name: '([^']+)'", a).group(1) for a in items if "desc:" not in a]
    print(f"仍無描述：{len(missing)} / {len(items)}")
    for name in missing:
        print("  -", name)

if __name__ == "__main__":
    main()
