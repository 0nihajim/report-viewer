#!/usr/bin/env bash
# Verify the viewer-drawn figure vocabulary survives sanitizing and that the
# data-* allowlist rejects anything that isn't plain data.
set -uo pipefail
BASE="${BASE:-http://localhost:8788}"
TOKEN="${TOKEN:-devtoken}"
DIR="$(cd "$(dirname "$0")/.." && pwd)"

pass=0; fail=0
check() {
  if [ "$2" = "$3" ]; then printf '  \033[32mPASS\033[0m %-40s %s\n' "$1" "$2"; pass=$((pass+1))
  else printf '  \033[31mFAIL\033[0m %-40s got=%s want=%s\n' "$1" "$2" "$3"; fail=$((fail+1)); fi
}

bash "$DIR/scripts/seed-report.sh" "$DIR/samples/fixture-viz.html" viz-test 2026-08-04 "viz" >/dev/null
curl -fsS "$BASE/r/viz-test" -o /tmp/rv_viz.html || { echo "fetch failed" >&2; exit 1; }
n() { grep -o -F -- "$1" /tmp/rv_viz.html | wc -l | tr -d ' '; }

echo "=== figure structure survives ==="
check 'figure.viz kept'       "$(n '<figure class="viz"')" "4"
check 'figcaption kept'       "$(n '<figcaption>')" "4"
check 'h4 kept'               "$(n '<h4>')" "2"
check 'timeline kept'         "$(n 'class="timeline"')" "1"
check 'versus kept'           "$(n 'class="versus"')" "1"

echo "=== data attributes reach the renderer ==="
check 'data-max kept'         "$(n 'data-max="6000"')" "1"
check 'data-value kept'       "$(n 'data-value="2140"')" "1"
# 2 = once in the body, once in the stylesheet selector for the tone variant.
check 'data-tone kept'        "$(n 'data-tone="positive"')" "2"
check 'data-points kept'      "$(n 'data-points="12,18,15,24,31,29,42,58"')" "1"
check 'data-label kept'       "$(n 'data-label="月次件数（件）"')" "1"
check 'data-state kept'       "$(n 'data-state="active"')" "2"

echo "=== hostile attributes rejected ==="
check 'onclick removed'       "$(n 'onclick')" "0"
check 'alert() removed'       "$(n 'alert(1)')" "0"
# A data-* value containing markup is not data; it must be dropped, not escaped
# into the attribute where a future renderer might trust it.
check 'markup in data-* dropped' "$(grep -c 'data-value="&' /tmp/rv_viz.html || true)" "0"

echo "=== drawing script is present and gated ==="
check 'figure script injected'     "$(n 'data-pct')" "2"
check 'reduced-motion honored'     "$(n 'prefers-reduced-motion: reduce')" "3"
check 'IntersectionObserver used'  "$(n 'IntersectionObserver')" "2"

echo
printf 'PASSED: %s  FAILED: %s\n' "$pass" "$fail"
[ "$fail" -eq 0 ] || exit 1
