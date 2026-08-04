#!/usr/bin/env bash
# Verify the live GitHub Pages deployment carries the figures and shared styles.
set -uo pipefail
B=https://0nihajim.github.io/report-viewer

echo "=== HTTP status ==="
for p in / /r/eval.html /r/inference.html /r/otel.html /icon.png /manifest.webmanifest; do
  printf '  %-26s %s\n' "$p" "$(curl -s -o /dev/null -w '%{http_code}' "$B$p")"
done

curl -s "$B/r/inference.html" -o /tmp/live_inf.html

echo "=== figures + motion shipped ==="
for p in 'figure class="viz"' 'data-points=' 'data-max="6000"' 'IntersectionObserver' 'beforeprint' 'prefers-reduced-motion'; do
  printf '  %-26s %s\n' "$p" "$(grep -o -F -- "$p" /tmp/live_inf.html | wc -l | tr -d ' ')"
done

echo "=== one shared stylesheet across reports ==="
python3 - <<'PY'
import hashlib, re, urllib.request
seen = set()
for i in ('eval', 'inference', 'otel'):
    u = f'https://0nihajim.github.io/report-viewer/r/{i}.html'
    h = urllib.request.urlopen(u).read().decode()
    css = ''.join(re.findall(r'<style>(.*?)</style>', h, re.S))
    d = hashlib.sha256(css.encode()).hexdigest()[:16]
    seen.add(d)
    print(' ', i.ljust(11), d, 'scripts=%d' % h.count('<script>'))
print()
print('IDENTICAL' if len(seen) == 1 else 'MISMATCH: %d stylesheets' % len(seen))
PY
