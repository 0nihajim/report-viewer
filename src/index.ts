import type { Env, ReportMeta } from './types';
import { sanitizeReport, esc } from './sanitize';
import { renderList, renderReport, renderManifest } from './render';
import { getIcon } from './icon';

const R2_PREFIX = 'reports/';

/**
 * Security headers. Note the CSP: the viewer serves *untrusted* generated HTML,
 * so we forbid external resources outright and only permit the inline <style>
 * and inline <script> blocks that we ourselves emit (sanitize.ts strips every
 * script/style that came from the report).
 */
const SECURITY_HEADERS: Record<string, string> = {
  'content-security-policy': [
    "default-src 'none'",
    "img-src 'self' data:",
    "style-src 'unsafe-inline'",
    "script-src 'unsafe-inline'",
    "manifest-src 'self'",
    // Needed for the PWA manifest fetch and any same-origin API call from the
    // list view. Without it `default-src 'none'` blocks fetch() outright.
    "connect-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; '),
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
  // Reports are private; never let a shared cache hold them.
  'cache-control': 'private, no-store',
};

function html(body: string, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(body, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', ...SECURITY_HEADERS, ...extra },
  });
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store' },
  });
}

function errorPage(status: number, message: string): Response {
  return html(
    `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${status}</title><style>
:root{color-scheme:light dark}
body{margin:0;min-height:100vh;display:grid;place-content:center;text-align:center;
font:17px/1.8 -apple-system,BlinkMacSystemFont,"Hiragino Sans","Noto Sans JP",sans-serif;
padding:2rem;color:#e8eaed;background:#16181c}
@media(prefers-color-scheme:light){body{color:#1a1c1f;background:#fff}}
h1{font-size:3.2rem;margin:0;opacity:.25;font-weight:800}
p{color:#868e9b}a{color:#6aa9ff}
</style></head><body><div>
<h1>${status}</h1><p>${esc(message)}</p><p><a href="/">← 一覧へ戻る</a></p>
</div></body></html>`,
    status,
  );
}

/** Sort newest-first; fall back to upload time when dates tie. */
function byDateDesc(a: ReportMeta, b: ReportMeta): number {
  return b.date.localeCompare(a.date) || b.uploaded.localeCompare(a.uploaded);
}

