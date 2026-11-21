#!/usr/bin/env python3
"""Design Doc for one item, Hebrew + English, DOCX + PDF.

  python3 tools/build_docs.py <ID>

Sources: items/<ID>/item.json (Hebrew) and items/<ID>/doc-en.json (English).
Steps: (1) screenshot the full architecture diagram from the live page -> docs/arch.png
       (2) build a block model per language -> docs/_model-<lang>.json (temp)
       (3) DOCX via tools/docx_build.js (npm 'docx'; Arial, RTL for Hebrew)
       (4) PDF via headless Chrome from an HTML render with the kit fonts
Needs: playwright, node + npm 'docx' (installed into tools/node_modules on first run).
"""
import asyncio, html, json, pathlib, re, subprocess, sys
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
TOOLS = ROOT / "tools"
CHROME = "/usr/bin/google-chrome" if pathlib.Path("/usr/bin/google-chrome").exists() else None

def plain(s):
    s = re.sub(r"\[\[[a-z0-9\-]+\|([^\]]+)\]\]", r"\1", s or "")
    return s.replace("`", "")

# ---------- number formatting (mirrors kit.js) ----------
def fnum(n):
    d = 0 if abs(n) >= 100 else 1 if abs(n) >= 10 else 2
    s = f"{n:,.{d}f}"
    return s.rstrip("0").rstrip(".") if "." in s else s
def compact(n):
    for v, u in ((1e12, "T"), (1e9, "B"), (1e6, "M"), (1e3, "K")):
        if abs(n) >= v:
            x = n / v; s = f"{x:.0f}" if x >= 100 else f"{x:.1f}" if x >= 10 else f"{x:.2f}"
            return (s.rstrip("0").rstrip(".") if "." in s else s) + u
    return fnum(n)
def unit_fmt(n, units):
    i = 0
    while abs(n) >= 1000 and i < len(units) - 1: n /= 1000; i += 1
    s = f"{n:.0f}" if n >= 100 else f"{n:.1f}" if n >= 10 else f"{n:.2f}"
    return (s.rstrip("0").rstrip(".") if "." in s else s) + " " + units[i]
def fmt_out(v, f, unit=None):
    if f == "bytes": t = unit_fmt(v, ["B", "KB", "MB", "GB", "TB", "PB"])
    elif f == "bps": t = unit_fmt(v, ["bps", "Kbps", "Mbps", "Gbps", "Tbps"])
    elif f == "compact": t = compact(v)
    else: t = fnum(v)
    return t + (" " + unit if unit else "")

