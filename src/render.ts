import type { ReportMeta } from './types';
import type { Heading } from './sanitize';
import { esc } from './sanitize';

/**
 * Shared reading shell. All CSS lives here so every report — regardless of
 * what the generator emitted — renders with identical, mobile-first typography.
 */
const BASE_CSS = `
:root {
  color-scheme: light dark;
  --bg: #ffffff;
  --bg-elev: #f6f7f9;
  --bg-sunken: #eceef1;
  --fg: #1a1c1f;
  --fg-muted: #4f5661;
  --fg-faint: #626a75;
  --accent: #0b62d6;
  --accent-soft: #e5effd;
  --border: #dfe3e8;
  --radius: 12px;
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
    --border: #343a42;
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
.report h1 { font-size: 1.62rem; line-height: 1.35; font-weight: 700; letter-spacing: -.01em; }
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

/* ---------- table of contents ---------- */
details.toc {
  margin: 1.5rem 0 2rem; background: var(--bg-elev);
  border: 1px solid var(--border); border-radius: var(--radius);
  padding: .3rem .9rem;
}
details.toc > summary {
  cursor: pointer; font-weight: 640; font-size: .92rem;
  padding: .6rem 0; list-style: none;
}
details.toc > summary::-webkit-details-marker { display: none; }
details.toc > summary::before { content: "☰  "; color: var(--fg-faint); }
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
}
`;

function layout(opts: {
  title: string;
  siteTitle: string;
  body: string;
  showHome: boolean;
  /** Sanitized, .report-scoped CSS supplied by the report itself. */
  reportCss?: string;
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
<style>${BASE_CSS}</style>
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
    <span>Cloudflare Access で保護された非公開ビューア</span>
  </footer>
</div>
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

export function renderList(reports: ReportMeta[], siteTitle: string): string {
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
  <p class="empty" id="nohit" hidden>該当するレポートがありません。</p>
  <script>${LIST_JS}</script>`;

  return layout({ title: siteTitle, siteTitle, body, showHome: false });
}

export function renderReport(
  meta: ReportMeta,
  contentHtml: string,
  headings: Heading[],
  siteTitle: string,
  reportCss = '',
): string {
  // Only bother with a TOC when there is real structure to navigate.
  const tocItems = headings.filter((h) => h.level >= 2);
  const toc =
    tocItems.length >= 3
      ? `<details class="toc"><summary>目次</summary><ol>
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

  return layout({ title: meta.title, siteTitle, body, showHome: true, reportCss });
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
