import type { ReportMeta } from './types';
import type { Heading } from './sanitize';
import { esc } from './sanitize';

/**
 * Shared reading shell. All CSS lives here so every report — regardless of
 * what the generator emitted — renders with identical, mobile-first typography.
 */
const BASE_CSS = `
/* Tokens are normative in DESIGN.md (Google design.md spec, lint-clean).
   Keep the two in sync: change DESIGN.md first, re-lint, then mirror here. */
:root {
  color-scheme: light dark;
  --bg: #ffffff;
  --bg-elev: #f6f7f9;
  --bg-sunken: #eceef1;
  --fg: #15181d;
  --fg-muted: #555f6e;
  --fg-faint: #5e6773;
  --accent: #0b62d6;
  --accent-soft: #e7f0fd;
  --accent-ink: #08479b;
  --border: #dde1e6;
  --positive: #0f7b52;
  --caution: #8a5a00;
  --caution-bg: #fff8e6;
  --critical: #b3261e;
  --critical-bg: #fdecea;
  --radius: 12px;
  --radius-md: 8px;
  --radius-sm: 4px;
  --maxw: 46rem;
  --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace;
  --sans: -apple-system, BlinkMacSystemFont, "Hiragino Kaku Gothic ProN",
          "Hiragino Sans", "Noto Sans JP", "Yu Gothic UI", sans-serif;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #16181c;
    --bg-elev: #22262c;
    --bg-sunken: #2a2f36;
    --fg: #e8eaed;
    --fg-muted: #bcc3cd;
    --fg-faint: #a2aab6;
    --accent: #6aa9ff;
    --accent-soft: #22344d;
    --accent-ink: #b8d5ff;
    --border: #343a42;
    --positive: #5cc9a0;
    --caution: #e0b65c;
    --caution-bg: #2f2a1c;
    --critical: #f0918a;
    --critical-bg: #33211f;
  }
}
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0;
  /* Pin the footer to the bottom on short pages instead of letting it float
     in the middle of a mostly-empty viewport. */
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  background: var(--bg);
  color: var(--fg);
  font-family: var(--sans);
  font-size: 17px;
  line-height: 1.8;
  /* Respect the iPhone notch / home indicator. */
  padding: 0 max(1rem, env(safe-area-inset-left)) env(safe-area-inset-bottom);
  overflow-wrap: break-word;
  -webkit-font-smoothing: antialiased;
}
.wrap {
  max-width: var(--maxw);
  margin: 0 auto;
  width: 100%;
  flex: 1;
  display: flex;
  flex-direction: column;
}
.wrap > footer { margin-top: auto; }

/* ---------- sticky header ---------- */
.top {
  position: sticky; top: 0; z-index: 20;
  display: flex; align-items: center; gap: .75rem;
  padding: calc(env(safe-area-inset-top) + 1.6rem) 0 .85rem;
  background: color-mix(in srgb, var(--bg) 88%, transparent);
  backdrop-filter: saturate(180%) blur(14px);
  -webkit-backdrop-filter: saturate(180%) blur(14px);
  border-bottom: 1px solid var(--border);
}
/* Index view: the site name is the page's H1, so make it read like one. */
.top.index h1 { font-size: 1.5rem; font-weight: 720; letter-spacing: -.015em; }
.top h1 { font-size: 1.02rem; margin: 0; font-weight: 640; letter-spacing: .01em; }
/* Breadcrumb label on report pages: truncates instead of wrapping the bar. */
.top .crumb {
  font-size: .95rem; margin: 0; font-weight: 600; color: var(--fg-muted);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0;
}
.top a.home {
  color: var(--accent); text-decoration: none; font-weight: 600;
  font-size: .95rem; white-space: nowrap;
  /* 44px min touch target per Apple HIG. */
  min-height: 44px; display: inline-flex; align-items: center;
}
.spacer { flex: 1; }

/* ---------- list view ---------- */
/* Leading magnifier icon: an inline SVG background keeps the CSP free of
   external requests while giving the field a real affordance. */
.searchwrap { position: relative; margin: 1.5rem 0 .9rem; }
.searchwrap::before {
  content: ""; position: absolute; left: .85rem; top: 50%;
  transform: translateY(-50%); width: 1.05rem; height: 1.05rem;
  pointer-events: none; opacity: .55;
  background: currentColor;
  -webkit-mask: var(--mag) center / contain no-repeat;
  mask: var(--mag) center / contain no-repeat;
}
:root {
  --mag: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4.3-4.3"/></svg>');
}
.search {
  width: 100%; font: inherit; font-size: 1rem;
  padding: .55rem .9rem .55rem 2.5rem;
  min-height: 46px;
  background: var(--bg-elev); color: var(--fg);
  border: 1px solid var(--border); border-radius: var(--radius);
  -webkit-appearance: none;
}
.search::placeholder { color: var(--fg-faint); }
.search:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 25%, transparent);
}
.count { color: var(--fg-faint); font-size: .82rem; margin: 0 0 .8rem; }
ul.reports { list-style: none; margin: 0; padding: 0; }
ul.reports li { margin-bottom: .7rem; }
a.card {
  display: block; text-decoration: none; color: inherit;
  background: var(--bg-elev); border: 1px solid var(--border);
  border-radius: var(--radius); padding: .95rem 2rem .95rem 1.05rem;
  position: relative;
  transition: transform .12s ease, border-color .12s ease, background .12s ease;
}
/* Chevron signals "this whole row is a link". */
a.card::after {
  content: "›"; position: absolute; right: .9rem; top: 50%;
  transform: translateY(-50%); color: var(--fg-faint);
  font-size: 1.4rem; line-height: 1; font-weight: 400;
}
a.card:hover { border-color: var(--accent); background: var(--bg-sunken); }
a.card:hover::after { color: var(--accent); }
a.card:active { transform: scale(.985); border-color: var(--accent); }
a.card:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
a.card .t { font-weight: 640; font-size: 1.02rem; line-height: 1.45; display: block; }
a.card .s {
  color: var(--fg-muted); font-size: .89rem; line-height: 1.6;
  margin-top: .3rem; display: -webkit-box; -webkit-line-clamp: 2;
  -webkit-box-orient: vertical; overflow: hidden;
}
a.card .m {
  margin-top: .6rem; display: flex; flex-wrap: wrap; gap: .45rem .7rem;
  align-items: center; font-size: .79rem; color: var(--fg-faint);
}
.tag {
  background: var(--accent-soft); color: var(--accent);
  padding: .16rem .62rem; border-radius: 999px;
  font-size: .75rem; font-weight: 600; line-height: 1.6;
}
.empty {
  text-align: center; color: var(--fg-faint);
  padding: 3.5rem 1rem; line-height: 1.9;
}

/* ---------- report view ---------- */
.meta {
  color: var(--fg-faint); font-size: .84rem;
  display: flex; flex-wrap: wrap; gap: .4rem .6rem;
  align-items: center; margin: 1.4rem 0 .5rem;
}
.report h1:first-of-type { margin-top: .3rem; }
/* h1 must clearly dominate: at 1.62rem it sat only ~5px above h2 and the
   document title read as just another section. */
.report h1 { font-size: 1.95rem; line-height: 1.32; font-weight: 700; letter-spacing: -.015em; }
.report h2 {
  font-size: 1.28rem; line-height: 1.4; margin-top: 2.4rem;
  padding-bottom: .3rem; border-bottom: 1px solid var(--border); font-weight: 680;
}
.report h3 { font-size: 1.08rem; margin-top: 1.8rem; font-weight: 660; }
.report h1, .report h2, .report h3 { scroll-margin-top: 4.5rem; }
.report p { margin: 1.05rem 0; }
.report a { color: var(--accent); text-decoration-thickness: 1px; text-underline-offset: 2px; }
.report ul, .report ol { padding-left: 1.4rem; }
.report li { margin: .4rem 0; }
.report img { max-width: 100%; height: auto; border-radius: 8px; display: block; }
.report blockquote {
  margin: 1.2rem 0; padding: .1rem 1rem;
  border-left: 3px solid var(--accent); color: var(--fg-muted);
  background: var(--bg-elev); border-radius: 0 8px 8px 0;
}
.report code {
  font-family: var(--mono); font-size: .88em;
  background: var(--bg-sunken); padding: .12em .38em; border-radius: 5px;
}
.report pre {
  background: var(--bg-sunken); border: 1px solid var(--border);
  padding: .9rem 1rem; border-radius: var(--radius);
  overflow-x: auto; -webkit-overflow-scrolling: touch;
  font-size: .84rem; line-height: 1.65;
}
.report pre code { background: none; padding: 0; font-size: inherit; }
.report hr { border: none; border-top: 1px solid var(--border); margin: 2.2rem 0; }
/* Tables are the #1 mobile layout breaker: wrap in a scroll container. */
.report .tw { overflow-x: auto; -webkit-overflow-scrolling: touch; margin: 1.3rem 0; }
.report table { border-collapse: collapse; width: 100%; font-size: .88rem; }
.report th, .report td {
  border: 1px solid var(--border); padding: .5rem .7rem;
  text-align: left; vertical-align: top;
}
.report th { background: var(--bg-elev); font-weight: 650; white-space: nowrap; }

/* ---------- design-system components ----------
   Vocabulary authored reports may use. Defined here, never by the report:
   see DESIGN.md and the kiroku-report skill. */

/* Category kicker above the h1. */
.report .eyebrow {
  font-size: .72rem; font-weight: 700; letter-spacing: .08em;
  color: var(--fg-faint); text-transform: none;
  margin: 0 0 .35rem;
}

/* One-sentence finding under the h1. Was 1.06rem, indistinguishable from body
   text at 17px — the distinction rested on color alone. */
.report .lede {
  font-size: 1.18rem; color: var(--fg-muted); line-height: 1.7;
  margin: .55rem 0 1.7rem;
}

/* Stat block. Numbers the reader will look for twice. */
.report .figures {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
  gap: 1px;
  background: var(--border);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  overflow: hidden;
  margin: 1.5rem 0 1.8rem;
}
.report .figure { background: var(--bg); padding: .85rem .9rem; }
.report .figure-label {
  font-size: .72rem; font-weight: 700; letter-spacing: .06em;
  color: var(--fg-faint); margin-bottom: .3rem;
}
.report .figure-value {
  font-family: var(--mono);
  font-size: 1.5rem; font-weight: 600; line-height: 1.2;
  font-variant-numeric: tabular-nums;
  color: var(--fg);
}
.report .figure-value .unit {
  font-size: .8rem; font-weight: 400; color: var(--fg-faint); margin-left: .15em;
}
.report .figure-delta { font-size: .76rem; margin-top: .25rem; color: var(--fg-faint); }
.report .figure-delta.up { color: var(--positive); }
.report .figure-delta.down { color: var(--critical); }

/* Emphasis block. At most one per section. */
.report .callout {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: .9rem 1rem;
  margin: 1.5rem 0;
  background: var(--bg-elev);
}
.report .callout > :first-child { margin-top: 0; }
.report .callout > :last-child { margin-bottom: 0; }
.report .callout.warn {
  background: var(--caution-bg);
  border-color: color-mix(in srgb, var(--caution) 35%, transparent);
  color: var(--caution);
}
.report .callout.critical {
  background: var(--critical-bg);
  border-color: color-mix(in srgb, var(--critical) 35%, transparent);
  color: var(--critical);
}

/* Right-aligned numeric column, tabular so ledger columns line up. */
.report th.num, .report td.num {
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

/* Provenance line. A report without sources is an opinion. */
.report .source {
  font-size: .82rem; color: var(--fg-faint); line-height: 1.7;
  border-top: 1px solid var(--border);
  padding-top: .9rem; margin-top: 2.4rem;
}

/* Japanese has no true italic, so a slanted kana run looks like a rendering
   fault. Render <em> as 傍点 instead and keep italic for Latin only.
   The dots sit above the glyphs and overflow the line box, colliding with the
   line above; the padding restores the rhythm without touching other lines. */
.report em {
  font-style: normal;
  -webkit-text-emphasis: dot;
  text-emphasis: dot;
  -webkit-text-emphasis-position: over right;
  text-emphasis-position: over right;
  line-height: 2.15;
}
.report p:has(em) { line-height: 2.15; }
.report em:lang(en) {
  font-style: italic;
  text-emphasis: none;
  -webkit-text-emphasis: none;
  line-height: inherit;
}

/* ---------- viewer-drawn figures ----------
   The report supplies numbers via data-*; these rules and FIGURE_JS draw them.
   Same chart look in every report, which per-report CSS could never give.
   All motion is gated behind prefers-reduced-motion. */

/* Shared figure frame: caption above, content below, hairline border. */
.report figure.viz {
  margin: 1.8rem 0;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg);
  overflow: hidden;
}
.report figure.viz > figcaption {
  font-size: .74rem; font-weight: 700; letter-spacing: .07em;
  color: var(--fg-faint);
  padding: .7rem .9rem .6rem;
  border-bottom: 1px solid var(--border);
  background: var(--bg-elev);
}
.report figure.viz .vizbody { padding: .95rem .9rem 1rem; }
.report figure.viz .note {
  font-size: .76rem; color: var(--fg-faint); line-height: 1.6;
  padding: 0 .9rem .85rem;
}

/* --- horizontal bars: the workhorse for "compare these magnitudes" --- */
.report .bars { display: grid; gap: .7rem; }
.report .bar { display: grid; grid-template-columns: 1fr auto; gap: .15rem .6rem; }
.report .bar .blabel {
  font-size: .84rem; color: var(--fg); grid-column: 1;
  overflow-wrap: anywhere;
}
.report .bar .bval {
  font-family: var(--mono); font-size: .84rem; font-variant-numeric: tabular-nums;
  color: var(--fg-muted); grid-column: 2; white-space: nowrap;
}
.report .bar .btrack {
  grid-column: 1 / -1;
  height: 8px; border-radius: 999px;
  background: var(--bg-sunken);
  overflow: hidden;
}
.report .bar .bfill {
  display: block; height: 100%; border-radius: 999px;
  background: var(--accent);
  /* Set by FIGURE_JS; starts at 0 so the grow animation has somewhere to go. */
  width: 0;
  transition: width .9s cubic-bezier(.22, .61, .36, 1);
}
.report .bar[data-tone="positive"] .bfill { background: var(--positive); }
.report .bar[data-tone="caution"]  .bfill { background: var(--caution); }
.report .bar[data-tone="critical"] .bfill { background: var(--critical); }

/* Scale footer: without it a bar that stops at 85% looks like a bug rather than
   a value measured against a declared ceiling. */
.report .bars + .scale,
.report .scale {
  display: flex; justify-content: space-between;
  margin-top: .55rem; padding-top: .4rem;
  border-top: 1px solid var(--border);
  font-size: .7rem; color: var(--fg-faint);
  font-variant-numeric: tabular-nums;
}

/* --- sparkline: trend shape, not precise values --- */
.report .spark { display: block; width: 100%; height: 58px; overflow: visible; }
.report .spark .sline {
  fill: none; stroke: var(--accent); stroke-width: 2;
  stroke-linecap: round; stroke-linejoin: round;
  /* Drawn on reveal by animating the dash offset. */
  stroke-dasharray: var(--len) var(--len);
  stroke-dashoffset: var(--len);
  transition: stroke-dashoffset 1.1s ease-out;
}
.report .spark .sarea { fill: var(--accent-soft); opacity: 0; transition: opacity .8s ease-out .3s; }
.report .spark .sdot { fill: var(--accent); opacity: 0; transition: opacity .3s ease-out .9s; }
.report .spark .sbase { stroke: var(--border); stroke-width: 1; }
.report .sparkfoot {
  display: flex; justify-content: space-between;
  font-size: .72rem; color: var(--fg-faint); margin-top: .3rem;
  font-variant-numeric: tabular-nums;
}

/* --- timeline / process: ordered steps with state --- */
.report ol.timeline { list-style: none; margin: 0; padding: 0; }
/* A timeline used directly in the article (not wrapped in figure.viz) needs its
   own frame, or the container rhythm breaks halfway down the page. */
.report > ol.timeline {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  margin: 1.8rem 0; padding: 1rem 1rem .3rem;
}
.report ol.timeline > li {
  position: relative;
  padding: 0 0 1.05rem 1.6rem;
  margin: 0;
}
.report ol.timeline > li::before {
  content: ""; position: absolute; left: 0; top: .42rem;
  width: 9px; height: 9px; border-radius: 50%;
  background: var(--bg); border: 2px solid var(--border);
  z-index: 1;
}
/* Connector runs between dots, stopping at the last item. */
.report ol.timeline > li:not(:last-child)::after {
  content: ""; position: absolute;
  left: 4px; top: 1.15rem; bottom: -.1rem;
  width: 1px; background: var(--border);
}
.report ol.timeline > li[data-state="done"]::before {
  background: var(--accent); border-color: var(--accent);
}
.report ol.timeline > li[data-state="active"]::before {
  background: var(--bg); border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.report ol.timeline .tstep { font-weight: 660; font-size: .95rem; }
.report ol.timeline .tmeta {
  font-size: .78rem; color: var(--fg-faint);
  font-variant-numeric: tabular-nums;
}
.report ol.timeline > li[data-state="todo"] .tstep { color: var(--fg-muted); }

/* --- two-column comparison: "A vs B" without a table --- */
.report .versus {
  display: grid; grid-template-columns: 1fr 1fr; gap: 1px;
  background: var(--border);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  overflow: hidden;
  margin: 1.8rem 0;
}
.report .versus > div { background: var(--bg); padding: .85rem .9rem; }
/* Inside figure.viz the card already provides the frame; avoid a double border. */
.report figure.viz .versus,
.report figure.viz ol.timeline {
  border: none; border-radius: 0; margin: 0; padding: 0;
}
.report .versus h4 {
  margin: 0 0 .45rem; font-size: .8rem; letter-spacing: .04em;
  color: var(--fg-faint); font-weight: 700;
}
.report .versus ul { margin: 0; padding-left: 1.1rem; }
.report .versus li { font-size: .87rem; margin: .3rem 0; }
@media (max-width: 30rem) {
  .report .versus { grid-template-columns: 1fr; }
}

/* Reveal-on-scroll: content is visible by default and only animates when JS has
   marked it, so a JS failure degrades to a static, readable figure. */
.report .reveal { opacity: 1; }
.report .js .reveal, .js .report .reveal {
  opacity: 0; transform: translateY(8px);
  transition: opacity .5s ease-out, transform .5s ease-out;
}
.js .report .reveal.in { opacity: 1; transform: none; }

@media (prefers-reduced-motion: reduce) {
  .report .bar .bfill,
  .report .spark .sline,
  .report .spark .sarea,
  .report .spark .sdot,
  .js .report .reveal { transition: none; }
  .js .report .reveal { opacity: 1; transform: none; }
  .report .spark .sline { stroke-dashoffset: 0; }
  .report .spark .sarea, .report .spark .sdot { opacity: 1; }
}
`;

