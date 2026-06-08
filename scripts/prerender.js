/**
 * Build-time prerender (Recommendation 3 Part B).
 *
 * Runs AFTER `vite build`, BEFORE generate-sitemap. Serves dist/ over a tiny
 * local http server, opens each static route + blog slug headless with
 * ?prerender=1, waits for the Helmet-ready signal (window.__PRERENDER_READY__,
 * set in src/main.tsx — NOT network idle, because WebGL/GSAP never go idle),
 * serializes the DOM, and writes dist/<route>/index.html. Crawlers / social
 * scrapers / LLMs then get per-route <title>, OG tags, and JSON-LD without
 * executing JS.
 *
 * #1 SAFETY CONSTRAINT: this step is strictly NON-FATAL. ANY failure
 * (puppeteer not installed, Chromium launch failure, Sanity unreachable, a
 * route timeout, one bad route) logs a warning and the process STILL exits 0,
 * so a broken prerender degrades to plain CSR instead of breaking the
 * "&&"-chained build / the Amplify deploy. puppeteer is imported dynamically
 * INSIDE the try so a missing dependency degrades gracefully rather than
 * crashing at module load.
 *
 * Route set is the SAME source as scripts/generate-sitemap.js (DRY): it imports
 * STATIC_ROUTES and BLOG_SLUGS_QUERY from there so the crawl never drifts from
 * the sitemap.
 */
import { createServer } from 'http';
import { createReadStream, existsSync, mkdirSync, writeFileSync, statSync } from 'fs';
import { resolve, dirname, join, extname, sep } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@sanity/client';
import { STATIC_ROUTES, BLOG_SLUGS_QUERY } from './generate-sitemap.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(__dirname, '../dist');

// Sanity: SAME config as generate-sitemap.js / generate-rss.js.
const client = createClient({
  projectId: 'k5950b3w',
  dataset: 'production',
  apiVersion: '2024-01-01',
  useCdn: false,
  timeout: 15000,
});

async function fetchBlogRoutes() {
  // BLOG_SLUGS_QUERY is shared with generate-sitemap.js; we only read .slug.
  const posts = await client.fetch(BLOG_SLUGS_QUERY);
  return posts.map((p) => `/blog/${p.slug}`);
}

// --- Tiny static file server over dist/ --------------------------------------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.glb': 'model/gltf-binary',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
};

function startServer() {
  return new Promise((resolveServer, rejectServer) => {
    const server = createServer((req, res) => {
      const urlPath = decodeURIComponent(req.url.split('?')[0]);
      let filePath = resolve(DIST, `.${urlPath}`);
      // Defensive path-traversal guard: never resolve outside dist/. Input is
      // local-only/trusted (only this build's puppeteer hits 127.0.0.1), but a
      // `..%2f` path would otherwise escape — clamp it to the SPA shell.
      if (filePath !== DIST && !filePath.startsWith(DIST + sep)) {
        filePath = join(DIST, 'index.html');
      }
      // Directory or extensionless route -> serve the SPA shell index.html.
      if (!extname(filePath) || (existsSync(filePath) && statSync(filePath).isDirectory())) {
        filePath = join(DIST, 'index.html');
      }
      if (!existsSync(filePath)) {
        filePath = join(DIST, 'index.html');
      }
      res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' });
      createReadStream(filePath).pipe(res);
    });
    server.on('error', rejectServer);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolveServer({ server, port });
    });
  });
}

