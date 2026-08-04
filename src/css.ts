/**
 * CSS sanitizer for author-supplied report styles.
 *
 * Reports arrive from a generator we do not fully trust, but their design is the
 * point -- so instead of dropping <style> we neutralize the parts that can harm
 * the viewer, then scope what remains so it cannot touch the app shell.
 *
 * Threats handled:
 *   - Escaping the article: every selector gets prefixed with the scope class,
 *     so `body { }` or `.top { }` in a report cannot restyle the viewer chrome.
 *   - Clickjacking / chrome cover-up: `position: fixed|sticky` and large
 *     `z-index` are stripped so a report cannot float over the header.
 *   - Privacy leaks: `@import` and any external `url()` are removed, so merely
 *     opening a report cannot phone home. `data:` images stay allowed.
 *   - Viewport blowout: `100vw`-style widths on wide elements are the main cause
 *     of horizontal scroll on iPhone, so we clamp width declarations.
 *   - JS execution: `expression()`, `javascript:` and `-moz-binding` are removed
 *     (legacy IE vectors, cheap to keep out).
 */

/** Declarations that let content escape or overlay the viewer shell. */
const BANNED_PROPS = new Set([
  'position', // fixed/sticky can cover the header; see rewriteDecl for the nuance
  'z-index',
  '-moz-binding',
  'behavior',
  'pointer-events',
]);

/** Property values that must never survive, whatever the property. */
const BANNED_VALUE = /(expression\s*\(|javascript\s*:|vbscript\s*:|-moz-binding)/i;

/** At-rules we keep. Anything else (notably @import) is dropped. */
const ALLOWED_AT_RULES = new Set([
  'media',
  'supports',
  'font-face',
  'keyframes',
  '-webkit-keyframes',
  'layer',
  'container',
  'page',
  'counter-style',
  'property',
]);

/**
 * Strip comments so they cannot hide a banned construct from the naive parser
 * (`ur/*x*\/l(...)` style evasion).
 */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, ' ');
}

