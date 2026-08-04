#!/usr/bin/env bash
#
# Export the live Worker output as a static site for GitHub Pages.
#
# The viewer normally renders on demand from R2. Pages can only serve static
# files, so we crawl the running `wrangler dev` instance and snapshot its HTML.
# This keeps the preview byte-identical to production rendering rather than
# reimplementing the templates.
#
# Usage: BASE=http://localhost:8788 BASE_PATH=/report-viewer bash scripts/export-static.sh
set -euo pipefail

BASE="${BASE:-http://localhost:8788}"
# GitHub Pages serves project sites under /<repo>/, so every absolute link and
# asset reference has to be rewritten to sit under that prefix.
BASE_PATH="${BASE_PATH:-}"
OUT="${OUT:-$(cd "$(dirname "$0")/.." && pwd)/dist}"

rm -rf "$OUT"
mkdir -p "$OUT/r" "$OUT/.tmp"

# The rewriter lives in its own file rather than a heredoc: a heredoc attached
# to `python3 -` competes with piped stdin, so `curl | rewrite` silently
# produced 0-byte files.
REWRITER="$OUT/.tmp/rewrite.py"
cat > "$REWRITER" <<'PY'
import re, sys
base = sys.argv[1].rstrip('/')
html = sys.stdin.read()

# /r/<id>  ->  <base>/r/<id>.html   (Pages needs a real file, not a route)
html = re.sub(r'href="/r/([^"#?]+)"', lambda m: f'href="{base}/r/{m.group(1)}.html"', html)
# root link ("‹ 一覧" back-link) -> <base>/index.html
html = re.sub(r'href="/"', f'href="{base}/index.html"', html)
# assets referenced from <head>
for asset in ('manifest.webmanifest', 'icon.png', 'favicon.ico'):
    html = html.replace(f'"/{asset}"', f'"{base}/{asset}"')

sys.stdout.write(html)
PY

rewrite() { python3 "$REWRITER" "$BASE_PATH"; }

echo "==> exporting from $BASE (base path: '${BASE_PATH:-/}')"

# --- index -------------------------------------------------------------------
curl -fsS "$BASE/" | rewrite > "$OUT/index.html"
echo "    index.html"

# --- each report -------------------------------------------------------------
ids=$(curl -fsS "$BASE/api/reports" \
  | python3 -c 'import json,sys; print("\n".join(r["id"] for r in json.load(sys.stdin)["reports"]))')

count=0
while IFS= read -r id; do
  [ -n "$id" ] || continue
  enc=$(python3 -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=""))' "$id")
  curl -fsS "$BASE/r/$enc" | rewrite > "$OUT/r/$id.html"
  echo "    r/$id.html"
  count=$((count + 1))
done <<< "$ids"

# --- assets ------------------------------------------------------------------
curl -fsS "$BASE/icon.png" -o "$OUT/icon.png"
cp "$OUT/icon.png" "$OUT/favicon.ico"

# Rewrite the manifest via a temp file: piping curl into a heredoc-fed python
# makes stdin ambiguous (the heredoc wins and json.load sees an empty stream).
curl -fsS "$BASE/manifest.webmanifest" -o "$OUT/manifest.raw.json"
python3 - "$BASE_PATH" "$OUT/manifest.raw.json" "$OUT/manifest.webmanifest" <<'PY'
import json, sys
base = sys.argv[1].rstrip('/')
with open(sys.argv[2], encoding='utf-8') as fh:
    m = json.load(fh)
m['start_url'] = f'{base}/index.html'
for i in m.get('icons', []):
    i['src'] = f"{base}/{i['src'].lstrip('/')}"
with open(sys.argv[3], 'w', encoding='utf-8') as fh:
    json.dump(m, fh, ensure_ascii=False)
PY
rm -f "$OUT/manifest.raw.json"
echo "    icon.png, favicon.ico, manifest.webmanifest"

# Jekyll would otherwise ignore files it considers special; disable it.
touch "$OUT/.nojekyll"
rm -rf "$OUT/.tmp"

echo "==> done: $count report(s) + index -> $OUT"