# ---------- model ----------
def model(it, en, lang):
    he = lang == "he"
    T = (lambda h, e: h if he else e)
    vals = {i["id"]: i["value"] for i in it["calc"]["inputs"]}
    B = []
    add = B.append
    src = it["source"]
    add({"t": "title", "text": it["title"] if he else en["title"]})
    add({"t": "subtitle", "text": plain(it["subtitle"]) if he else en["subtitle"]})
    add({"t": "meta", "rows": [
        [T("סטטוס", "Status"), it["doc"]["status"] if he else en["status"]],
        [T("מזהה", "ID"), f'{it["sheet"]} · {it["id"]}'],
        [T("מקור", "Source"), f'The Economist, {src["date"]} · {src["section"]} · "{src["headline"]}"'],
        [T("אתר", "Site"), f'ronygralnic.github.io/blueprint/items/{it["id"]}/']]})
    add({"t": "h1", "text": T("תקציר", "Summary")})
    add({"t": "p", "text": it["doc"]["tldr"] if he else en["tldr"]})
    add({"t": "h1", "text": T("1. הקשר", "1. Context")})
    add({"t": "ul", "items": [plain(x) for x in it["minute"]["points"]] if he else en["context"]})
    add({"t": "h2", "text": T("השאלה", "The question")})
    add({"t": "quote", "text": plain(it["prompt"]["text"]) if he else
         "Design a platform that connects solar and wind generation to a national network of battery-swap stations for heavy trucks. It should charge the stations' battery inventory when there is clean surplus the grid can't absorb, and still guarantee a full battery for every truck that reserved a swap."})
    add({"t": "h1", "text": T("2. מטרות ומה מחוץ לתחום", "2. Goals and non-goals")})
    add({"t": "h3", "text": T("מטרות", "Goals")}); add({"t": "ul", "items": it["doc"]["goals"] if he else en["goals"]})
    add({"t": "h3", "text": T("מחוץ לתחום", "Non-goals")}); add({"t": "ul", "items": [plain(x) for x in it["reqs"]["out"]] if he else en["nongoals"]})
    add({"t": "h1", "text": T("3. דרישות", "3. Requirements")})
    add({"t": "h3", "text": T("פונקציונליות", "Functional")}); add({"t": "ul", "items": [plain(x) for x in it["reqs"]["functional"]] if he else en["functional"]})
    add({"t": "h3", "text": T("לא־פונקציונליות", "Non-functional")}); add({"t": "ul", "items": [plain(x) for x in it["reqs"]["nonfunctional"]] if he else en["nonfunctional"]})

    add({"t": "h1", "text": T("4. חישוב גס", "4. Back-of-envelope estimates")})
    add({"t": "p", "text": T("ערכי ברירת המחדל של המחוונים בעמוד. כל הנחה מסומנת במקור שלה.", "Default values of the page's sliders. Every input is tagged with its source.")})
    kinds = {"report": T("מהדיווח", "reported"), "assume": T("הנחה", "assumption"), "calc": T("חישוב", "calculation")}
    rows = []
    for i in it["calc"]["inputs"]:
        v = compact(i["value"]) if i.get("fmt") == "compact" else fnum(i["value"])
        rows.append([plain(i["label"]) if he else en["inputs"][i["id"]], v + (" " + i["unit"] if i.get("unit") else ""), kinds[i["src"]["kind"]]])
    add({"t": "table", "head": [T("קלט", "Input"), T("ערך", "Value"), T("מקור", "Source")], "rows": rows, "widths": [50, 22, 28], "ltrcols": [1]})
    rows = []
    for o in it["calc"]["outputs"]:
        v = eval(o["expr"], {"__builtins__": {}}, dict(vals))
        lbl, how = (plain(o["label"]), plain(o["how"])) if he else en["outputs"][o["id"]]
        rows.append([lbl, fmt_out(v, o["fmt"], o.get("unit")), how])
    add({"t": "table", "head": [T("תוצאה", "Result"), T("ערך", "Value"), T("איך", "How")], "rows": rows, "widths": [30, 18, 52], "ltrcols": [1]})
    add({"t": "p", "text": plain(it["calc"]["note"]) if he else en["estNote"]})

    add({"t": "h1", "text": T("5. API ומודל נתונים", "5. API and data model")})
    add({"t": "p", "text": plain(it["api"]["intro"]) if he else en["apiIntro"]})
    add({"t": "table", "head": [T("פעולה", "Endpoint"), T("תיאור", "Description")],
         "rows": [[f'{e["m"]} {e["p"]}', plain(e["d"]) if he else en["endpoints"][k]] for k, e in enumerate(it["api"]["endpoints"])],
         "widths": [42, 58], "ltrcols": [0]})
    for e in it["api"]["endpoints"]:
        if e.get("ex"): add({"t": "code", "title": f'{e["m"]} {e["p"]}', "text": e["ex"]})
    for m in it["api"]["models"]:
        add({"t": "h3", "text": f'{m["name"]} · {m["kind"]}', "ltr": True})
        add({"t": "table", "head": [T("שדה", "Field"), T("משמעות", "Meaning")],
             "rows": [[f[0] + (" (PK)" if len(f) > 2 and f[2] else ""), plain(f[1]) if he else ""] for f in m["fields"]] if he else
                     [[f[0] + (" (PK)" if len(f) > 2 and f[2] else ""), EN_FIELD.get(f[0], "")] for f in m["fields"]],
             "widths": [42, 58], "ltrcols": [0]})
        note = (plain(m["note"]) if he else en["modelNotes"].get(m["name"])) if m.get("note") else None
        if note: add({"t": "p", "text": note, "small": True})

    add({"t": "h1", "text": T("6. ארכיטקטורה", "6. Architecture")})
    add({"t": "image", "path": "arch.png", "caption": plain(it["arch"]["title"]) if he else "Architecture: generation sites → data pipeline and forecast → charge scheduler → stations and drivers"})
    add({"t": "p", "text": T("הרכיבים לפי סדר ההוספה, עם הסיבה לקיום של כל אחד.", en["archIntro"])})
    for k, st in enumerate(it["arch"]["steps"]):
        title, text, why = (plain(st["title"]), plain(st["text"]), plain(st["why"])) if he else en["steps"][k]
        add({"t": "h3", "text": f"{k+1}. {title}"}); add({"t": "p", "text": text})
        add({"t": "p", "text": T("**למה כאן:** ", "**Why here:** ") + why, "small": True})

    add({"t": "h1", "text": T("7. צלילה לשני רכיבים קריטיים", "7. Deep dives")})
    for k, d in enumerate(it["dives"]):
        e = en["dives"][k]
        add({"t": "h2", "text": (plain(d["title"]) if he else e["title"])})
        problem = plain(d["problem"]) if he else e["problem"]
        if he and d.get("viz") == "daystrip":
            problem = problem.replace("לחצו על האפשרויות כדי לראות את ההבדל:", "ביום ההמחשה שבעמוד, טעינה כשמגיעים קולטת כ-6% מהעודף, טעינה לפי עודף כ-44%, ועם עומסים גמישים נוספים כ-93%.")
        add({"t": "p", "text": problem})
        add({"t": "h3", "text": T("איך זה עובד", "How it works")}); add({"t": "ul", "items": [plain(x) for x in d["design"]] if he else e["design"]})
        add({"t": "h3", "text": T("החלטות ומקרי קצה", "Decisions and edge cases")}); add({"t": "ul", "items": [plain(x) for x in d["decisions"]] if he else e["decisions"]})
        add({"t": "code", "title": d["code"]["title"] if he else e["codeTitle"], "text": d["code"]["text"]})

    add({"t": "h1", "text": T("8. מה נשבר בפי 10", "8. What breaks at 10×")})
    rows = []
    for k, c in enumerate(it["x10"]["components"]):
        at = (100 / c["base"]) ** (1 / c["exp"])
        name, brk, fix = (plain(c["name"]), plain(c["breaks"]), plain(c["fix"])) if he else en["x10"][k]
        rows.append([name, f'{c["base"]}%', f"×{at:.1f}" if at <= 10 else T("מחזיק", "holds"), fix])
    add({"t": "table", "head": [T("רכיב", "Component"), T("ניצולת היום", "Today"), T("נשבר ב-", "Breaks at"), T("הפתרון", "Fix")],
         "rows": rows, "widths": [26, 12, 12, 50], "ltrcols": [1, 2]})
    add({"t": "p", "text": plain(it["x10"]["note"]) if he else en["x10Note"]})

    add({"t": "h1", "text": T("9. פשרות", "9. Trade-offs")})
    add({"t": "table", "head": [T("ציר", "Axis"), T("הבחירה", "Choice"), T("למה", "Why")],
         "rows": [[f'{t["a"]} ↔ {t["b"]}', plain(t["choice"]), plain(t["why"])] for t in it["trades"]] if he else
                 [[f"{a} ↔ {b}", c, w] for a, b, c, w in en["trades"]], "widths": [22, 26, 52]})
    add({"t": "h1", "text": T("10. סיכונים ושאלות פתוחות", "10. Risks and open questions")})
    add({"t": "ul", "items": it["doc"]["risks"] if he else en["risks"]})
    add({"t": "h3", "text": T("שאלות פתוחות", "Open questions")}); add({"t": "ul", "items": it["doc"]["open"] if he else en["open"]})
    add({"t": "h1", "text": T("נספח: שאלות המשך בראיון", "Appendix: interview follow-ups")})
    for k, q in enumerate(it["qa"]):
        qq, aa = (plain(q["q"]), plain(q["a"])) if he else en["qa"][k]
        add({"t": "h3", "text": f"Q{k+1}. {qq}"}); add({"t": "p", "text": aa})
    add({"t": "source", "text": T(f'מבוסס על דיווח ב-The Economist, {src["dateLabel"]} (מדור {src["section"]}, "{src["headline"]}"). {src["note"]}', en["source"])})
    return B

