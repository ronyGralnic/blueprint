#!/usr/bin/env python3
"""Blueprint QA matrix. Every page × {1280, 390} × {light, dark} × {http, file://}.

Checks: console errors, horizontal scroll, every item interaction (calculator, scroll diagram,
day strip, ×10, Q&A, terms, theme), file:// navigation. Screenshots go to tools/_shots/ (git-ignored).
Usage: python3 tools/check.py --item <ID> [--port 8765] [--chrome /usr/bin/google-chrome]
Needs: pip playwright; a server is started automatically on --port for the http run.
"""
import argparse, asyncio, json, pathlib, subprocess, sys, time
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
SHOTS = ROOT / "tools" / "_shots"

async def run_page(browser, url, w, theme, report, tag, item_checks=False, shots=False):
    ctx = await browser.new_context(viewport={"width": w, "height": 860 if w > 500 else 844}, device_scale_factor=1)
    await ctx.add_init_script(f"try{{localStorage.setItem('desk-theme','{theme}')}}catch(e){{}}")
    pg = await ctx.new_page()
    errs = []
    pg.on("console", lambda m: errs.append(f"{m.type}: {m.text}") if m.type in ("error", "warning") else None)
    pg.on("pageerror", lambda e: errs.append(f"pageerror: {e}"))
    res = {"tag": tag, "ok": True, "notes": []}
    def fail(msg): res["ok"] = False; res["notes"].append("FAIL " + msg)
    try:
        await pg.goto(url); await pg.wait_for_timeout(600)
        t = await pg.evaluate("document.documentElement.dataset.theme")
        if t != theme: fail(f"theme {t}")
        if item_checks:
            await item_interactions(pg, w, res, fail, shots, f"{tag}")
        sw = await pg.evaluate("[document.documentElement.scrollWidth, document.documentElement.clientWidth]")
        if sw[0] > sw[1]: fail(f"horizontal scroll {sw}")
        if shots:
            await pg.evaluate("window.scrollTo(0,0)"); await pg.wait_for_timeout(200)
            await pg.screenshot(path=str(SHOTS / f"{tag}-top.png"))
    except Exception as e:
        fail(f"exception {e}")
    real = [e for e in errs if "favicon" not in e]
    if real: fail("console: " + " | ".join(real[:5]))
    await ctx.close()
    report.append(res)

async def item_interactions(pg, w, res, fail, shots, tag):
    async def step(name, coro):
        try: await coro
        except Exception as e: fail(f"{name}: {e}")
    # terms are rendered
    n_terms = await pg.locator(".term").count()
    if n_terms < 20: fail(f"only {n_terms} terms")
    # calculator
    async def calc():
        before = await pg.locator("#ov-qps").inner_text()
        await pg.locator("#in-trucks").evaluate("el=>{el.value=900;el.dispatchEvent(new Event('input',{bubbles:true}))}")
        after = await pg.locator("#ov-qps").inner_text()
        if before == after: fail("calc did not update")
        await pg.locator("#calc-reset").click()
        if await pg.locator("#ov-qps").inner_text() != before: fail("calc reset")
        res["notes"].append(f"calc qps {before} -> {after}")
    await step("calc", calc())
    # architecture: buttons + scroll
    async def arch():
        await pg.locator("#arch").scroll_into_view_if_needed()
        await pg.locator(".arch-step[data-i='4']").scroll_into_view_if_needed(); await pg.wait_for_timeout(700)
        lbl = await pg.locator("#arch-lbl").inner_text()
        res["notes"].append(f"arch after scroll: {lbl}")
        if "שלב 1 " in lbl: fail("arch scroll did not advance")
        if shots: await pg.screenshot(path=str(SHOTS / f"{tag}-arch-step.png"))
        await pg.locator("#arch-all").click(); await pg.wait_for_timeout(700)
        off = await pg.locator(".arch-svg .node.off").count()
        if off: fail(f"{off} nodes hidden in 'all'")
        if shots:
            await pg.locator(".arch-stage").screenshot(path=str(SHOTS / f"{tag}-arch-all.png"))
        await pg.locator("#arch-next").click(); await pg.wait_for_timeout(100)
    await step("arch", arch())
    # day strip
    async def day():
        c0 = await pg.locator("#ds-cap").inner_text()
        await pg.locator("#daystrip button[data-mode='1']").click()
        c1 = await pg.locator("#ds-cap").inner_text()
        if c0 == c1: fail("daystrip did not change")
        res["notes"].append("daystrip: " + c0.split("%")[0][-3:] + "% -> " + c1.split("%")[0][-3:] + "%")
        if shots: await pg.locator("#daystrip").screenshot(path=str(SHOTS / f"{tag}-day.png"))
    await step("daystrip", day())
    # ×10
    async def x10():
        await pg.locator("#x10-in").evaluate("el=>{el.value=10;el.dispatchEvent(new Event('input',{bubbles:true}))}")
        cls = await pg.locator("#x10-v").get_attribute("class")
        if "bad" not in cls: fail("x10 verdict not bad at ×10")
        await pg.wait_for_timeout(400)
        broken = await pg.locator(".bar.broken").count()
        res["notes"].append(f"x10 at ×10: {broken} broken")
        if shots: await pg.locator("#x10").screenshot(path=str(SHOTS / f"{tag}-x10.png"))
    await step("x10", x10())
    # Q&A
    async def qa():
        d = pg.locator("#qa details").first
        await d.locator("summary").click()
        if not await d.evaluate("e=>e.open"): fail("qa not opening")
    await step("qa", qa())
    # term popover stays inside the viewport
    async def term():
        t = pg.locator(".term").first
        await t.scroll_into_view_if_needed(); await t.click(); await pg.wait_for_timeout(150)
        box = await pg.locator(".term-pop").bounding_box()
        if not box: fail("no popover")
        elif box["x"] < 0 or box["x"] + box["width"] > w + 1: fail(f"popover outside viewport {box}")
        if shots: await pg.screenshot(path=str(SHOTS / f"{tag}-term.png"))
        await pg.keyboard.press("Escape")
        if await pg.locator(".term-pop").count(): fail("popover not closed by Escape")
    await step("term", term())
    # theme toggle
    async def theme():
        t0 = await pg.evaluate("document.documentElement.dataset.theme")
        await pg.locator(".theme-btn").click()
        t1 = await pg.evaluate("document.documentElement.dataset.theme")
        if t0 == t1: fail("theme toggle")
        await pg.locator(".theme-btn").click()
    await step("theme", theme())

