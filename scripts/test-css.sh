#!/usr/bin/env bash
# Verify author CSS is passed through but cannot harm the viewer.
#
# Reports are allowed their own visual identity, so <style> survives. That makes
# the stylesheet an untrusted input: these cases assert that it cannot escape the
# .report scope, cover the viewer chrome, phone home, or execute script.
set -uo pipefail
BASE="${BASE:-http://localhost:8788}"
TOKEN="${TOKEN:-devtoken}"

pass=0; fail=0
check() {
  if [ "$2" = "$3" ]; then printf '  \033[32mPASS\033[0m %-46s %s\n' "$1" "$2"; pass=$((pass+1))
  else printf '  \033[31mFAIL\033[0m %-46s got=%s want=%s\n' "$1" "$2" "$3"; fail=$((fail+1)); fi
}

python3 - > /tmp/rv_css.json <<'PY'
import json
html = """<html><head><style>
@import url("https://evil.example.com/x.css");
:root { --brand: #c2185b; }
body { background: #fff8f0; font-family: Georgia, serif; }
.card { border: 2px solid var(--brand); border-radius: 14px; padding: 1rem; }
.hero { font-size: 2.5rem; letter-spacing: -.02em; color: var(--brand); }
.evil-fixed { position: fixed; top: 0; left: 0; z-index: 99999; background: red; }
.evil-sticky { position: sticky; top: 0; }
.evil-leak { background-image: url("https://tracker.example.com/pixel.gif"); }
.evil-expr { width: expression(alert(1)); }
.evil-wide { width: 200vw; min-width: 150vw; }
.evil-events { pointer-events: none; }
.top { display: none; }
.wrap { background: black; }
footer { visibility: hidden; }
.ok-relative { position: relative; }
.ok-data { background-image: url("data:image/gif;base64,R0lGODlhAQABAAAAACw="); }
@media (max-width: 600px) { .card { padding: .5rem; } }
@keyframes fade { from { opacity: 0 } to { opacity: 1 } }
.anim { animation: fade .4s ease both; }
</style></head><body>
<h1>CSS検証レポート</h1>
<p class="hero">見出しスタイル</p>
<div class="card">カード</div>
<h2>節1</h2><p>本文</p>
<h2>節2</h2><p>本文</p>
<h2>節3</h2><p>本文</p>
</body></html>"""
print(json.dumps({"id": "css-test", "title": "CSS検証レポート",
                  "date": "2026-08-04", "tags": ["test"], "html": html}))
PY

curl -s -X POST "$BASE/api/reports" -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' --data-binary @/tmp/rv_css.json > /dev/null
# `?css=1` is required: passing report CSS through is off by default now, because
# per-report palettes broke the archive's consistency. This suite covers the
# escape hatch -- that when CSS *is* allowed, it still cannot escape or overlay.
curl -s "$BASE/r/css-test?css=1" -o /tmp/rv_css.html

# Default path must drop it entirely.
curl -s "$BASE/r/css-test" -o /tmp/rv_css_default.html
# Isolate the report-supplied block so counts can't collide with the viewer's
# own BASE_CSS (which legitimately contains `position: sticky`, `.top {`, etc).
python3 - <<'PY'
import re
h = open('/tmp/rv_css.html', encoding='utf-8').read()
m = re.search(r'<style>/\* report-supplied.*?</style>', h, re.S)
open('/tmp/rv_css_block.txt', 'w', encoding='utf-8').write(m.group(0) if m else '')
PY
cnt() { grep -o -F -- "$1" /tmp/rv_css_block.txt | wc -l | tr -d ' '; }
cnt_all() { grep -o -F -- "$1" /tmp/rv_css.html | wc -l | tr -d ' '; }

echo "=== default path drops report CSS entirely ==="
check "default: no report style block" \
  "$(grep -o -F 'report-supplied' /tmp/rv_css_default.html | wc -l | tr -d ' ')" "0"
