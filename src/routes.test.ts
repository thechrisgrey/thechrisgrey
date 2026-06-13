import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { ROUTES, ROUTES_BY_PATH, HOME_CONTEXT } from './routes';

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
