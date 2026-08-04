#!/usr/bin/env bash
# Verify CJK space tightening does not break HTML escaping.
#
# HTMLRewriter's text().replace() interprets its argument as HTML by default,
# so a naive implementation would let escaped entities in report content be
# re-parsed (turning &lt;script&gt; into a live <script>). This asserts that
# entities survive and that whitespace inside <pre>/<code> is untouched.
set -uo pipefail
BASE="${BASE:-http://localhost:8788}"
TOKEN="${TOKEN:-devtoken}"

pass=0; fail=0
check() {
  if [ "$2" = "$3" ]; then printf '  \033[32mPASS\033[0m %-42s %s\n' "$1" "$2"; pass=$((pass+1))
  else printf '  \033[31mFAIL\033[0m %-42s got=%s want=%s\n' "$1" "$2" "$3"; fail=$((fail+1)); fi
}

python3 - > /tmp/rv_esc.json <<'PY'
import json
html = """<html><body><h1>エスケープ検証</h1>
<p>比較演算子 は a &lt; b および a &gt; b である。 次の文。 そして &amp; 記号。</p>
<p>危険な文字列 &lt;script&gt;alert(1)&lt;/script&gt; を含む文。 続く文。</p>
<pre><code>if a &lt; b:
    x = 1   # 空白 は  保持   される
</code></pre>
</body></html>"""
print(json.dumps({"id": "esc-test", "title": "エスケープ検証",
                  "date": "2026-08-04", "tags": ["test"], "html": html}))
PY

curl -s -X POST "$BASE/api/reports" -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' --data-binary @/tmp/rv_esc.json > /dev/null

curl -s "$BASE/r/esc-test" -o /tmp/rv_esc.html
cnt() { grep -o -F -- "$1" /tmp/rv_esc.html | wc -l | tr -d ' '; }

echo "=== escaping survives tightening ==="
# "a &lt; b" appears twice on purpose: once in the paragraph, once in the code
# block, so assert presence rather than an exact count.
check "a &lt; b kept escaped"   "$(cnt 'a &lt; b')" "2"
check "a &gt; b kept escaped"   "$(cnt 'a &gt; b')" "1"
check "ampersand kept escaped"  "$(cnt '&amp; 記号')" "1"
check "no double-encoding"      "$(cnt '&amp;lt;')" "0"
check "no live <script> injected" "$(cnt '<script>alert(1)')" "0"
check "script text stays escaped" "$(cnt '&lt;script&gt;alert(1)')" "1"

echo "=== CJK tightening applied outside code ==="
check "'。 次の文' tightened"     "$(cnt '。 次の文')" "0"
check "'。次の文' present"        "$(cnt '。次の文')" "1"
check "'。 続く文' tightened"     "$(cnt '。 続く文')" "0"

echo "=== latin spacing preserved ==="
# "演算子 は" is CJK on both sides, so it is *correctly* tightened. Use a real
# Latin-adjacent case to prove Latin spacing is left alone.
check "'演算子は' tightened (CJK both sides)" "$(cnt '演算子は')" "1"
check "'a &lt; b' latin spacing kept"        "$(cnt 'a &lt; b')" "2"
check "'文字列 &lt;script' latin kept"       "$(cnt '文字列 &lt;script')" "1"

echo "=== whitespace inside code preserved ==="
check "code spacing untouched"    "$(cnt '空白 は  保持   される')" "1"

curl -s -X DELETE "$BASE/api/reports/esc-test" -H "authorization: Bearer $TOKEN" > /dev/null
echo
printf 'PASSED: %s  FAILED: %s\n' "$pass" "$fail"
[ "$fail" -eq 0 ] || exit 1
