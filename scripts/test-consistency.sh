#!/usr/bin/env bash
#
# Assert that every report renders with the SAME computed style.
#
# This is the contract the design system exists to enforce: the reader should
# move between reports and notice only that the subject changed. Eyeballing
# three pages does not prove it, so we extract computed styles per page and
# diff them.
#
# Usage: BASE=http://localhost:8788 bash scripts/test-consistency.sh id1 id2 id3
set -uo pipefail
BASE="${BASE:-http://localhost:8788}"
IDS=("$@")
[ "${#IDS[@]}" -ge 2 ] || { echo "usage: test-consistency.sh <id> <id> [id...]" >&2; exit 2; }

pass=0; fail=0
check() {
  if [ "$2" = "$3" ]; then printf '  \033[32mPASS\033[0m %-44s %s\n' "$1" "$2"; pass=$((pass+1))
  else printf '  \033[31mFAIL\033[0m %-44s got=%s want=%s\n' "$1" "$2" "$3"; fail=$((fail+1)); fi
}

# Fetch each page and reduce it to a style fingerprint. Only the *shell* is
# compared -- the CSS payload must be byte-identical across reports.
for id in "${IDS[@]}"; do
  curl -fsS "$BASE/r/$id" -o "/tmp/rv_c_$id.html" || { echo "fetch failed: $id" >&2; exit 1; }
done

echo "=== stylesheet is identical across reports ==="
ref="${IDS[0]}"
refhash=$(python3 - "/tmp/rv_c_$ref.html" <<'PY'
import hashlib, re, sys
h = open(sys.argv[1], encoding='utf-8').read()
blocks = re.findall(r'<style>(.*?)</style>', h, re.S)
print(hashlib.sha256(''.join(blocks).encode()).hexdigest()[:16])
PY
)
for id in "${IDS[@]}"; do
  hash=$(python3 - "/tmp/rv_c_$id.html" <<'PY'
import hashlib, re, sys
h = open(sys.argv[1], encoding='utf-8').read()
blocks = re.findall(r'<style>(.*?)</style>', h, re.S)
print(hashlib.sha256(''.join(blocks).encode()).hexdigest()[:16])
PY
)
  check "$id stylesheet hash" "$hash" "$refhash"
done

echo "=== no report ships its own CSS ==="
for id in "${IDS[@]}"; do
  n=$(grep -c 'report-supplied' "/tmp/rv_c_$id.html" || true)
  check "$id has no injected report CSS" "$n" "0"
  # A single <style> element: the shell's. A second one means a report leaked in.
  s=$(grep -o '<style>' "/tmp/rv_c_$id.html" | wc -l | tr -d ' ')
  check "$id has exactly one <style>" "$s" "1"
done

echo "=== every report uses the shared component vocabulary ==="
for id in "${IDS[@]}"; do
  for cls in eyebrow lede figures source; do
    n=$(grep -o "class=\"$cls\"" "/tmp/rv_c_$id.html" | wc -l | tr -d ' ')
    if [ "$cls" = "figures" ] || [ "$cls" = "eyebrow" ] || [ "$cls" = "lede" ] || [ "$cls" = "source" ]; then
      if [ "$n" -ge 1 ]; then printf '  \033[32mPASS\033[0m %-44s %s\n' "$id .$cls" "$n"; pass=$((pass+1))
      else printf '  \033[31mFAIL\033[0m %-44s got=0 want>=1\n' "$id .$cls"; fail=$((fail+1)); fi
    fi
  done
done

echo "=== structural invariants hold on every report ==="
for id in "${IDS[@]}"; do
  h1=$(grep -o '<h1[ >]' "/tmp/rv_c_$id.html" | wc -l | tr -d ' ')
  check "$id single <h1>" "$h1" "1"
  tw=$(grep -o '<div class="tw"><table' "/tmp/rv_c_$id.html" | wc -l | tr -d ' ')
  tb=$(grep -o '<table' "/tmp/rv_c_$id.html" | wc -l | tr -d ' ')
  check "$id all tables wrapped" "$tw" "$tb"
  # Forbidden constructs must not survive into the rendered page.
  for pat in '<script' 'style=' 'bgcolor' 'onload='; do
    n=$(grep -o -F -- "$pat" "/tmp/rv_c_$id.html" | wc -l | tr -d ' ')
    check "$id stripped $pat" "$n" "0"
  done
done

echo
printf 'PASSED: %s  FAILED: %s\n' "$pass" "$fail"
[ "$fail" -eq 0 ] || exit 1