/**
 * Draws the data-* driven figures and runs reveal-on-scroll.
 *
 * Runs on the report page only. Everything degrades to readable static content
 * if this never executes: bars keep their value as text, sparklines are replaced
 * rather than enhanced, and .reveal stays opaque until the `js` class is set.
 */
const FIGURE_JS = `
(function(){
  var d = document;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  d.documentElement.classList.add('js');

  function num(v){ var n = parseFloat(v); return isFinite(n) ? n : 0; }

  // --- bars: width comes from data-value against the group's max ---
  Array.prototype.forEach.call(d.querySelectorAll('.report .bars'), function(group){
    var rows = [].slice.call(group.querySelectorAll('.bar'));
    var declared = num(group.getAttribute('data-max'));
    var max = declared > 0 ? declared : rows.reduce(function(m, r){
      return Math.max(m, num(r.getAttribute('data-value')));
    }, 0);
    if (max <= 0) max = 1;
    rows.forEach(function(r){
      var track = r.querySelector('.btrack');
      if (!track) {
        track = d.createElement('span');
        track.className = 'btrack';
        track.appendChild(d.createElement('span')).className = 'bfill';
        r.appendChild(track);
      }
      var fill = track.querySelector('.bfill');
      var pct = Math.max(0, Math.min(100, (num(r.getAttribute('data-value')) / max) * 100));
      fill.setAttribute('data-pct', pct);
      // aria: the bar is decorative; the value is already in .bval text.
      track.setAttribute('aria-hidden', 'true');
      if (reduce) fill.style.width = pct + '%';
    });

    // State the ceiling. A bar stopping at 85% is otherwise indistinguishable
    // from a rendering bug.
    if (rows.length && !group.nextElementSibling?.classList.contains('scale')) {
      var sc = d.createElement('div');
      sc.className = 'scale';
      var unit = group.getAttribute('data-label') || '';
      sc.innerHTML = '<span>0</span><span>' +
        max.toLocaleString('ja-JP') + (unit ? ' ' + unit : '') + '</span>';
      group.parentNode.insertBefore(sc, group.nextSibling);
    }
  });

  // --- sparklines: replace the placeholder with an SVG path ---
  Array.prototype.forEach.call(d.querySelectorAll('.report .spark'), function(host){
    var pts = (host.getAttribute('data-points') || '').split(',')
      .map(function(s){ return parseFloat(s); })
      .filter(function(n){ return isFinite(n); });
    if (pts.length < 2) return;

    var W = 300, H = 58, P = 4;
    // Extra right inset so the terminal dot does not touch the card padding.
    var RP = 7;
    var lo = Math.min.apply(null, pts), hi = Math.max.apply(null, pts);
    // Anchor the vertical scale at zero unless the series goes negative.
    // Scaling from the minimum makes a 12->58 rise fill the whole band as if it
    // climbed from nothing, which exaggerates the slope and misleads.
    var base = lo < 0 ? lo : 0;
    var top = hi === base ? base + 1 : hi;
    var span = top - base;
    var xy = pts.map(function(v, i){
      return [
        P + (i / (pts.length - 1)) * (W - P - RP),
        P + (1 - (v - base) / span) * (H - P * 2)
      ];
    });
    var line = xy.map(function(p, i){
      return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1);
    }).join(' ');
    var area = line + ' L' + xy[xy.length - 1][0].toFixed(1) + ' ' + (H - P) +
               ' L' + xy[0][0].toFixed(1) + ' ' + (H - P) + ' Z';

    var NS = 'http://www.w3.org/2000/svg';
    var svg = d.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('class', 'spark');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', host.getAttribute('data-label') || '推移');

    var ap = d.createElementNS(NS, 'path');
    ap.setAttribute('d', area); ap.setAttribute('class', 'sarea');
    var lp = d.createElementNS(NS, 'path');
    lp.setAttribute('d', line); lp.setAttribute('class', 'sline');
    var last = xy[xy.length - 1];
    var dot = d.createElementNS(NS, 'circle');
    dot.setAttribute('cx', last[0].toFixed(1));
    dot.setAttribute('cy', last[1].toFixed(1));
    dot.setAttribute('r', '3'); dot.setAttribute('class', 'sdot');

    // Baseline sits at the zero anchor, so the area reads against a real datum.
    var axis = d.createElementNS(NS, 'line');
    axis.setAttribute('x1', P); axis.setAttribute('x2', W - RP);
    axis.setAttribute('y1', H - P); axis.setAttribute('y2', H - P);
    axis.setAttribute('class', 'sbase');

    svg.appendChild(axis); svg.appendChild(ap); svg.appendChild(lp); svg.appendChild(dot);
    host.parentNode.replaceChild(svg, host);

    // Axis labels: state the range and the unit, or the shape is decorative.
    // Ends are marked so 12/58 aren't misread as first/last x values.
    var unit = host.getAttribute('data-label') || '';
    var m = unit.match(/[（(]([^）)]+)[）)]\s*$/);
    var suffix = m ? m[1] : '';
    var foot = d.createElement('div');
    foot.className = 'sparkfoot';
    foot.innerHTML = '<span>最小 ' + lo.toLocaleString('ja-JP') + suffix + '</span>' +
                     '<span>最大 ' + hi.toLocaleString('ja-JP') + suffix + '</span>';
    svg.parentNode.insertBefore(foot, svg.nextSibling);

    // Dash length must be measured after insertion.
    var len = lp.getTotalLength ? lp.getTotalLength() : 0;
    lp.style.setProperty('--len', len);
    if (reduce) { lp.style.strokeDashoffset = '0'; ap.style.opacity = 1; dot.style.opacity = 1; }
  });

  // --- reveal on scroll, and trigger the figure animations at that moment ---
  function activate(el){
    el.classList.add('in');
    Array.prototype.forEach.call(el.querySelectorAll('.bfill'), function(f){
      f.style.width = (f.getAttribute('data-pct') || 0) + '%';
    });
    Array.prototype.forEach.call(el.querySelectorAll('.sline'), function(l){
      l.style.strokeDashoffset = '0';
    });
    Array.prototype.forEach.call(el.querySelectorAll('.sarea, .sdot'), function(n){
      n.style.opacity = '1';
    });
  }

  var targets = [].slice.call(d.querySelectorAll('.report figure.viz, .report .reveal'));
  targets.forEach(function(t){ t.classList.add('reveal'); });

  if (reduce || !('IntersectionObserver' in window)) {
    targets.forEach(activate);
    return;
  }
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if (e.isIntersecting) { activate(e.target); io.unobserve(e.target); }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.15 });
  targets.forEach(function(t){ io.observe(t); });

  // Safety net: anything still waiting after 2.5s gets activated regardless.
  // A figure parked at opacity:0 is indistinguishable from a broken chart, and
  // that is exactly what a full-page screenshot, a print, or a fast scroll past
  // the observer's threshold produces.
  setTimeout(function(){
    targets.forEach(function(t){
      if (!t.classList.contains('in')) { activate(t); io.unobserve(t); }
    });
  }, 2500);

  // Print must never show a blank box.
  var mql = matchMedia('print');
  function onPrint(){ targets.forEach(activate); }
  if (mql.addEventListener) mql.addEventListener('change', onPrint);
  window.addEventListener('beforeprint', onPrint);
})();
`;

