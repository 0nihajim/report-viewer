/**
 * HTML sanitizer + normalizer built on HTMLRewriter (native to Workers).
 *
 * Goals:
 *  1. Strip anything executable from generated reports (<script>, inline event
 *     handlers, javascript: URLs, <iframe>/<object>).
 *  2. Extract only the <body> content so we can wrap it in our own mobile
 *     reading shell.
 *  3. Collect headings (h1-h3) to build a table of contents.
 *  4. Keep author CSS, but sanitized and scoped: reports are allowed their own
 *     visual identity, while the viewer chrome stays untouchable. See css.ts.
 *
 * JS is never passed through. CSS is, because a stylesheet cannot read the
 * Access session cookie -- but it *can* cover the UI or phone home, so it goes
 * through sanitizeCss() first.
 */

import { sanitizeCss } from './css';

/** Elements removed entirely, including their contents. */
const DROP_WITH_CONTENT = ['script', 'noscript', 'template', 'iframe', 'object', 'embed', 'applet'];

/** Elements removed but whose children are kept (unwrapped). */
const UNWRAP = ['html', 'body', 'head', 'meta', 'link', 'base', 'font', 'center'];

/** Attributes allowed to survive on any element. */
const GLOBAL_ATTRS = new Set(['id', 'class', 'title', 'dir', 'lang']);

/** Per-tag additional allowed attributes. */
const TAG_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'target', 'rel']),
  img: new Set(['src', 'alt', 'width', 'height', 'loading']),
  td: new Set(['colspan', 'rowspan', 'align']),
  th: new Set(['colspan', 'rowspan', 'align', 'scope']),
  col: new Set(['span']),
  colgroup: new Set(['span']),
  ol: new Set(['start', 'reversed', 'type']),
  time: new Set(['datetime']),
  code: new Set(['data-lang']),
  input: new Set(['type', 'checked', 'disabled']),
};

/**
 * Schemes allowed on a *navigational* attribute (href). A link is inert until
 * the reader clicks it, so external destinations are fine.
 */
