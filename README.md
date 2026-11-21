# Blueprint · System Design from the headlines

Part of **Desk**. Each item turns one news story into an interview-style system design question: requirements, interactive back-of-envelope estimates, API and data model, an architecture diagram that builds as you scroll, two deep dives, a 10× slider, trade-offs and follow-up questions. Each item ships with a Design Doc (Hebrew and English, DOCX and PDF).

Live: `https://ronygralnic.github.io/blueprint/`

## Structure
```
index.html, about.html        home (gallery + filters), about
assets/                       site.css (identity), home.js, item.js (renderer), og.png, icons
kit/                          Desk kit v2 (shared base: CSS, JS, fonts, OG template)
items/index.json              gallery list (source)   -> items/data.js (generated)
items/<ID>/item.json          the item (source)       -> index.html, data.js (generated)
items/<ID>/doc-en.json        English Design Doc text
items/<ID>/docs/              design-doc-{he,en}.{docx,pdf}, arch.png
tools/                        build_item.py, og.py, build_docs.py (+ docx_build.js), check.py
interview/                    private, git-ignored
```

The site works over http **and** opened directly from disk (`file://`): data loads from `data.js` through `<script>`, and every link points to a file.

## Adding an item (no code changes)
```bash
python3 tools/build_item.py <ID>      # index.html + data.js + items/index.json + items/data.js
python3 tools/og.py <ID>              # items/<ID>/og.png
python3 tools/build_docs.py <ID>      # Design Doc he/en, docx/pdf
python3 tools/check.py --item <ID>    # 1280/390 × light/dark × http/file + interactions
```
Requires Python 3 + `playwright`, Chrome/Chromium, and Node with the `docx` package. Fonts: `kit/fetch-fonts.sh`.

Based on reporting in The Economist. Summaries are written in our own words; charts are rebuilt or illustrative.
