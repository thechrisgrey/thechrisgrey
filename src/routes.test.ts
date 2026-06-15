import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { ROUTES, ROUTES_BY_PATH, HOME_CONTEXT, NAVIGATION_CONFIG } from './routes';

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * Drift detector. The canonical metadata for every route lives in `src/routes.ts`;
 * the literal JSX `<Route>` declarations live in `src/App.tsx`. These tests
 * pair-check the two: if anyone adds a route to one and forgets the other,
 * the build turns red here before the drift can hide in production (where
 * `/admin` lost its prefetch and `/foundation` and `/blueprint` lost their
 * Alti grounding context before this file existed).
 */

const NON_TABLE_PATHS = new Set([
  '/', // Home — statically imported in App.tsx, not lazy, not prefetched
  '*', // NotFound catch-all — also lives outside the ROUTES table
]);

function readAppRoutePaths(): string[] {
  const app = readFileSync(resolve(HERE, 'App.tsx'), 'utf-8');
  const regex = /<Route\s+path="([^"]+)"/g;
  const paths = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = regex.exec(app))) {
    paths.add(match[1]);
  }
  return [...paths];
}

describe('ROUTES table — drift detector', () => {
  const appPaths = readAppRoutePaths();

  it('declares every non-special route present in App.tsx', () => {
    const expected = appPaths.filter((p) => !NON_TABLE_PATHS.has(p)).sort();
    const actual = ROUTES.map((r) => r.path).sort();
    expect(actual).toEqual(expected);
  });

  it('every ROUTES entry has a matching <Route> in App.tsx', () => {
    for (const route of ROUTES) {
      expect(appPaths).toContain(route.path);
    }
  });

  it('App.tsx still mounts the special non-table routes (/ and *)', () => {
    for (const p of NON_TABLE_PATHS) {
      expect(appPaths).toContain(p);
    }
  });

  it('every route has a real Alti grounding context (no "Page"/"General" defaults)', () => {
    // The historic drift was /foundation and /blueprint falling through to
    // `{ pageTitle: 'Page', section: 'General' }` in pageContext.ts. Catch
    // that class of bug at the source.
    for (const route of ROUTES) {
      expect(route.context.pageTitle, `${route.path} pageTitle must not be the fallback "Page"`).not.toBe('Page');
      expect(route.context.section, `${route.path} section must not be the fallback "General"`).not.toBe('General');
      expect(route.context.pageTitle.length, `${route.path} pageTitle must be non-empty`).toBeGreaterThan(0);
      expect(route.context.section.length, `${route.path} section must be non-empty`).toBeGreaterThan(0);
    }
  });

  it('the Home context is exported separately and uses /', () => {
    expect(HOME_CONTEXT.path).toBe('/');
    expect(HOME_CONTEXT.context.pageTitle).toBe('Home');
    expect(HOME_CONTEXT.suggestions.length).toBeGreaterThan(0);
  });

  it('ROUTES_BY_PATH is in sync with ROUTES', () => {
    expect(ROUTES_BY_PATH.size).toBe(ROUTES.length);
    for (const r of ROUTES) {
      expect(ROUTES_BY_PATH.get(r.path)).toBe(r);
    }
  });

  it('every prefetch-eligible route has a unique path', () => {
    const paths = ROUTES.filter((r) => !r.noPrefetch).map((r) => r.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('/admin is in ROUTES (regression: it was missing from routeManifest.ts before this refactor)', () => {
    const admin = ROUTES_BY_PATH.get('/admin');
    expect(admin).toBeDefined();
    expect(admin?.noPrefetch).toBe(true);
  });

  it('/foundation and /blueprint have non-default Alti context (regression)', () => {
    const foundation = ROUTES_BY_PATH.get('/foundation');
    expect(foundation?.context.section).toBe('The Altivum Foundation');
    const blueprint = ROUTES_BY_PATH.get('/blueprint');
    expect(blueprint?.context.section).toBe('Blueprint');
  });
});

/**
 * Sitemap / prerender drift detector.
 *
 * The indexable URL set is owned by `scripts/generate-sitemap.js` (`staticPages`,
 * re-exported as `STATIC_ROUTES`, which `scripts/prerender.js` imports so the
 * crawl set never diverges from the sitemap). The canonical route table lives in
 * THIS file. Nothing previously asserted the two stay in sync — which is exactly
 * how `/aws` and `/claude` (both real, indexable credibility pages with full
 * `<SEO>` blocks) were silently absent from BOTH the sitemap and the prerender
 * crawl, shipping as empty CSR shells invisible to search.
 *
 * We parse `generate-sitemap.js` as TEXT rather than importing it — same idiom as
 * `readAppRoutePaths()` above and the Lambda `validation-drift` test — to avoid
 * coupling a TS test to a build-only ESM script (and its `@sanity/client` import)
 * across the src/scripts boundary.
 */
function readSitemapStaticPaths(): string[] {
  const src = readFileSync(resolve(HERE, '../scripts/generate-sitemap.js'), 'utf-8');
  const block = src.match(/const staticPages = \[([\s\S]*?)\];/);
  if (!block) throw new Error('Could not locate the `staticPages` array in scripts/generate-sitemap.js');
  const paths = new Set<string>();
  const re = /url:\s*'([^']+)'/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(block[1]))) paths.add(match[1]);
  return [...paths];
}

describe('sitemap/prerender ↔ ROUTES drift detector', () => {
  const sitemapPaths = readSitemapStaticPaths();

  // The set search engines SHOULD see: Home (static, lives in HOME_CONTEXT, not
  // ROUTES) plus every route that is neither dynamic (`:param`) nor flagged
  // noIndex (gated / in-development).
  const indexableRoutes = [
    HOME_CONTEXT.path,
    ...ROUTES.filter((r) => !r.noIndex && !r.path.includes(':')).map((r) => r.path),
  ].sort();

  it('the sitemap/prerender static set is EXACTLY the indexable route set + Home', () => {
    expect([...sitemapPaths].sort()).toEqual(indexableRoutes);
  });

  it('never lists a gated, in-development, or dynamic route in the sitemap', () => {
    const nonIndexable = ROUTES.filter((r) => r.noIndex || r.path.includes(':')).map((r) => r.path);
    for (const path of nonIndexable) {
      expect(sitemapPaths, `${path} must NOT be in the sitemap/prerender set`).not.toContain(path);
    }
  });

  it('indexes /aws and /claude (regression: both were silently dropped from sitemap + prerender)', () => {
    expect(sitemapPaths).toContain('/aws');
    expect(sitemapPaths).toContain('/claude');
  });
});

/**
 * Navigation ↔ ROUTES drift detector.
 *
 * `NAVIGATION_CONFIG` (in routes.ts) is the single source of truth for the header
 * nav + About dropdown; `Navigation.tsx` renders straight from it. Labels are
 * intentionally UI-specific (they differ from `context.pageTitle`, which is Alti's
 * grounding text — `/chat` is "Alti" here but "AI Chat" to the model), so we don't
 * assert label equality. We assert the PATHS stay coherent with the canonical
 * table — the drift that actually breaks navigation:
 *   - every nav path is a real ROUTES path (or Home), so a renamed/removed route
 *     can't leave a dead link in the menu, and
 *   - every ROUTES entry is surfaced in the nav OR explicitly exempt, so a new
 *     page can't silently fall out of the menu (the bug the hardcoded arrays invited).
 */
const NON_NAV_ROUTES = new Set([
  '/blog/:slug', // dynamic — reached from blog cards, never a top-level nav item
  '/privacy', // footer-only legal page
  '/admin', // Cognito-gated, hidden surface
]);

describe('Navigation ↔ ROUTES drift detector', () => {
  const navPaths = [
    ...NAVIGATION_CONFIG.mainNav.map((i) => i.path),
    ...NAVIGATION_CONFIG.aboutDropdown.map((i) => i.path),
  ];

  it('every nav path is a real ROUTES path (or Home)', () => {
    for (const path of navPaths) {
      const known = path === HOME_CONTEXT.path || ROUTES_BY_PATH.has(path);
      expect(known, `nav path ${path} is not in ROUTES (or HOME)`).toBe(true);
    }
  });

  it('every ROUTES entry is surfaced in the nav or explicitly exempt', () => {
    const inNav = new Set(navPaths);
    for (const route of ROUTES) {
      const surfaced = inNav.has(route.path) || NON_NAV_ROUTES.has(route.path);
      expect(
        surfaced,
        `${route.path} is missing from NAVIGATION_CONFIG — add it to the nav or to NON_NAV_ROUTES`
      ).toBe(true);
    }
  });

  it('no route appears in both mainNav and the About dropdown', () => {
    expect(new Set(navPaths).size).toBe(navPaths.length);
  });

  it('every nav item has a non-empty label', () => {
    for (const item of [...NAVIGATION_CONFIG.mainNav, ...NAVIGATION_CONFIG.aboutDropdown]) {
      expect(item.label.length, `${item.path} must have a label`).toBeGreaterThan(0);
    }
  });

  it('the About dropdown still has its 8 known items (regression guard)', () => {
    expect(NAVIGATION_CONFIG.aboutDropdown).toHaveLength(8);
  });
});
