#!/usr/bin/env bash
# Ingest one report HTML into the viewer.
#
# Usage: bash scripts/seed-report.sh <file> <id> [date] [tags] [summary]
# Title and summary are read from the document when not given.
set -euo pipefail
BASE="${BASE:-http://localhost:8788}"
TOKEN="${TOKEN:-devtoken}"

FILE="${1:?usage: seed-report.sh <file> <id> [date] [tags] [summary]}"
ID="${2:?missing id}"
DATE="${3:-$(date +%Y-%m-%d)}"
TAGS="${4:-}"
SUMMARY="${5:-}"

python3 - "$FILE" "$ID" "$DATE" "$TAGS" "$SUMMARY" > /tmp/rv_seed.json <<'PY'
import json, re, sys
path, rid, date, tags, summary = sys.argv[1:6]
html = open(path, encoding='utf-8').read()

# Title from <title>, falling back to the first <h1>.
m = re.search(r'<title>(.*?)</title>', html, re.S | re.I) or re.search(r'<h1[^>]*>(.*?)</h1>', html, re.S | re.I)
title = re.sub(r'<[^>]+>', '', m.group(1)).strip() if m else rid

# Summary from .lede when not supplied -- the lede is the one-sentence finding.
if not summary:
    m = re.search(r'class="lede"[^>]*>(.*?)</p>', html, re.S | re.I)
    if m:
        summary = re.sub(r'<[^>]+>', '', m.group(1)).strip()

print(json.dumps({
    "id": rid,
    "title": title,
    "date": date,
    "tags": [t for t in tags.split(',') if t],
    "summary": summary,
    "html": html,
}, ensure_ascii=False))
PY

curl -s -X DELETE "$BASE/api/reports/$ID" -H "authorization: Bearer $TOKEN" -o /dev/null || true
curl -s -X POST "$BASE/api/reports" -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' --data-binary @/tmp/rv_seed.json \
  -o /dev/null -w "$ID -> HTTP %{http_code}\n"