/** Reconstruct report metadata from an R2 object's custom metadata. */
function metaFromObject(obj: R2Object): ReportMeta {
  const cm = obj.customMetadata ?? {};
  const id = obj.key.slice(R2_PREFIX.length).replace(/\.html$/i, '');
  const tags = (cm.tags ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  return {
    id,
    title: cm.title || id,
    date: cm.date || obj.uploaded.toISOString(),
    tags,
    summary: cm.summary || undefined,
    size: obj.size,
    uploaded: obj.uploaded.toISOString(),
  };
}

/**
 * Slug validation: keeps R2 keys predictable and blocks path traversal.
 * CJK is permitted so Japanese report titles produce readable URLs; the
 * character class deliberately excludes '/', '\' and '..' sequences.
 */
const SLUG_RE =
  /^[A-Za-z0-9\u3040-\u30ff\u4e00-\u9fff\uff66-\uff9f][A-Za-z0-9._\-\u3040-\u30ff\u4e00-\u9fff\uff66-\uff9f]{0,120}$/;

/**
 * Build a URL slug from arbitrary text.
 *
 * Japanese titles must survive this: an earlier version stripped all non-ASCII,
 * which collapsed "2026-08-03-AIエージェント評価手法の最新動向" down to
 * "2026-08-03-ai" and made every same-day report overwrite the previous one.
 */
function slugify(input: string): string {
  const s = input
    .trim()
    .toLowerCase()
    .replace(/[\s\u3000]+/g, '-')
    // Keep ASCII word chars plus hiragana, katakana, kanji and halfwidth katakana.
    .replace(/[^a-z0-9\-_.\u3040-\u30ff\u4e00-\u9fff\uff66-\uff9f]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    // R2 keys are fine with long names, but keep URLs manageable.
    .slice(0, 100)
    .replace(/[-.]+$/g, '');
  return s || `report-${Date.now()}`;
}

/**
 * Authorize a write request.
 *
 * Two independent paths, either is sufficient:
 *  1. Cloudflare Access service token — Access validated it at the edge and
 *     injected Cf-Access-Client-Id. This is the production path.
 *  2. A bearer INGEST_TOKEN secret — used for `wrangler dev` and for setups
 *     where Access is not in front of the Worker yet.
 */
function isAuthorizedWrite(req: Request, env: Env): boolean {
  // Access sets this only after successfully validating the service token pair.
  if (req.headers.get('cf-access-client-id')) return true;

  const expected = env.INGEST_TOKEN;
  if (!expected) return false;
  const got = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (got.length !== expected.length) return false;
  // Constant-time comparison to avoid leaking the token through timing.
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= got.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

/** List every report, following R2 pagination cursors. */
async function listReports(env: Env): Promise<ReportMeta[]> {
  const out: ReportMeta[] = [];
  let cursor: string | undefined;
  do {
    const page = await env.REPORTS.list({
      prefix: R2_PREFIX,
      include: ['customMetadata'],
      limit: 1000,
      cursor,
    });
    for (const obj of page.objects) {
      if (obj.key.endsWith('.html')) out.push(metaFromObject(obj));
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return out.sort(byDateDesc);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const siteTitle = env.SITE_TITLE || 'Research Reports';

    try {
      // ---------------- write API (report generator) ----------------
      if (path === '/api/reports' && (request.method === 'POST' || request.method === 'PUT')) {
        if (!isAuthorizedWrite(request, env)) {
          return json({ error: 'unauthorized' }, 401);
        }

        const ct = request.headers.get('content-type') ?? '';
        let body: string;
        let title: string | undefined;
        let date: string | undefined;
        let tags: string[] = [];
        let summary: string | undefined;
        let id: string | undefined;

        if (ct.includes('application/json')) {
          // JSON envelope: metadata travels alongside the HTML.
          const payload = (await request.json()) as Record<string, unknown>;
          body = String(payload.html ?? '');
          title = payload.title ? String(payload.title) : undefined;
          date = payload.date ? String(payload.date) : undefined;
          summary = payload.summary ? String(payload.summary) : undefined;
          id = payload.id ? String(payload.id) : undefined;
          if (Array.isArray(payload.tags)) tags = payload.tags.map(String);
          else if (typeof payload.tags === 'string') tags = payload.tags.split(',').map((t) => t.trim());
        } else {
          // Raw HTML body; metadata comes from the query string. Handy for curl.
          body = await request.text();
          title = url.searchParams.get('title') ?? undefined;
          date = url.searchParams.get('date') ?? undefined;
          summary = url.searchParams.get('summary') ?? undefined;
          id = url.searchParams.get('id') ?? undefined;
          const t = url.searchParams.get('tags');
          if (t) tags = t.split(',').map((s) => s.trim()).filter(Boolean);
        }

        if (!body.trim()) return json({ error: 'empty html body' }, 400);

        // Derive the title from the document itself when not supplied.
        const probe = await sanitizeReport(body);
        const finalTitle = title ?? probe.title ?? 'Untitled report';
        const finalDate = date ?? new Date().toISOString();
        const slug = id ? slugify(id) : slugify(`${finalDate.slice(0, 10)}-${finalTitle}`);
        if (!SLUG_RE.test(slug)) return json({ error: `invalid id: ${slug}` }, 400);

        const key = `${R2_PREFIX}${slug}.html`;
        await env.REPORTS.put(key, body, {
          httpMetadata: { contentType: 'text/html; charset=utf-8' },
          customMetadata: {
            title: finalTitle,
            date: finalDate,
            tags: tags.join(','),
            ...(summary ? { summary } : {}),
          },
        });

        return json(
          { ok: true, id: slug, url: `${url.origin}/r/${encodeURIComponent(slug)}`, title: finalTitle },
          201,
        );
      }

      if (path.startsWith('/api/reports/') && request.method === 'DELETE') {
        if (!isAuthorizedWrite(request, env)) return json({ error: 'unauthorized' }, 401);
        const id = decodeURIComponent(path.slice('/api/reports/'.length));
        if (!SLUG_RE.test(id)) return json({ error: 'invalid id' }, 400);
        await env.REPORTS.delete(`${R2_PREFIX}${id}.html`);
        return json({ ok: true, deleted: id });
      }

      // ---------------- read API ----------------
      if (path === '/api/reports' && request.method === 'GET') {
        return json({ reports: await listReports(env) });
      }

      // ---------------- static ----------------
      if (path === '/manifest.webmanifest') {
        return new Response(renderManifest(siteTitle), {
          headers: {
            'content-type': 'application/manifest+json; charset=utf-8',
            'cache-control': 'private, max-age=3600',
            'x-content-type-options': 'nosniff',
            'referrer-policy': 'no-referrer',
          },
        });
      }

      if (path === '/icon.png' || path === '/favicon.ico') {
        // Same asset for both: iOS uses /icon.png via apple-touch-icon, while
        // desktop browsers request /favicon.ico unprompted (which was 404ing).
        return new Response(getIcon(), {
          headers: {
            'content-type': 'image/png',
            'cache-control': 'private, max-age=86400',
          },
        });
      }

      if (path === '/healthz') {
        return json({ ok: true, ts: new Date().toISOString() });
      }

      if (path === '/robots.txt') {
        return new Response('User-agent: *\nDisallow: /\n', {
          headers: { 'content-type': 'text/plain; charset=utf-8' },
        });
      }

      // ---------------- HTML views ----------------
      if (path === '/' || path === '/index.html') {
        return html(renderList(await listReports(env), siteTitle));
      }

      if (path.startsWith('/r/')) {
        const id = decodeURIComponent(path.slice(3).replace(/\/$/, ''));
        if (!SLUG_RE.test(id)) return errorPage(400, 'レポートIDが不正です');

        const obj = await env.REPORTS.get(`${R2_PREFIX}${id}.html`);
        if (!obj) return errorPage(404, 'レポートが見つかりませんでした');

        const raw = await obj.text();
        const { html: content, headings } = await sanitizeReport(raw);
        const meta = metaFromObject(obj);

        // Raw view escape hatch for debugging what the generator produced.
        if (url.searchParams.get('raw') === '1') {
          return new Response(raw, {
            headers: { 'content-type': 'text/plain; charset=utf-8', ...SECURITY_HEADERS },
          });
        }

        return html(renderReport(meta, content, headings, siteTitle), 200, {
          'last-modified': obj.uploaded.toUTCString(),
        });
      }

      return errorPage(404, 'ページが見つかりませんでした');
    } catch (err) {
      console.error('unhandled error', err);
      return errorPage(500, '内部エラーが発生しました');
    }
  },
} satisfies ExportedHandler<Env>;