const URL_SAFE = /^(https?:|mailto:|tel:|#|\/|\.\/|\.\.\/|data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,)/i;

/**
 * Schemes allowed on a *subresource* attribute (src). These fetch automatically
 * on render, so an external URL leaks the fact that the report was opened —
 * a tracking pixel in a generated report would phone home to whoever wrote it,
 * from inside an Access-protected session. Inline data: images and same-origin
 * paths only.
 */
const SRC_SAFE = /^(data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,|\/|\.\/|\.\.\/)/i;

export interface Heading {
  level: number;
  id: string;
  text: string;
}

export interface SanitizeResult {
  html: string;
  headings: Heading[];
  /** Title discovered from <title> or the first <h1>, if any. */
  title: string | null;
  /**
   * Author CSS, sanitized and scoped to the report container. Empty when the
   * report shipped no <style> or nothing survived sanitizing.
   */
  css: string;
}

/** Turn heading text into a URL-safe, unique anchor id. */
function slugifyHeading(text: string, used: Set<string>): string {
  let base = text
    .toLowerCase()
    .trim()
    .replace(/[\s\u3000]+/g, '-')
    // Keep word chars, hyphens, and CJK so Japanese headings still get useful anchors.
    .replace(/[^\w\-\u3040-\u30ff\u4e00-\u9fff\uff66-\uff9f]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
  if (!base) base = 'section';
  let slug = base;
  let n = 2;
  while (used.has(slug)) slug = `${base}-${n++}`;
  used.add(slug);
  return slug;
}

/**
 * Sanitize a full HTML document into an embeddable fragment.
 * Returns the fragment, its headings, and a discovered title.
 */
export async function sanitizeReport(
  source: string,
  opts: { allowCss?: boolean } = {},
): Promise<SanitizeResult> {
  const allowCss = opts.allowCss === true;
  const headings: Heading[] = [];
  const usedIds = new Set<string>();
  let docTitle: string | null = null;
  let titleBuf = '';
  let inTitle = false;

  // Tracks the heading currently being streamed so we can accumulate its text.
  let currentHeading: { level: number; id: string; text: string } | null = null;
  // >0 while inside <pre>/<code>, where whitespace must be preserved verbatim.
  let preDepth = 0;
  // Last non-whitespace character emitted in the previous text chunk. Needed
  // because HTMLRewriter splits text at tag boundaries: "。\n  <a>関連論文</a>"
  // arrives as separate chunks, so a per-chunk regex cannot see that the
  // leading whitespace of the second chunk follows a closing punctuation mark.
  let prevChar = '';
  // Author <style> contents, concatenated for one sanitize pass at the end.
  const cssBuf: string[] = [];

  const rewriter = new HTMLRewriter()
    .on('style', {
      // Author CSS is collected (not emitted inline) so it can be sanitized and
      // scoped once, then injected into <head> by the renderer.
      text(t) {
        cssBuf.push(t.text);
      },
      element(el) {
        el.remove();
      },
    })
    .on('title', {
      element() {
        inTitle = true;
        titleBuf = '';
      },
      text(t) {
        if (inTitle) titleBuf += t.text;
        if (t.lastInTextNode) {
          /* keep accumulating until element end */
        }
      },
    })
    .onDocument({
      end() {
        if (!docTitle && titleBuf.trim()) docTitle = titleBuf.trim();
      },
    });

  // HTMLRewriter has no "element end" hook with state, so we close the title
  // via a second handler on the same selector using `element.onEndTag`.
  const rw = rewriter
    .on('title', {
      element(el) {
        el.onEndTag(() => {
          inTitle = false;
          if (titleBuf.trim()) docTitle = titleBuf.trim();
        });
      },
    })
    .on(DROP_WITH_CONTENT.join(','), {
      element(el) {
        el.remove();
      },
    })
    .on(UNWRAP.join(','), {
      element(el) {
        el.removeAndKeepContent();
      },
    })
    .on('h1, h2, h3', {
      element(el) {
        const level = Number(el.tagName.slice(1));
        // Placeholder id; the real slug is computed once we have the text.
        const marker = { level, id: '', text: '' };
        currentHeading = marker;
        el.onEndTag(() => {
          const text = marker.text.replace(/\s+/g, ' ').trim();
          if (text) {
            marker.id = slugifyHeading(text, usedIds);
            marker.text = text;
            headings.push({ level, id: marker.id, text });
            if (!docTitle && level === 1) docTitle = text;
          }
          currentHeading = null;
        });
      },
      text(t) {
        if (currentHeading) currentHeading.text += t.text;
      },
    })
    .on('*', {
      element(el) {
        const tag = el.tagName.toLowerCase();
        // Whitespace is significant inside code, so CJK tightening must skip it.
        if (tag === 'pre' || tag === 'code') {
          preDepth++;
          el.onEndTag(() => {
            preDepth--;
          });
        }
        const allowed = TAG_ATTRS[tag];
        for (const [name, value] of [...el.attributes]) {
          const lower = name.toLowerCase();
          const ok = GLOBAL_ATTRS.has(lower) || allowed?.has(lower);
          if (!ok) {
            el.removeAttribute(name);
            continue;
          }
          // Reject unsafe URL schemes. src is checked more strictly than href
          // because a subresource fetches on render without user intent.
          if (lower === 'href' && !URL_SAFE.test(value.trim())) {
            el.removeAttribute(name);
          } else if (lower === 'src' && !SRC_SAFE.test(value.trim())) {
            el.removeAttribute(name);
          }
        }
        // External links open in a new tab without leaking the referrer.
        if (tag === 'a') {
          const href = el.getAttribute('href') ?? '';
          if (/^https?:/i.test(href)) {
            el.setAttribute('target', '_blank');
            el.setAttribute('rel', 'noopener noreferrer nofollow');
          }
        }
        if (tag === 'img') el.setAttribute('loading', 'lazy');
        // Wide tables are the main cause of broken mobile layout. Wrap each one
        // in a horizontal scroll container so the page itself never overflows.
        if (tag === 'table') {
          el.before('<div class="tw">', { html: true });
          el.after('</div>', { html: true });
        }
      },
      text(t) {
        // Source line breaks become spaces in HTML, which looks wrong between
        // Japanese characters. Tighten them everywhere except inside code.
        if (preDepth === 0) {
          let out = tightenCjk(t.text);
          // Cross-chunk case: HTMLRewriter splits text at tag boundaries, so
          // "。\n  <a>関連論文</a>" arrives as two chunks and the intra-chunk
          // regex cannot see the punctuation. Strip this chunk's leading
          // whitespace when the previous chunk ended in closing punctuation.
          if (prevChar && isCloser(prevChar)) {
            out = out.replace(/^[ \t\r\n\f\v]+/, '');
          }
          if (out !== t.text) {
            // t.text is NOT entity-decoded — it arrives as the raw source text
            // (verified: a chunk reads "a &lt; b"). replace() without
            // `html: true` re-escapes the ampersands, yielding "&amp;lt;" which
            // renders as the literal string "&lt;". So we must insert as HTML.
            //
            // This is safe because tightenCjk only *removes* whitespace; it
            // never introduces '<', '>' or '&', so the chunk stays exactly as
            // already-sanitized as it arrived.
            t.replace(out, { html: true });
          }
          const trimmed = out.replace(/[ \t\r\n\f\v]+$/, '');
          if (trimmed) prevChar = trimmed.slice(-1);
        }
      },
    });

  const res = rw.transform(
    new Response(source, { headers: { 'content-type': 'text/html; charset=utf-8' } }),
  );
  let html = await res.text();

  // HTMLRewriter cannot inject the computed heading ids during streaming
  // (ids are only known at the end tag), so patch them in afterwards by
  // walking the headings in document order.
  let cursor = 0;
  for (const h of headings) {
    const re = new RegExp(`<h${h.level}(\\s[^>]*)?>`, 'i');
    const rest = html.slice(cursor);
    const m = re.exec(rest);
    if (!m) continue;
    const at = cursor + m.index;
    const attrs = m[1] ?? '';
    if (/\bid\s*=/.test(attrs)) {
      cursor = at + m[0].length;
      continue;
    }
    const replacement = `<h${h.level}${attrs} id="${h.id}">`;
    html = html.slice(0, at) + replacement + html.slice(at + m[0].length);
    cursor = at + replacement.length;
  }

  // Scope author CSS to the article container so a report can restyle itself
  // without reaching the viewer chrome.
  //
  // Disabled by default. The archive's whole value is that every report reads the
  // same way, and per-report palettes destroyed that -- pages stopped feeling
  // like chapters of one book. Reports now supply structure and the viewer owns
  // appearance (see DESIGN.md + the kiroku-report skill). The machinery stays
  // because it is tested and cheap to re-enable for a one-off, but the default
  // is off and `allowCss` must be passed explicitly.
  const css = allowCss && cssBuf.length ? sanitizeCss(cssBuf.join('\n'), '.report') : '';

  return { html, headings, title: docTitle, css };
}

/** Escape a string for safe interpolation into HTML text/attribute context. */
export function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Collapse the ASCII space that source line breaks leave between CJK characters.
 *
 * Report generators wrap prose in the HTML source, and HTML turns each newline
 * into a space. In English that's correct; in Japanese it produces visible holes
 * mid-sentence ("依存しており、 長期的な"). We only remove the space when both
 * neighbours are CJK/full-width, so "span 属性" and "LLM アプリ" keep the
 * intentional spacing around Latin runs.
 */
const CJK =
  '\\u3000-\\u303f\\u3040-\\u309f\\u30a0-\\u30ff\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff\\uff00-\\uff60\\uffe0-\\uffe6';
// Whitespace here must include newlines and tabs: generators hard-wrap prose in
// the source, and the browser collapses "。\n  本レポート" into "。 本レポート".
// Matching only literal spaces left those gaps on screen.
const WS = ' \\t\\r\\n\\f\\v';
const CJK_GAP = new RegExp(`([${CJK}])[${WS}]+(?=[${CJK}])`, 'g');

// Japanese closing punctuation already carries its own trailing white space in
// the glyph, so a following space is always wrong -- even before Latin text
// ("終わっていない。 span を" showed a visible hole). Handle these separately
// from the CJK-on-both-sides rule.
const CLOSERS = '\\u3001\\u3002\\uff01\\uff09\\uff1a\\uff1b\\uff1f\\u300d\\u300f\\u3011\\u3015\\u2019\\u201d';
const CLOSER_GAP = new RegExp(`([${CLOSERS}])[${WS}]+(?=\\S)`, 'g');
const CLOSER_ONE = new RegExp(`^[${CLOSERS}]$`);

/** True when a single character is Japanese closing punctuation. */
export function isCloser(ch: string): boolean {
  return CLOSER_ONE.test(ch);
}

// Mirror image: opening brackets should not be preceded by a space.
const OPENERS = '\\uff08\\u300c\\u300e\\u3010\\u3014\\u2018\\u201c';
const OPENER_GAP = new RegExp(`(\\S)[${WS}]+(?=[${OPENERS}])`, 'g');

export function tightenCjk(text: string): string {
  // Two passes on CJK_GAP: a single pass misses runs like "。 、 あ" where
  // consecutive matches overlap on the shared lookahead character.
  return text
    .replace(CJK_GAP, '$1')
    .replace(CJK_GAP, '$1')
    .replace(CLOSER_GAP, '$1')
    .replace(OPENER_GAP, '$1');
}
