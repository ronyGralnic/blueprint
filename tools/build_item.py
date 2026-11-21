#!/usr/bin/env python3
"""Build one Blueprint item from items/<ID>/item.json.

Generates:
  items/<ID>/index.html   from tools/item-template.html (static meta for crawlers)
  items/<ID>/data.js      window.DESK_ITEM  (lets the page work from file://)
  items/index.json        gallery entry upserted (source of truth for the gallery)
  items/data.js           window.DESK_INDEX (generated from items/index.json)

Usage: python3 tools/build_item.py <ID>
JSON is the source; never edit data.js by hand.
"""
import html, json, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = "blueprint"

def main(item_id):
    d = ROOT / "items" / item_id
    item = json.loads((d / "item.json").read_text(encoding="utf-8"))
    assert item["id"] == item_id, "id mismatch"

    tpl = (ROOT / "tools" / "item-template.html").read_text(encoding="utf-8")
    page = (tpl.replace("{{ID}}", html.escape(item_id))
               .replace("{{TITLE}}", html.escape(item["title"]))
               .replace("{{DESC}}", html.escape(item["summary"])))
    (d / "index.html").write_text(page, encoding="utf-8")
    (d / "data.js").write_text("/* generated from item.json by tools/build_item.py */\nwindow.DESK_ITEM = "
                               + json.dumps(item, ensure_ascii=False) + ";\n", encoding="utf-8")

    idx_path = ROOT / "items" / "index.json"
    idx = json.loads(idx_path.read_text(encoding="utf-8")) if idx_path.exists() else {"site": SITE, "format": "SD", "items": []}
    entry = {k: item.get(k) for k in ("id", "issue", "sheet", "title", "subtitle", "summary", "region", "country", "domain", "tags", "keyMetric")}
    entry["og"] = f"items/{item_id}/og.png"
    idx["items"] = [e for e in idx["items"] if e["id"] != item_id] + [entry]
    idx["items"].sort(key=lambda e: e["id"])
    idx_path.write_text(json.dumps(idx, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (ROOT / "items" / "data.js").write_text("/* generated from items/index.json by tools/build_item.py */\nwindow.DESK_INDEX = "
                                            + json.dumps(idx, ensure_ascii=False) + ";\n", encoding="utf-8")
    print(f"built {item_id}: index.html, data.js; index has {len(idx['items'])} item(s)")

if __name__ == "__main__":
    main(sys.argv[1])