// route '/' -> dist/index.html ; route '/blog/x' -> dist/blog/x/index.html
function outPathFor(route) {
  if (route === '/') return join(DIST, 'index.html');
  return join(DIST, route.replace(/^\//, ''), 'index.html');
}

// --- Sanity CORS proxy via request interception ------------------------------
//
// WHY: BlogPost (and podcast pages) do a CLIENT-SIDE Sanity fetch from the
// headless browser. That browser's origin is http://127.0.0.1:<random-port>,
// which is NOT on Sanity's CORS allowlist (only thechrisgrey.com is), so the
// browser XHR is blocked by CORS ("No 'Access-Control-Allow-Origin' header is
// present on the requested resource" -> net::ERR_FAILED). The fetch rejects,
// BlogPost renders its error boundary, and the prerendered <title> becomes
// "Error Loading Article" instead of the real article title.
//
// FIX: We can't add the random ephemeral port to Sanity's allowlist, and we
// must not touch Sanity project settings. Instead we intercept every request
// the page makes; for requests to a Sanity host we re-issue the SAME request
// from Node (which has NO CORS — it's not a browser) and fulfill the browser
// request with that response plus a permissive Access-Control-Allow-Origin so
// the browser's CORS check passes. Matches BOTH Sanity projects (blog k5950b3w
// + podcast uaxzdsfa) by domain, never a hardcoded project id. All other
// requests pass through untouched. Every failure path is swallowed so a broken
// proxy attempt degrades to a normal (CORS-failing) request rather than
// crashing the crawl — the script stays strictly non-fatal (always exits 0).
function isSanityUrl(url) {
  try {
    const { hostname } = new URL(url);
    // Covers apicdn.sanity.io, api.sanity.io, <project>.apicdn.sanity.io,
    // cdn.sanity.io, etc. — any host under the sanity.io apex.
    return hostname === 'sanity.io' || hostname.endsWith('.sanity.io');
  } catch {
    return false;
  }
}

// Hop-by-hop / forbidden response headers Chrome's Fetch.fulfillRequest will
// reject or that don't make sense to replay (encoding handled by node fetch).
const STRIPPED_RESPONSE_HEADERS = new Set([
  'content-encoding',
  'content-length',
  'transfer-encoding',
  'connection',
  'keep-alive',
]);

async function proxySanityRequest(interceptedRequest) {
  const url = interceptedRequest.url();
  // Replay the request server-side with Node fetch (no CORS in Node).
  const method = interceptedRequest.method();
  const reqHeaders = { ...interceptedRequest.headers() };
  // Drop browser-set headers that don't belong on a server-side fetch and would
  // either be rejected or trigger an unwanted CORS preflight semantics on Node.
  delete reqHeaders.host;
  delete reqHeaders.origin;
  delete reqHeaders.referer;
  delete reqHeaders['content-length'];

  const init = { method, headers: reqHeaders };
  if (method !== 'GET' && method !== 'HEAD') {
    const postData = interceptedRequest.postData();
    if (postData != null) init.body = postData;
  }

  const upstream = await fetch(url, init);
  const bodyBuf = Buffer.from(await upstream.arrayBuffer());

  const headers = {};
  upstream.headers.forEach((value, key) => {
    if (!STRIPPED_RESPONSE_HEADERS.has(key.toLowerCase())) headers[key] = value;
  });
  // Permissive CORS so the browser's same-origin/CORS check passes for the
  // 127.0.0.1:<port> origin. Local-only build context; not shipped to prod.
  headers['access-control-allow-origin'] = '*';
  headers['access-control-allow-methods'] = 'GET,POST,OPTIONS';
  headers['access-control-allow-headers'] = '*';

  await interceptedRequest.respond({
    status: upstream.status,
    headers,
    contentType: upstream.headers.get('content-type') || undefined,
    body: bodyBuf,
  });
}

// Wire request interception on a page so Sanity requests are proxied through
// Node and everything else continues normally. Errors are isolated per-request.
async function attachSanityProxy(page) {
  await page.setRequestInterception(true);
  page.on('request', (interceptedRequest) => {
    // Guard against the (rare) case a handler already resolved this request.
    if (interceptedRequest.isInterceptResolutionHandled?.()) return;

    if (!isSanityUrl(interceptedRequest.url())) {
      interceptedRequest.continue().catch(() => {});
      return;
    }

    // CORS preflight: answer OPTIONS locally so the browser proceeds to the
    // real request (which we then proxy below).
    if (interceptedRequest.method() === 'OPTIONS') {
      interceptedRequest
        .respond({
          status: 204,
          headers: {
            'access-control-allow-origin': '*',
            'access-control-allow-methods': 'GET,POST,OPTIONS',
            'access-control-allow-headers': '*',
            'access-control-max-age': '600',
          },
        })
        .catch(() => {});
      return;
    }

    proxySanityRequest(interceptedRequest).catch((proxyErr) => {
      // Proxy failed — fall back to a normal request so the crawl never crashes.
      // (Normal request will likely CORS-fail, but that is non-fatal: the route
      // degrades to the error state rather than aborting the whole build.)
      console.warn(
        `  [prerender] WARN Sanity proxy failed for ${interceptedRequest.url().slice(0, 80)}...: ${proxyErr && proxyErr.message}`,
      );
      interceptedRequest.continue().catch(() => {});
    });
  });
}

async function crawl() {
  if (!existsSync(join(DIST, 'index.html'))) {
    console.warn('[prerender] dist/index.html not found — skipping prerender (run vite build first).');
    return;
  }

  // Dynamic import INSIDE the guarded path so a missing puppeteer dependency
  // degrades gracefully (warn + CSR) instead of crashing at module load.
  const { default: puppeteer } = await import('puppeteer');

  console.log('[prerender] Prerendering routes...');
  const blogRoutes = await fetchBlogRoutes();
  const routes = [...STATIC_ROUTES, ...blogRoutes];
  console.log(
    `[prerender] Routes to prerender: ${routes.length} (${STATIC_ROUTES.length} static + ${blogRoutes.length} blog)`,
  );

  const { server, port } = await startServer();
  const base = `http://127.0.0.1:${port}`;

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  let ok = 0;
  let failed = 0;
  try {
    for (const route of routes) {
      // One bad route must never abort the whole crawl — isolate each.
      try {
        const page = await browser.newPage();
        page.setDefaultTimeout(30000);
        // Proxy client-side Sanity fetches through Node to bypass the browser
        // CORS block on the 127.0.0.1:<port> origin (see attachSanityProxy).
        await attachSanityProxy(page);
        try {
          const url = `${base}${route}${route.includes('?') ? '&' : '?'}prerender=1`;
          // domcontentloaded only — we do NOT wait for network idle (3D never idles).
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
          // Wait for React commit + react-helmet-async flush (deterministic signal).
          await page.waitForFunction('window.__PRERENDER_READY__ === true', { timeout: 15000 });
          const html = await page.content();
          const outFile = outPathFor(route);
          mkdirSync(dirname(outFile), { recursive: true });
          writeFileSync(outFile, html, 'utf-8');
          ok += 1;
          console.log(`  [prerender] ok ${route} -> ${outFile.replace(DIST, 'dist')}`);
        } finally {
          await page.close();
        }
      } catch (routeErr) {
        failed += 1;
        console.warn(`  [prerender] WARN skipped ${route}: ${routeErr && routeErr.message}`);
      }
    }
  } finally {
    await browser.close();
    server.close();
  }

  console.log(`[prerender] Done: ${ok} prerendered, ${failed} skipped (of ${routes.length}).`);
}

// Entire crawl wrapped so ANY failure is non-fatal: warn and exit 0 so the
// "&&"-chained build still proceeds and the site deploys as CSR.
async function main() {
  try {
    await crawl();
  } catch (err) {
    console.warn(
      '[prerender] WARN prerender step failed — continuing build as CSR (this is non-fatal):',
      err && err.message ? err.message : err,
    );
  }
  // Always succeed.
  process.exit(0);
}

main();
