# Desk kit v2

Shared base for Desk sites. Every site copies `kit/` and layers its identity in `assets/site.css`.

- `kit.css`: local fonts (Frank Ruhl Libre for headings, Heebo for body text, IBM Plex Mono for numbers and code), tokens, RTL, light and dark modes, cards, chips, bridges, term popovers, details, tables.
- `kit.js`: `window.Desk`, which provides theme, `rich()` (term markup `[[id|text]]`, `**bold**`, `` `code` ``, LTR runs isolated in `<bdi>`), `autoDir`, term popovers, number formatting, GoatCounter (only on `*.github.io`), and `load()` (a data.js global first, fetch only over http).
- `og-template.html`: the Open Graph card template (1200×630).
- `fonts/`: not stored in the project. Restore them with `./fetch-fonts.sh` (npm, @fontsource).

v2 was rebuilt on 2026-11-21 when the Blueprint (SD) site was set up. Its API is not identical to v1 (used by After Action / PM).
