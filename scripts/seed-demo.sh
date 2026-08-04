#!/usr/bin/env bash
# Seed the local dev instance with demo reports (used for the GitHub Pages preview).
set -euo pipefail
BASE="${BASE:-http://localhost:8788}"
TOKEN="${TOKEN:-devtoken}"
DIR="$(cd "$(dirname "$0")/.." && pwd)"

post() { # post <file> <id> <date> <tags> <summary>
  curl -s -X POST "$BASE/api/reports" \
    -H "authorization: Bearer $TOKEN" \
    -H 'content-type: application/json' \
    --data-binary @- <<JSON | grep -o '"id": "[^"]*"'
{
  "id": $(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2"),
  "date": $(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$3"),
  "tags": $(python3 -c 'import json,sys; print(json.dumps(sys.argv[1].split(",")))' "$4"),
  "summary": $(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$5"),
  "html": $(python3 -c 'import json,sys; print(json.dumps(open(sys.argv[1],encoding="utf-8").read()))' "$1")
}
JSON
}

post "$DIR/samples/sample-report.html"    demo-eval      2026-08-03 "evaluation,agents"      "静的ベンチマークの飽和問題と軌跡ベース評価の台頭"
post "$DIR/samples/report-inference.html" demo-inference 2026-07-28 "inference,vllm,sglang"  "vLLM と SGLang のスループット特性をワークロード別に比較"
post "$DIR/samples/report-otel.html"      demo-otel      2026-07-15 "observability,otel"     "GenAI セマンティック規約の現状と計装時の落とし穴"
echo "seeded."
