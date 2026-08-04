#!/usr/bin/env bash
# Re-ingest the custom-designed back-office report from samples/.
set -euo pipefail
BASE="${BASE:-http://localhost:8788}"
TOKEN="${TOKEN:-devtoken}"
DIR="$(cd "$(dirname "$0")/.." && pwd)"

python3 - "$DIR/samples/report-backoffice.html" > /tmp/rv_bo.json <<'PY'
import json, sys
html = open(sys.argv[1], encoding='utf-8').read()
print(json.dumps({
  "id": "backoffice",
  "title": "日本のバックオフィス業務の分類",
  "date": "2026-08-04",
  "tags": ["business", "classification", "custom-design"],
  "summary": "経理・人事・総務・法務を処理の性質で四類に分類し、改善手段との対応を整理",
  "html": html,
}, ensure_ascii=False))
PY

curl -s -X DELETE "$BASE/api/reports/backoffice" -H "authorization: Bearer $TOKEN" -o /dev/null
curl -s -X POST "$BASE/api/reports" -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' --data-binary @/tmp/rv_bo.json \
  -o /dev/null -w 'ingest %{http_code}\n'