async def nav_file(browser, report):
    """file://: home -> item -> home -> about, by clicking links."""
    res = {"tag": "file-nav", "ok": True, "notes": []}
    ctx = await browser.new_context(viewport={"width": 1280, "height": 860}); pg = await ctx.new_page()
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    try:
        await pg.goto((ROOT / "index.html").as_uri()); await pg.wait_for_timeout(400)
        await pg.locator(".item-card").first.click(); await pg.wait_for_load_state(); await pg.wait_for_timeout(400)
        assert await pg.locator(".titleblock").count() == 1, "item did not render"
        await pg.locator(".brand").click(); await pg.wait_for_load_state(); await pg.wait_for_timeout(300)
        assert await pg.locator(".item-card").count() >= 1, "home gallery empty"
        await pg.locator(".site-nav a[href='about.html']").click(); await pg.wait_for_load_state()
        assert "אודות" in await pg.title(), "about"
        res["notes"].append("home → item → home → about OK")
    except Exception as e:
        res["ok"] = False; res["notes"].append(f"FAIL {e}")
    if errs: res["ok"] = False; res["notes"].append("errors " + "; ".join(errs))
    await ctx.close(); report.append(res)

async def main(a):
    SHOTS.mkdir(parents=True, exist_ok=True)
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(a.port)], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)
    report = []
    try:
        async with async_playwright() as p:
            kw = {"args": ["--no-sandbox"]}
            if a.chrome: kw["executable_path"] = a.chrome
            br = await p.chromium.launch(**kw)
            pages = [("home", "index.html", False), ("about", "about.html", False), ("item", f"items/{a.item}/index.html", True)]
            for proto in ("http", "file"):
                for w in (1280, 390):
                    for theme in ("light", "dark"):
                        for name, path, ic in pages:
                            url = f"http://localhost:{a.port}/{path}" if proto == "http" else (ROOT / path).as_uri()
                            tag = f"{proto}-{w}-{theme}-{name}"
                            await run_page(br, url, w, theme, report, tag, item_checks=ic, shots=(proto == "http"))
            await nav_file(br, report)
            await br.close()
    finally:
        srv.terminate()
    bad = [r for r in report if not r["ok"]]
    for r in report:
        print(("OK  " if r["ok"] else "BAD ") + r["tag"] + ("  · " + " · ".join(r["notes"]) if r["notes"] else ""))
    print(f"\n{len(report) - len(bad)}/{len(report)} passed")
    (SHOTS / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
    sys.exit(1 if bad else 0)

if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("--item", required=True); ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--chrome", default="/usr/bin/google-chrome" if pathlib.Path("/usr/bin/google-chrome").exists() else None)
    asyncio.run(main(ap.parse_args()))