/** Shell chrome: TOC, footer, print rules. Appended to BASE_CSS. */
const CHROME_CSS = `
/* ---------- table of contents ---------- */
details.toc {
  margin: 1.5rem 0 2rem; background: var(--bg-elev);
  border: 1px solid var(--border); border-radius: var(--radius);
  padding: .3rem .9rem;
}
details.toc > summary {
  cursor: pointer; font-weight: 640; font-size: .92rem;
  padding: .6rem 0; list-style: none;
  display: flex; align-items: center; gap: .5rem;
}
details.toc > summary::-webkit-details-marker { display: none; }
/* A collapsed panel showing only a label reads as an empty broken box — three
   separate reviews reported this TOC as "empty". The chevron is the affordance
   that says it opens, and it rotates to show state. */
details.toc > summary::after {
  content: "›";
  margin-left: auto;
  color: var(--fg-faint);
  font-size: 1.25rem; line-height: 1;
  transform: rotate(90deg);
  transition: transform .15s ease;
}
details.toc[open] > summary::after { transform: rotate(-90deg); }
/* Item count so the reader knows there is something inside before opening. */
details.toc > summary .n {
  font-weight: 400; font-size: .82rem; color: var(--fg-faint);
  font-variant-numeric: tabular-nums;
}
@media (prefers-reduced-motion: reduce) {
  details.toc > summary::after { transition: none; }
}
details.toc ol { list-style: none; margin: 0 0 .6rem; padding-left: .2rem; }
details.toc li { margin: .1rem 0; }
details.toc a {
  color: var(--fg-muted); text-decoration: none;
  font-size: .9rem; display: block; padding: .32rem 0;
}
details.toc a:active { color: var(--accent); }
details.toc li.lv3 { padding-left: 1.1rem; font-size: .95em; }

footer {
  margin: 3.5rem 0 2rem; padding-top: 1.2rem;
  border-top: 1px solid var(--border);
  color: var(--fg-faint); font-size: .8rem;
  display: flex; gap: .8rem; flex-wrap: wrap; align-items: center;
}
footer a { color: var(--fg-muted); }
@media print {
  .top, details.toc, footer { display: none; }
  body { font-size: 11pt; }
  /* Reveal-on-scroll never fires for a print render, so force figures visible.
     Bar widths still come from JS via beforeprint. */
  .js .report .reveal { opacity: 1 !important; transform: none !important; }
  .report figure.viz { break-inside: avoid; }
  .report .spark .sline { stroke-dashoffset: 0 !important; }
  .report .spark .sarea, .report .spark .sdot { opacity: 1 !important; }
}
`;