EN_FIELD = {"station_id": "Identifier", "region": "Grid region; also the shard key", "grid_node": "Grid connection point", "max_kw": "Grid connection limit",
            "slots": "Swap bays", "battery_id": "Identifier", "state": "charging | ready | held | in_truck", "soc": "State of charge, 0 to 1",
            "version": "Prevents lost updates (optimistic locking)", "reservation_id": "Identifier", "idempotency_key": "Unique",
            "truck_id, station_id, battery_id": "Who, where, which battery", "eta, hold_until": "Hold TTL", "status": "held | done | cancelled | expired",
            "(site_id, metric, ts)": "Series key", "value": "Number", "(region, slot_start)": "Key", "surplus_mw": "Forecast surplus",
            "price": "Forecast price", "forecast_version": "Which forecast", "(station_id, plan_version)": "Key", "kw[96]": "kW per 15-minute slot",
            "ready_targets": "Batteries ready per hour"}

# ---------- HTML for PDF ----------
LTR_RUN = re.compile(r"([0-9A-Za-z_][0-9A-Za-z_.,%×+\-–/:|{}()]*[0-9A-Za-z_%})]|[0-9A-Za-z])")
def inline(s):
    def seg(t):  # escape first, then isolate LTR runs while skipping entities
        parts = re.split(r"(&[#a-z0-9]+;)", html.escape(t, quote=False))
        return "".join(x if x.startswith("&") else LTR_RUN.sub(r"<bdi>\1</bdi>", x) for x in parts)
    out = []
    for i, part in enumerate(re.split(r"\*\*([^*]+)\*\*", s or "")):
        out.append(f"<strong>{seg(part)}</strong>" if i % 2 else seg(part))
    return "".join(out)