check "default: hotpink-style CSS gone" \
  "$(grep -o -F '#c2185b' /tmp/rv_css_default.html | wc -l | tr -d ' ')" "0"
check "default: exactly one <style>" \
  "$(grep -o -F '<style>' /tmp/rv_css_default.html | wc -l | tr -d ' ')" "1"

echo "=== author CSS survives ==="
# `:root` and `body` both scope to `.report`, producing two separate rules, so
# assert the declaration is present rather than pinning it to one block.
check "custom property kept"        "$(cnt '--brand: #c2185b')" "1"
check "brand referenced by var()"   "$(cnt 'var(--brand)')" "2"
check "card rule kept"              "$(cnt 'border-radius: 14px')" "1"
check "hero typography kept"        "$(cnt 'letter-spacing: -.02em')" "1"
check "@media kept"                 "$(cnt '@media (max-width: 600px)')" "1"
check "@keyframes kept"             "$(cnt '@keyframes fade')" "1"
check "animation decl kept"         "$(cnt 'animation: fade .4s ease both')" "1"
check "data: url intact (not split)" "$(cnt 'data:image/gif;base64,R0lGODlhAQABAAAAACw=')" "1"
check "position: relative kept"     "$(cnt 'position: relative')" "1"

echo "=== rules are scoped to .report ==="
check "body rewritten to scope"     "$(cnt '.report { background: #fff8f0')" "1"
check "no bare 'body {' rule"       "$(grep -oE '(^|})[[:space:]]*body[[:space:]]*\{' /tmp/rv_css_block.txt | wc -l | tr -d ' ')" "0"
check ".card scoped"                "$(cnt '.report .card')" "2"
check ".top neutralized by scope"   "$(cnt '.report .top')" "1"
check "no unscoped .top rule"       "$(grep -oE '(^|})[[:space:]]*\.top[[:space:]]*\{' /tmp/rv_css_block.txt | wc -l | tr -d ' ')" "0"
check ".wrap scoped"                "$(cnt '.report .wrap')" "1"
check "footer scoped"               "$(cnt '.report footer')" "1"

echo "=== dangerous constructs removed ==="
check "@import dropped"             "$(cnt_all '@import')" "0"
check "evil.example.com gone"       "$(cnt_all 'evil.example.com')" "0"
# Regression: a statement at-rule has no block, so brace-scanning used to fold
# it together with the next rule and discard both. The :root palette vanished.
check "rule after @import survives" "$(cnt '--brand: #c2185b')" "1"
check "position: fixed dropped"     "$(cnt 'position: fixed')" "0"
check "position: sticky dropped"    "$(cnt 'position: sticky')" "0"
check "z-index: 99999 dropped"      "$(cnt_all 'z-index: 99999')" "0"
check "external tracker url gone"   "$(cnt_all 'tracker.example.com')" "0"
check "expression() dropped"        "$(cnt_all 'expression(')" "0"
check "pointer-events dropped"      "$(cnt 'pointer-events: none')" "0"

echo "=== viewport blowout clamped ==="
check "200vw clamped"               "$(cnt '200vw')" "0"
check "150vw clamped"               "$(cnt '150vw')" "0"
check "clamped to 100%"             "$(cnt 'width: 100%')" "2"

echo "=== shell CSS still present ==="
check "viewer sticky header intact" "$(grep -c 'position: sticky' /tmp/rv_css.html)" "1"
check "viewer .top rule intact"     "$(grep -oE '(^|})[[:space:]]*\.top[[:space:]]*\{' /tmp/rv_css.html | wc -l | tr -d ' ')" "1"

curl -s -X DELETE "$BASE/api/reports/css-test" -H "authorization: Bearer $TOKEN" > /dev/null
echo
printf 'PASSED: %s  FAILED: %s\n' "$pass" "$fail"
[ "$fail" -eq 0 ] || exit 1
