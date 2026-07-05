import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { VALID_PATHS, BLOG_SLUG_PATTERN, isValidPath } from "../validation.mjs";

// Drift guard: the chat Lambda's VALID_PATHS allowlist is a hand-maintained
// mirror of the canonical route table in src/routes.ts. The Lambda runs under
// `node --test` and CANNOT import the TypeScript ROUTES table, so we read the
// file as TEXT and regex-extract the path literals — mirroring how
// src/routes.test.ts regex-reads App.tsx. This asserts every static route a
// visitor can be on is a path the Lambda will accept for pageContext grounding.
const HERE = dirname(fileURLToPath(import.meta.url));
const ROUTES_TS = resolve(HERE, "../../../src/routes.ts");

function extractRoutePaths() {
  const source = readFileSync(ROUTES_TS, "utf8");
  // Matches `path: '/about'` (HOME_CONTEXT + every ROUTES entry). The
  // RouteDefinition interface's `path: string;` has no quote, so it is excluded.
  const matches = [...source.matchAll(/path:\s*'([^']+)'/g)].map((m) => m[1]);
  return matches;
}

test("VALID_PATHS is a superset of the canonical static route paths", () => {
  const allPaths = extractRoutePaths();
  // Sanity guard: if the `path:` key or quote style ever changes, this fails
  // loudly instead of passing vacuously on an empty set.
  assert.ok(allPaths.length > 10, `expected to parse >10 path literals from src/routes.ts, got ${allPaths.length}`);

  // Parameterized paths (e.g. /blog/:slug) are matched at runtime by
  // BLOG_SLUG_PATTERN, not by the VALID_PATHS Set — exclude them here.
  const staticPaths = allPaths.filter((p) => !p.includes(":"));
  for (const p of staticPaths) {
    assert.ok(VALID_PATHS.has(p), `VALID_PATHS is missing canonical route path: ${p}`);
  }
});

test("the two historically-missing paths are present (regression guard)", () => {
  assert.ok(VALID_PATHS.has("/foundation"), "/foundation must be in VALID_PATHS");
  assert.ok(VALID_PATHS.has("/blueprint"), "/blueprint must be in VALID_PATHS");
});

test("param blog path is excluded from VALID_PATHS but matched by BLOG_SLUG_PATTERN", () => {
  // The :slug form is intentionally NOT a literal in VALID_PATHS; real slugs are
  // validated by BLOG_SLUG_PATTERN via isValidPath.
  assert.equal(VALID_PATHS.has("/blog/:slug"), false);
  assert.ok(BLOG_SLUG_PATTERN.test("/blog/some-real-post"));
  assert.ok(isValidPath("/blog/some-real-post"));
});