def to_html(B, lang):
    rtl = lang == "he"
    out = []
    for b in B:
        t = b["t"]
        if t == "title": out.append(f'<div class="kick">BLUEPRINT · DESIGN DOC</div><h1>{inline(b["text"])}</h1>')
        elif t == "subtitle": out.append(f'<p class="sub">{inline(b["text"])}</p>')
        elif t == "meta": out.append('<table class="meta">' + "".join(f'<tr><th>{inline(k)}</th><td dir="auto">{inline(v)}</td></tr>' for k, v in b["rows"]) + "</table>")
        elif t in ("h1", "h2", "h3"): out.append(f'<{t}{" dir=ltr" if b.get("ltr") else ""}>{inline(b["text"])}</{t}>')
        elif t == "p": out.append(f'<p class="{"small" if b.get("small") else ""}">{inline(b["text"])}</p>')
        elif t == "quote": out.append(f'<blockquote>{inline(b["text"])}</blockquote>')
        elif t == "ul": out.append("<ul>" + "".join(f"<li>{inline(x)}</li>" for x in b["items"]) + "</ul>")
        elif t == "code": out.append(f'<div class="codet">{inline(b["title"])}</div><pre>{html.escape(b["text"])}</pre>')
        elif t == "image": out.append(f'<figure><img src="{b["path"]}"><figcaption>{inline(b["caption"])}</figcaption></figure>')
        elif t == "source": out.append(f'<p class="source">{inline(b["text"])}</p>')
        elif t == "table":
            cols = "".join(f'<col style="width:{w}%">' for w in b["widths"])
            head = "".join(f"<th>{inline(h)}</th>" for h in b["head"])
            body = "".join("<tr>" + "".join(f'<td{" dir=ltr" if i in b.get("ltrcols", []) else ""}>{inline(c)}</td>' for i, c in enumerate(r)) + "</tr>" for r in b["rows"])
            out.append(f'<table class="t"><colgroup>{cols}</colgroup><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table>')
    kit = (ROOT / "kit" / "kit.css").as_uri()
    return f"""<!doctype html><html lang="{lang}" dir="{'rtl' if rtl else 'ltr'}"><head><meta charset="utf-8"><link rel="stylesheet" href="{kit}">
<style>
 @page{{size:A4;margin:18mm 17mm 18mm 17mm}}
 body{{background:#fff;color:#14213a;font-family:var(--f-body);font-size:10.6pt;line-height:1.55;overflow:visible}}
 h1{{font-size:16pt;margin:18pt 0 6pt;color:#1d4ed8;border-bottom:1px solid #cfd9ea;padding-bottom:3pt;break-after:avoid}}
 h1:first-of-type{{font-size:24pt;color:#14213a;border:0;margin-top:2pt}}
 h2{{font-size:13pt;margin:14pt 0 4pt;break-after:avoid}} h3{{font-family:var(--f-body);font-size:11pt;margin:10pt 0 3pt;break-after:avoid}}
 .kick{{font-family:var(--f-mono);font-size:8.5pt;letter-spacing:.14em;color:#1d4ed8;direction:ltr;text-align:{'right' if rtl else 'left'}}}
 .sub{{font-size:12pt;color:#53627c}} p{{margin:0 0 6pt}} .small{{font-size:9.6pt;color:#3c4a63}}
 ul{{margin:0 0 6pt;padding-inline-start:16pt}} li{{margin-bottom:2pt}}
 blockquote{{margin:4pt 0 8pt;padding:6pt 10pt;border-inline-start:3px solid #1d4ed8;background:#eef3fc;font-family:var(--f-head);font-size:11.5pt}}
 table{{border-collapse:collapse;width:100%;margin:4pt 0 8pt;font-size:9.4pt;break-inside:auto}} tr{{break-inside:avoid}}
 .t th{{background:#eaf0f9;text-align:start;padding:4pt 6pt;border:1px solid #cfd9ea;font-weight:500}}
 .t td{{padding:4pt 6pt;border:1px solid #cfd9ea;vertical-align:top;text-align:start}}
 .meta th{{text-align:start;color:#53627c;font-weight:400;padding:2pt 8pt 2pt 0;width:18%}} .meta td{{padding:2pt 0}}
 pre{{direction:ltr;text-align:left;font-size:8.2pt;background:#f3f6fb;border:1px solid #cfd9ea;border-radius:4px;padding:6pt 8pt;white-space:pre-wrap;break-inside:avoid}}
 .codet{{font-size:9pt;color:#53627c;margin-top:6pt}}
 figure{{margin:6pt 0 10pt}} figure img{{width:100%;border:1px solid #cfd9ea;border-radius:4px}} figcaption{{font-size:9pt;color:#53627c;margin-top:3pt}}
 .source{{margin-top:16pt;padding-top:6pt;border-top:1px solid #cfd9ea;font-size:9pt;color:#53627c}}
 td[dir=ltr]{{text-align:left;font-family:var(--f-mono);font-size:8.6pt}}
</style></head><body>{''.join(out)}</body></html>"""

