# CI Gates

The `.github/workflows/ci.yml` pipeline blocks merges to `main` on the following checks. Each check is intended to catch a specific class of regression before it reaches production.

## Gates

| Gate | What it enforces | Unblock path |
|------|------------------|--------------|
| `Run linter` | ESLint on `src/**/*.{ts,tsx}` with zero warnings | Fix the lint error. Do not add `eslint-disable` without a reason in the same line. |
| `Run Lambda lint` | ESLint on `lambda/**/*.mjs` via `lambda/.eslintrc.cjs` | Fix the lint error. Lambda globals go in `lambda/.eslintrc.cjs` under `globals:`. |
| `Run tests with coverage` | Vitest suite + coverage thresholds (see `vitest.config.ts`) | Add tests to bring coverage back up, or lower the threshold if a large, non-load-bearing file is temporarily uncovered. |
| `Run Lambda tests` | `node --test lambda/chat-stream/__tests__/*.test.mjs` | Fix the broken test or the Lambda module it covers. |
| `Audit production dependencies` | `npm audit --audit-level=high --omit=dev` on the root | See "Unblocking npm audit" below. |
| `lambda-audit` (matrix job) | Same audit gate, per Lambda directory | Same as above, but run `npm audit` inside the affected `lambda/<fn>/` directory. |
| `Build project` | `npm run build` (env validation → podcast fetch → lint → tsc → vite build → OG images → prerender → prerender SEO gate → sitemap + RSS) | Build errors surface the failing step in logs. |

## Coverage

- Report uploaded as the `coverage-report` artifact on every CI run (kept 14 days).
- Thresholds live in `vitest.config.ts` under `test.coverage.thresholds`. The floor is intentionally held ~5 points below live measured coverage — it is a regression catch, not a high-water mark. Re-tightened 2026-06 from 62/60/59/55 to 66/64/62/60 after coverage organically rose; re-ratchet to ~5 below live when the gap exceeds ~8 points. There is no `autoUpdate` automation (it would erase the buffer and churn the config on every dev run); ratchet manually via `npm run test:coverage`.
- If you're adding a large file that's intentionally uncovered (e.g., a generated module), add it to `test.coverage.exclude` rather than lowering thresholds for the whole repo.

## Unblocking `npm audit`

If a legitimate high-severity advisory surfaces in a transitive production dependency and a fix is not yet published:

1. Confirm it's actually reachable from the app (search the advisory's CVE notes against our usage).
2. Try `npm audit fix` (no `--force`) — this resolves the common case.
3. If still blocked, add an `overrides` entry in the root `package.json` pinning the transitive dep to a safe version.
4. If no safe version exists, document the waiver in this file with CVE ID, reviewer, and expected fix ETA, then temporarily add `|| true` to the audit step as a one-off PR that the reviewer explicitly approves. Restore enforcement in the same PR that bumps the dep.

Never re-add `continue-on-error: true` to the audit step globally.

## Dependabot

- `.github/dependabot.yml` scans root `/` plus the six Lambda directories (`lambda/chat-stream`, `lambda/kb-builder`, `lambda/metrics`, `lambda/kb-sync`, `lambda/blueprint`, `lambda/mcp-server`) and the shared `lambda/shared` package weekly on Mondays.
- Lambda PRs carry both `dependencies` and `lambda` labels.
- Root is limited to 10 open PRs; each Lambda is limited to 3.

## Prerender SEO gate

`scripts/validate-prerender-seo.mjs` runs in the build chain immediately after `scripts/prerender.js` (and before sitemap/RSS). It parses each prerendered static route's `dist/*.html` and asserts the SEO surface that crawlers actually read — exactly one valid JSON-LD `@graph`, exactly one self-referential `<link rel="canonical">`, and that any same-origin `og:image` (`/og/<slug>.png`) resolves to a file in `dist/`. The route set is the same `STATIC_ROUTES` SSOT as the sitemap/prerender, so it can never drift.

- **Non-fatal by default** — mirrors `prerender.js`'s #1 safety constraint. A route that degraded to a CSR shell (no prerendered file) is reported, never failed; violations are logged but the build still exits 0, so a broken validation never blocks the Amplify deploy.
- **Strict mode** — set `STRICT_PRERENDER=true` (reused from `prerender.js`) or `STRICT_SEO_VALIDATION=true` to make any violation fail the build with exit 1. Use this in a pre-release check when you want a hard gate on the indexed HTML.

This is the build-artifact complement to the jsdom unit tests (`src/components/SEO.test.tsx`, `src/utils/schemas.test.ts`), which validate the JSON-LD generation logic but not the final shipped file.

## Amplify

The Amplify build (`amplify.yml`) runs `npm run test && npm run build` on every deploy. This is belt-and-suspenders — CI blocks merges to `main`, and Amplify blocks deploys if CI-quality state somehow regresses after merge (e.g., a direct push).
