#!/usr/bin/env bash
# End-to-end smoke test against a running `wrangler dev` instance.
#
# Usage:  BASE=http://localhost:8788 TOKEN=devtoken bash scripts/smoke.sh
#
# Verifies: auth gating, ingest, sanitization (XSS + layout hostility),
# heading anchors, table wrapping, listing, 404s and path traversal.
set -uo pipefail

BASE="${BASE:-http://localhost:8788}"
TOKEN="${TOKEN:-devtoken}"
SAMPLE="$(dirname "$0")/../samples/sample-report.html"

pass=0
fail=0

check() { # check <label> <actual> <expected>
  if [ "$2" = "$3" ]; then
    printf '  \033[32mPASS\033[0m %-46s %s\n' "$1" "$2"
    pass=$((pass + 1))
  else
    printf '  \033[31mFAIL\033[0m %-46s got=%s want=%s\n' "$1" "$2" "$3"
    fail=$((fail + 1))
  fi
}

# Some strings legitimately appear more than once (a title shows up in both the
# card text and the data-search attribute, an id in both the "id" and "url"
# JSON fields). For those, assert presence rather than an exact count.
check_min() { # check_min <label> <actual> <min>
  if [ "$2" -ge "$3" ]; then
    printf '  \033[32mPASS\033[0m %-46s %s (>=%s)\n' "$1" "$2" "$3"
    pass=$((pass + 1))
  else
    printf '  \033[31mFAIL\033[0m %-46s got=%s want>=%s\n' "$1" "$2" "$3"
    fail=$((fail + 1))
  fi
}

code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
countf() { grep -o -i -F -- "$2" "$1" | wc -l | tr -d ' '; }

echo "=== 1. basic endpoints ==="
check "GET /healthz" "$(code "$BASE/healthz")" "200"
check "GET /robots.txt" "$(code "$BASE/robots.txt")" "200"
check "GET /manifest.webmanifest" "$(code "$BASE/manifest.webmanifest")" "200"
check "GET / (list)" "$(code "$BASE/")" "200"
# PWA assets: these 404'd initially, leaving the home-screen icon blank.
check "GET /icon.png" "$(code "$BASE/icon.png")" "200"
check "GET /favicon.ico" "$(code "$BASE/favicon.ico")" "200"
check "icon is a real PNG" \
  "$(curl -s "$BASE/icon.png" | head -c 8 | od -An -tx1 | tr -d ' \n' | cut -c1-16)" "89504e470d0a1a0a"
check "manifest declares icon" \
  "$(curl -s "$BASE/manifest.webmanifest" | grep -c '/icon.png')" "1"
# default-src 'none' silently blocks fetch() unless connect-src is present.
check "CSP allows same-origin fetch" \
  "$(curl -s -D - -o /dev/null "$BASE/" | grep -c "connect-src 'self'")" "1"
check "CSP blocks framing" \
  "$(curl -s -D - -o /dev/null "$BASE/" | grep -c "frame-ancestors 'none'")" "1"

echo "=== 2. write authorization ==="
check "POST without token -> 401" \
  "$(code -X POST "$BASE/api/reports" -H 'content-type: text/html' --data-binary @"$SAMPLE")" "401"
check "POST wrong token -> 401" \
  "$(code -X POST "$BASE/api/reports" -H 'authorization: Bearer nope' \
      -H 'content-type: text/html' --data-binary @"$SAMPLE")" "401"
check "DELETE without token -> 401" "$(code -X DELETE "$BASE/api/reports/whatever")" "401"

echo "=== 3. ingest ==="
RESP=$(curl -s -X POST "$BASE/api/reports?tags=evaluation,agents&date=2026-08-03&id=smoke-test-report&summary=smoke" \
  -H "authorization: Bearer $TOKEN" -H 'content-type: text/html' --data-binary @"$SAMPLE")
echo "  response: $RESP"
check "ingest ok flag" "$(printf '%s' "$RESP" | grep -c '"ok": true')" "1"
check_min "ingest id honored" "$(printf '%s' "$RESP" | grep -c 'smoke-test-report')" "1"
check "title auto-extracted" \
  "$(printf '%s' "$RESP" | grep -c 'AIエージェント評価手法の最新動向')" "1"

echo "=== 4. rendered report ==="
curl -s "$BASE/r/smoke-test-report" -o /tmp/rv_report.html
check "GET /r/<id>" "$(code "$BASE/r/smoke-test-report")" "200"

