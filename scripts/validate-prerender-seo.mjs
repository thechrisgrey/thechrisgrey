/**
 * Build-time SEO validation gate for the PRERENDERED HTML.
 *
 * Runs AFTER scripts/prerender.js, BEFORE generate-sitemap. The unit tests
 * (SEO.test.tsx / schemas.test.ts) validate the JSON-LD generation logic in
 * jsdom, but nothing validated the actual dist/*.html that Google and social
 * crawlers read — the exact gap behind the #170 canonical/indexing-decay bug.
 * This step parses each prerendered route's <head> and asserts:
 *   - exactly one <script type="application/ld+json"> that is valid JSON with a
 *     non-empty @graph,
 *   - exactly one <link rel="canonical"> equal to the route's own URL
 *     (trailing-slash-insensitive),
 *   - any same-origin og:image (/og/<slug>.png) resolves to a file in dist/.
 *
 * #1 SAFETY CONSTRAINT (mirrors prerender.js): this step is NON-FATAL by
 * default. A route that degraded to a CSR shell (no prerendered file) is
 * reported but never fails the build, and violations only set a non-zero exit
 * when STRICT_PRERENDER=true (or STRICT_SEO_VALIDATION=true) — so a broken
 * crawl/validation never blocks the Amplify deploy. The route set is the SAME
 * SSOT as the sitemap/prerender (STATIC_ROUTES) so it can never drift.
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { STATIC_ROUTES } from './generate-sitemap.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(__dirname, '../dist');
const SITE_URL = 'https://thechrisgrey.com';

// File form written by prerender.js (outPathsFor): '/' -> dist/index.html,
// '/aws' -> dist/aws.html (the bare-URL artifact that returns 200, no redirect).
function fileForRoute(route) {
  if (route === '/') return join(DIST, 'index.html');
  return join(DIST, `${route.replace(/^\//, '')}.html`);
}

// Compare two absolute URLs ignoring a trailing slash (Home's canonical is the
// bare origin; Amplify serves some routes with a trailing slash). Stripping is
// unconditional — no real canonical is short enough for it to matter.
function sameUrl(a, b) {
  const norm = (u) => u.replace(/\/+$/, '');
  return norm(a) === norm(b);
}

function validateRoute(route) {
  const file = fileForRoute(route);
  if (!existsSync(file)) {
    return { route, degraded: true, violations: [] };
  }
  const html = readFileSync(file, 'utf-8');
  const violations = [];

  // --- JSON-LD ---
  const ldMatches = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  if (ldMatches.length !== 1) {
    violations.push(`expected exactly 1 JSON-LD block, found ${ldMatches.length}`);
  } else {
    try {
      const graph = JSON.parse(ldMatches[0][1]);
      if (graph['@context'] !== 'https://schema.org') {
        violations.push('JSON-LD @context is not https://schema.org');
      }
      if (!Array.isArray(graph['@graph']) || graph['@graph'].length === 0) {
        violations.push('JSON-LD has no non-empty @graph array');
      }
    } catch (err) {
      violations.push(`JSON-LD is not valid JSON: ${err && err.message}`);
    }
  }

  // --- canonical ---
  const canonMatches = [...html.matchAll(/<link[^>]*rel="canonical"[^>]*href="([^"]+)"/g)];
  if (canonMatches.length !== 1) {
    violations.push(`expected exactly 1 canonical link, found ${canonMatches.length}`);
  } else {
    const expected = `${SITE_URL}${route === '/' ? '' : route}`;
    if (!sameUrl(canonMatches[0][1], expected)) {
      violations.push(`canonical ${canonMatches[0][1]} != expected ${expected}`);
    }
  }

  // --- og:image (only validate same-origin generated cards) ---
  const og = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/);
  if (!og) {
    violations.push('missing og:image');
  } else {
    const ogUrl = og[1];
    if (ogUrl.startsWith(`${SITE_URL}/og/`)) {
      const rel = ogUrl.slice(SITE_URL.length); // /og/<slug>.png
      if (!existsSync(join(DIST, rel))) {
        violations.push(`og:image ${rel} does not exist in dist/`);
      }
    }
  }

  return { route, degraded: false, violations };
}

function main() {
  if (!existsSync(join(DIST, 'index.html'))) {
    console.warn('[seo-gate] dist/index.html not found — skipping (run the build first). Non-fatal.');
    process.exit(0);
  }

  const results = STATIC_ROUTES.map(validateRoute);
  const degraded = results.filter((r) => r.degraded).map((r) => r.route);
  const withViolations = results.filter((r) => r.violations.length > 0);
  const totalViolations = withViolations.reduce((n, r) => n + r.violations.length, 0);

  console.log(
    `[seo-gate] ${STATIC_ROUTES.length} static routes checked; ` +
      `${totalViolations} violation(s); ${degraded.length} degraded to CSR` +
      (degraded.length ? `: ${degraded.join(', ')}` : ''),
  );
  for (const r of withViolations) {
    for (const v of r.violations) console.error(`  [seo-gate] ${r.route}: ${v}`);
  }

  const strict = process.env.STRICT_PRERENDER === 'true' || process.env.STRICT_SEO_VALIDATION === 'true';
  if (strict && totalViolations > 0) {
    console.error(`[seo-gate] STRICT mode: exiting 1 due to ${totalViolations} SEO violation(s) in prerendered HTML.`);
    process.exit(1);
  }
  // Default: strictly non-fatal so a broken prerender/validation never blocks the deploy.
  process.exit(0);
}

main();