async def arch_png(item_id, out):
    async with async_playwright() as p:
        b = await (p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"]) if CHROME else p.chromium.launch())
        ctx = await b.new_context(viewport={"width": 1280, "height": 900}, device_scale_factor=2)
        await ctx.add_init_script("try{localStorage.setItem('desk-theme','light')}catch(e){}")
        pg = await ctx.new_page()
        await pg.goto((ROOT / "items" / item_id / "index.html").as_uri()); await pg.wait_for_timeout(500)
        await pg.locator(".arch-stage").scroll_into_view_if_needed(); await pg.wait_for_timeout(500)
        await pg.evaluate("""()=>{const s=document.querySelector('.arch-svg');
          s.querySelectorAll('.off,.hl,.dim').forEach(e=>e.classList.remove('off','hl','dim'));
          s.querySelectorAll('.edge path').forEach(p=>p.setAttribute('marker-end','url(#arr)'));
          const vb=window.DESK_ITEM.arch.viewBox; s.setAttribute('viewBox','0 0 '+vb[0]+' '+vb[1]);
          document.querySelectorAll('.node,.edge').forEach(e=>e.style.transition='none');}""")
        await pg.wait_for_timeout(200)
        await pg.locator(".arch-svg").screenshot(path=str(out))
        await b.close()

async def pdf(html_path, out, lang, title):
    async with async_playwright() as p:
        b = await (p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"]) if CHROME else p.chromium.launch())
        pg = await b.new_page()
        await pg.goto(html_path.as_uri()); await pg.evaluate("document.fonts.ready"); await pg.wait_for_timeout(300)
        foot = ('<div style="font-size:8px;width:100%;text-align:center;color:#6b7a93;font-family:Arial">'
                f'Blueprint · {html.escape(title)} · <span class="pageNumber"></span>/<span class="totalPages"></span></div>')
        await pg.pdf(path=str(out), format="A4", print_background=True, display_header_footer=True,
                     header_template="<span></span>", footer_template=foot, margin={"top": "18mm", "bottom": "18mm", "left": "17mm", "right": "17mm"})
        await b.close()

def ensure_docx_lib():
    try:
        subprocess.run(["node", "-e", "require('docx')"], cwd=TOOLS, check=True, capture_output=True)
    except subprocess.CalledProcessError:
        subprocess.run(["npm", "install", "--silent", "--no-save", "docx"], cwd=TOOLS, check=True)

def main(item_id):
    d = ROOT / "items" / item_id; docs = d / "docs"; docs.mkdir(exist_ok=True)
    it = json.loads((d / "item.json").read_text(encoding="utf-8"))
    en = json.loads((d / "doc-en.json").read_text(encoding="utf-8"))
    asyncio.run(arch_png(item_id, docs / "arch.png")); print("arch.png")
    ensure_docx_lib()
    for lang in ("he", "en"):
        B = model(it, en, lang)
        mp = docs / f"_model-{lang}.json"; mp.write_text(json.dumps(B, ensure_ascii=False), encoding="utf-8")
        subprocess.run(["node", str(TOOLS / "docx_build.js"), str(mp), lang, str(docs / f"design-doc-{lang}.docx"), str(docs / "arch.png")], check=True)
        hp = docs / f"_doc-{lang}.html"; hp.write_text(to_html(B, lang), encoding="utf-8")
        asyncio.run(pdf(hp, docs / f"design-doc-{lang}.pdf", lang, it["sheet"] + " · " + it["id"]))
        mp.unlink(); hp.unlink()
        print(f"design-doc-{lang}.docx / .pdf")

if __name__ == "__main__":
    main(sys.argv[1])