echo "  -- dangerous content must be stripped --"
# NOTE: author CSS is deliberately NOT stripped any more -- reports are allowed
# their own visual identity. Cosmetic declarations like hotpink / Comic Sans now
# survive on purpose; what must not survive is anything executable or anything
# that escapes the .report scope. See scripts/test-css.sh for that contract.
for pat in "alert(" "onload=" "onclick=" "javascript:" "<script" "<iframe" \
           "evil.example.com" "bgcolor" 'width="1400"' "document.cookie"; do
  check "stripped: $pat" "$(countf /tmp/rv_report.html "$pat")" "0"
done

echo "  -- author CSS passes through, but scoped --"
check "author CSS kept" "$(countf /tmp/rv_report.html 'hotpink')" "1"
check "report style block injected" "$(countf /tmp/rv_report.html 'report-supplied, sanitized')" "1"
check "no unscoped body rule from report" \
  "$(grep -oE '(^|})[[:space:]]*body[[:space:]]*\{[^}]*hotpink' /tmp/rv_report.html | wc -l | tr -d ' ')" "0"

echo "  -- expected structure must survive --"
check "table wrapped in .tw" "$(countf /tmp/rv_report.html '<div class="tw"><table')" "1"
check "TOC rendered" "$(countf /tmp/rv_report.html '目次')" "1"
check "heading anchor id" "$(countf /tmp/rv_report.html 'id="1-背景と課題"')" "1"
check "TOC link to h2" "$(countf /tmp/rv_report.html 'href="#2-手法の比較"')" "1"
check "external link hardened" "$(countf /tmp/rv_report.html 'noopener noreferrer nofollow')" "1"
check "img lazy-loaded" "$(countf /tmp/rv_report.html 'loading="lazy"')" "1"
check "arxiv link kept" "$(countf /tmp/rv_report.html 'arxiv.org/abs/2601.05111')" "1"
check "code block kept" "$(countf /tmp/rv_report.html '<pre>')" "1"
check "blockquote kept" "$(countf /tmp/rv_report.html '<blockquote>')" "1"
check "viewport fit=cover" "$(countf /tmp/rv_report.html 'viewport-fit=cover')" "1"
check "noindex" "$(countf /tmp/rv_report.html 'noindex')" "1"

echo "  -- security headers --"
HDR=$(curl -s -D - -o /dev/null "$BASE/r/smoke-test-report")
for h in "content-security-policy" "x-content-type-options" "referrer-policy" "x-frame-options"; do
  check "header: $h" "$(printf '%s' "$HDR" | grep -c -i "^$h")" "1"
done
check "cache-control private" "$(printf '%s' "$HDR" | grep -c -i 'no-store')" "1"

echo "=== 5. listing shows the report ==="
curl -s "$BASE/" -o /tmp/rv_list.html
check_min "list contains title" "$(countf /tmp/rv_list.html 'AIエージェント評価手法の最新動向')" "1"
check_min "list contains tag" "$(countf /tmp/rv_list.html '>evaluation<')" "1"
check "list has search box" "$(countf /tmp/rv_list.html 'id="q"')" "1"
check "API lists report" "$(curl -s "$BASE/api/reports" | grep -c 'smoke-test-report')" "1"

echo "=== 6. error handling ==="
check "unknown report -> 404" "$(code "$BASE/r/does-not-exist")" "404"
check "unknown path -> 404" "$(code "$BASE/nope")" "404"
check "path traversal blocked" "$(code "$BASE/r/..%2F..%2Fetc%2Fpasswd")" "400"
check "empty body -> 400" \
  "$(code -X POST "$BASE/api/reports" -H "authorization: Bearer $TOKEN" \
      -H 'content-type: text/html' --data-binary '')" "400"
check "raw view works" "$(code "$BASE/r/smoke-test-report?raw=1")" "200"

echo "=== 7. cleanup ==="
check "DELETE report" \
  "$(curl -s -X DELETE "$BASE/api/reports/smoke-test-report" -H "authorization: Bearer $TOKEN" | grep -c '"ok": true')" "1"
check "deleted -> 404" "$(code "$BASE/r/smoke-test-report")" "404"

echo
echo "================================"
printf 'PASSED: %s   FAILED: %s\n' "$pass" "$fail"
echo "================================"
[ "$fail" -eq 0 ] || exit 1
