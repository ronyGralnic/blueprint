#!/usr/bin/env python3
"""Open Graph cards (1200×630) from kit/og-template.html, rendered with headless Chrome.

  python3 tools/og.py          -> assets/og.png (site card)
  python3 tools/og.py <ID>     -> items/<ID>/og.png
"""
import asyncio, html, json, pathlib, sys
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
CHROME = "/usr/bin/google-chrome" if pathlib.Path("/usr/bin/google-chrome").exists() else None
BLUEPRINT_CSS = """
  :root{--og-bg:#0b1830;--og-ink:#eef4ff;--og-muted:#a9bddf;--og-accent:#7cb6ff;--og-line:rgba(124,182,255,.55);
  --og-pattern:linear-gradient(rgba(124,182,255,.13) 1px,transparent 1px),linear-gradient(90deg,rgba(124,182,255,.13) 1px,transparent 1px),
  linear-gradient(rgba(124,182,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(124,182,255,.06) 1px,transparent 1px)}
  .bg{background-size:120px 120px,120px 120px,24px 24px,24px 24px}
"""

def fill(site, title, subtitle, footer, metric, metric_label):
    tpl = (ROOT / "kit" / "og-template.html").read_text(encoding="utf-8")
    size = 64 if len(title) <= 34 else 54
    rep = {"{{SITE}}": site, "{{TITLE}}": html.escape(title), "{{SUBTITLE}}": html.escape(subtitle),
           "{{FOOTER}}": html.escape(footer), "{{METRIC}}": html.escape(metric), "{{METRIC_LABEL}}": html.escape(metric_label),
           "{{TITLE_SIZE}}": str(size), "{{EXTRA_CSS}}": BLUEPRINT_CSS}
    for k, v in rep.items(): tpl = tpl.replace(k, v)
    return tpl

async def render(page_html, out):
    tmp = ROOT / "kit" / "_og_tmp.html"
    tmp.write_text(page_html, encoding="utf-8")
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"]) if CHROME else await p.chromium.launch()
            pg = await b.new_page(viewport={"width": 1200, "height": 630})
            await pg.goto(tmp.as_uri()); await pg.evaluate("document.fonts.ready"); await pg.wait_for_timeout(300)
            await pg.screenshot(path=str(out)); await b.close()
    finally:
        tmp.unlink(missing_ok=True)
    print("wrote", out)

def main():
    if len(sys.argv) > 1:
        iid = sys.argv[1]; it = json.loads((ROOT / "items" / iid / "item.json").read_text(encoding="utf-8"))
        h = fill("BLUEPRINT · SYSTEM DESIGN", it["title"], it["summary"], f'{it["sheet"]} · {it["issue"]}',
                 it["keyMetric"]["value"], it["keyMetric"]["label"])
        asyncio.run(render(h, ROOT / "items" / iid / "og.png"))
    else:
        h = fill("BLUEPRINT · SYSTEM DESIGN", "תכנון מערכות מתוך החדשות",
                 "סיפור חדשותי אחד, שאלת System Design אחת: דרישות, חישוב גס, ארכיטקטורה שנבנית בגלילה, ומה נשבר בפי 10.",
                 "ronygralnic.github.io/blueprint", "×10", "מה נשבר ראשון")
        asyncio.run(render(h, ROOT / "assets" / "og.png"))

if __name__ == "__main__":
    main()