function layout(opts: {
  title: string;
  siteTitle: string;
  body: string;
  showHome: boolean;
  /** Sanitized, .report-scoped CSS supplied by the report itself. */
  reportCss?: string;
  /** Inline script appended before </body> (figure drawing, list filtering). */
  script?: string;
  /**
   * Footer line. Stating "protected by Cloudflare Access" on a deployment that
   * has no access control is a lie the reader can act on, so the note travels
   * with the deployment instead of being hardcoded.
   */
  footerNote: string;
}): string {
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<meta name="robots" content="noindex, nofollow, noarchive">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="${esc(opts.siteTitle)}">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="apple-touch-icon" href="/icon.png">
<title>${esc(opts.title)}</title>
<style>${BASE_CSS}${CHROME_CSS}</style>
${opts.reportCss ? `<style>/* report-supplied, sanitized + scoped to .report */\n${opts.reportCss}</style>` : ''}
</head>
<body>
<div class="wrap">
  <header class="top${opts.showHome ? '' : ' index'}">
    ${opts.showHome ? '<a class="home" href="/">‹ 一覧</a>' : ''}
    ${
      opts.showHome
        ? // On a report page the article supplies the document's h1, so the sticky
          // bar is just a breadcrumb label — not another top-level heading.
          `<p class="crumb">${esc(opts.title)}</p>`
        : `<h1>${esc(opts.siteTitle)}</h1>`
    }
    <span class="spacer"></span>
  </header>
  ${opts.body}
  <footer>
    <span>${esc(opts.footerNote)}</span>
  </footer>
</div>
${opts.script ? `<script>${opts.script}</script>` : ''}
</body>
</html>`;
}

/** Format an ISO date as YYYY-MM-DD (JST) for display. */
function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Tokyo',
  }).format(d);
}

/** Client-side filter for the list view: instant, no network round-trip. */
const LIST_JS = `
(function () {
  var q = document.getElementById('q');
  var items = Array.prototype.slice.call(document.querySelectorAll('ul.reports li'));
  var count = document.getElementById('count');
  var none = document.getElementById('nohit');
  var total = items.length;
  function apply() {
    var v = q.value.trim().toLowerCase();
    var shown = 0;
    items.forEach(function (li) {
      var hit = !v || li.dataset.search.indexOf(v) !== -1;
      li.hidden = !hit;
      if (hit) shown++;
    });
    count.textContent = v ? shown + ' / ' + total + ' 件' : total + ' 件';
    // Without this the list just goes blank and looks broken.
    none.hidden = shown !== 0;
  }
  q.addEventListener('input', apply);
  apply();
})();
`;

/**
 * Footer note when the deployment doesn't say otherwise. The Cloudflare Access
 * wording only applies to the private deployment; the GitHub Pages preview has
 * no access control, and claiming otherwise there would mislead the reader about
 * whether the content is public.
 */
const FOOTER_DEFAULT = '非公開ビューア（Cloudflare Access 保護）';

export function renderList(reports: ReportMeta[], siteTitle: string, footerNote = FOOTER_DEFAULT): string {
  const body =
    reports.length === 0
      ? `<p class="empty">レポートがまだありません。<br>生成側から <code>POST /api/reports</code> で投入してください。</p>`
      : `
  <div class="searchwrap">
    <input id="q" class="search" type="search" placeholder="タイトル・タグで絞り込み" autocomplete="off" enterkeyhint="search" aria-label="レポートを絞り込む">
  </div>
  <p class="count" id="count"></p>
  <ul class="reports">
${reports
  .map((r) => {
    const hay = [r.title, r.summary ?? '', r.tags.join(' '), r.date].join(' ').toLowerCase();
    return `    <li data-search="${esc(hay)}">
      <a class="card" href="/r/${encodeURIComponent(r.id)}">
        <span class="t">${esc(r.title)}</span>
        ${r.summary ? `<span class="s">${esc(r.summary)}</span>` : ''}
        <span class="m">
          <span>${esc(fmtDate(r.date))}</span>
          ${r.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}
        </span>
      </a>
    </li>`;
  })
  .join('\n')}
  </ul>
  <p class="empty" id="nohit" hidden>該当するレポートがありません。</p>`;

  return layout({ title: siteTitle, siteTitle, body, showHome: false, script: LIST_JS, footerNote });
}

export function renderReport(
  meta: ReportMeta,
  contentHtml: string,
  headings: Heading[],
  siteTitle: string,
  reportCss = '',
  footerNote = FOOTER_DEFAULT,
): string {
  // Only bother with a TOC when there is real structure to navigate.
  const tocItems = headings.filter((h) => h.level >= 2);
  const toc =
    tocItems.length >= 3
      ? `<details class="toc"><summary>目次<span class="n">${tocItems.length}項目</span></summary><ol>
${tocItems
  .map((h) => `  <li class="lv${h.level}"><a href="#${esc(h.id)}">${esc(h.text)}</a></li>`)
  .join('\n')}
</ol></details>`
      : '';

  // Most generated reports already open with their own <h1>. Emitting another
  // one here produced a visible duplicate title (and three <h1> elements on the
  // page counting the sticky header), so only add ours when the report has none.
  const hasOwnH1 = headings.some((h) => h.level === 1);
  const heading = hasOwnH1 ? '' : `    <h1>${esc(meta.title)}</h1>\n`;

  const body = `
  <p class="meta">
    <span>${esc(fmtDate(meta.date))}</span>
    ${meta.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}
  </p>
  ${toc}
  <article class="report">
${heading}${contentHtml}
  </article>`;

  return layout({
    title: meta.title, siteTitle, body, showHome: true,
    reportCss, script: FIGURE_JS, footerNote,
  });
}

export function renderManifest(siteTitle: string): string {
  return JSON.stringify({
    name: siteTitle,
    short_name: 'Reports',
    start_url: '/',
    display: 'standalone',
    background_color: '#16181c',
    theme_color: '#16181c',
    icons: [{ src: '/icon.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }],
  });
}
