#!/usr/bin/env bash
#
# Lint a report HTML against the Kiroku design system.
#
# The viewer strips forbidden constructs anyway, but a report that *contains*
# them was authored against the wrong mental model and will look wrong. Catching
# it here is cheaper than noticing on a phone later.
#
# Usage: bash scripts/lint-report.sh samples/report-eval.html
set -uo pipefail

FILE="${1:-}"
if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
  echo "usage: bash scripts/lint-report.sh <report.html>" >&2
  exit 2
fi

errors=0
warns=0
err() { printf '  \033[31mERROR\033[0m %s\n' "$1"; errors=$((errors + 1)); }
warn() { printf '  \033[33mWARN \033[0m %s\n' "$1"; warns=$((warns + 1)); }
ok()  { printf '  \033[32mok   \033[0m %s\n' "$1"; }

echo "== $FILE =="

# --- forbidden constructs: appearance must come from the viewer --------------
echo "-- forbidden constructs --"
check_absent() { # check_absent <label> <grep-pattern>
  local n
  n=$(grep -icE "$2" "$FILE" || true)
  if [ "$n" -gt 0 ]; then err "$1 present ($n)"; else ok "no $1"; fi
}
check_absent "<style>"        '<style[ >]'
check_absent "<script>"       '<script[ >]'
check_absent "<link>"         '<link[ >]'
check_absent "inline style="  'style[[:space:]]*='
check_absent "<font>"         '<font[ >]'
check_absent "bgcolor"        'bgcolor[[:space:]]*='
check_absent "width= attr"    '<(table|td|th|img|div)[^>]*[[:space:]]width[[:space:]]*='
check_absent "align= attr"    '<(table|td|th|div|p)[^>]*[[:space:]]align[[:space:]]*='
check_absent "on* handler"    '[[:space:]]on[a-z]+[[:space:]]*='
check_absent "hand-written TOC" '(id|class)="toc"'

# --- document structure ------------------------------------------------------
echo "-- structure --"
h1=$(grep -oc '<h1[ >]' "$FILE" || true)
h1=$(grep -o '<h1[ >]' "$FILE" | wc -l | tr -d ' ')
if [ "$h1" -eq 1 ]; then ok "exactly one <h1>"; else err "<h1> count is $h1, must be 1"; fi

if grep -qiE '<h[56][ >]' "$FILE"; then err "<h5>/<h6> used; stop at h4"; else ok "no h5/h6"; fi

if grep -qE '<h[1-4][^>]*[[:space:]]id[[:space:]]*=' "$FILE"; then
  err "heading carries a hand-written id; the viewer generates slugs"
else
  ok "no hand-written heading ids"
fi

# Heading levels must not skip (h1 -> h3).
skip=$(python3 - "$FILE" <<'PY'
import re, sys
levels = [int(m) for m in re.findall(r'<h([1-4])[ >]', open(sys.argv[1], encoding='utf-8').read())]
bad = sum(1 for a, b in zip(levels, levels[1:]) if b > a + 1)
print(bad)
PY
)
if [ "$skip" -eq 0 ]; then ok "no skipped heading levels"; else err "$skip skipped heading level(s)"; fi

# --- required components ----------------------------------------------------
echo "-- required components --"
for pair in 'eyebrow:class="eyebrow"' 'lede:class="lede"' 'source:class="source"'; do
  label="${pair%%:*}"; pat="${pair#*:}"
  if grep -qF "$pat" "$FILE"; then ok ".$label present"; else err ".$label missing"; fi
done

# --- soft conventions -------------------------------------------------------
echo "-- conventions --"
figs=$(grep -o 'class="figure"' "$FILE" | wc -l | tr -d ' ')
if [ "$figs" -gt 4 ]; then warn "$figs figures; 4 is the maximum before wrapping looks bad"
elif [ "$figs" -gt 0 ]; then ok "$figs figure(s)"; fi

# A numeric-looking column with no .num is the usual cause of ragged tables.
if grep -q '<table' "$FILE" && ! grep -q 'class="num"' "$FILE"; then
  warn "table present but no class=\"num\"; numeric columns should be right-aligned"
fi

if grep -qE '<h[1-3][^>]*>[[:space:]]*[■▼◆●【]' "$FILE"; then
  warn "decorative marks in a heading; the design system supplies hierarchy"
fi

if grep -qE '(いかがでしょうか|と言えるでしょう|ではないでしょうか)' "$FILE"; then
  warn "hedging/rhetorical tail found; prefer plain declaratives"
fi

# Hard-wrapped Japanese prose relies on the viewer's CJK tightening.
wrapped=$(python3 - "$FILE" <<'PY'
import re, sys
h = open(sys.argv[1], encoding='utf-8').read()
h = re.sub(r'<pre.*?</pre>', '', h, flags=re.S)
CJK = r'\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff\u3000-\u303f'
print(len(re.findall(rf'[{CJK}][ \t]*\n[ \t]*[{CJK}]', h)))
PY
)
if [ "$wrapped" -gt 0 ]; then
  warn "$wrapped hard-wrapped CJK line break(s); viewer tightens these but one line is safer"
else
  ok "no hard-wrapped CJK prose"
fi

echo
printf 'ERRORS: %s  WARNINGS: %s\n' "$errors" "$warns"
[ "$errors" -eq 0 ] || exit 1