/** Remove url() references to anything other than inline data: images. */
function stripExternalUrls(value: string): string {
  return value.replace(/url\(\s*(['"]?)([^'")]*)\1\s*\)/gi, (whole, _q, url: string) => {
    const u = String(url).trim();
    if (/^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,/i.test(u)) return whole;
    // Same-origin relative refs are fine; everything else is dropped so the
    // report cannot signal an external server that it was opened.
    if (/^(\/|\.\/|\.\.\/|#)/.test(u)) return whole;
    return 'none';
  });
}

/** Sanitize one `prop: value` pair. Returns null when it must be dropped. */
function rewriteDecl(decl: string): string | null {
  const idx = decl.indexOf(':');
  if (idx <= 0) return null;

  const prop = decl.slice(0, idx).trim().toLowerCase();
  let value = decl.slice(idx + 1).trim();
  if (!prop || !value) return null;

  if (BANNED_VALUE.test(prop) || BANNED_VALUE.test(value)) return null;

  // Custom properties (--brand: ...) carry the report's whole palette, so they
  // must survive. They can hold arbitrary tokens, so only scrub urls: a custom
  // property is inert until some other declaration references it, and that
  // reference is itself checked by these same rules.
  if (prop.startsWith('--')) {
    return `${prop}: ${stripExternalUrls(value)}`;
  }

  // `position: relative|static|absolute` is harmless inside a scoped subtree;
  // fixed/sticky are the ones that can pin content over the viewer header.
  if (prop === 'position') {
    return /^(fixed|sticky)$/i.test(value) ? null : `${prop}: ${value}`;
  }
  if (BANNED_PROPS.has(prop)) return null;

  value = stripExternalUrls(value);

  // Viewport-relative widths are the classic source of horizontal scrolling on
  // a phone. Clamp rather than drop so intentional full-bleed still works.
  if ((prop === 'width' || prop === 'min-width') && /\d\s*vw/i.test(value)) {
    return `${prop}: 100%`;
  }

  return `${prop}: ${value}`;
}

/**
 * Split a declaration block on top-level semicolons only.
 *
 * A naive `split(';')` corrupts values that legitimately contain semicolons --
 * `url("data:image/gif;base64,...")` got truncated to `url("data:image/gif`.
 * Track quotes and parens so only real separators split.
 */
function splitDecls(body: string): string[] {
  const out: string[] = [];
  let buf = '';
  let depth = 0;
  let quote: string | null = null;

  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (quote) {
      buf += ch;
      if (ch === quote && body[i - 1] !== '\\') quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      buf += ch;
      continue;
    }
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);

    if (ch === ';' && depth === 0) {
      out.push(buf);
      buf = '';
      continue;
    }
    buf += ch;
  }
  if (buf.trim()) out.push(buf);
  return out;
}

/** Sanitize a declaration block body (everything between braces). */
function rewriteBlock(body: string): string {
  return splitDecls(body)
    .map((d) => rewriteDecl(d))
    .filter((d): d is string => d !== null)
    .join('; ');
}

/**
 * Prefix a selector list with the scope so report CSS cannot reach the shell.
 * `html`/`body`/`:root` are rewritten to the scope itself, since a report
 * legitimately wants to set its own page background.
 */
function scopeSelector(selectorList: string, scope: string): string {
  return selectorList
    .split(',')
    .map((sel) => {
      const s = sel.trim();
      if (!s) return '';
      // Keyframe stops (`from`, `to`, `50%`) are not selectors.
      if (/^(from|to|\d+%)$/i.test(s)) return s;
      if (/^(html|body|:root)$/i.test(s)) return scope;
      // Leading html/body qualifier: drop it, keep the rest under the scope.
      const stripped = s.replace(/^\s*(html|body)\s*(>\s*)?/i, '');
      return `${scope} ${stripped || ''}`.trim();
    })
    .filter(Boolean)
    .join(', ');
}

/**
 * Detect whether the report sets its own background on the scope root.
 *
 * This matters because the viewer shell styles blockquote/th/pre with dark
 * backgrounds under `prefers-color-scheme: dark`. A report that supplies a light
 * paper background but only sets *text* colors ends up with indigo text on the
 * shell's dark fill -- unreadable. When we see the report take over the
 * background, we neutralize the shell's element fills inside the scope so the
 * report's own palette is the only one in play.
 */
function setsOwnBackground(sanitized: string, scope: string): boolean {
  const rootRule = new RegExp(
    `(^|})\\s*${scope.replace('.', '\\.')}\\s*\\{[^}]*background(-color)?\\s*:`,
    'i',
  );
  return rootRule.test(sanitized);
}

/**
 * Reset the shell's own element backgrounds inside the report scope.
 *
 * Emitted *before* the report's rules so author styles still win, and kept to
 * background/color only -- spacing and borders from the shell remain useful.
 */
function shellResetFor(scope: string): string {
  return [
    `${scope} blockquote, ${scope} th, ${scope} thead th, ${scope} pre, ${scope} code,`,
    `${scope} table, ${scope} td, ${scope} tr {`,
    `  background: transparent;`,
    `  color: inherit;`,
    `}`,
  ].join('\n');
}

/**
 * Rewrite a stylesheet so every rule is scoped and every declaration is safe.
 *
 * Hand-rolled brace matching keeps this dependency-free inside a Worker and
 * handles the nesting we actually see (@media / @supports wrapping rules).
 */
export function sanitizeCss(css: string, scope: string, depth = 0): string {
  if (depth > 8) return ''; // pathological nesting guard
  let src = depth === 0 ? stripComments(css) : css;

  // Statement at-rules end in ';' and have no block: @import, @charset,
  // @namespace. They must be removed *before* brace scanning, otherwise
  // `@import url(x); :root { ... }` is read as one prelude and the following
  // rule gets discarded along with the @import.
  src = src.replace(/@(import|charset|namespace)\b[^;{}]*;/gi, '');

  const out: string[] = [];
  let i = 0;

  while (i < src.length) {
    const braceAt = src.indexOf('{', i);

    if (braceAt === -1) break;

    const prelude = src.slice(i, braceAt).trim();

    // Find the matching close brace for this block.
    let depthCount = 1;
    let j = braceAt + 1;
    while (j < src.length && depthCount > 0) {
      if (src[j] === '{') depthCount++;
      else if (src[j] === '}') depthCount--;
      j++;
    }
    const body = src.slice(braceAt + 1, depthCount === 0 ? j - 1 : src.length);

    if (prelude.startsWith('@')) {
      const name = (prelude.slice(1).match(/^[\w-]+/) ?? [''])[0].toLowerCase();
      if (ALLOWED_AT_RULES.has(name)) {
        if (name === 'font-face' || name === 'property' || name === 'counter-style') {
          // These carry declarations, not nested rules.
          const inner = rewriteBlock(body);
          if (inner) out.push(`${prelude} { ${inner} }`);
        } else if (name === 'keyframes' || name === '-webkit-keyframes') {
          // Keyframe stops must NOT be scoped, but their declarations are checked.
          const inner = sanitizeKeyframes(body);
          if (inner) out.push(`${prelude} { ${inner} }`);
        } else {
          const inner = sanitizeCss(body, scope, depth + 1);
          if (inner) out.push(`${prelude} { ${inner} }`);
        }
      }
      // Unknown at-rules (including @import) are dropped entirely.
    } else if (prelude) {
      const sel = scopeSelector(prelude, scope);
      const inner = rewriteBlock(body);
      if (sel && inner) out.push(`${sel} { ${inner} }`);
    }

    i = j;
  }

  const body = out.join('\n');
  if (depth > 0) return body;

  // Top level only: prepend the shell reset when the report owns its background.
  return setsOwnBackground(body, scope) ? `${shellResetFor(scope)}\n${body}` : body;
}

/** Keyframe blocks: keep the stop selectors, sanitize the declarations. */
function sanitizeKeyframes(body: string): string {
  const out: string[] = [];
  let i = 0;
  while (i < body.length) {
    const braceAt = body.indexOf('{', i);
    if (braceAt === -1) break;
    const stop = body.slice(i, braceAt).trim();
    const close = body.indexOf('}', braceAt);
    if (close === -1) break;
    const decls = rewriteBlock(body.slice(braceAt + 1, close));
    if (stop && decls) out.push(`${stop} { ${decls} }`);
    i = close + 1;
  }
  return out.join('\n');
}
