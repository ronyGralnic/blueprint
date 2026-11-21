#!/usr/bin/env bash
# Restores kit/fonts/*.woff2 from npm (@fontsource). Run from anywhere.
set -euo pipefail
KIT="$(cd "$(dirname "$0")" && pwd)"
TMP="$(mktemp -d)"
( cd "$TMP" && npm init -y >/dev/null && npm i --silent @fontsource/frank-ruhl-libre @fontsource/heebo @fontsource/ibm-plex-mono >/dev/null )
mkdir -p "$KIT/fonts"
F="$TMP/node_modules/@fontsource"
for w in 400 500 700; do for s in hebrew latin; do cp "$F/heebo/files/heebo-$s-$w-normal.woff2" "$KIT/fonts/"; done; done
for w in 500 700; do for s in hebrew latin; do cp "$F/frank-ruhl-libre/files/frank-ruhl-libre-$s-$w-normal.woff2" "$KIT/fonts/"; done; done
for w in 400 500; do cp "$F/ibm-plex-mono/files/ibm-plex-mono-latin-$w-normal.woff2" "$KIT/fonts/"; done
rm -rf "$TMP"; ls "$KIT/fonts" | wc -l
