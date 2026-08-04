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
# Note the hard-wrapped lines: the newline+indent is what the browser collapses
# into a visible space between CJK characters.
html = """<html><body><h1>エスケープ検証</h1>
<p>比較演算子 は a &lt; b および a &gt; b である。 次の文。 そして &amp; 記号。</p>
<p>危険な文字列 &lt;script&gt;alert(1)&lt;/script&gt; を含む文。 続く文。</p>
<p>改行で折り返された文である。
  次の行に続く文。
  さらに続く文。</p>
<p>処理が終わっていない。 span を早期に終了させる。 TTFT は別に記録する。</p>
<p>括弧の検証 （openai, anthropic 等）、 および 「引用」 の扱い。</p>
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
# Newline-wrapped prose is the common real-world case: the browser collapses
# "。\n  次の行" into a visible space, so newlines must be tightened too.
check "newline gap tightened"     "$(cnt 'である。次の行に続く文。さらに続く文。')" "1"
check "no residual newline gap" \
  "$(python3 -c "
import re,sys
h=open('/tmp/rv_esc.html',encoding='utf-8').read()
b=re.sub(r'<pre.*?</pre>','',h,flags=re.S)
CJK=r'\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff\u3000-\u303f'
print(len(re.findall(rf'[{CJK}]\s+[{CJK}]',b)))
")" "0"

echo "=== punctuation followed by Latin (the reported bug) ==="
# "。 span" had a visible hole: closing punctuation carries its own trailing
# space in the glyph, so a following space is wrong even before Latin text.
check "'。 span' tightened"        "$(cnt '。 span')" "0"
check "'。span を' present"        "$(cnt '。span を')" "1"
check "'。 TTFT' tightened"        "$(cnt '。 TTFT')" "0"
check "'。TTFT は' present"        "$(cnt '。TTFT は')" "1"
check "'）、 および' tightened"    "$(cnt '）、 および')" "0"
check "space before 「 removed"    "$(cnt ' 「引用」')" "0"
check "space before （ removed"    "$(cnt ' （openai')" "0"
# Latin-to-Latin spacing must survive untouched.
check "'openai, anthropic' kept"   "$(cnt 'openai, anthropic')" "1"
check "'span を早期に' kept"       "$(cnt 'span を早期に')" "1"

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
