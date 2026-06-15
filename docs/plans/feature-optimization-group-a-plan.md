# Feature Optimization — Group A Implementation Plan

> Generated 2026-06-15 from the Group A refinement audit (12 content/marketing pages → **61 verified refinements** → **10 PR-sized work packages**). Source findings: `docs/feature-optimization.md`. Execute packages with `/execute`.
> **Refinement only — no package introduces new features.**

## MISSION BRIEF

**Overview:** 61 verified, file:line-grounded refinements consolidated into 10 work packages — 3 standalone High-value fixes (correctness, SEO copy, Contact a11y), 4 mechanical cross-cutting sweeps (image CLS, ViewTransitionLink, reduced-motion, CTA/touch-target), and 3 thematic cleanups (dead code/dedup, a11y polish, consistency/UX residuals).

**Recommended execution order** (impact → risk → file-overlap):
1. **WP-A** Podcast date off-by-one + regression test — *High, correctness, isolated. Ship first.*
2. **WP-B** Foundation cybersecurity copy alignment — *High, SEO/crawlable copy, trivial, isolated.*
3. **WP-C** Contact.tsx bundle (field-validation a11y + cleanups) — *High a11y, single file.*
4. **WP-D** Image CLS dimensions + lazy-loading sweep — *Medium perf, mechanical, multi-page.*
5. **WP-E** ViewTransitionLink sweep — *Medium consistency, mechanical.*
6. **WP-F** Reduced-motion gating sweep — *Low, mechanical.*
7. **WP-G** CTA / touch-target / micro-interaction sweep — *Medium, mechanical.*
8. **WP-H** Dead code & duplication cleanup — *Medium maintainability; run after the sweeps.*
9. **WP-I** Accessibility polish (incl. the meatier AWS overlay removal) — *Medium.*
10. **WP-J** Consistency, tokens & UX residuals (carries the owner decisions) — *Low/Medium.*

**Decision points (resolve before/while executing):**
- **WP-A** — *RESOLVED (recommended):* fix `formatDate` via bare-`YYYY-MM-DD` manual parse, NOT a blanket `{timeZone:'UTC'}` (the function is shared with Blog/BlogPost, which pass full Sanity timestamps — UTC would shift blog dates near midnight).
- **WP-H** — Podcast `topics`/`guests` dead UI: **wire the generator to populate them** vs **remove the dead branches**. Owner call (depends on whether per-episode topics/guests will ever come from the generator vs Sanity).
- **WP-I** — AWS keyboard overlay: *recommended* to **remove the invisible overlay layer + `projectTo2D`** and rely on the visible cluster nav bar (already accessible).
- **WP-J** — Links X/Twitter handle: confirm the correct URL (`x.com/thechrisgrey` vs `x.com/x_thechrisgrey`) **with the owner** before pointing everything at `SOCIAL_LINKS`.
- **WP-J** — SpotifyFacade `sandbox`: must be **live-verified** (the embed may need `allow-storage-access-by-user-activation`; confirm playback after scoping).
- **WP-J** — Privacy consent reset: keep the full `window.location.reload()` (acceptable for a rare control) vs a reactive re-show. Low priority.

**File-overlap note (important for execution):** the theme-based packages co-edit several files — e.g. `Home.tsx` (D, H, I), `Altivum.tsx` (D, G, H, I, J), `AWS` topology (F, H, I), `ArchitectureXRay.tsx` (F, H, I, J), `BeyondTheAssessment.tsx` (D, G, H, J), `Privacy.tsx` (E, I, J), `Links.tsx` (D, E, H, J), `Foundation.tsx` (B, D, H, I). **Execute the packages sequentially in the order above** (not as parallel branches) to avoid conflicts — or, if you prefer isolated PRs, re-slice by page instead of by theme. Each package's own "Dependencies & Order of Operations" section assumes sequential execution.

**Total estimated effort:** ~3–5 focused days. The bulk is Low-complexity mechanical change (sweeps D/E/F/G, cleanup H, polish I/J); the Medium-complexity work concentrates in WP-C (Contact per-field validation refactor), WP-I (AWS overlay removal), and the WP-H Podcast generator decision.

---

## Table of contents

- **WP-A** — Podcast date off-by-one bug + regression test *(Impact: High)*
- **WP-B** — Foundation cybersecurity copy alignment *(Impact: High)*
- **WP-C** — Contact.tsx refinements bundle (a11y + dead code + data-drive) *(Impact: High)*
- **WP-D** — Image CLS dimensions + lazy-loading sweep *(Impact: Medium)*
- **WP-E** — ViewTransitionLink consistency sweep *(Impact: Medium)*
- **WP-F** — Reduced-motion gating consistency sweep *(Impact: Low)*
- **WP-G** — CTA / touch-target / micro-interaction convention sweep *(Impact: Medium)*
- **WP-H** — Dead code & duplication cleanup *(Impact: Medium)*
- **WP-I** — Accessibility polish *(Impact: Medium)*
- **WP-J** — Consistency, tokens & UX residuals *(Impact: Low/Medium)*

---

## WP-A: Podcast date off-by-one bug + regression test

**Aggregate impact:** High

#### Objective

Fix the off-by-one date bug in `src/utils/dateFormatter.ts` so bare `YYYY-MM-DD` strings (the shape podcast data ships — `scripts/generate-podcast-episodes.js:248` does `snippet.publishedAt.split('T')[0]`) render the calendar date the author intended in every timezone, instead of rolling back a day for US/negative-offset visitors. Then lock the fix with a regression test in `EpisodeCard.test.tsx` (currently masked by a midday-UTC fixture that never asserts the rendered date) plus strengthen the existing `dateFormatter.test.ts` so the bug cannot silently regress. Refinement only — no new formatting features, no API changes, no new exports.

Bug confirmed empirically under `TZ=America/Los_Angeles`:
- `formatDate('2026-01-10')` → `"January 9, 2026"` (wrong, off by one)
- `formatDate('2026-01-10T12:00:00Z')` → `"January 10, 2026"` (correct — this is exactly why the current test fixture masks the bug)

#### Prerequisites

- None blocking. All target files read. No new dependencies; `vitest` already present (`package.json` scripts `test`, `test:watch`, `test:coverage`).
- Awareness that `formatDate` is **shared**: imported by `EpisodeCard.tsx:4`, `Blog.tsx:7` (line 432), and `BlogPost.tsx:8` (line 365). Blog `publishedAt` comes from Sanity as a **full ISO datetime** (`src/sanity/types.ts:33,67`), not a bare date. The chosen fix must not alter blog-date rendering. (Verified: a Sanity timestamp near UTC midnight, e.g. `2026-01-10T02:00:00Z`, renders "January 9" locally in Pacific today; a blanket UTC option would flip it to "January 10" — a behavior change for blog posts. The manual-parse approach avoids this entirely.)
- The repo already has the canonical TZ-safe pattern to mirror: `formatMonthYear` in `src/pages/Podcast.tsx:23-28` ("Parsed by string, not Date, to avoid any UTC/local timezone month-shift").

#### Step-by-Step Implementation

**1. Fix `src/utils/dateFormatter.ts` to be TZ-safe for bare `YYYY-MM-DD`.**

DECISION — two viable approaches:

- **Option A (RECOMMENDED): Detect bare `YYYY-MM-DD` and parse the components manually; leave full timestamps on the existing local path.** A bare date string has no time/offset, so it represents a calendar date with no timezone meaning — format it from its parts. A full ISO timestamp (Sanity blog posts) carries a real instant and should keep rendering in the viewer's local zone exactly as today. This is the only option that fixes podcast dates **without** changing blog-date behavior for the shared function, and it mirrors the existing `formatMonthYear` precedent already trusted in this codebase.
- **Option B: Pass `{ timeZone: 'UTC' }` unconditionally.** Simpler one-line-per-function change, but it is a *blanket* behavior change to a shared util: full-timestamp blog dates near UTC midnight would shift day for negative-offset viewers (verified above). Rejected because it changes blog rendering and silently reinterprets real instants as UTC.

Proceeding with **Option A**.

1.1. Add a small internal helper (not exported — keeps the public surface unchanged) that builds the `Date` to format:
- Match strictly bare dates with `/^\d{4}-\d{2}-\d{2}$/`.
- For a match, construct the date at **local** noon from the parsed parts (`new Date(year, monthIndex, day, 12)`). Local noon guarantees no DST/midnight edge can roll the day in any zone, and lets `toLocaleDateString` (no `timeZone` option) render the intended calendar date.
- For non-matches (full ISO timestamps, anything with a `T`), fall back to `new Date(dateString)` unchanged — preserving current blog behavior exactly.

1.2. Refactor `formatDate` (line 8) and `formatDateShort` (line 19) to call the helper instead of `new Date(dateString)` directly, keeping their existing `toLocaleDateString('en-US', {...})` option objects byte-for-byte (so the `month: long|short, day, year` output format is unchanged). No signature change, no new export.

**2. Lock the fix with regression tests.**

2.1. **Pin a deterministic US timezone for the test run.** The bug only manifests in negative-offset zones, so tests must not depend on the CI machine's local zone. Use Vitest's per-suite config in BOTH affected test files:
```ts
import { beforeAll, afterAll } from 'vitest';
const ORIGINAL_TZ = process.env.TZ;
beforeAll(() => { process.env.TZ = 'America/Los_Angeles'; });
afterAll(() => { process.env.TZ = ORIGINAL_TZ; });
```
Place this at the top of each `describe` file's module scope so it applies before any render. (Setting `process.env.TZ` before the date is constructed is honored by Node's `Intl`/`Date` in this environment — confirmed via the repro above which used exactly this mechanism.)

DECISION — TZ pinning location: **per-file `beforeAll`/`afterAll` (RECOMMENDED)** vs. a global `process.env.TZ` in `src/__tests__/setup.ts` or the `test` npm script. Recommend per-file: it is explicit about *why* the suite needs a fixed zone, scoped to the two tests that actually assert TZ-sensitive output, and avoids globally reinterpreting every other test's date handling. Do **not** hard-set `TZ` in the npm `test` script — that hides the dependency and changes the whole suite's environment.

2.2. **`EpisodeCard.test.tsx` — change the masking fixture and add date assertions.**
- Change `baseEpisode.publishedAt` (line 11) from `'2026-01-10T12:00:00Z'` to the bare shape the real data ships: `'2026-01-10'`.
- Add a `describe('date rendering', ...)` block asserting the rendered string is `"January 10, 2026"` (the intended calendar date) — proving the day did not roll back under Pacific time. This is the assertion the suite has never had.
- Cover the date in the variants that actually render it via `formatDate`:
  - **standard** variant: `formatDate(episode.publishedAt)` renders at `EpisodeCard.tsx:179`. Assert `screen.getByText('January 10, 2026')`.
  - **compact** variant: the desktop date at line 53 is in a `hidden md:block` span (still in the DOM in jsdom — no real CSS), and the expanded mobile date at line 72 only mounts when expanded. Add one assertion for the collapsed compact desktop date (`getAllByText('January 10, 2026')` since it may also appear once expanded), and optionally one after `await user.click(...)` for the expanded path. Keep these aligned with the existing compact tests' `userEvent.setup()` pattern.
  - The **featured** variant also renders `formatDate` at line 179 (shared meta block); add an assertion there for completeness.
- Sanity-check the unchanged tests: switching the fixture to a bare date does not affect the title/duration/links/guests/topics assertions (they don't read `publishedAt`).

2.3. **`dateFormatter.test.ts` — add a true regression test and stop self-referencing the buggy path.** The current file's `expectedFull`/`expectedShort` helpers (lines 9-23) compute the expected value with the **same** `new Date(...).toLocaleDateString(...)` logic the function uses, so a bug in that path would be mirrored in the expectation and never caught. Add explicit, hard-coded assertions under a fixed Pacific TZ:
- `expect(formatDate('2026-01-10')).toBe('January 10, 2026')` (would have been `'January 9, 2026'` before the fix).
- `expect(formatDateShort('2026-01-10')).toBe('Jan 10, 2026')`.
- A first-of-month case that is the worst off-by-one: `expect(formatDate('2026-03-01')).toBe('March 1, 2026')` (pre-fix → `'February 28, 2026'`).
- A full-timestamp guard proving blog behavior is preserved: assert that `formatDate('2026-01-10T18:30:00Z')` still equals the **local** rendering (e.g. `'January 10, 2026'` in Pacific) — i.e., full timestamps are NOT forced to UTC. This documents the Option A boundary.
- Keep the existing tz-agnostic tests as-is (they remain valid); only ADD the pinned-TZ regression assertions and the `beforeAll/afterAll` TZ pin.

**3. Validate.** Run the targeted suites, then the full suite, then lint/typecheck (Step in Testing & Validation).

#### File & Code Changes

| Action | File Path | Description |
| --- | --- | --- |
| Modify | `/Users/cperez/dev/altivum-dev/thechrisgrey/src/utils/dateFormatter.ts` | Add a non-exported helper that manually parses strictly-bare `YYYY-MM-DD` (regex `^\d{4}-\d{2}-\d{2}$`) into a local-noon `Date`, and falls back to `new Date(dateString)` for full timestamps. Route `formatDate` (line 8) and `formatDateShort` (line 19) through it; leave both `toLocaleDateString('en-US', {...})` option objects unchanged. No signature/export change. |
| Modify | `/Users/cperez/dev/altivum-dev/thechrisgrey/src/components/EpisodeCard.test.tsx` | Change `baseEpisode.publishedAt` (line 11) `'2026-01-10T12:00:00Z'` → `'2026-01-10'`. Add module-scope `beforeAll`/`afterAll` pinning `process.env.TZ='America/Los_Angeles'`. Add a `date rendering` describe asserting `"January 10, 2026"` in standard, featured, and compact (collapsed + expanded) variants. |
| Modify | `/Users/cperez/dev/altivum-dev/thechrisgrey/src/utils/dateFormatter.test.ts` | Add module-scope `beforeAll`/`afterAll` pinning Pacific TZ. Add hard-coded regression assertions for bare dates (`'2026-01-10'`→`'January 10, 2026'`, short variant, and `'2026-03-01'`→`'March 1, 2026'`) and a full-timestamp guard documenting that timestamps keep local rendering. Leave existing tz-agnostic tests intact. |

No changes to `scripts/generate-podcast-episodes.js` (the bare-date data shape is correct and intentional — `// YYYY-MM-DD` comment at line 248), `Blog.tsx`, `BlogPost.tsx`, or `Podcast.tsx`.

#### Testing & Validation

Unit/integration:
- `npx vitest run src/utils/dateFormatter.test.ts` — new pinned-TZ assertions must pass; confirm they would FAIL pre-fix (sanity-check by temporarily reverting only `dateFormatter.ts` and re-running, then restoring — proves the test actually guards the bug, per the "distrust green tests" rule).
- `npx vitest run src/components/EpisodeCard.test.tsx` — the new date-rendering assertions and all existing assertions pass with the bare-date fixture.
- `npm test` — full suite green (verify no other test depended on the old `T12:00:00Z` fixture; grep showed `dateFormatter` is only imported by `EpisodeCard`, `Blog`, `BlogPost`, and no test asserts on rendered blog dates, so blast radius is contained).
- `npm run lint` and `npx tsc --noEmit` (or `npm run build`'s tsc step) — no type/lint regressions; helper is internal so no API drift.

Manual verification (the "run the real thing" rule — green tests alone are not proof for TZ-sensitive rendering):
- `TZ=America/Los_Angeles node -e "import('./src/utils/dateFormatter.ts')"` is not directly runnable (TS); instead verify behavior in the dev app: `npm run dev`, open `/podcast`, and with the OS or browser set to a US Pacific/Eastern zone confirm episode dates match the YouTube publish date (no day-behind). The repro command already proved the fix at the engine level: `TZ=America/Los_Angeles node -e "...timeZone:'UTC'..."` → `January 10` and bare-parse → intended date.
- Spot-check `/blog` and a `/blog/:slug` page under the same TZ to confirm blog dates are unchanged by the shared-util edit (Option A guarantees this for full timestamps).

Rollback check:
- Single-commit, fully reversible: `git revert <sha>` restores prior `dateFormatter.ts` and tests. No data migration, no env var, no deploy-time generator change, no IAM/infra. Reverting only re-exposes the latent bug; it cannot break the build.

#### Risk & Mitigation

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Fix unintentionally changes blog date rendering (shared `formatDate`) | Low | Med | Option A only branches on strictly-bare `YYYY-MM-DD`; full Sanity timestamps keep the exact current `new Date(dateString)` local path. Add the full-timestamp guard test + manual `/blog` spot-check. |
| Regex too loose/strict (e.g. matches `2026-1-5` or rejects valid input) | Low | Low | Anchor `^\d{4}-\d{2}-\d{2}$`; YouTube/`split('T')[0]` always emits zero-padded 4-2-2. Non-matches fall through safely to existing behavior. |
| `process.env.TZ` not honored mid-process in CI Node | Low | Med | Set in `beforeAll` before any `Date`/render; verified working in this env via the repro. If a runner ignores it, fall back to pinning TZ in the test command for these two files only — but prefer per-file so the dependency is visible. |
| Local-noon `Date` still shifts day in extreme offsets | Very Low | Low | Max real offset is ±14h; noon ±14h stays within the same calendar day, so the day never rolls. |
| Self-referential expected helpers mask a future regression | Med (pre-existing) | Med | Add hard-coded literal expectations (not derived from `new Date(...).toLocaleDateString`) so the assertion is independent of the implementation path. |
| Existing tests break from fixture change | Low | Low | Grep confirms only `EpisodeCard.test.tsx` uses this fixture and no test asserts rendered date today; non-date assertions are independent of `publishedAt`. |

#### Dependencies & Order of Operations

1. Edit `src/utils/dateFormatter.ts` (Step 1) first — tests assert against the fixed behavior.
2. Update `src/utils/dateFormatter.test.ts` (Step 2.3) and `src/components/EpisodeCard.test.tsx` (Step 2.2) — order between the two test files is independent.
3. Run targeted suites → full `npm test` → `npm run lint` + tsc (Step 3 / Testing).
4. (Optional but recommended per repo rules) Temporarily revert only `dateFormatter.ts`, re-run the new tests to confirm they go RED, then restore — proving the regression test has teeth.
5. Manual TZ spot-check in dev app before considering it "works" (not just "tests pass").

No external-service, deploy, AWS, or schema dependencies. No item drifts into new functionality — this stays strictly within the off-by-one fix + its regression coverage.

#### Estimated Effort

Complexity **Low** · Time **30-45 min** (including the deliberate red/green verification of the regression test and a manual TZ spot-check) · Files affected **3** (`src/utils/dateFormatter.ts`, `src/utils/dateFormatter.test.ts`, `src/components/EpisodeCard.test.tsx`).

---

## WP-B: Foundation cybersecurity copy alignment

**Aggregate impact:** High

#### Objective

Bring the four crawlable/snippet-bearing copy surfaces on the Foundation page into agreement with the four-field funding model ("cloud computing, artificial intelligence, robotics, **and cybersecurity**") that the page already asserts in its grid (`FOCUS_AREAS`, all four ordinals 01–04), its section heading ("Four fields. One common thread."), the FAQ answers (`schemas.ts:531`, `535`), the schema `description` line, and `knowsAbout` (`schemas.ts:561`). Cybersecurity is currently missing from:

1. The H1 (`Foundation.tsx:64`) — "Veteran scholarships in AI, Cloud &amp; Robotics."
2. The SEO meta `description` (`Foundation.tsx:35`)
3. The SEO `keywords` (`Foundation.tsx:36`)
4. The Vision paragraph (`Foundation.tsx:103`)

This is a **copy-only** refinement. No components, props, schema fields, or behavior change. Keep typography tokens, `&amp;` entity usage, and the existing voice intact; keep the meta description within a reasonable SERP length.

#### Prerequisites

- No new dependencies. No env vars. No Sanity/AWS changes.
- Confirm working tree state before editing (existing untracked `.claude/` and `scripts/editorial-raw/` are unrelated; leave them).
- Note the inconsistency that this WP intentionally does **not** touch (out of refinement scope, flagged for awareness): `buildFoundationOrganizationSchema().description` (`schemas.ts:551`) also lists only three fields — but that string is an exact mirror of the SEO description and is *not* in this WP's item list. DECISION on whether to align it is raised in Step 1.5 below; default recommendation is to align it for the same reason (it is a crawlable JSON-LD description), but it can be deferred without breaking this WP.

#### Step-by-Step Implementation

**1. Update the four named surfaces in `src/pages/Foundation.tsx` and `src/utils/schemas.ts` to include cybersecurity.**

The canonical four-field phrasing already used by the page's FAQ (`schemas.ts:531`) is: *"cloud computing, artificial intelligence, robotics, and cybersecurity"* (Oxford comma, lowercase in prose). Match that phrasing in prose surfaces; match the H1's existing Title-Case + `&amp;` style in the H1.

**1.1 — H1 (`Foundation.tsx:64`).**
Current:
```tsx
              Veteran scholarships in AI, Cloud &amp; Robotics.
```
The existing H1 abbreviates ("AI, Cloud") and uses `&amp;` before the last item. Adding a fourth item to a serial list joined only by `&` reads awkwardly ("AI, Cloud, Robotics &amp; Cybersecurity" — acceptable, standard serial-with-ampersand). 

DECISION — H1 wording (it is the most prominent on-page + SERP title-adjacent string):
- **Option A (recommended):** `Veteran scholarships in AI, cloud, robotics &amp; cybersecurity.` — keeps the compact four-item list, uses `&amp;` before the final item per the existing pattern, lowercases the field nouns to read as prose (matches "cloud computing/artificial intelligence" being descriptive, not proper nouns). Slightly longer but still one line on desktop with `heroHeader` clamp sizing.
- **Option B (minimal change):** `Veteran scholarships in AI, Cloud, Robotics &amp; Cybersecurity.` — preserves the current Title Case exactly, only inserts the new item. Lowest-risk diff.
- **Recommendation: Option B** for the H1 specifically — it is the smallest, most defensible change and preserves the established Title-Case treatment of the four field labels (which mirrors the grid's Title-Case `name` values: "Cloud Computing", "Artificial Intelligence", "Robotics", "Cybersecurity"). Apply Option B.

New (Option B):
```tsx
              Veteran scholarships in AI, Cloud, Robotics &amp; Cybersecurity.
```
Verify after edit: at the largest `heroHeader` clamp size this is four words longer than today; it wraps gracefully (centered, `max-w-4xl`) and there is no fixed-height container, so wrapping is safe.

**1.2 — SEO meta description (`Foundation.tsx:35`).**
Current (228 chars):
```tsx
        description="The Altivum Foundation is a 501(c)(3) nonprofit funding U.S. military veterans pursuing education in cloud computing, artificial intelligence, and robotics — at no cost to the scholar."
```
Insert `, and cybersecurity` and drop the now-redundant `and` before robotics so the serial list is correct:
```tsx
        description="The Altivum Foundation is a 501(c)(3) nonprofit funding U.S. military veterans pursuing education in cloud computing, artificial intelligence, robotics, and cybersecurity — at no cost to the scholar."
```
Length after change ≈ 244 characters. That is longer than Google's typical ~155–160 char desktop snippet display, but the *current* string is already 228 chars and well past that threshold — this WP is alignment, not a description rewrite, so adding one field keeps parity with existing behavior. Length is "reasonable" in that it is a single, well-formed sentence; full rewrite/trim is explicitly out of WP-B scope. (If trimming is desired it becomes a separate copy task — note and stop at the refinement boundary.)

**1.3 — SEO keywords (`Foundation.tsx:36`).**
Current:
```tsx
        keywords="The Altivum Foundation, Altivum Foundation, veteran scholarships, 501c3, cloud computing education, AI education, robotics education, Christian Perez Founder"
```
Add a cybersecurity keyword in the same "<field> education" pattern, placed adjacent to the other field-education keywords (after `robotics education`):
```tsx
        keywords="The Altivum Foundation, Altivum Foundation, veteran scholarships, 501c3, cloud computing education, AI education, robotics education, cybersecurity education, Christian Perez Founder"
```

**1.4 — Vision paragraph (`Foundation.tsx:103`).**
Current:
```tsx
            The men and women who served this country bring discipline, adaptability, and leadership forged under pressure. The industries shaping the next century — cloud computing, artificial intelligence, robotics — need exactly those qualities. The Altivum Foundation exists to connect the two.
```
Add cybersecurity to the em-dash field list. The list is set off by em-dashes and currently has no trailing comma; append `, and cybersecurity` before the closing em-dash:
```tsx
            The men and women who served this country bring discipline, adaptability, and leadership forged under pressure. The industries shaping the next century — cloud computing, artificial intelligence, robotics, and cybersecurity — need exactly those qualities. The Altivum Foundation exists to connect the two.
```

**1.5 — (DECISION, optional alignment) `buildFoundationOrganizationSchema` description (`schemas.ts:551`).**
This JSON-LD `description` is verbatim the same three-field sentence as the SEO meta description and is also crawlable:
```ts
    "description": "A 501(c)(3) nonprofit funding U.S. military veterans pursuing education in cloud computing, artificial intelligence, and robotics — at no cost to the scholar.",
```
DECISION:
- **Option A (recommended):** Align it too — change to `... cloud computing, artificial intelligence, robotics, and cybersecurity — at no cost to the scholar.` Rationale: it is a crawlable description string with the exact defect the WP targets (omits the 4th field while `knowsAbout` two lines below lists it), and leaving it creates fresh schema-vs-`knowsAbout` drift. The edit is one line, zero risk.
- **Option B:** Leave it; it is not in the WP-B item list.
- **Recommendation: Option A.** It is the same class of fix and avoids introducing a new internal contradiction in the very same schema function. This stays inside the refinement boundary (copy alignment, no new field/behavior).

If the orchestrator wants strict scope adherence, apply 1.1–1.4 only and record 1.5 as a follow-up.

**2. Run validation (lint, typecheck, build subset, tests) — see Testing & Validation.**

#### File & Code Changes

| Action | File Path | Description |
|--------|-----------|-------------|
| Edit | `/Users/cperez/dev/altivum-dev/thechrisgrey/src/pages/Foundation.tsx` | Line 64: H1 → `Veteran scholarships in AI, Cloud, Robotics &amp; Cybersecurity.` (Option B). |
| Edit | `/Users/cperez/dev/altivum-dev/thechrisgrey/src/pages/Foundation.tsx` | Line 35: SEO `description` — insert `robotics, and cybersecurity` (replace `and robotics` with `robotics, and cybersecurity`). |
| Edit | `/Users/cperez/dev/altivum-dev/thechrisgrey/src/pages/Foundation.tsx` | Line 36: SEO `keywords` — add `cybersecurity education,` after `robotics education,`. |
| Edit | `/Users/cperez/dev/altivum-dev/thechrisgrey/src/pages/Foundation.tsx` | Line 103: Vision paragraph — change `artificial intelligence, robotics —` to `artificial intelligence, robotics, and cybersecurity —`. |
| Edit (optional, Step 1.5 Option A) | `/Users/cperez/dev/altivum-dev/thechrisgrey/src/utils/schemas.ts` | Line 551: schema `description` — change `and robotics — at no cost` to `robotics, and cybersecurity — at no cost`. |

No new files. No deletions. `FOCUS_AREAS`, FAQ answers, `knowsAbout`, and the section heading already contain cybersecurity — leave them unchanged.

#### Testing & Validation

Unit/integration tests:
- Search for any existing test that asserts on these strings before editing, so an edit doesn't silently break a snapshot/assertion:
  ```bash
  rg -n "AI, Cloud|artificial intelligence, and robotics|robotics education|Four fields" /Users/cperez/dev/altivum-dev/thechrisgrey/src
  ```
  If a test pins the old three-field copy, update that assertion to the new string in the same change set (do not weaken the assertion — update the expected literal).
- Optional (recommended) lightweight guard test, only if a Foundation test file already exists or the team wants a regression net: assert the rendered H1, SEO description, and Vision paragraph each contain the four field tokens. Mock `AltiMascot`/3D and GSAP per the repo's jsdom gotchas; `SEO`/react-helmet-async integration needs explicit `cleanup()` in try/catch per CLAUDE.md. Do not add a brand-new test harness solely for this copy change unless the team requests it — that drifts toward new scope.

Static checks:
```bash
npm run lint
npx tsc --noEmit
```

Targeted unit run:
```bash
npx vitest run src/pages 2>/dev/null; npx vitest run src/utils/schemas.test.ts 2>/dev/null
```
(If those paths don't exist, run the full suite: `npx vitest run`.)

Manual verification (the "run the real thing" rule — copy is verified by rendering, not just by grep):
```bash
npm run dev
```
- Visit `http://localhost:5173/foundation`. Confirm:
  - H1 reads "Veteran scholarships in AI, Cloud, Robotics & Cybersecurity." and wraps cleanly at mobile (375px) and desktop widths — no clipping, still centered.
  - Vision paragraph lists all four fields.
  - View source / DevTools `<head>`: `<meta name="description">` and `<meta name="keywords">` contain cybersecurity.
  - View page JSON-LD (`<script type="application/ld+json">`): if Step 1.5 applied, the NonprofitOrganization `description` lists four fields; `knowsAbout` already does.
- Optional snippet/structured-data sanity: paste the page's JSON-LD into Google Rich Results Test after deploy (the build pipeline `npm run build` also exercises sitemap/RSS, but those don't touch this copy).

Rollback check:
- Change is four (or five) isolated string edits. Rollback = `git checkout -- src/pages/Foundation.tsx src/utils/schemas.ts` (or revert the commit). No data/state migration, so rollback is instantaneous and total.

#### Risk & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| A test pins the old three-field strings and turns red | Medium | Low | Run the `rg` search in step 1; update any pinned literal to the new copy in the same change set. |
| H1 wraps to an extra line on small screens and looks unbalanced | Low | Low | H1 is centered, `max-w-4xl`, no fixed height — wrapping is safe; verify at 375px in dev. Option B keeps wording compact. |
| Meta description grows further past Google's ~160-char display window | High (already over) | Low | Out of WP scope to rewrite; this only maintains parity. Flag a separate "trim Foundation meta description" task if SERP truncation matters. |
| Em-dash / `&amp;` entity typed incorrectly (e.g., literal `&` in JSX, or hyphen instead of `—`) | Low | Medium | Reuse the exact existing `—` (U+2014) and `&amp;` from the current lines; copy them rather than retyping. ESLint/JSX will not catch a wrong dash, so verify visually in dev. |
| Scope creep into rewriting Vision/description copy | Low | Medium | Insert-only edits; no restructuring. Stop at the four-field insertion boundary. |
| Step 1.5 (schema description) deemed out of scope by orchestrator | Low | Low | It is optional and clearly flagged; skipping it leaves the WP-B items fully addressed. |

#### Dependencies & Order of Operations

1. Run the `rg` pre-edit search for pinned strings (informs whether a test update rides along).
2. Apply the four `Foundation.tsx` edits (1.1 → 1.4); order among them is independent.
3. (Optional) Apply the `schemas.ts:551` edit (1.5) if Option A is accepted.
4. Update any test literal surfaced in step 1.
5. `npm run lint` → `npx tsc --noEmit` → `vitest run` (targeted, then full if needed).
6. `npm run dev` manual render verification of all four surfaces.
7. Commit/push only when the user asks; if asked, branch off `main` first (not committing to `main` directly).

No cross-file ordering constraint: the `Foundation.tsx` and `schemas.ts` edits are independent (the page imports `foundationFAQs`/`buildFoundationOrganizationSchema`, but neither edited string is consumed by the other file).

#### Estimated Effort

Complexity **Low** · Time **10–20 minutes** (plus a few minutes if a pinned test literal must be updated) · Files affected **1** (`Foundation.tsx`), **2** if Step 1.5 Option A is taken (`+ schemas.ts`); 0 new files.

---

## WP-C: Contact.tsx refinements bundle (a11y + dead code + data-drive)

**Aggregate impact:** High

#### Objective

Refine `src/pages/Contact.tsx` along five verified, scope-bounded axes — without adding any new feature — to raise accessibility and remove dead code/duplication:

1. **Field-level validation a11y (HIGH):** replace the single shared `role="alert"` validation box with per-field error state (`aria-invalid` + `aria-describedby` + a per-field `<p id role="alert">` beneath each input), and move keyboard focus to the first invalid field on submit. Mirror the existing `FormInput.tsx` pattern (lines 41-49).
2. **Drop `focus:outline-hidden`** on the four inputs/textarea (lines 273, 290, 306, 324) so the global gold `:focus-visible` ring in `index.css:138-142` applies; `index.css:146-152` already suppresses the mouse-click outline.
3. **Announce the success-modal confirmation `<p>`** (lines 535-537) with `role="status" aria-live="polite"` (cf. `ChatMessage.tsx:92`).
4. **Remove the dead `"success"` branch:** the `formStatus.type` union (lines 20-23) and the green style branch (lines 347-348) include `"success"`, but the success path sets `type: 'idle'` and opens the modal (lines 101-104). Nothing ever sets `"success"`.
5. **Data-drive the six contact-info link blocks** (lines 391-468, ~75 lines of near-identical JSX) into a `contactChannels` array, branching once between `material-icons` and `<SocialIcon>`, sourcing hrefs from the already-imported `SOCIAL_LINKS` (line 6) where they exist.

This stays strictly at the refinement boundary: no new fields, no new validation rules, no new channels, no behavioral change to submit/fetch logic. The only intentional behavioral change is the validation **presentation** (per-field vs. shared box), which is the explicit ask in item 1 and forces an update to the existing integration tests' assertions.

#### Prerequisites

- Read (already done): `src/pages/Contact.tsx`, `src/components/ui/FormInput.tsx`, `src/index.css:138-152`, `src/components/chat/ChatMessage.tsx:92`, `src/constants/links.ts`, `src/components/SocialIcon.tsx`, `src/utils/validators.ts`, `src/__tests__/integration/Contact.integration.test.tsx`, `src/components/ui/FormInput.test.tsx`.
- Tooling baseline before edits:
  ```bash
  cd /Users/cperez/dev/altivum-dev/thechrisgrey
  npx vitest run src/__tests__/integration/Contact.integration.test.tsx
  ```
  Confirm green so the refactor's diff is attributable.
- **Known contract collision:** the existing integration tests at `Contact.integration.test.tsx:108-148` assert a single `screen.getByRole('alert')` carrying the *whole* message string. After item 1, validation errors render as **per-field** alerts (multiple `role="alert"` nodes). Those three tests (`shows error when name is too short`, `...email is invalid`, `...message is too short`) and `clears error when user starts typing` (lines 151-174) MUST be updated in the same change set or the suite breaks. This is anticipated, not a regression.
- No new dependencies. `SOCIAL_LINKS`, `SocialIcon`, `isValidEmail` are all already imported.

#### Step-by-Step Implementation

**1. Field-level validation a11y (HIGH) — items 1 + drives the dead-branch removal in item 4**

1.1 Add a per-field errors state next to `formStatus` (after line 23). Keys match field names so `handleChange` can clear them by `e.target.name`:
   ```tsx
   type FieldName = 'name' | 'email' | 'message';
   const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldName, string>>>({});
   ```

1.2 Refactor `validateForm` (lines 55-66) from returning `string | null` to returning a keyed errors object. Keep the **exact same** rules and message strings (no scope creep):
   ```tsx
   const validateForm = (): Partial<Record<FieldName, string>> => {
     const errors: Partial<Record<FieldName, string>> = {};
     const name = formData.name.trim();
     if (name.length < 2 || name.length > 100) {
       errors.name = 'Name must be between 2 and 100 characters';
     }
     if (!isValidEmail(formData.email)) {
       errors.email = 'Please enter a valid email address';
     }
     const message = formData.message.trim();
     if (message.length < 10 || message.length > 5000) {
       errors.message = 'Message must be between 10 and 5000 characters';
     }
     return errors;
   };
   ```
   DECISION — message wording: **Recommendation: keep the three existing strings verbatim.** Rewording them would be scope creep and would need extra test churn. (Alternative: shorten now that each error sits beside its field, e.g. "2–100 characters" — rejected; out of refinement scope.)

1.3 Rewrite the validation block in `handleSubmit` (lines 71-76). Set per-field errors, then focus the first invalid field by DOM order (name → email → message). Define a stable focus order so "first invalid" is deterministic:
   ```tsx
   const errors = validateForm();
   if (Object.keys(errors).length > 0) {
     setFieldErrors(errors);
     const order: FieldName[] = ['name', 'email', 'message'];
     const firstInvalid = order.find((f) => errors[f]);
     if (firstInvalid) {
       document.getElementById(firstInvalid)?.focus();
     }
     return;
   }
   setFieldErrors({}); // clear stale errors on a now-valid submit
   ```
   Note: `document.getElementById(...).focus()` works in jsdom and matches existing direct-DOM usage already in this file (lines 39, 51 use `window`/`document` listeners). Inputs already have `id={name}` (lines 266, 284, 301, 316), so `getElementById` keys off the existing ids — no refs needed.

1.4 Update `handleChange` (lines 134-143) to clear that field's error on input, replacing the current `formStatus`-based clear:
   ```tsx
   const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
     const { name, value } = e.target;
     setFormData(prev => ({ ...prev, [name]: value }));
     if (fieldErrors[name as FieldName]) {
       setFieldErrors(prev => {
         const next = { ...prev };
         delete next[name as FieldName];
         return next;
       });
     }
   };
   ```

1.5 Add `aria-invalid` / `aria-describedby` to the three validated inputs and the textarea, and render a per-field error `<p>` beneath each — mirroring `FormInput.tsx:41-49`. The **subject** field is not validated, so it gets neither (no `fieldErrors.subject` ever exists). For the **name** input (lines 264-275) the block becomes:
   ```tsx
   <input
     type="text"
     id="name"
     name="name"
     value={formData.name}
     onChange={handleChange}
     required
     minLength={2}
     maxLength={100}
     aria-invalid={fieldErrors.name ? true : undefined}
     aria-describedby={fieldErrors.name ? 'name-error' : undefined}
     className="w-full px-0 py-4 bg-transparent border-b-2 border-white/10 text-white placeholder-white/70 focus:border-altivum-gold transition-all duration-300 rounded-none"
     placeholder="Your name"
   />
   {fieldErrors.name && (
     <p id="name-error" className="mt-2 text-sm text-red-400" role="alert">
       {fieldErrors.name}
     </p>
   )}
   ```
   Repeat for `email` (lines 282-292 → `email-error`) and `message` textarea (lines 315-326 → `message-error`). Note the className above already has `focus:outline-hidden` removed (item 2). Use `mt-2` for spacing consistency with the inputs' `py-4`/`mb-3` rhythm (FormInput uses `mt-1`; `mt-2` reads better against this form's larger spacing — minor, designer-safe).

1.6 Remove the now-orphaned shared status box's role in showing validation errors. The shared box (lines 343-357) is still needed for **submit-time** statuses (loading "Sending...", network/API/429/timeout errors) which are NOT field-scoped — those still flow through `formStatus`. So the shared box STAYS, but item 4 trims its dead success branch (below). Field validation no longer routes through `formStatus`, so remove the `setFormStatus({ type: 'error', ... })` that 1.3 replaced.

**2. Drop `focus:outline-hidden` (item 2)**

2.1 In each of the four control classNames (lines 273, 290, 306, 324), delete the substring `focus:outline-hidden ` (with its trailing space). This includes the un-validated **subject** input (line 306) — the gold ring should apply uniformly. Result keeps `focus:border-altivum-gold`. The global `index.css:138-142` adds the 2px gold `:focus-visible` outline for keyboard users; `index.css:146-152` removes it for mouse `:focus:not(:focus-visible)`. Net: keyboard focus now shows the gold ring (the documented design-system behavior) instead of being suppressed.

**3. Announce the success-modal confirmation (item 3)**

3.1 On the modal confirmation paragraph (lines 535-537) add `role="status"` and `aria-live="polite"`, matching `ChatMessage.tsx:92`:
   ```tsx
   <p className="text-altivum-silver mb-8" style={typography.bodyText} role="status" aria-live="polite">
     Thanks for contacting me. I'll reach back as soon as possible.
   </p>
   ```
   Rationale: the dialog already has `aria-labelledby="contact-modal-title"` ("Thank You!") which SRs announce on focus, but the body sentence is not in the accessible name; `aria-live` ensures it's read when the modal mounts. (The `<p>` mounts with the modal, so a polite live region announces it on insertion.)

**4. Remove the dead `"success"` member/branch (item 4)**

4.1 Narrow the `formStatus.type` union (lines 20-23) by deleting `'success'`:
   ```tsx
   const [formStatus, setFormStatus] = useState<{
     type: 'idle' | 'loading' | 'error';
     message: string;
   }>({ type: 'idle', message: '' });
   ```

4.2 In the shared status box (lines 346-352), remove the unreachable green branch. Since only `'error'` (and a transient `'loading'` "Sending...") can produce a visible message now, simplify the ternary to a binary:
   ```tsx
   <div
     className={`p-5 rounded-xs backdrop-blur-xs transition-all duration-300 ${
       formStatus.type === 'error'
         ? 'bg-red-900/30 border-l-4 border-red-500 text-red-300'
         : 'bg-altivum-blue/30 border-l-4 border-altivum-gold text-altivum-gold'
     }`}
     role="alert"
   >
     {formStatus.message}
   </div>
   ```
   Verify after the union change that TypeScript no longer flags any `=== 'success'` comparison (there are none beyond this branch — `grep "'success'"` should return nothing in the file post-edit).

   Note: the shared box's `role="alert"` remains for submit-time/network errors. Tests targeting network/API/429/timeout errors (`Contact.integration.test.tsx:295-361`) still find exactly one `role="alert"` and stay valid, because those paths never set field errors.

**5. Data-drive the contact-info link blocks (item 5)**

5.1 Define a typed `contactChannels` array. Two shapes — icon-based (`material-icons`) and brand-SVG-based (`SocialIcon`). Place it as a module-level `const` above the component (it's static; no need to recompute per render). Source hrefs from `SOCIAL_LINKS` where a matching entry exists, fall back to literals otherwise:
   ```tsx
   type ContactChannel = {
     href: string;
     external?: boolean; // adds target/_blank + rel
     title: string;
     detail: string;
   } & ({ kind: 'icon'; icon: string } | { kind: 'svg'; platform: string });

   const CONTACT_CHANNELS: ContactChannel[] = [
     { kind: 'icon', icon: 'phone',          href: SOCIAL_LINKS.phone,            title: 'Phone',                   detail: '(615) 219-9425' },
     { kind: 'icon', icon: 'email',          href: SOCIAL_LINKS.altivumEmail,     title: 'General Inquiries',       detail: 'info@altivum.ai' },
     { kind: 'icon', icon: 'business_center',href: SOCIAL_LINKS.altivumLogicEmail,title: 'Altivum Logic Services',  detail: 'logic@altivum.ai' },
     { kind: 'icon', icon: 'person',         href: 'mailto:christian.perez@altivum.ai', title: 'Direct Email',     detail: 'christian.perez@altivum.ai' },
     { kind: 'svg',  platform: 'linkedin',   href: SOCIAL_LINKS.linkedin, external: true, title: 'LinkedIn',         detail: 'Connect professionally' },
     { kind: 'svg',  platform: 'github',     href: SOCIAL_LINKS.github,   external: true, title: 'GitHub',           detail: 'View open-source projects' },
   ];
   ```
   DECISION — Direct Email href: `SOCIAL_LINKS.email` is `'mailto:christian.perez@altivum.ai'` (line 18 of links.ts), which exactly matches the current literal `mailto:christian.perez@altivum.ai` (line 432). **Recommendation: use `SOCIAL_LINKS.email`** to fully honor item 5's "source hrefs from SOCIAL_LINKS." (The table above shows the literal for clarity; replace with `SOCIAL_LINKS.email` in the implementation — verified identical.) The `detail` string `christian.perez@altivum.ai` stays a literal because `SOCIAL_LINKS.email` carries the `mailto:` prefix.

   Verified href parity (no behavior change): `SOCIAL_LINKS.phone` = `tel:+16152199425` (= line 393), `SOCIAL_LINKS.altivumEmail` = `mailto:info@altivum.ai` (= line 406), `SOCIAL_LINKS.altivumLogicEmail` = `mailto:logic@altivum.ai` (= line 419), `SOCIAL_LINKS.email` = `mailto:christian.perez@altivum.ai` (= line 432), `SOCIAL_LINKS.linkedin` (= line 445), `SOCIAL_LINKS.github` (= line 458, currently a literal `https://github.com/AltivumInc-Admin` — identical to the constant).

5.2 Replace the six `<a>` blocks (lines 392-468, between `{/* Phone */}` and the closing `</div>` at 469) with a single `.map`. Branch once on `kind` for the icon vs `<SocialIcon>`, and once on `external` for the link attrs. External links keep `target="_blank" rel="noopener noreferrer"`; `tel:`/`mailto:` links must NOT get those (matches current markup):
   ```tsx
   {CONTACT_CHANNELS.map((channel) => (
     <a
       key={channel.title}
       href={channel.href}
       {...(channel.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
       className="block group"
     >
       <div className="flex items-start gap-6">
         <div className="w-12 h-12 flex items-center justify-center text-altivum-gold/50 group-hover:text-altivum-gold transition-colors">
           {channel.kind === 'icon' ? (
             <span className="material-icons text-3xl">{channel.icon}</span>
           ) : (
             <SocialIcon platform={channel.platform} />
           )}
         </div>
         <div>
           <h3 className="text-white mb-1 group-hover:text-altivum-gold transition-colors" style={typography.cardTitleSmall}>{channel.title}</h3>
           <p className="text-altivum-silver text-sm">{channel.detail}</p>
         </div>
       </div>
     </a>
   ))}
   ```
   The outer wrapper `<div className="space-y-6">` (line 391) stays. Note: these are external/tel/mailto anchors — per project conventions they correctly remain `<a>`, NOT `<ViewTransitionLink>`.

5.3 Confirm `SocialIcon` default `className` is unchanged: current calls (lines 448, 461) pass no className, relying on the `w-6 h-6` default (`SocialIcon.tsx:69`). The map omits className identically — pixel-identical output.

#### File & Code Changes

| Action | File Path | Description |
|--------|-----------|-------------|
| Edit | `/Users/cperez/dev/altivum-dev/thechrisgrey/src/pages/Contact.tsx` | Add `FieldName` type + `fieldErrors` state; rewrite `validateForm` to return a keyed errors object; rewrite the submit-time validation block to set per-field errors and focus the first invalid field; rewrite `handleChange` to clear the touched field's error; add `aria-invalid`/`aria-describedby` + per-field `<p role="alert">` under name/email/message; drop `focus:outline-hidden` from all four control classNames; narrow `formStatus.type` union (remove `'success'`) and collapse the status-box ternary to binary; add `role="status" aria-live="polite"` to the modal confirmation `<p>`; introduce module-level `CONTACT_CHANNELS` and replace the six contact-info `<a>` blocks with a single `.map`. |
| Edit | `/Users/cperez/dev/altivum-dev/thechrisgrey/src/__tests__/integration/Contact.integration.test.tsx` | Update the three validation tests (lines 95-149) and the clear-on-type test (151-174) to assert per-field error semantics instead of a single shared `role="alert"` (see Testing section). Network/API/429/timeout/success/payload tests need no change. |

No new files. No changes to `FormInput.tsx`, `links.ts`, `SocialIcon.tsx`, `index.css`, or `ChatMessage.tsx`.

#### Testing & Validation

**Update existing integration tests (required — contract changed by item 1):**

- `shows error when name is too short` (95-112): replace the single `getByRole('alert')` assertion. The input should now be findable as invalid and described by its error:
  ```tsx
  await waitFor(() => {
    const nameInput = screen.getByLabelText(/name \*/i);
    expect(nameInput).toHaveAttribute('aria-invalid', 'true');
    expect(nameInput).toHaveAttribute('aria-describedby', 'name-error');
  });
  expect(screen.getByText('Name must be between 2 and 100 characters')).toBeInTheDocument();
  ```
- `shows error when email is invalid` (114-133): same shape, assert `email-error` / `aria-invalid` on the email input and the message text.
- `shows error when message is too short` (135-149): same shape for the message textarea / `message-error`.
- `clears error when user starts typing after an error` (151-174): change the post-error assertion from `queryByRole('alert')` (now ambiguous — the shared box also uses `role="alert"`) to the field error text disappearing:
  ```tsx
  // after typing into name
  await waitFor(() => {
    expect(
      screen.queryByText('Name must be between 2 and 100 characters')
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText(/name \*/i)).not.toHaveAttribute('aria-invalid');
  });
  ```

**Add new tests (extend the existing `describe('Form validation')` and `describe('Accessibility')` blocks):**

- **Focus moves to first invalid field:** submit empty form (or name="A", valid email+message) and assert `expect(screen.getByLabelText(/name \*/i)).toHaveFocus()`. Add a second case: valid name, invalid email → assert email has focus (proves DOM-order focus selection).
- **Multiple field errors render simultaneously:** submit name="A" + invalid email + short message → assert all three error strings present and three inputs carry `aria-invalid="true"` (the old single-box design could only show one).
- **No `aria-invalid` on the un-validated subject field:** after a failing submit, `expect(screen.getByLabelText(/subject/i)).not.toHaveAttribute('aria-invalid')`.
- **Modal confirmation is a live region:** in the existing success-modal test, additionally assert the confirmation `<p>` has `role="status"` and `aria-live="polite"` — e.g. `const status = within(dialog).getByText("Thanks for contacting me. I'll reach back as soon as possible."); expect(status).toHaveAttribute('role', 'status'); expect(status).toHaveAttribute('aria-live', 'polite');`
- **Contact channels render with correct hrefs (data-drive regression guard):** assert the six links resolve to the expected hrefs sourced from `SOCIAL_LINKS`, e.g. `expect(screen.getByRole('link', { name: /linkedin/i })).toHaveAttribute('href', SOCIAL_LINKS.linkedin)` and that external links carry `target="_blank"` while `tel:`/`mailto:` do not. The existing "renders contact information cards" test (82-91) still passes unchanged (text content identical).

**Type / lint / build:**
```bash
cd /Users/cperez/dev/altivum-dev/thechrisgrey
npx vitest run src/__tests__/integration/Contact.integration.test.tsx
npx tsc -p tsconfig.app.json --noEmit   # confirms 'success' union removal compiles
npm run lint
```
Grep guard for residual dead code:
```bash
grep -n "'success'\|focus:outline-hidden" src/pages/Contact.tsx   # expect zero hits
```

**Manual verification (the real path — green tests are not proof):**
```bash
npm run dev   # localhost:5173/contact
```
- Tab through the four fields with the keyboard → each shows the 2px gold `:focus-visible` ring (item 2). Click each with the mouse → no outline (mouse suppression still works).
- Submit empty → focus jumps to Name, per-field red errors appear under invalid fields; a screen reader (VoiceOver: Cmd+F5) announces the error of the focused field via `aria-describedby`.
- Fix Name, resubmit → focus jumps to Email; typing in a field clears only that field's error.
- Submit a valid form (mock or real `VITE_CONTACT_ENDPOINT`) → success modal; VoiceOver announces the confirmation sentence (item 3). Per CLAUDE.md, exercise a real submit against the live contact endpoint at least once before claiming the success path works end-to-end.
- Verify the six contact links still navigate correctly (phone dials, mailtos open mail client, LinkedIn/GitHub open new tab).

**Rollback check:** the change is confined to two files; `git checkout -- src/pages/Contact.tsx src/__tests__/integration/Contact.integration.test.tsx` fully reverts. No data, env, infra, or Lambda involvement.

#### Risk & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Existing integration tests (108-148, 151-174) break because they assume one shared `role="alert"` | High (certain) | Medium | Update those four tests in the same change set (Testing section); they are an expected contract change from item 1, not a regression. |
| `role="alert"` proliferation: per-field errors + shared status box all expose `role="alert"`, making `getByRole('alert')` ambiguous in tests | Medium | Low | Stop using bare `getByRole('alert')`; assert by error text and `aria-invalid`/`aria-describedby` on the specific input. |
| `document.getElementById(...).focus()` no-ops or throws in jsdom | Low | Low | Inputs already carry stable `id`s; jsdom supports `getElementById().focus()` + `toHaveFocus()`. Optional chaining guards a null. |
| Href drift if a `SOCIAL_LINKS` value differs from the current literal | Low | Medium | Verified each mapped value equals the current literal (parity list in 5.1); added a test asserting hrefs equal `SOCIAL_LINKS.*`. |
| Removing `focus:outline-hidden` changes visual focus on the un-validated subject field too | Low | Low | Intended and consistent; the gold ring is the documented design-system focus indicator. Verify visually on all four controls. |
| Mis-keying `fieldErrors` (e.g., subject leaking an `aria-invalid`) | Low | Low | `FieldName` union excludes `subject`; subject input gets no aria attrs; explicit "no aria-invalid on subject" test. |
| Live-region double announcement (modal title + status `<p>`) | Low | Low | `aria-labelledby` names the title; `role="status"` polite announces the body once on mount — standard, matches ChatMessage pattern. |

#### Dependencies & Order of Operations

1. **Item 4 (union narrowing) is coupled to item 1.** Do item 1 first (it removes the only code that would have populated a validation error in `formStatus`), then item 4 (remove `'success'` member + collapse the status-box ternary). Doing 4 before 1 would leave a TS gap window but no runtime issue; sequencing 1→4 keeps each edit compiling.
2. **Item 2 (drop `focus:outline-hidden`)** is edited on the same input elements touched in item 1.5 — fold it into the same className rewrites to avoid editing each `<input>` twice.
3. **Items 3 and 5 are independent** of items 1/2/4 and of each other; do them in any order.
4. **Tests last:** finish all `Contact.tsx` edits, then update the four existing tests and add the new ones, then run vitest → tsc → lint → manual. No cross-file ordering constraints (only `Contact.tsx` is the runtime change; the test file follows it).

#### Estimated Effort

**Complexity: Medium** · **Time: ~2.5–3.5 hours** (≈1.5h implementation incl. the data-drive refactor and focus logic, ≈1h test update + new tests, ≈0.5h type/lint/manual + a real-endpoint success-path check) · **Files affected: 2** (`src/pages/Contact.tsx`, `src/__tests__/integration/Contact.integration.test.tsx`).

Driver of the Medium (vs Low) rating: item 1 changes a user-facing a11y contract that the existing suite asserts against, so it is not a pure no-op refactor — the test updates are mandatory, not optional. Items 2, 3, 4, 5 are individually Low-risk.

---

## WP-D: Image CLS dimensions + lazy-loading sweep

**Aggregate impact:** Medium

#### Objective

Eliminate layout shift (CLS) and trim wasteful high-priority/below-the-fold image fetches across 7 page heroes and supporting images by adding intrinsic `width`/`height` (or `aspect-square`), `loading="lazy"` + `decoding="async"` where below the fold, and converting one un-optimized hero JPEG to WebP. This is a refinement-only sweep — no new components, no new layout, no behavior change beyond browser hinting and asset encoding. All seven items in WP-D are covered.

Key empirical facts established by reading the files/assets (these drive the steps below):
- `vite-plugin-image-optimizer` (vite.config.ts:9-17) re-encodes `src/assets/**` JPEG/PNG/WebP at q80 but **does NOT change format** and **excludes `public/` root images** (so `public/profile1.jpeg` is shipped as-is).
- `src/assets/foundation.jpg` is `2048x1080`, 171KB; even mozjpeg q80 re-encode only reaches ~170KB, but **WebP q80 = 104KB (~39% smaller)** — confirmed via sharp.
- `src/assets/mpb.png` (About hero) is `1500x1500` with alpha; `sharp().trim()` returns the **full 1500x1500** — the transparent pixels are interspersed with artwork, **not a croppable margin**. So the item-2 "crop" idea is not viable; the achievable win is a **768w downscale** (64KB → ~12KB PNG). See the DECISION in step 2.
- Logo assets: `mpb.png`/`altivum.png`/`bta.png` are all `1500x1500`; `reading.jpeg` is `1131x1600`; `aws-hero.png` is `1366x768`; `aws-community-builder.webp` is `1920x1005`; `builder-qr.png` is `512x512` (not the `64`/`72`-rendered numbers — intrinsic size is 512).
- Home `heroImage` (LCP, lines 140-147) **already** has `width/height/fetchPriority` and must stay `eager` (do not touch). Existing lazy/decoding convention to mirror: EpisodeCard.tsx:153, GuestCard.tsx:27, SanityResponsiveImage.tsx:71.

#### Prerequisites

- `sharp@0.34.5` is already installed (package.json:64) and importable — verified. No new dependency required for items 2 and 4.
- Node 20 (`.nvmrc`), `npm ci` clean tree.
- Branch off `main` (do not commit to `main` directly): `git checkout -b wp-d-image-cls`.
- Confirm the dev build is green before starting: `npm run lint && npx tsc --noEmit`.
- A browser with throttling (or Lighthouse) for manual CLS verification at the end.

#### Step-by-Step Implementation

**1. Home — lazy/async the below-the-fold profile image (Home.tsx:158-163)**

1.1 The profile `<img>` sits in the sticky 675/840vh section, `absolute inset-0` inside a fixed-size container (`h-screen overflow-hidden`) — it can never cause CLS, but it currently eager-loads and competes with the LCP `heroImage`. Add `loading="lazy"` and `decoding="async"`. Do NOT add `width`/`height` (it is `object-cover` filling an absolutely-positioned box; intrinsic dims are irrelevant and could be confusing). Leave the inline `style` transform/filter untouched.

```tsx
            <img
              src={profileImage}
              alt="Christian Perez"
              className="w-full h-full object-cover object-[left_30%] md:object-[center_30%]"
              loading="lazy"
              decoding="async"
              style={{ transform: 'translate3d(0,0,0)', filter: 'brightness(1.05) contrast(1.1) saturate(1.1)' }}
            />
```

1.2 Do **not** modify the LCP `heroImage` block (Home.tsx:140-147) — it is correctly `eager` + `fetchPriority="high"` + already dimensioned.

**2. About — dimension + (DECISION) downscale the hero PNG (About.tsx:34-39)**

2.1 Add intrinsic `width={1500} height={1500}` to the `mpbLogo` `<img>` (it is the LCP for `/about`; keep `fetchPriority="high"`, keep `loading` default/eager). This alone reserves the box and removes CLS — the highest-value, zero-risk part of item 2.

```tsx
              <img
                src={mpbLogo}
                alt="My Personal Biography"
                className="w-full max-w-3xl mx-auto opacity-90"
                width={1500}
                height={1500}
                fetchPriority="high"
              />
```

2.2 **DECISION — the committed asset optimization for `mpb.png`.** The work-package text proposes "pre-resize/crop". `trim()` proved the canvas is **not** croppable (artwork fills the full 1500x1500 bbox), so crop is off the table. Options for the *resize* half:

- **Option A (recommended): leave the asset at 1500x1500.** Rationale: the source is already only 64KB after vite's q80 PNG pass, the artwork is square so the 1500px source serves retina at the `max-w-3xl` (768px) display size (2x = 1536px ≈ source), and adding a one-off resize script for a 52KB saving (12KB vs 64KB) adds maintenance surface for marginal gain. The intrinsic-dims fix in 2.1 captures the real CLS/LCP benefit.
- **Option B: commit a pre-resized `mpb.png` at 1024–1536px wide** via a one-shot sharp command (below), keeping it square so the `width={1500}`/`height={1500}` attrs stay valid only if you keep dims at the *new* intrinsic size. If you resize, you MUST update the attrs to the new dimensions. Saves ~30–50KB on a non-LCP-critical but `fetchPriority="high"` asset.

  One-shot (run once, commit the result; not part of the build pipeline):
  ```bash
  npx --yes sharp-cli -i src/assets/mpb.png -o src/assets/ resize 1024 1024 --withoutEnlargement
  # then set width={1024} height={1024} in About.tsx:34-39
  ```
  (Or a 4-line inline `node -e` using the bundled `sharp` if you prefer not to pull `sharp-cli`.)

**Recommendation: Option A.** Take the dims-only fix (2.1) and stop at the refinement boundary; note Option B as a future asset-weight task. (Resizing committed binary assets is a content change, not a code refinement, and the payoff here is small.)

**3. Altivum — dimension the LCP hero logo (Altivum.tsx:203-208)**

3.1 Add `width={1500} height={1500}` to the `altivumLogo` hero `<img>`; keep `fetchPriority="high"`, keep eager. Verifier is scoped to the hero only — do NOT touch the AWS Partner logo (lines 216-220, already `w-20 h-20` reserved) or any full-screen image.

```tsx
              <img
                src={altivumLogo}
                alt="Altivum Inc."
                className="w-full max-w-3xl mx-auto opacity-90"
                width={1500}
                height={1500}
                fetchPriority="high"
              />
```

3.2 The conventions list `aspect-square` as an alternative; intrinsic `width`/`height` is preferred here for parity with the Home hero pattern (which uses numeric dims) and because the asset is genuinely square. Use numeric dims, not the utility class.

**4. Foundation — convert hero JPEG to WebP (Foundation.tsx:3,49-54)**

4.1 Generate `src/assets/foundation.webp` from the existing `foundation.jpg` at q80 (one-shot, commit the result). Using the bundled sharp:

```bash
node -e "require('sharp')('src/assets/foundation.jpg').webp({quality:80}).toFile('src/assets/foundation.webp').then(i=>console.log(i.width+'x'+i.height, (require('fs').statSync('src/assets/foundation.webp').size/1024).toFixed(0)+'KB'))"
```
Expected output: `2048x1080 104KB`.

4.2 Switch the import (Foundation.tsx:3) to the new file, matching the `awsCommunityBuilder` webp-import convention (AWS.tsx:3):
```tsx
import foundationImage from '../assets/foundation.webp';
```
4.3 Leave the `<img>` at Foundation.tsx:49-54 unchanged in markup — it is an `absolute inset-0` full-bleed `object-cover` background; it is the LCP so keep `fetchPriority="high"` and eager, and do NOT add `width`/`height` (a cover background does not benefit and the container reserves the box). The only change is the source format.

4.4 **Decision — keep `foundation.jpg` or delete it?** Recommended: **delete `src/assets/foundation.jpg`** after confirming no other importer references it (`grep -rn "foundation.jpg" src scripts` returned only Foundation.tsx:3). Removing the now-unused 171KB binary keeps the repo clean. If any reference remains, keep the JPEG.

**5. BTA — dimension hero logo + reading image (BeyondTheAssessment.tsx:31-36, 52-56)**

5.1 Hero `btaLogo` (LCP for `/beyond-the-assessment`, tracked by the high-cls alarm): add `width={1500} height={1500}`, keep `fetchPriority="high"`, keep eager.
```tsx
              <img
                src={btaLogo}
                alt="Beyond the Assessment"
                className="w-full max-w-3xl mx-auto opacity-90"
                width={1500}
                height={1500}
                fetchPriority="high"
              />
```
5.2 `readingImage` (below the fold, in the content grid): add `width={1131} height={1600}` (its true intrinsic size) plus `loading="lazy" decoding="async"`. The wrapper applies `rounded-lg overflow-hidden` and the `<img>` is `w-full h-auto object-cover scale` — the intrinsic ratio (1131:1600) matches `h-auto`, so dims reserve the correct box with no distortion.
```tsx
                <img
                  src={readingImage}
                  alt="Christian Perez reading Beyond the Assessment"
                  className="w-full h-auto object-cover transform scale-100 group-hover:scale-105 transition-transform duration-700 ease-out"
                  width={1131}
                  height={1600}
                  loading="lazy"
                  decoding="async"
                />
```

**6. AWS — dimension hero + lazy the below-fold banner (AWS.tsx:35-40, 50-54)**

6.1 Hero `awsHero` (LCP, `1366x768`): add `width={1366} height={768}`, keep `fetchPriority="high"`, keep eager. Note class is `max-w-6xl` (wider than other heroes) — dims still correct since they are intrinsic, not display, size.
```tsx
              <img
                src={awsHero}
                alt="AWS - AI Engineering"
                className="w-full max-w-6xl mx-auto opacity-90"
                width={1366}
                height={768}
                fetchPriority="high"
              />
```
6.2 Community Builder banner `awsCommunityBuilder` (`1920x1005`, below the fold, currently eager): add `width={1920} height={1005}` + `loading="lazy" decoding="async"`. Do NOT add `fetchPriority` (banner is not LCP). The `w-full h-auto block` class plus the 1920:1005 ratio reserves the box correctly.
```tsx
          <img
            src={awsCommunityBuilder}
            alt="Christian Perez - AWS Community Builder"
            className="w-full h-auto block"
            width={1920}
            height={1005}
            loading="lazy"
            decoding="async"
          />
```

**7. Links — dimension + lazy the featured QR (Links.tsx:133-137)**

7.1 `builderQR` intrinsic size is `512x512` (NOT the `w-64 h-64` / `md:w-72 md:h-72` display sizes). It is below the fold. Add `width={512} height={512} loading="lazy" decoding="async"`; keep the existing responsive sizing classes (they govern display size; the attrs set the aspect box).
```tsx
                  <img
                    src={builderQR}
                    alt="AWS Builder Profile QR Code"
                    className="w-64 h-64 md:w-72 md:h-72"
                    width={512}
                    height={512}
                    loading="lazy"
                    decoding="async"
                  />
```

**8. Verify build pipeline**

8.1 `npm run lint` (ESLint clean — JSX boolean/numeric attrs, no unused imports).
8.2 `npx tsc --noEmit` (TS clean — `width`/`height`/`loading`/`decoding`/`fetchPriority` are all valid on `React.ImgHTMLAttributes`).
8.3 `npm run build` (full pipeline; confirms the new `foundation.webp` import resolves and vite re-optimizes it).

#### File & Code Changes

| Action | File Path | Description |
|--------|-----------|-------------|
| Edit | `/Users/cperez/dev/altivum-dev/thechrisgrey/src/pages/Home.tsx` | Add `loading="lazy" decoding="async"` to the profile `<img>` (lines 158-163). Do not touch the LCP hero (140-147). |
| Edit | `/Users/cperez/dev/altivum-dev/thechrisgrey/src/pages/About.tsx` | Add `width={1500} height={1500}` to `mpbLogo` hero `<img>` (34-39). Asset resize deferred (DECISION Option A). |
| Edit | `/Users/cperez/dev/altivum-dev/thechrisgrey/src/pages/Altivum.tsx` | Add `width={1500} height={1500}` to `altivumLogo` hero `<img>` (203-208). Do not touch AWS Partner logo (216-220). |
| Create | `/Users/cperez/dev/altivum-dev/thechrisgrey/src/assets/foundation.webp` | New q80 WebP (`2048x1080`, ~104KB) generated once via bundled sharp. |
| Edit | `/Users/cperez/dev/altivum-dev/thechrisgrey/src/pages/Foundation.tsx` | Change import (line 3) `foundation.jpg` → `foundation.webp`. `<img>` markup (49-54) unchanged. |
| Delete | `/Users/cperez/dev/altivum-dev/thechrisgrey/src/assets/foundation.jpg` | Remove now-unused 171KB JPEG (only importer was Foundation.tsx). DECISION step 4.4. |
| Edit | `/Users/cperez/dev/altivum-dev/thechrisgrey/src/pages/BeyondTheAssessment.tsx` | Add `width={1500} height={1500}` to `btaLogo` (31-36); add `width={1131} height={1600} loading="lazy" decoding="async"` to `readingImage` (52-56). |
| Edit | `/Users/cperez/dev/altivum-dev/thechrisgrey/src/pages/AWS.tsx` | Add `width={1366} height={768}` to `awsHero` (35-40); add `width={1920} height={1005} loading="lazy" decoding="async"` to `awsCommunityBuilder` banner (50-54). |
| Edit | `/Users/cperez/dev/altivum-dev/thechrisgrey/src/pages/Links.tsx` | Add `width={512} height={512} loading="lazy" decoding="async"` to `builderQR` (133-137). |

#### Testing & Validation

**Unit / integration (Vitest + Testing Library):**
- No page-level tests exist today for any of these 7 pages (confirmed: only `routes.test.ts`, util/component tests). The conventions warn that any page test importing these pages must mock `AltiMascot`/Three.js, GSAP, and (for jsdom) call `cleanup()` for react-helmet-async. Spinning up full page-render tests for an attribute sweep is **net-new test scaffolding** with high mocking cost for low signal — out of proportion to a presentational change.
- **Recommended (proportionate):** add ONE lightweight assertion test, `src/pages/imageAttributes.test.ts`, that reads each page file as text and asserts the specific `<img>` for each item carries the required attributes (e.g. regex that the `builderQR` img has `loading="lazy"` and `decoding="async"`; that `awsHero` has `width={1366}`). This is the same "parse-as-text" pattern already used by `validation-drift.test.mjs` and `routeManifest.test.ts`, mocks nothing, and guards against future regressions of these exact attrs. If the team prefers zero new tests for a pure refinement, that is defensible — call it out and rely on lint/tsc/manual.
- Run the existing suite to confirm no regression: `npm test` (or the repo's vitest invocation).

**Build / type / lint gates:**
- `npm run lint` — clean.
- `npx tsc --noEmit` — clean (all added attrs are valid DOM props).
- `npm run build` — full pipeline must pass; specifically confirms `foundation.webp` import resolves and the deleted `foundation.jpg` is unreferenced.

**Manual verification (the real thing):**
- `npm run dev`, then for each route (`/`, `/about`, `/altivum`, `/foundation`, `/beyond-the-assessment`, `/aws`, `/links`):
  - Open DevTools → Network, throttle to "Slow 4G", hard-reload. Confirm: heroes still load eagerly/high-priority; profile (Home), reading (BTA), banner (AWS), QR (Links) load **lazily** (deferred / lower priority); `foundation.webp` is served (not `.jpg`) and is ~104KB.
  - DevTools → Performance / Lighthouse: confirm **CLS = 0** (or unchanged-near-0) on each page; confirm LCP not regressed on Foundation/AWS/About (the heroes still eager).
  - Visually confirm no distortion on `readingImage` (1131:1600) and the AWS banner (1920:1005) — `h-auto` + correct intrinsic ratio means no squish.
- Production smoke after deploy: load `/foundation` on prod, verify the network response Content-Type is `image/webp`.

**Rollback check:**
- All changes are isolated, additive attributes plus one import swap and one asset add/delete. Rollback = `git revert` the commit; restore `foundation.jpg` from git history if the WebP swap is reverted. No infra, no env vars, no Lambda, no CSP (all assets are same-origin bundled — no CSP change needed). Verify a clean revert builds: `git revert --no-edit <sha> && npm run build`.

#### Risk & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| WebP not decodable on an ancient browser visiting `/foundation` (broken hero bg) | Very Low | Low | WebP has universal support in all evergreen + Safari ≥14 / iOS ≥14 (2020). Site already ships `.webp` (`aws-community-builder.webp`) with no fallback — this matches existing precedent. |
| Wrong intrinsic dims cause distortion (e.g. transposing reading 1131×1600) | Low | Medium | Dims were read directly off-disk via `sips`; ratios match the `h-auto`/`object-cover` classes. Manual visual check in step "Manual verification" catches any swap. |
| Adding `loading="lazy"` to an image that is actually above the fold on some viewport delays its paint | Low | Low | Only applied to genuinely below-fold images (Home sticky-section profile, BTA reading, AWS banner, Links QR). Heroes stay eager. Verified by section position in source. |
| Deleting `foundation.jpg` breaks an un-grepped reference (e.g. OG card, sitemap) | Low | Medium | `grep -rn "foundation.jpg" src scripts public` before delete; the build (`npm run build`) fails loudly on a missing import. Keep JPEG if any hit. |
| Scope creep: item 2 "crop"/resize turns into an asset-pipeline feature | Medium | Low | Bounded by DECISION Option A — ship dims-only, defer resize. Documented as a follow-up, not done here. |
| New `imageAttributes.test.ts` becomes brittle (line-number coupled) | Low | Low | Match on attribute substrings near the `src={...}` token, not line numbers (mirrors existing text-parse drift tests). |

#### Dependencies & Order of Operations

1. Branch off `main` (`wp-d-image-cls`).
2. **Item 4 asset first** (independent, must precede the Foundation import edit): run the sharp one-shot to create `foundation.webp`, verify dimensions/size.
3. Apply all `<img>` attribute edits — items 1, 2.1, 3, 5, 6, 7 (independent of each other; any order). Apply item 4.2 import swap.
4. Run `grep` for `foundation.jpg`, then delete it (item 4.4) — must come AFTER the import swap so the build never points at a deleted file mid-edit.
5. (Optional) add `src/pages/imageAttributes.test.ts`.
6. Gates: `npm run lint` → `npx tsc --noEmit` → `npm test` → `npm run build`.
7. Manual DevTools/Lighthouse verification per route.
8. Commit on branch, open PR (no push to `main` per repo rules). Amplify deploys on merge.

No cross-item code dependency exists except foundation asset → import → delete (steps 2→3→4). All other page edits are parallelizable.

#### Estimated Effort

**Complexity: Low.** Presentational attribute additions plus one asset format conversion; no logic, no infra, no tests-of-behavior required. The only judgment calls are the two DECISIONs (resize mpb.png — recommend skip; delete foundation.jpg — recommend delete after grep).

**Time: 45–75 minutes** (≈30 min edits + asset gen, ≈15–30 min manual CLS/Lighthouse verification across 7 routes, +15 min if adding the optional text-assertion test).

**Files affected: 9** (7 page `.tsx` edits — Home, About, Altivum, Foundation, BeyondTheAssessment, AWS, Links; 1 asset created — `foundation.webp`; 1 asset deleted — `foundation.jpg`), +1 optional new test file (`src/pages/imageAttributes.test.ts`).

---

## WP-E: ViewTransitionLink consistency sweep

**Aggregate impact:** Medium

#### Objective

Bring three pages into line with the project's internal-navigation convention: all in-app links must use `<ViewTransitionLink>` (which triggers `document.startViewTransition()` crossfades and hover/focus route prefetch) rather than raw `<a href>` or unlinked styled spans. External, `tel:`, and `mailto:` anchors stay as plain `<a>`. This is a refinement only — no copy, layout, or styling changes beyond what is required to attach the link, and the existing gold/italic visual treatment is preserved exactly.

Concretely:
1. `src/pages/About.tsx` — convert the three plain styled spans ("Altivum Inc." ×2, lines 52-53 and 83-84; "Beyond the Assessment", line 74) into `<ViewTransitionLink>` to `/altivum` and `/beyond-the-assessment`, keeping the gold color / italic styling.
2. `src/pages/Links.tsx` — convert the contact CTA `<a href="/contact">` (lines 278-283) to `<ViewTransitionLink to="/contact">`; leave the `tel:` anchor (lines 284-289) as `<a>`.
3. `src/pages/Privacy.tsx` — convert the "contact form" `<a href="/contact">` (line 306) to `<ViewTransitionLink to="/contact">`; leave the `mailto:` anchor (line 303) as `<a>`.

#### Prerequisites

- Confirmed: `src/components/ViewTransitionLink.tsx` is a **default export**; every consumer imports it as `import ViewTransitionLink from '...'`. None of the three target files import it yet, so each needs a new import line.
- Confirmed routes exist in `src/routes.ts`: `/altivum` (line 101), `/beyond-the-assessment` (line 134), `/contact` (line 206). All are real navigable routes, so prefetch + transition will resolve.
- Confirmed `ViewTransitionLink` spreads arbitrary props (`{...props}`) onto the underlying `<Link>`, so `className` and `style` pass through unchanged — the existing visual styling can be moved verbatim onto the link.
- No existing page-level test files for About/Links/Privacy (`src/pages/*.test.tsx` returns no matches). The component-level test `src/components/ViewTransitionLink.test.tsx` already covers the link's behavior; new tests for these pages are optional (see Testing & Validation).
- Node 20 / `npm` available; verification via `npm run lint` and `npx tsc --noEmit` (or `npm run build` for the full pipeline).

#### Step-by-Step Implementation

**1. About.tsx — three spans → ViewTransitionLink**

- **1.1** Add the import at the top of `src/pages/About.tsx`. Insert after the existing `NewsletterCTA` import (line 5):
  ```tsx
  import ViewTransitionLink from '../components/ViewTransitionLink';
  ```

- **1.2** "Altivum Inc." in the Opening Statement (current lines 52-53). The span is `<span className="text-altivum-gold">Altivum Inc.</span>`. Replace with a link that carries the same class:
  ```tsx
        My name is <span className="text-altivum-gold">Christian Perez</span>, and I'm the Founder & CEO of{' '}
        <ViewTransitionLink to="/altivum" className="text-altivum-gold link-underline">Altivum Inc.</ViewTransitionLink>
  ```
  DECISION — affordance for inline text links (applies to all three About links and both /contact links below). Three options:
  - **(A) Add `link-underline`** — the project's animated-underline class (defined in `index.css`, used for inline text links elsewhere) to signal interactivity on hover/focus while keeping the gold color at rest. **Recommended:** it is the established inline-link affordance in this codebase and adds a discoverability/accessibility cue that a bare colored span lacks, without changing the resting appearance.
  - **(B) Keep class exactly as-is** (`text-altivum-gold` only, no underline) — purest "refinement, zero visual delta" reading. Safe, but leaves an inline link with no hover affordance, which is a minor UX/a11y shortfall.
  - **(C) Add `hover:underline`** — matches the Privacy mailto/contact style but is a different, less polished affordance than the site's `link-underline`.
  The snippets below show option A; if the reviewer prefers strict zero-delta, drop ` link-underline` from each `className` (option B). Note: "Christian Perez" stays a plain non-link span — there is no `/me` route and it is not in scope.

- **1.3** "Beyond the Assessment" in Military Service (current line 74). The span is `<span className="text-white" style={{ fontStyle: 'italic' }}>Beyond the Assessment</span>`. The book lives at `/beyond-the-assessment`. Replace with a link that preserves the white color and italic style:
  ```tsx
        I wrote <ViewTransitionLink to="/beyond-the-assessment" className="text-white link-underline" style={{ fontStyle: 'italic' }}>Beyond the Assessment</ViewTransitionLink>—a reflection on modern
        masculinity and a dedication to my son, <span className="text-white">Elijah</span>.
  ```
  Note: the em-dash immediately follows the closing tag with no space, exactly as in the current markup — preserve that to avoid a copy/spacing change.

- **1.4** "Altivum Inc." in Career Evolution (current lines 83-84). The span is `<span className="text-altivum-gold">Altivum Inc.</span>`, followed by `, a public benefit corporation`. Replace:
  ```tsx
        In <span className="text-white">February 2025</span>, I founded{' '}
        <ViewTransitionLink to="/altivum" className="text-altivum-gold link-underline">Altivum Inc.</ViewTransitionLink>, a public benefit corporation
  ```
  Preserve the trailing `, a public benefit corporation` exactly (comma immediately after the closing tag).

**2. Links.tsx — contact CTA `<a>` → ViewTransitionLink (keep tel: as `<a>`)**

- **2.1** Add the import at the top of `src/pages/Links.tsx`. Insert after the `NewsletterCTA` import (line 7):
  ```tsx
  import ViewTransitionLink from '../components/ViewTransitionLink';
  ```

- **2.2** Convert only the first anchor in the Contact CTA (current lines 278-283). Change the element name and the `href="/contact"` attribute to `to="/contact"`; the `className` is unchanged:
  ```tsx
            <ViewTransitionLink
              to="/contact"
              className="inline-block px-10 py-4 bg-white text-altivum-dark font-medium hover:bg-altivum-gold transition-all duration-200"
            >
              Get in Touch
            </ViewTransitionLink>
  ```
  Leave the immediately-following `tel:+16152199425` anchor (current lines 284-289) untouched as `<a>` — `tel:` is an external protocol, correctly outside the convention.
  - Note (no change required): this CTA already meets the touch-target convention via `px-10 py-4` (well over 48px); it does not currently set `touch-manipulation` or `active:scale-[0.98]`, and the `tel:` sibling doesn't either. Adding those would be a new micro-interaction, which is out of scope for this link-type refinement — do not add them here.

**3. Privacy.tsx — "contact form" `<a>` → ViewTransitionLink (keep mailto: as `<a>`)**

- **3.1** Add the import at the top of `src/pages/Privacy.tsx`. Insert after the `disablePostHog` import (line 4):
  ```tsx
  import ViewTransitionLink from '../components/ViewTransitionLink';
  ```

- **3.2** Convert only the "contact form" anchor (current line 306). Keep the exact `className`; change `<a href="/contact" …>` to `<ViewTransitionLink to="/contact" …>`:
  ```tsx
                <p className="text-altivum-silver mt-2" style={typography.bodyText}>
                  Or use our <ViewTransitionLink to="/contact" className="text-altivum-gold hover:underline">contact form</ViewTransitionLink>.
                </p>
  ```
  Leave the `mailto:admin@altivum.ai` anchor (current line 303) as `<a>` — `mailto:` is external and correctly stays an anchor. (Here the existing affordance is `hover:underline`; preserve it as-is rather than swapping to `link-underline`, since this anchor lives next to the mailto sibling that uses the same `hover:underline` style — consistency within the block wins.)

**4. Final verification pass**

- **4.1** Confirm no other raw internal `<a href="/...">` remain on these three pages (defensive grep, step in Testing).
- **4.2** Run lint + typecheck, then a manual smoke check in `npm run dev`.

#### File & Code Changes

| Action | File Path | Description |
|--------|-----------|-------------|
| Edit | `src/pages/About.tsx` | Add `import ViewTransitionLink from '../components/ViewTransitionLink';`. Wrap "Altivum Inc." (lines 52-53) and (lines 83-84) in `<ViewTransitionLink to="/altivum" className="text-altivum-gold link-underline">`; wrap "Beyond the Assessment" (line 74) in `<ViewTransitionLink to="/beyond-the-assessment" className="text-white link-underline" style={{ fontStyle: 'italic' }}>`. Preserve surrounding whitespace, `{' '}`, commas, and the em-dash exactly. |
| Edit | `src/pages/Links.tsx` | Add `import ViewTransitionLink from '../components/ViewTransitionLink';`. Convert the contact-CTA `<a href="/contact">` (lines 278-283) to `<ViewTransitionLink to="/contact">` with the same `className`. Leave the `tel:` anchor (lines 284-289) as `<a>`. |
| Edit | `src/pages/Privacy.tsx` | Add `import ViewTransitionLink from '../components/ViewTransitionLink';`. Convert the "contact form" `<a href="/contact">` (line 306) to `<ViewTransitionLink to="/contact">` with the same `className`. Leave the `mailto:` anchor (line 303) as `<a>`. |
| Add (optional) | `src/pages/About.test.tsx`, `src/pages/Links.test.tsx`, `src/pages/Privacy.test.tsx` | Optional render tests asserting the converted links resolve to the correct internal `href` and that `tel:`/`mailto:` stay plain anchors. See Testing & Validation for the decision. |

#### Testing & Validation

**Automated (required):**
- `npm run lint` — must pass clean (catches an unused import if a conversion is missed, and JSX issues).
- `npx tsc --noEmit` — type-check; `ViewTransitionLink`'s props are `LinkProps & { to: string } & anchor attrs`, so `className`/`style`/`to` all type-check. A leftover `href` on a `ViewTransitionLink` would be flagged or silently dropped — typecheck plus the grep in the manual step guard against it.
- Optionally `npm run build` for the full pipeline (env validation → lint → tsc → vite build) to confirm no build-time regression.

**Automated (optional, recommended — DECISION):** No page-level tests exist today for these three pages. Two options:
- **(A) Add minimal render tests** (one per page, ~3 assertions each) using the established pattern from `src/components/ViewTransitionLink.test.tsx`: render the page inside `<MemoryRouter>` with `vi.mock('../utils/routeManifest', () => ({ prefetchRoute: vi.fn() }))`, then assert e.g. `screen.getByRole('link', { name: /altivum inc\./i })` has `href="/altivum"`, the "Beyond the Assessment" link has `href="/beyond-the-assessment"`, the Links/Privacy contact link has `href="/contact"`, and the `tel:`/`mailto:` links retain their `tel:`/`mailto:` hrefs. These pages also render `<SEO>` (react-helmet-async) and `<NewsletterCTA>`; wrap in `HelmetProvider` if helmet throws, and add `cleanup()` in a try/finally per the documented react-helmet-async gotcha. About uses no 3D, so no AltiMascot mock is needed. **Recommended** — locks the convention in and is cheap, matching the codebase's preference for tested changes.
- **(B) Skip new tests**, relying on lint/tsc + manual verification. Acceptable for a pure link-type swap, but leaves the conversion unguarded against future regression.

**Manual verification (required — convention swap must be exercised, not just compiled):**
1. `npm run dev`, open `http://localhost:5173`.
2. `/about`: click both "Altivum Inc." links → lands on `/altivum`; click "Beyond the Assessment" → lands on `/beyond-the-assessment`. Confirm a view-transition crossfade occurs and the gold color (and italic for the book) is unchanged at rest; hover shows the `link-underline` animation if option A chosen. Cmd/Ctrl+click opens in a new tab (don't-prevent-default path).
3. `/links`: click "Get in Touch" → SPA-navigates to `/contact` (no full reload); the "Call (615) 219-9425" button still triggers the dialer (`tel:`).
4. `/privacy`: click "contact form" → SPA-navigates to `/contact`; the email link still opens the mail client (`mailto:`).
5. Hover each converted link and confirm a route chunk prefetches (Network tab shows the lazy chunk fetched on hover/focus).

**Regression / completeness grep (required):**
```bash
grep -nE '<a[^>]*href="/[^"]*"' src/pages/About.tsx src/pages/Links.tsx src/pages/Privacy.tsx
```
Expected output: empty (no raw internal `<a href="/...">` remain). `tel:`/`mailto:` anchors won't match this pattern, so they correctly remain.

**Rollback check:** All three edits are isolated, additive imports + element-name/attribute swaps with no shared state, no new deps, no backend/IaC/CSP touch. Revert is a clean `git checkout -- src/pages/About.tsx src/pages/Links.tsx src/pages/Privacy.tsx` (plus deleting any new `*.test.tsx`). No data migration or deploy coupling.

#### Risk & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Accidentally converting a `tel:`/`mailto:` anchor to `ViewTransitionLink` (breaks dialer/mailto) | Low | Medium | Step-by-step explicitly converts only the `/contact` anchors; manual steps 3-4 click the `tel:`/`mailto:` links to confirm they still launch the dialer/mail client. |
| Visual drift — losing gold color, italic, or the resting appearance of the inline About links | Low | Low | `className`/`style` are carried verbatim onto `ViewTransitionLink` (it spreads props to `<Link>`); manual step 2 visually confirms. DECISION in 1.2 lets the reviewer choose strict zero-delta (drop `link-underline`). |
| Whitespace/punctuation change from re-typing the JSX (missing `{' '}`, dropped em-dash, moved comma) | Medium | Low | Use exact-match `Edit` against the current strings; snippets reproduce `{' '}`, the em-dash with no leading space, and the trailing comma. Manual read of `/about` confirms copy reads identically. |
| Leftover `href` attribute on a converted `ViewTransitionLink` (no-op / confusing) | Low | Low | `href` is replaced by `to` in each snippet; tsc + the completeness grep catch a stray internal `href`. |
| Unused-import lint error if a target conversion is skipped | Low | Low | `npm run lint` fails fast; each file gets at least one conversion that uses the import. |
| Prefetch for `/contact` etc. is a no-op or errors | Very Low | Low | `prefetchRoute` is keyed off `routeManifest` derived from `routes.ts`; all three paths are present (`noPrefetch` not set). Manual step 5 confirms the chunk prefetches on hover. |

#### Dependencies & Order of Operations

- No cross-file dependencies; the three pages are independent and can be edited in any order. Suggested order: About (3 conversions, highest density) → Links → Privacy.
- Within each file: add the import first, then perform the element conversions (lint will otherwise flag an unused import mid-edit, which is harmless but noisy).
- No dependency on the deploy pipeline, CSP/`amplify.yml` (no new external origins), Lambdas, Sanity, or env vars. No `routes.ts` change (all routes already exist).
- Sequence: edits → `npm run lint` → `npx tsc --noEmit` → (optional) add tests + `npm test` → manual smoke in `npm run dev` → completeness grep. Commit/push only when the user asks.

#### Estimated Effort

Complexity **Low** · Time **~25-40 min** (implementation ~10-15 min; manual verification ~10 min; optional render tests +10-15 min) · Files affected: **3 edited** (`src/pages/About.tsx`, `src/pages/Links.tsx`, `src/pages/Privacy.tsx`), plus **up to 3 optional new test files**.

---

## WP-F: Reduced-motion gating consistency sweep

**Aggregate impact:** Low

#### Objective

Make reduced-motion gating in the AWS topology and Claude architecture components reactive and prerender-aware, matching the established codebase patterns, without changing any animation behavior or scope.

- **Item 1 (AWS):** `src/components/aws/TopologyScene.tsx:58` and `src/components/aws/ClusterEdge.tsx:15` read `window.matchMedia('(prefers-reduced-motion: reduce)').matches` once at render. The value never updates if a visitor toggles the OS reduced-motion setting while the page is open. Replace with the reactive `useMediaQuery('(prefers-reduced-motion: reduce)')` hook so the components re-render and re-gate on change.
- **Item 2 (Claude):** `src/components/claude/ArchitectureXRay.tsx:122` (`runPipelineAnimation`) and `:196` (`replayWithCache`) read the same raw `matchMedia` at call time. Replace with `isMotionDisabled()` (`src/utils/motion.ts`), which additionally honors the build-time prerender flag — matching `SplitReveal.tsx:34`. This component already imports `useMediaQuery`; the gating here is read inside imperative callbacks (not at render), so `isMotionDisabled()` is the correct call-time equivalent rather than a hook.

This is a consistency/correctness refinement only. No visual, timing, or API changes.

#### Prerequisites

- Node 20 (`.nvmrc`), dependencies installed (`npm ci`).
- Confirm the two helpers exist and have the expected signatures (verified during planning):
  - `src/hooks/useMediaQuery.ts` exports `useMediaQuery(query: string): boolean` — SSR-safe initializer + `change` listener.
  - `src/utils/motion.ts` exports `isMotionDisabled(): boolean` — `isPrerender()` first, then `typeof window` guard, then the reduced-motion media query.
- No new dependencies, env vars, or CSP changes.
- Tests run with `npm run test` (Vitest). 3D/WebGL and GSAP are mocked in jsdom per project conventions; `window.matchMedia` is not implemented by jsdom and must be stubbed in any test that exercises these paths (see Testing section).

#### Step-by-Step Implementation

**1. AWS — TopologyScene.tsx: reactive reduced-motion in `SceneContent`**

- **1.1** Add the hook import alongside the existing React import block. After line 9 (`import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';`), add:
  ```ts
  import { useMediaQuery } from '../../hooks/useMediaQuery';
  ```
- **1.2** Replace the non-reactive read at line 58 inside `SceneContent`:
  - From:
    ```ts
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    ```
  - To:
    ```ts
    const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
    ```
- **1.3** No downstream edits required. `reducedMotion` is already consumed correctly:
  - It is in the `useEffect` dependency array at line 159 (`[controlRef, camera, invalidate, reducedMotion, onSelectCluster, setFrameloopMode]`), so the control-handle effect re-runs when it flips.
  - `autoRotate` (line 162: `const autoRotate = !reducedMotion && selectedClusterId === null;`) is recomputed each render and synced into OrbitControls via the `useFrame` at lines 166-170 and the `<OrbitControls autoRotate={autoRotate} ...>` prop at line 250 — both pick up a re-render automatically.
  - `handleClusterClick` (dep array line 202) and `handleDeselect` (dep array line 223) already list `reducedMotion`, so they re-memoize correctly.
  - **Note (no scope creep):** `SceneContent` runs inside `<Canvas>` (an R3F renderer subtree). React hooks are valid in this component (it already calls `useRef`, `useThree`, `useEffect`, `useFrame`, `useCallback`). Adding `useMediaQuery` is just another hook in the same component — it does not cross the renderer boundary in a way that breaks rules-of-hooks. Verify the test suite mounts the real `<Canvas>` or mocks R3F; if R3F is mocked such that `SceneContent` is not rendered, this hook is still exercised only when the real component runs (acceptable — matches existing behavior).

**2. AWS — ClusterEdge.tsx: reactive reduced-motion**

- **2.1** Add the hook import. After line 4 (`import * as THREE from 'three';`), add:
  ```ts
  import { useMediaQuery } from '../../hooks/useMediaQuery';
  ```
- **2.2** Replace the non-reactive read at line 15 inside `ClusterEdge`:
  - From:
    ```ts
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    ```
  - To:
    ```ts
    const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
    ```
- **2.3** No downstream edits. `reducedMotion` is read inside the `useFrame` closure (line 37: `if (reducedMotion) return;`). Because `useFrame` re-registers its callback on each render of `ClusterEdge` and `useMediaQuery` triggers a re-render on change, the frame loop will see the updated value on the next render. When `reducedMotion` becomes `true`, the early `return` halts particle position updates and they remain at the evenly-spaced static `positions` buffer (lines 24-33), which is the intended static state.

**3. Claude — ArchitectureXRay.tsx: prerender-aware, call-time gating via `isMotionDisabled()`**

- **3.1** Add the import. After line 4 (`import { useMediaQuery } from '../../hooks/useMediaQuery';`), add:
  ```ts
  import { isMotionDisabled } from '../../utils/motion';
  ```
  (`useMediaQuery` stays — it is still used at line 42 for the `(min-width: 768px)` desktop breakpoint, which is unrelated to motion.)
- **3.2** Replace the read inside `runPipelineAnimation` at line 122:
  - From:
    ```ts
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    ```
  - To:
    ```ts
    const prefersReducedMotion = isMotionDisabled();
    ```
- **3.3** Replace the read inside `replayWithCache` at line 196:
  - From:
    ```ts
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    ```
  - To:
    ```ts
    const prefersReducedMotion = isMotionDisabled();
    ```
- **3.4** No further edits. Both `prefersReducedMotion` reads happen at invocation time inside `useCallback` bodies, not at render. `isMotionDisabled()` is a plain function (not a hook) and is the correct drop-in here — calling it imperatively inside callbacks does not violate rules-of-hooks. The local variable name `prefersReducedMotion` is retained to minimize diff and keep the surrounding `if (prefersReducedMotion) { ... }` blocks (lines 124-144 and 197-201) unchanged.
  - **DECISION — hook vs. function in this file:** Do **not** convert these to a render-level `useMediaQuery`/state value.
    - Option A (recommended): keep `isMotionDisabled()` called inside the callbacks. Rationale: these are imperative animation entry points triggered by user actions (trace / replay); reading the live value at call time is correct, requires no dependency-array changes, and gains prerender-awareness for free (a prerendered page that somehow invoked these would skip animation). Matches the `SplitReveal.tsx:34` precedent for motion gating.
    - Option B (rejected): hoist to `const motionDisabled = useMediaQuery('(prefers-reduced-motion: reduce)')` at render and reference it in the callbacks. This would force adding `motionDisabled` to the `useCallback` dependency arrays for `runPipelineAnimation` (line 177) and `replayWithCache` (line 217) and the downstream `handleTrace` (line 346), expanding the diff and re-creating callbacks on every motion toggle for no behavioral gain — and it would **lose** prerender-awareness. Rejected.

**4. Verify imports and lint**

- **4.1** Run `npm run lint` to confirm no unused-import or rules-of-hooks warnings.
- **4.2** Run `npx tsc --noEmit` (or `npm run build`'s tsc step) to confirm types resolve.

#### File & Code Changes

| Action | File Path | Description |
| --- | --- | --- |
| Edit | `/Users/cperez/dev/altivum-dev/thechrisgrey/src/components/aws/TopologyScene.tsx` | Add `import { useMediaQuery } from '../../hooks/useMediaQuery';` after line 9. Replace line 58 `const reducedMotion = window.matchMedia(...).matches;` with `const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');`. No other changes — existing dep arrays (lines 159, 202, 223) and `autoRotate` (line 162) already consume `reducedMotion` reactively. |
| Edit | `/Users/cperez/dev/altivum-dev/thechrisgrey/src/components/aws/ClusterEdge.tsx` | Add `import { useMediaQuery } from '../../hooks/useMediaQuery';` after line 4. Replace line 15 `const reducedMotion = window.matchMedia(...).matches;` with `const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');`. The `useFrame` closure (line 37) reads the re-rendered value automatically. |
| Edit | `/Users/cperez/dev/altivum-dev/thechrisgrey/src/components/claude/ArchitectureXRay.tsx` | Add `import { isMotionDisabled } from '../../utils/motion';` after line 4 (keep existing `useMediaQuery` import — still used for the 768px breakpoint). Replace line 122 and line 196 reads of `window.matchMedia('(prefers-reduced-motion: reduce)').matches` with `isMotionDisabled()`. No dep-array changes (both reads are inside callback bodies). |

#### Testing & Validation

**Unit / integration tests**

- **Check for existing tests first:** run `npx vitest related src/components/aws/TopologyScene.tsx src/components/aws/ClusterEdge.tsx src/components/claude/ArchitectureXRay.tsx` and `rg -l "TopologyScene|ClusterEdge|ArchitectureXRay" src --glob '*.test.*'` to find current coverage. If tests exist, update any that stub motion via `window.matchMedia` directly so they remain valid (the hook and `isMotionDisabled()` both still call `window.matchMedia` under the hood, so an existing `matchMedia` mock that returns `{ matches, addEventListener, removeEventListener }` continues to work — `useMediaQuery` requires `addEventListener`/`removeEventListener` on the returned MQL).
- **matchMedia stub (jsdom has none):** any new/updated test touching these components must define a `window.matchMedia` mock in setup that returns an object with `matches`, `media`, `addEventListener`, `removeEventListener`, `addListener`, `removeListener`, `dispatchEvent`. Check `src/test/setup.ts` (or the configured Vitest setup file) for an existing global `matchMedia` mock and reuse it; if it lacks `addEventListener`, extend it (this is the one real risk — see Risk table).
- **New focused tests to add (light, behavior-preserving):**
  - `ArchitectureXRay`: with `matchMedia('(prefers-reduced-motion: reduce)')` → `matches: true`, assert `runPipelineAnimation()` sets node states synchronously (no GSAP timeline) and `replayWithCache()` sets full `responseContent` immediately with `traceState === 'complete'` (no streaming interval). With `matches: false`, assert the GSAP timeline path is taken (GSAP is mocked — assert the mock timeline was constructed). This locks the gating semantics across the refactor.
  - `useMediaQuery` reactivity (if not already covered): mount a probe component, fire a `change` event on the mocked MQL, assert the boolean flips. This guards the reactive guarantee that motivates Item 1.
- **Prerender path (Item 2 gain):** add/extend a test that sets the prerender flag (`isPrerender()` true — inspect `src/utils/prerender.ts` for how it is toggled, e.g. a global/window flag) and asserts `isMotionDisabled()` returns `true`, so `runPipelineAnimation`/`replayWithCache` take the instant branch. This proves the new prerender-awareness the raw `matchMedia` lacked.

**Build / static checks**

- `npm run lint` — expect zero new warnings (specifically `react-hooks/rules-of-hooks` clean: `useMediaQuery` is added at the top level of `SceneContent` and `ClusterEdge`, not inside a loop/condition/callback).
- `npx tsc --noEmit` — types resolve; `useMediaQuery` returns `boolean`, `isMotionDisabled` returns `boolean`, both assigned to the same variable types as before.

**Manual verification (the real path)**

- `npm run dev`, open `/aws`:
  - With normal motion: topology auto-rotates, edge particles travel. Toggle OS "Reduce motion" ON while the page is open → auto-rotate stops and particles freeze at static positions **without reload** (this is the reactive behavior the old code lacked). Toggle OFF → motion resumes. macOS: System Settings → Accessibility → Display → Reduce motion; or Chrome DevTools → Rendering → "Emulate CSS prefers-reduced-motion".
- Open `/claude`, scroll to "The Architecture":
  - With Reduce motion OFF: run a trace → nodes light up sequentially (GSAP), response streams in chunks.
  - With Reduce motion ON (emulate in DevTools, no reload needed since it is read at call time): run a trace → nodes set instantly, response appears in full immediately; trigger the cached-replay path (force a system/guardrail message, then a successful trace cached) → replay shows full text instantly.

**Rollback check**

- Each file is an isolated, independent edit. To roll back any single item: revert that file to restore the `window.matchMedia('(prefers-reduced-motion: reduce)').matches` read and remove the added import. No shared state, no migration, no infra. `git checkout -- <file>` per file is a complete rollback.

#### Risk & Mitigation

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Vitest `matchMedia` mock lacks `addEventListener`/`removeEventListener`, breaking `useMediaQuery`'s `useEffect` in `TopologyScene`/`ClusterEdge` tests | Medium | Low | Inspect the Vitest setup file for the global `matchMedia` mock; ensure it returns `addEventListener`/`removeEventListener` (and legacy `addListener`/`removeListener`). Extend once in setup — fixes all three components. |
| `useFrame` in `ClusterEdge` caches a stale `reducedMotion` if R3F does not re-register the callback on re-render | Low | Low | R3F re-runs the component on state change (`useMediaQuery` triggers re-render) and `useFrame` re-subscribes the new closure each render, so the latest `reducedMotion` is seen next frame. Confirm via the manual `/aws` toggle test (particles freeze without reload). |
| Adding a hook (`useMediaQuery`) inside the R3F `<Canvas>` subtree (`SceneContent`) triggers a rules-of-hooks or reconciler concern | Low | Low | `SceneContent` already calls multiple hooks; one more top-level hook is fine. `npm run lint` (`react-hooks/rules-of-hooks`) gates this. |
| Loss of behavior parity in `ArchitectureXRay` because `isMotionDisabled()` returns `true` during prerender where old code returned `false` | Low | Low (positive change) | Intended: prerender should skip animation. These callbacks are user-triggered and effectively never fire during the headless prerender crawl; even if they did, the instant branch is the correct, safe output. Documented as the Item 2 improvement. |
| Existing test asserted the old `matchMedia` call path directly (spy on `window.matchMedia`) | Low | Low | Grep for `matchMedia` spies in the three components' tests; update to assert observable behavior (node states / streaming) instead of the call site. |

#### Dependencies & Order of Operations

- The three edits are fully independent of one another and can be made in any order; recommended order is Item 1 files (TopologyScene, ClusterEdge) then Item 2 (ArchitectureXRay), then a single lint + tsc + test pass.
- No dependency on other work packages. No shared helper changes (`useMediaQuery` and `isMotionDisabled` already exist and are unchanged).
- Order within a file: add the import, then swap the assignment, then lint.
- Final gate before commit: `npm run lint` + `npx tsc --noEmit` + `npx vitest related <three files>` green, plus the manual `/aws` and `/claude` reduced-motion toggle checks (green tests are not proof — the toggle-without-reload behavior is the actual feature being fixed and must be observed live).

#### Estimated Effort

- **Complexity:** Low.
- **Time range:** 30-45 min including running the suite and the two manual toggle verifications; +15-20 min if the Vitest `matchMedia` mock needs extending or new focused tests are added.
- **Files affected:** 3 source files (`TopologyScene.tsx`, `ClusterEdge.tsx`, `ArchitectureXRay.tsx`); plus 0-2 test files (existing test updates and/or one new `matchMedia` mock extension in the Vitest setup file) depending on current coverage.

---

## WP-G: CTA / touch-target / micro-interaction convention sweep

**Aggregate impact:** Medium

#### Objective

Bring the call-to-action links, touch targets, and micro-interactions on three pages — Altivum (`/altivum`), Beyond the Assessment (`/beyond-the-assessment`), and the 404 (NotFound) — into compliance with the established interaction recipe already used on Foundation.tsx and Home.tsx. Concretely: every primary/secondary CTA gets `min-h-[48px]` + `touch-manipulation` (44px+ tap target per mobile-first convention), `active:scale-[0.98]` press feedback, and `transition-all duration-300`; primary (gold-fill) CTAs gain the gold glow `hover:shadow-[0_0_20px_rgba(197,165,114,0.3)]`; decorative inline `<svg>` arrows get `aria-hidden="true"`. This is a pure convention sweep — no copy, layout, routing, or behavior changes.

The canonical recipes (verified in-repo):
- Primary gold CTA (Foundation.tsx:75): `inline-block px-8 py-4 bg-altivum-gold text-altivum-dark font-semibold rounded-sm hover:bg-altivum-gold/90 hover:shadow-[0_0_20px_rgba(197,165,114,0.3)] active:scale-[0.98] transition-all duration-300 touch-manipulation min-h-[48px]`
- Secondary outline CTA (Foundation.tsx:83): `inline-block px-8 py-4 bg-transparent border-2 border-altivum-gold text-altivum-gold font-semibold rounded-sm hover:bg-altivum-gold/10 active:scale-[0.98] transition-all duration-300 touch-manipulation min-h-[48px]`
- Decorative arrow (Foundation.tsx:198): `<svg ... aria-hidden="true">`

#### Prerequisites

- Working tree clean for these three files (none currently modified per `git status`).
- Node 20 toolchain available; `npm run lint` and `npm run build` runnable.
- No new dependencies, env vars, or CSP changes — all classes used (`shadow-[...]`, `active:scale-[0.98]`, `touch-manipulation`, `min-h-[48px]`, `transition-all`, `duration-300`) already exist elsewhere in the codebase and resolve under Tailwind v4.
- Confirmed: there are no existing page-level test files (`src/pages/*.test.tsx` does not exist), so this sweep adds no required test churn; the validation path is lint + tsc + build + manual.

Note on `min-h-[48px]` with `inline-block`: Foundation's primary/secondary CTAs use exactly `inline-block ... min-h-[48px]` (lines 75, 83, 224, 232) and render correctly, so applying the same pairing to Altivum's `inline-block` CTAs is consistent with the shipped pattern. `min-h` on an `inline-block` is honored by the browser; the existing `py-4` already exceeds 48px of content height, so `min-h-[48px]` is a guarantee/floor, matching the reference.

#### Step-by-Step Implementation

**1. Altivum.tsx — Learn More CTAs (lines 408–421)**

1.1 External primary CTA `<a href="https://altivum.ai">` (line 412). Replace its className:
- From: `inline-block px-8 py-4 bg-altivum-gold text-altivum-dark font-semibold rounded-sm hover:bg-altivum-gold/90 transition-all duration-200`
- To: `inline-block px-8 py-4 bg-altivum-gold text-altivum-dark font-semibold rounded-sm hover:bg-altivum-gold/90 hover:shadow-[0_0_20px_rgba(197,165,114,0.3)] active:scale-[0.98] transition-all duration-300 touch-manipulation min-h-[48px]`
- Net adds: gold glow, `active:scale-[0.98]`, `touch-manipulation`, `min-h-[48px]`; `duration-200` → `duration-300` (align to recipe). This matches Foundation.tsx:75 exactly.

1.2 Internal secondary CTA `<ViewTransitionLink to="/contact">` (line 418). Replace its className:
- From: `inline-block px-8 py-4 bg-transparent border border-altivum-gold text-altivum-gold font-semibold rounded-sm hover:bg-altivum-gold/10 transition-all duration-200`
- To: `inline-block px-8 py-4 bg-transparent border-2 border-altivum-gold text-altivum-gold font-semibold rounded-sm hover:bg-altivum-gold/10 active:scale-[0.98] transition-all duration-300 touch-manipulation min-h-[48px]`
- Net adds: `active:scale-[0.98]`, `touch-manipulation`, `min-h-[48px]`; `duration-200` → `duration-300`. This matches Foundation.tsx:83 exactly.
- **DECISION (border width):** Altivum currently uses `border` (1px); Foundation's recipe uses `border-2` (2px). Options:
  - (A) Adopt `border-2` to match the canonical recipe exactly (recommended — the package goal is "align to the Foundation recipe," and the two CTAs sit side-by-side so consistent border weight reads as intentional).
  - (B) Keep `border` (1px) to minimize visual delta. Lower risk of any perceived restyle, but leaves a residual inconsistency with the recipe.
  - **Recommendation: (A) `border-2`.** It is the documented target ("align to the Foundation recipe, Foundation.tsx:71–87"). The visual change is 1px on a single button; it is within refinement scope.

**2. BeyondTheAssessment.tsx — Amazon CTA (lines 89–100)**

2.1 Amazon CTA `<a href="https://a.co/d/iC9TEDW">` (line 94). Append the missing classes to the end of the existing className:
- From: `inline-flex items-center justify-center px-8 py-4 bg-altivum-gold hover:bg-amber-400 text-altivum-dark font-bold rounded-lg transition-all duration-300 transform hover:-translate-y-1 hover:shadow-lg hover:shadow-altivum-gold/20 min-w-[200px]`
- To: `inline-flex items-center justify-center px-8 py-4 bg-altivum-gold hover:bg-amber-400 text-altivum-dark font-bold rounded-lg transition-all duration-300 transform hover:-translate-y-1 hover:shadow-lg hover:shadow-altivum-gold/20 min-w-[200px] active:scale-[0.98] touch-manipulation min-h-[48px]`
- Net adds only: `active:scale-[0.98]`, `touch-manipulation`, `min-h-[48px]`. Note this button already has `transition-all duration-300` and a gold shadow on hover (`hover:shadow-altivum-gold/20`) plus `hover:-translate-y-1`; we deliberately **do not** add the `hover:shadow-[0_0_20px_...]` glow or strip the existing lift — that would be a restyle, not the requested touch-target/press refinement. Scope is exactly the three missing convention classes named in the package.
- **DECISION (`transform` + `active:scale-[0.98]` interaction):** This button already has `hover:-translate-y-1` and the `transform` utility. Adding `active:scale-[0.98]` composes fine in Tailwind v4 (both compile to the same CSS transform via separate utility classes; the existing Home/Foundation CTAs combine translate + scale without issue). No conflict — proceed.

2.2 Decorative arrow `<svg>` (lines 97–99). Add `aria-hidden="true"` to the opening tag:
- From: `<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2" viewBox="0 0 20 20" fill="currentColor">`
- To: `<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">`
- Matches the decorative-SVG convention at Foundation.tsx:198. The link already has a visible text label ("Order on Amazon" via the `<span>`), so the arrow is purely decorative and should be hidden from the a11y tree.

**3. NotFound.tsx — three CTAs (lines 41–61) + quick-links (lines 69–85)**

3.1 Primary "Go Home" `<ViewTransitionLink to="/">` (line 43). Replace className:
- From: `px-6 py-3 bg-altivum-gold text-altivum-dark font-medium rounded-lg hover:bg-altivum-gold/90 transition-colors`
- To: `px-6 py-3 bg-altivum-gold text-altivum-dark font-medium rounded-lg inline-flex items-center justify-center hover:bg-altivum-gold/90 hover:shadow-[0_0_20px_rgba(197,165,114,0.3)] active:scale-[0.98] transition-all duration-300 touch-manipulation min-h-[48px]`
- Net adds: gold glow (primary only, per package), `active:scale-[0.98]`, `touch-manipulation`, `min-h-[48px]`, plus `inline-flex items-center justify-center` so `min-h-[48px]` vertically centers the label (these are anchor-rendered links, default `inline`/`block`; without flex centering the text would top-align in the taller box). `transition-colors` → `transition-all duration-300`.

3.2 Secondary "Read the Blog" `<ViewTransitionLink to="/blog">` (line 50). Replace className:
- From: `px-6 py-3 border border-altivum-gold text-altivum-gold rounded-lg hover:bg-altivum-gold/10 transition-colors`
- To: `px-6 py-3 border border-altivum-gold text-altivum-gold rounded-lg inline-flex items-center justify-center hover:bg-altivum-gold/10 active:scale-[0.98] transition-all duration-300 touch-manipulation min-h-[48px]`
- Net adds: `active:scale-[0.98]`, `touch-manipulation`, `min-h-[48px]`, `inline-flex items-center justify-center`; `transition-colors` → `transition-all duration-300`. No glow (secondary).
- **DECISION (border width):** Package says "switch to transition-all duration-300 + active:scale-[0.98]" and does not call for a border-weight change here. Keep `border` (1px) on the two outline CTAs — the 404 page is its own visual context (not adjacent to Foundation), and the package scope for NotFound is explicitly tap-target + transition + glow-on-primary, not border weight. Recommendation: **keep 1px borders** on NotFound's secondary/tertiary to stay strictly within the named scope.

3.3 Tertiary "Get in Touch" `<ViewTransitionLink to="/contact">` (line 57). Replace className:
- From: `px-6 py-3 border border-white/20 text-white rounded-lg hover:bg-white/5 transition-colors`
- To: `px-6 py-3 border border-white/20 text-white rounded-lg inline-flex items-center justify-center hover:bg-white/5 active:scale-[0.98] transition-all duration-300 touch-manipulation min-h-[48px]`
- Net adds: `active:scale-[0.98]`, `touch-manipulation`, `min-h-[48px]`, `inline-flex items-center justify-center`; `transition-colors` → `transition-all duration-300`. No glow.

3.4 Quick-links row (lines 70–84): five text links (`/about`, `/altivum`, `/podcast`, `/beyond-the-assessment`, `/chat`), each currently `text-altivum-silver hover:text-altivum-gold transition-colors` with `style={typography.smallText}`. These are inline text links inside a wrapped flex row (`gap-x-6 gap-y-2`), not buttons. The package asks for "taller tap targets (Home.tsx:203,210 pattern)" — but Home.tsx:203/210 are full button CTAs, an inappropriate transform for inline text links (block-level button styling would break the inline wrapping row). 
- **DECISION (quick-links tap target):** Options:
  - (A) Make each a min-44/48px tap target without changing the visual text size by adding `inline-flex items-center min-h-[44px] touch-manipulation` to each link (and keep `transition-colors`). This enlarges only the hit area, preserves the compact inline look and the `gap-y-2` wrapping.
  - (B) Convert to full buttons per Home.tsx:203/210 — **rejected**: that is a restyle/new-feature drift (turns a demoted text-link row into a button grid), explicitly out of refinement scope.
  - (C) Leave quick-links unchanged.
  - **Recommendation: (A).** It honors the package intent ("taller tap targets") within the refinement boundary, matching the spirit of the mobile-first `min-h`/`touch-manipulation` convention without restyling. Apply to all five links:
    - From: `text-altivum-silver hover:text-altivum-gold transition-colors`
    - To: `inline-flex items-center min-h-[44px] touch-manipulation text-altivum-silver hover:text-altivum-gold transition-colors`
  - **Refinement-boundary note:** I am deliberately using `min-h-[44px]` (the WCAG/iOS minimum) rather than `min-h-[48px]` for these inline links, because 48px on a wrapped text row adds noticeable vertical bulk to a demoted tertiary nav; 44px is the documented floor and keeps the demoted row compact. If the reviewer prefers strict 48px parity with the buttons, swap `min-h-[44px]`→`min-h-[48px]` — both are one-token edits. Flagging because the package text references the Home button pattern (48px); 44px is a defensible deviation, surfaced for the decision-maker.

**4. Lint/type/build verification** — run `npm run lint`, then `npm run build` (full pipeline includes tsc). See Testing & Validation.

#### File & Code Changes

| Action | File Path | Description |
|---|---|---|
| Edit | `/Users/cperez/dev/altivum-dev/thechrisgrey/src/pages/Altivum.tsx` | Line 412: primary external CTA `<a>` className → add gold glow + `active:scale-[0.98]` + `touch-manipulation` + `min-h-[48px]`; `duration-200`→`duration-300` (match Foundation:75). Line 418: secondary `<ViewTransitionLink>` className → `border`→`border-2`, add `active:scale-[0.98]` + `touch-manipulation` + `min-h-[48px]`; `duration-200`→`duration-300` (match Foundation:83). |
| Edit | `/Users/cperez/dev/altivum-dev/thechrisgrey/src/pages/BeyondTheAssessment.tsx` | Line 94: append `active:scale-[0.98] touch-manipulation min-h-[48px]` to Amazon CTA className (keep existing `transition-all duration-300`, lift, and gold hover-shadow as-is). Line 97: add `aria-hidden="true"` to decorative arrow `<svg>`. |
| Edit | `/Users/cperez/dev/altivum-dev/thechrisgrey/src/pages/NotFound.tsx` | Line 43: primary "Go Home" → add `inline-flex items-center justify-center`, gold glow, `active:scale-[0.98]`, `touch-manipulation`, `min-h-[48px]`; `transition-colors`→`transition-all duration-300`. Lines 50 & 57: secondary/tertiary → add `inline-flex items-center justify-center`, `active:scale-[0.98]`, `touch-manipulation`, `min-h-[48px]`; `transition-colors`→`transition-all duration-300` (no glow). Lines 70–84 (5 quick-links): prepend `inline-flex items-center min-h-[44px] touch-manipulation` to each. |

No new files. No deletions. No changes to `routes.ts`, `amplify.yml`, CSP, schemas, or Lambda.

#### Testing & Validation

**Automated (required):**
1. `npm run lint` — must pass (className string edits + one new JSX attribute; no logic).
2. `npm run build` — runs env validation → podcast gen → lint → `tsc` → vite build → sitemap → RSS. The `tsc` step confirms the new `aria-hidden` attribute and class strings are type-valid JSX; vite build confirms Tailwind compiles every utility (`shadow-[0_0_20px_rgba(197,165,114,0.3)]`, `active:scale-[0.98]`, `min-h-[48px]`, `min-h-[44px]`, `touch-manipulation`, `border-2`) — all already used elsewhere so JIT will emit them.

**Unit/integration tests:** None required and none currently exist for these pages (`src/pages/*.test.tsx` is empty). Adding a test suite for purely-presentational className changes would be net-new scaffolding beyond this package's scope. **Optional, low-value:** a snapshot/RTL test asserting each CTA `toHaveClass('min-h-[48px]', 'touch-manipulation', 'active:scale-[0.98]')` could be added if the team wants a regression guard for the convention; flagged as optional, not part of the refinement.

**Manual verification (this is where the real proof is — the convention is interaction/visual):**
1. `npm run dev`, open each route:
   - `/altivum` → "Want to Learn More?" section: hover "Visit Altivum.ai" → gold glow appears; click-and-hold → button scales to 0.98; both CTAs visibly ≥48px tall; "Get in Touch" now has 2px border matching the gold fill button's weight.
   - `/beyond-the-assessment` → "Order on Amazon" button: press → scales; height ≥48px; existing lift + gold hover-shadow still present (regression check). Run an a11y check (browser devtools "Accessibility" tree or axe) → the arrow `<svg>` no longer announces; the link's accessible name is "Order on Amazon".
   - `/404` (navigate to any nonexistent path, e.g. `/zzz`): all three CTAs ≥48px, label vertically centered (verify the `inline-flex` centering took effect), press-scale works, "Go Home" shows gold glow on hover, the other two do not. Quick-links row: each link's hit area is ≥44px tall (hover/devtools box model), row still wraps with `gap-y-2`, text size unchanged.
2. Mobile viewport (DevTools device toolbar, ~375px): confirm tap targets meet 48px and there is no layout shift / row reflow in the 404 CTA group or quick-links.
3. `prefers-reduced-motion: reduce` (DevTools rendering emulation): `active:scale` and `transition-all` are CSS-driven; confirm no jank. (These pages don't gate via `isMotionDisabled()` for these CTAs — neither does Foundation/Home for the same classes — so behavior matches the established pattern; no new motion-gating obligation introduced.)

**Rollback check:** Changes are isolated to three presentational files and are class-string/attribute-only. `git checkout -- src/pages/Altivum.tsx src/pages/BeyondTheAssessment.tsx src/pages/NotFound.tsx` fully reverts with zero side effects (no migrations, no generated artifacts, no state). Safe to revert per-file if any single page regresses.

#### Risk & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `min-h-[48px]` on `inline`/`block` anchor links (NotFound) leaves label top-aligned in a taller box | Medium | Low (cosmetic) | Add `inline-flex items-center justify-center` alongside `min-h-[48px]` (Step 3.1–3.3) so the label centers; verify in DevTools box model. |
| `border`→`border-2` on Altivum secondary CTA is perceived as a restyle beyond "refinement" | Low | Low | Surfaced as DECISION 1.2 with recommendation + fallback (keep `border`); change is 1px and matches the documented target recipe. |
| Quick-links "taller tap target" interpreted as Home.tsx button restyle (scope drift) | Medium | Medium (would change page design) | Explicitly rejected option B; chose hit-area-only enlargement (DECISION 3.4) that preserves the inline text-link look. |
| `active:scale-[0.98]` composes badly with BTA's existing `transform`/`hover:-translate-y-1` | Low | Low | Same composition already ships on Home/Foundation CTAs; verified Tailwind emits both as transform utilities; manual press test in checklist. |
| Tailwind v4 JIT fails to emit an arbitrary class | Very Low | Low (style missing) | Every class used already exists elsewhere (grep-confirmed `min-h-[48px]`, `shadow-[0_0_20px_...]`, `active:scale-[0.98]` in Foundation/Home); `npm run build` will surface any miss. |
| `aria-hidden` typo or wrong element breaks a11y intent | Very Low | Low | Applied to the decorative arrow only; link retains visible `<span>` text label; verified via a11y tree in manual check. |
| Unintended visual regression to BTA's existing gold hover-shadow/lift | Low | Low | Edit only appends 3 classes; existing `transition-all duration-300 hover:-translate-y-1 hover:shadow-...` left untouched; regression check in manual step 1. |

#### Dependencies & Order of Operations

1. The three file edits are mutually independent — order does not matter and they can be done in any sequence or in parallel.
2. Within each file, apply the className/attribute edits, then run lint.
3. After all edits: `npm run lint` → `npm run build` (build depends on edits being complete and lint-clean).
4. Manual verification depends on a successful `npm run dev` / build.
5. No upstream dependencies (no routes, CSP, env, schema, or Lambda touch). No downstream consumers of these pages' markup. Decisions 1.2 (border-2), 3.4 (44px vs 48px) should be confirmed by the implementer/reviewer before commit, but neither blocks the others.

#### Estimated Effort

Complexity **Low** · Time **20–35 min** (edits ~10 min; lint+build ~5–10 min; manual cross-device + a11y verification ~10–15 min) · Files affected **3** (`src/pages/Altivum.tsx`, `src/pages/BeyondTheAssessment.tsx`, `src/pages/NotFound.tsx`) — 9 element edits total (Altivum 2, BTA 2, NotFound 3 CTAs + 5 quick-links treated as one repeated edit).

---

## WP-H: Dead code & duplication cleanup

**Aggregate impact:** Medium

#### Objective

Eliminate verified dead code and copy-paste duplication across eight page/component files in the thechrisgrey React app, plus remove a 2.1 MB unused source asset from the repo. This is **refinement only** — no user-visible behavior, layout, copy, styling, or routing changes. Every step preserves the existing rendered DOM (so the green integration tests in `Home.integration.test.tsx`, `AWS.integration.test.tsx`, `Claude.integration.test.tsx`, and `EpisodeCard.test.tsx` keep passing unchanged) while collapsing redundant declarations into single sources of truth, deleting unreachable branches, and dropping a never-imported binary asset. The net effect is a smaller, more maintainable tree with one less drei import on the AWS chunk and ~2.1 MB removed from git history going forward.

#### Prerequisites

- Node 20 (`.nvmrc`), `npm ci` already run; baseline green: `npm run lint`, `npx tsc --noEmit`, and `npx vitest run` before starting (capture the baseline pass count so a post-change diff is meaningful).
- Confirm working tree is clean except the pre-existing untracked `.claude/` and `scripts/editorial-raw/` (per `git status`). Branch off `main` first: `git checkout -b chore/wp-h-deadcode-dedup`.
- Verified facts this plan relies on (all confirmed by reading current code):
  - `Home.tsx` `keyPoints` entries **all** have a non-empty `link` (lines 31–38), so the `point.link ? … : <div>` ternary (85–93) `else` branch is statically unreachable.
  - `Altivum.tsx` `timelineItems[].icon` (13–17, 40–43, 80–83) is **never** read by the render (`timelineItems.map` at 344–362 renders only `title`, `preview`, `content`).
  - The three "Imperatives" appear verbatim once inside `timelineItems[1].content` (52–71) and again as standalone cards (383–396).
  - `ClusterDetail.tsx` is exported but has **zero** importers (grep: only its own definition). It is the **only** consumer of `@react-three/drei`'s `Html` in `src/components/aws/`.
  - `TopologyScene.tsx` `flyTo` (137–157) and `handleClusterClick` (172–203) are byte-for-byte the same camera-move logic; `reset` (120–136) and `handleDeselect` (205–223) likewise. Both `flyTo` and `reset` are reached externally via `controlRef` from `InfraTopology.tsx` (132, 151, 153); `handleClusterClick`/`handleDeselect` are reached via in-scene pointer events.
  - `ArchitectureXRay.tsx` `buildInitialNodeStates` (25–31) and `resetAllNodeStates` (33–39) are identical; an inline copy of the same loop appears at 110–116, 230–232, and 449–453. `handleTrace` calls `abortControllerRef.current?.abort()` twice (222 and 248).
  - `EpisodeCard.tsx` `guests` (197–209) and `topics` (220–231) branches render only when those arrays are non-empty. The generator (`generate-podcast-episodes.js:261`) emits `topics: []` and never emits `guests`; `generatedEpisodes.json` confirms 9 episodes, all `"topics": []`, zero `"guests"`. **But** `FALLBACK_EPISODES` in `podcastEpisodes.ts` (5–60) DO populate both, and the `EpisodeCard.test.tsx` unit tests (59–77) assert both branches render. So the branches are dead against *production* data only, not against the fallback path or tests.
  - The EPUB at `src/assets/Beyond the Assessment FINAL.epub/` is 76 git-tracked files / 2.1 MB, never imported (grep clean; the only "epub"/"Beyond the Assessment FINAL" hits are `datePublished` false-positives).

#### Step-by-Step Implementation

**1. Home — remove unreachable fallback, hoist statics, content-key tabs, fix shader comment**

1.1 In `src/pages/Home.tsx`, move the `keyPoints` array (currently lines 30–39) out of the `Home` component to module scope (just below the imports, after line 22). Add an explicit type so the `renderTab` `typeof keyPoints[number]` reference still resolves: declare `type KeyPoint = { title: string; subtitle: string; link: string };` and `const keyPoints: KeyPoint[] = [ … ];`. The `link` field is now required (non-optional) — this is correct since every entry has one and it makes the dead ternary provably removable.

1.2 Move `renderTab` (currently 41–96) to module scope as a standalone function below `keyPoints`. It already closes over only `sectionRef` and `typography` — pass `sectionRef` in as a parameter so it can live at module scope. Change its signature to `const renderTab = (point: KeyPoint, index: number, sectionRef: React.RefObject<HTMLElement | null>, mirrored = false) => { … }`. Update its `typeof keyPoints[number]` param type to `KeyPoint`. (`SplitReveal`/`FadeReveal`/`ViewTransitionLink`/`typography` are module-level imports already available.)

1.3 Remove the unreachable fallback. Replace the ternary block (85–93):
```tsx
{point.link ? (
  <ViewTransitionLink to={point.link} className={`${cardClass} ${linkHover}`}>
    {content}
  </ViewTransitionLink>
) : (
  <div className={cardClass}>
    {content}
  </div>
)}
```
with the unconditional link:
```tsx
<ViewTransitionLink to={point.link} className={`${cardClass} ${linkHover}`}>
  {content}
</ViewTransitionLink>
```

1.4 Content-key the tabs. The outer wrapper is currently `<div key={index} className="pointer-events-auto">` (84). Change `key={index}` to `key={point.link}` (each link is unique across the 8 entries — verified distinct). This is the "content-key" fix; it keeps React reconciliation stable if the array is ever reordered.

1.5 Update the two call sites (now 171, 174) to pass `sectionRef`: `renderTab(point, i, sectionRef)` and `renderTab(point, i + 4, sectionRef, true)`.

1.6 In `src/components/home/heroShader.ts` line 32, fix the stale comment. Current: `uniform vec3  uColorNavy;   // #1A2332` — wait, re-verify: the *navy* comment at line 32 reads `// #1A2332` which is already correct. The package instructions say "stale shader hex comment (heroShader.ts:32 -> #2E4A6B)". Reading the file: line 31 is `uColorDark; // #0A0F1C`, line 32 is `uColorNavy; // #1A2332`, line 33 is `uColorGold; // #C5A572`. None currently shows a wrong hex. **DECISION/NOTE:** the comment at line 32 is already accurate (`#1A2332` = `altivum-navy`), and `#2E4A6B` is `altivum-blue`, which is NOT one of the three uniforms the shader actually uses (it mixes dark→navy→gold only). The instruction to change line 32 to `#2E4A6B` would make the comment *wrong*. **Recommendation: skip the hex change** — making this edit would introduce an inaccuracy, which violates the refinement boundary. Verify against the `@theme` block in `src/index.css` (altivum-navy = #1A2332, altivum-blue = #2E4A6B) before deciding; if the maintainer confirms a different intent, the only defensible edit is to leave it. Document this in the PR description rather than editing.

**2. Altivum — drop unused icon field, hoist Imperatives to one array**

2.1 In `src/pages/Altivum.tsx`, decide the `timelineItems[].icon` fate. The field is defined three times (13–17, 40–43, 80–83) and never rendered. **DECISION:** Two options — (a) **remove** the `icon` property from all three objects (it carries no behavior and the timeline render at 344–362 has no icon slot), or (b) **render** it (add an icon slot to the timeline node). **Recommendation: remove.** Adding a render slot is new functionality (out of scope); removing is the pure dead-code cleanup the package calls for. Delete the three `icon: ( <svg…/> )` blocks.

2.2 Hoist the Imperatives. Create a module-scope constant above the component (mirroring Foundation's `FOCUS_AREAS` pattern at `Foundation.tsx:7–28`):
```tsx
const IMPERATIVES = [
  {
    title: 'Advance AI through real-world application',
    description: 'We deploy AI into high-stakes, real-world environments, not just to test performance, but to expand its frontier by solving problems that matter.',
  },
  {
    title: 'Strengthen human-machine integration',
    description: 'We integrate AI with the decisiveness, adaptability, and mission-first mindset of veterans, creating systems that think fast, act smart, and align with human intent.',
  },
  {
    title: 'Position veterans as strategic leaders',
    description: 'We equip veterans to lead the charge, not just as users of autonomous technology, but as architects, commanders, and ethical stewards of the AI-driven future.',
  },
] as const;
```
(Strings copied verbatim from the standalone cards at 385–394 — these match the `<span className="font-semibold">…:</span> …` text in the timeline list at 56, 62, 68, modulo the trailing colon. Verify the two sources are character-identical before collapsing; they are, except the timeline version inlines the title and body in one `<div>` with a `:` separator.)

2.3 Replace the standalone Imperatives cards (383–396) with a map over `IMPERATIVES`, preserving the exact current markup/classes:
```tsx
<div className="space-y-6">
  {IMPERATIVES.map((imp) => (
    <div key={imp.title} className="p-6 border border-altivum-slate/20 rounded-lg hover:border-altivum-gold/30 transition-colors duration-300">
      <h4 className="text-white mb-3" style={typography.cardTitleSmall}>{imp.title}</h4>
      <p className="text-altivum-silver/70" style={typography.smallText}>{imp.description}</p>
    </div>
  ))}
</div>
```

2.4 Replace the inline Imperatives `<ul>` inside `timelineItems[1].content` (52–71) with a map over the same `IMPERATIVES`, preserving the existing `<li className="flex items-start …">` / `<span className="text-altivum-gold mr-3 mt-1">→</span>` / `<div><span className="font-semibold text-white">{imp.title}:</span> {imp.description}</div>` structure (note the colon after the bold title in this variant). This keeps both renders fed by one array. Because `timelineItems` is defined inside the component and `IMPERATIVES` is module-scope, the reference resolves fine.

**3. Foundation — extract local CTA button variants**

3.1 In `src/pages/Foundation.tsx`, there are four external-link CTA buttons across two sections — hero (71–86) and bottom CTA (220–235) — with two visual variants (solid gold "primary", outlined "secondary"). Extract two small local presentational components above the `Foundation` component (kept local to the file; not a shared UI export, matching the package's "extract local button variants" wording). Note the **one real difference**: hero buttons use `inline-block px-8 py-4` with no width class; bottom CTA buttons add `w-full sm:w-auto`. Parameterize that via a `fullWidthMobile` prop, or accept `className` overrides. Recommended shape:
```tsx
type FoundationCtaProps = { href: string; children: React.ReactNode; fullWidthMobile?: boolean };

const PrimaryCta = ({ href, children, fullWidthMobile = false }: FoundationCtaProps) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className={`inline-block ${fullWidthMobile ? 'w-full sm:w-auto ' : ''}px-8 py-4 bg-altivum-gold text-altivum-dark font-semibold rounded-sm hover:bg-altivum-gold/90 hover:shadow-[0_0_20px_rgba(197,165,114,0.3)] active:scale-[0.98] transition-all duration-300 touch-manipulation min-h-[48px]`}
  >
    {children}
  </a>
);

const SecondaryCta = ({ href, children, fullWidthMobile = false }: FoundationCtaProps) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className={`inline-block ${fullWidthMobile ? 'w-full sm:w-auto ' : ''}px-8 py-4 bg-transparent border-2 border-altivum-gold text-altivum-gold font-semibold rounded-sm hover:bg-altivum-gold/10 active:scale-[0.98] transition-all duration-300 touch-manipulation min-h-[48px]`}
  >
    {children}
  </a>
);
```

3.2 Replace hero block (71–86): `<PrimaryCta href="https://altivumfoundation.org">Visit altivumfoundation.org</PrimaryCta>` and `<SecondaryCta href="https://altivumfoundation.org/give">Give Now</SecondaryCta>`.

3.3 Replace bottom CTA block (220–235): `<PrimaryCta href="https://altivumfoundation.org/give" fullWidthMobile>Give Now</PrimaryCta>` and `<SecondaryCta href="https://altivumfoundation.org" fullWidthMobile>Visit altivumfoundation.org</SecondaryCta>`. Note the bottom CTA reverses which URL is primary vs secondary (Give Now is the gold primary at bottom; Visit is gold primary at hero) — preserve that exactly; the extraction must not normalize it.

3.4 Verify the className strings produced are character-identical to the originals (build the string by hand and diff against lines 75, 83, 224, 232). The `min-h-[48px]`, `touch-manipulation`, `active:scale-[0.98]` tokens must all survive.

**4. Podcast — resolve dead `topics`/`guests` branches (DECISION)**

The branches are dead against generated (production) data but **live** against `FALLBACK_EPISODES` and against the unit tests. Two options:

- **Option A — Wire the generator to populate them.** In `generate-podcast-episodes.js`, parse `#hashtags` from the YouTube description into `topics` (the file's own comment at 261 hints at this), and optionally parse guest names. *Effort: Med–High.* *Risk: Med* — hashtag heuristics are noisy; guest extraction from free-text descriptions is unreliable and could surface wrong names on a public page. This **expands scope** (new data-extraction feature) and edges past the refinement boundary.
- **Option B — Remove the dead branches from `EpisodeCard.tsx`.** *Risk: High* — this would break the fallback render path (used when `YOUTUBE_API_KEY` is unset, e.g. local dev / API outage; `FALLBACK_EPISODES` carry topics+guests) AND break four unit-test assertions (`EpisodeCard.test.tsx` 59–77), and remove the only place guest credit shows for the three seed episodes. Not a safe pure-cleanup.

**Recommendation: do neither as a code change in WP-H — keep both branches, and instead remove the misleading "Could extract from description hashtags if present" comment is *not* warranted either.** The cleanest honest action is **Option A deferred**: the branches are correct defensive UI that the *fallback* path exercises; they are not truly dead, only unused by the current generated dataset. Removing them (Option B) is a regression; wiring the generator (Option A) is a feature. **WP-H's recommendation: leave `EpisodeCard.tsx` unchanged and note in the PR that "topics/guests are intentionally retained for the fallback dataset; populating them from YouTube is a separate feature (Option A) tracked in `docs/ideas-to-consider.md`."** If the maintainer insists on a code change within this package, prefer Option A (additive, no regression) over Option B. Do not silently delete the branches.

4.1 (If Option A is chosen) In `generate-podcast-episodes.js`, after `episodeNum` is computed (~241), add a `topics` extractor: `const topics = (snippet.description || '').match(/#(\w+)/g)?.map(t => t.slice(1)) ?? [];` and set `topics,` instead of `topics: []` at 261. Add a unit test in a new `scripts/__tests__/` or extend the existing exported-helper tests (the file already exports helpers for testability). Do **not** attempt guest extraction (unreliable). Leave `guests` as-is (the fallback supplies them; generated stays without).

**5. BTA — remove the unused 2.1 MB source EPUB**

5.1 Remove the directory from git and disk:
```bash
git rm -r "src/assets/Beyond the Assessment FINAL.epub"
```
(76 tracked files, 2.1 MB; confirmed zero importers.) This stops it shipping in future clones and keeps it out of any glob. It remains in history; if history-scrubbing is desired that's a separate, riskier operation out of scope here.

5.2 Optionally add `*.epub` (or the specific path) to `.gitignore` to prevent re-adding the source bundle. Keep this minimal; only add if the maintainer wants the guard.

**6. AWS — delete dead `ClusterDetail`, dedup `flyTo`/`reset`**

6.1 Delete the dead file: `git rm src/components/aws/ClusterDetail.tsx`. Confirmed: zero importers, and it is the sole `@react-three/drei` `Html` consumer in `src/components/aws/`, so its removal drops `Html` from the AWS lazy chunk. (The live detail UI is `FallbackDetail`, rendered as plain HTML in `InfraTopology.tsx:129`.)

6.2 In `TopologyScene.tsx`, collapse the duplicated camera moves into two private helpers inside `SceneContent`. Because the duplicated logic uses `camera`, `invalidate`, `reducedMotion`, `onSelectCluster`, `setFrameloopMode` (all in scope), define:
```tsx
const flyToCluster = useCallback((id: string) => {
  const cluster = clusters.find((c) => c.id === id);
  if (!cluster) return;
  onSelectCluster(id);
  setFrameloopMode('demand');
  const target = new THREE.Vector3(...cluster.position);
  const dest = new THREE.Vector3().lerpVectors(DEFAULT_CAMERA_POS, target, 0.25);
  dest.z = Math.max(dest.z, target.z + 2);
  if (reducedMotion) {
    camera.position.set(dest.x, dest.y, dest.z);
    invalidate();
  } else {
    gsap.to(camera.position, {
      x: dest.x, y: dest.y, z: dest.z,
      duration: 0.8, ease: 'power2.out',
      onUpdate: () => invalidate(),
      onComplete: () => invalidate(),
    });
  }
}, [camera, invalidate, onSelectCluster, setFrameloopMode, reducedMotion]);

const resetView = useCallback(() => {
  onSelectCluster(null);
  setFrameloopMode('always');
  if (reducedMotion) {
    camera.position.set(DEFAULT_CAMERA_POS.x, DEFAULT_CAMERA_POS.y, DEFAULT_CAMERA_POS.z);
    invalidate();
  } else {
    gsap.to(camera.position, {
      x: DEFAULT_CAMERA_POS.x, y: DEFAULT_CAMERA_POS.y, z: DEFAULT_CAMERA_POS.z,
      duration: 0.8, ease: 'power2.out',
      onUpdate: () => invalidate(),
    });
  }
}, [camera, invalidate, onSelectCluster, setFrameloopMode, reducedMotion]);
```
*Note the one pre-existing micro-difference to preserve faithfully:* the original `handleClusterClick` (191–200) has both `onUpdate` and `onComplete`, while `flyTo` (149–156) also has both — they match. The original `reset` (127–134) has only `onUpdate`; `handleDeselect` (214–221) also only `onUpdate` — they match. So `flyToCluster` keeps `onComplete`, `resetView` does not. Verified consistent.

6.3 Rewire references:
   - In the `controlRef` handle (63–158): set `reset: resetView` and `flyTo: flyToCluster` (delete the two inline bodies at 120–136 and 137–157). Update the effect dependency array (159) accordingly (`flyToCluster`, `resetView` instead of the inlined deps if they change; since the helpers are `useCallback`-stable, list them).
   - Replace `handleClusterClick` (172–203) body with a thin wrapper or call `flyToCluster` directly at the cluster `onClick` (273): `onClick={() => flyToCluster(cluster.id)}`. Remove the now-unused `handleClusterClick`.
   - Replace `handleDeselect` (205–223): use `resetView`. Update the empty-space mesh `onPointerDown={resetView}` (257) and the Escape-key effect (226–235) to call `resetView` (and its dep array → `resetView`). Remove the now-unused `handleDeselect`.

6.4 Run `npx tsc --noEmit` — the `TopologyControlHandle` interface (294–299) is unchanged (still `flyTo`/`reset`), so `InfraTopology.tsx` and `TopologyControls.tsx` need no edits. Confirm no unused-var lint errors for removed `handleClusterClick`/`handleDeselect`.

**7. Claude — collapse node-state helpers into one `allDim()`, drop redundant abort**

7.1 In `src/components/claude/ArchitectureXRay.tsx`, replace `buildInitialNodeStates` (25–31) and `resetAllNodeStates` (33–39) with a single module-scope helper:
```tsx
function allDim(): Record<string, NodeState> {
  return Object.fromEntries(pipelineNodes.map((n) => [n.id, 'dim' as const]));
}
```
(This matches the already-existing inline form at line 231 — `Object.fromEntries(pipelineNodes.map((n) => [n.id, 'dim' as const]))` — so it's a proven-equivalent shape.)

7.2 Update the four call sites to use `allDim()`:
   - useState initializer (44): `useState<Record<string, NodeState>>(allDim)` (pass the function reference, lazy init).
   - `runPipelineAnimation` reset (153): `setNodeStates(allDim())`.
   - `handleTrace` reset (230–232): `setNodeStates(allDim())`.
   - `NodeDetailPanel onClose` (448–454) and `handleNodeClick` toggle-off (102–106): these set individual keys / loop over `prev`; the close handlers at 448–454 and 109–116 rebuild from `Object.keys(prev)`. The 448–454 block (all-to-dim) can become `setNodeStates(allDim())` since it dims every node unconditionally. The 109–116 block sets all-dim-then-one-active — keep its loop (it's not a plain all-dim). The 100–106 toggle-off sets just the clicked node to dim — leave as-is.

7.3 Remove the redundant second `abort()` in `handleTrace`. Lines 222 (`abortControllerRef.current?.abort();` at the top) and 248 (`abortControllerRef.current?.abort();` just before constructing the new controller) are redundant — the same controller is aborted twice with no state change in between (the `setTraceState`/`setResponseContent` calls don't create a new controller). Delete the second one (248) and its now-orphaned comment `// Abort any previous request` (247). Keep the first abort (222) which pairs with the kill-in-flight comment.

7.4 Run `npx vitest run src/components/claude/__tests__/ArchitectureXRay.test.tsx` to confirm trace/abort/reduced-motion behavior is unchanged.

**8. Links — extract a `SocialCard` helper for the duplicated grids**

8.1 In `src/pages/Links.tsx`, the personal (201–224) and company (239–262) social grids render byte-identical `<a>`/icon/title/handle markup. Extract one local presentational component above `Links`:
```tsx
type SocialItem = { name: string; handle: string; url: string; icon: React.ReactNode };

const SocialCard = ({ social }: { social: SocialItem }) => (
  <a
    key={social.name + social.handle}
    href={social.url}
    target="_blank"
    rel="noopener noreferrer"
    className="block p-6 rounded-lg border border-white/10 hover:border-altivum-gold/50 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-altivum-gold/5 transition-all duration-300 group bg-transparent"
  >
    <div className="flex items-center gap-4">
      <div className="w-10 h-10 flex items-center justify-center text-altivum-gold/70 group-hover:text-altivum-gold transition-all shrink-0">
        {social.icon}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-white group-hover:text-altivum-gold transition-colors" style={typography.cardTitleSmall}>
          {social.name}
        </h3>
        <p className="text-altivum-silver/60 text-xs truncate">{social.handle}</p>
      </div>
      <span className="material-icons text-altivum-silver/30 group-hover:text-altivum-gold group-hover:translate-x-1 transition-all shrink-0 text-sm">arrow_forward</span>
    </div>
  </a>
);
```
Note: `key` belongs on the element returned by `.map`, not inside `SocialCard` — put the `key` on the `<SocialCard>` call, not on the inner `<a>` (remove `key` from the snippet above). The `personalSocials`/`companySocials` items already match `SocialItem`'s shape (verified: each has `name`, `handle`, `url`, `icon`).

8.2 Replace both grid bodies' `.map` with `{personalSocials.map((social) => <SocialCard key={social.name + social.handle} social={social} />)}` and the company equivalent. The two `<section>` wrappers, headings ("Personal - Social Media" / "Company - Social Media"), and the gradient dividers (191, 229) stay as-is. The `websites` grid (160–187) has a different shape/markup — leave it untouched (out of the duplicated pair).

**9. Validate, commit**

9.1 `npm run lint && npx tsc --noEmit && npx vitest run` — all green, same test count as baseline (no tests deleted; possibly +1 if Option A test added).
9.2 `npm run build` to confirm the full pipeline (env validation → episodes → lint → tsc → vite build → sitemap → RSS) still succeeds and the EPUB removal doesn't break any glob.
9.3 Commit on the branch; do not push/PR unless the user asks.

#### File & Code Changes

| Action | File Path | Description |
|---|---|---|
| Edit | `/Users/cperez/dev/altivum-dev/thechrisgrey/src/pages/Home.tsx` | Hoist `keyPoints` (typed) + `renderTab` to module scope; remove unreachable `point.link` ternary `else` branch (85–93) → unconditional `<ViewTransitionLink>`; change tab `key={index}` → `key={point.link}`; thread `sectionRef` into `renderTab`. |
| None (note) | `/Users/cperez/dev/altivum-dev/thechrisgrey/src/components/home/heroShader.ts` | Line 32 comment `// #1A2332` is already correct (altivum-navy). The requested `#2E4A6B` (altivum-blue) is not a shader uniform; editing would make the comment wrong. Leave unchanged; document in PR. |
| Edit | `/Users/cperez/dev/altivum-dev/thechrisgrey/src/pages/Altivum.tsx` | Delete unused `icon` SVG field from all three `timelineItems` (13–17, 40–43, 80–83); add module-scope `IMPERATIVES` array; map it in both the timeline `content` `<ul>` (52–71) and the standalone cards (383–396). |
| Edit | `/Users/cperez/dev/altivum-dev/thechrisgrey/src/pages/Foundation.tsx` | Add local `PrimaryCta`/`SecondaryCta` button components with `fullWidthMobile` prop; replace the four hand-rolled `<a>` CTAs (71–86, 220–235), preserving exact classes and the hero-vs-bottom primary/secondary URL ordering. |
| None (recommended) | `/Users/cperez/dev/altivum-dev/thechrisgrey/src/components/EpisodeCard.tsx` | Keep `topics`/`guests` branches — live for the fallback dataset + unit tests; deleting them regresses fallback/local-dev render. (See DECISION; Option A is the only safe code change and is additive/out-of-scope for WP-H.) |
| Edit (only if Option A chosen) | `/Users/cperez/dev/altivum-dev/thechrisgrey/scripts/generate-podcast-episodes.js` | Populate `topics` from `#hashtags` in the video description (replace `topics: []` at 261); add a helper unit test. Do not attempt guest extraction. |
| Delete | `/Users/cperez/dev/altivum-dev/thechrisgrey/src/assets/Beyond the Assessment FINAL.epub/` | `git rm -r` the 76-file / 2.1 MB unused source EPUB (no importers). |
| Edit (optional) | `/Users/cperez/dev/altivum-dev/thechrisgrey/.gitignore` | Add `*.epub` (or the specific path) to prevent re-adding the source bundle. |
| Delete | `/Users/cperez/dev/altivum-dev/thechrisgrey/src/components/aws/ClusterDetail.tsx` | `git rm` the dead 162-line component (zero importers; sole `@react-three/drei` `Html` consumer in `aws/`). |
| Edit | `/Users/cperez/dev/altivum-dev/thechrisgrey/src/components/aws/TopologyScene.tsx` | Introduce `flyToCluster(id)` + `resetView()` `useCallback`s; route `controlRef.flyTo`/`reset`, cluster `onClick`, empty-space `onPointerDown`, and the Escape effect through them; delete the four duplicated bodies (`flyTo`, `handleClusterClick`, `reset`, `handleDeselect`). |
| Edit | `/Users/cperez/dev/altivum-dev/thechrisgrey/src/components/claude/ArchitectureXRay.tsx` | Replace `buildInitialNodeStates`+`resetAllNodeStates` with one `allDim()`; use it at the useState init (44), `runPipelineAnimation` (153), `handleTrace` (230–232), and `NodeDetailPanel.onClose` all-dim (448–454); remove the redundant second `abort()` (248) + its comment (247). |
| Edit | `/Users/cperez/dev/altivum-dev/thechrisgrey/src/pages/Links.tsx` | Add local `SocialCard` component; replace personal (201–224) and company (239–262) grid `.map` bodies with `<SocialCard>`; leave the `websites` grid, headings, and dividers untouched. |

#### Testing & Validation

- **Unit/integration (must stay green, unchanged):**
  - `src/__tests__/integration/Home.integration.test.tsx` — asserts the 5 visible key-point titles/subtitles and their `/about`, `/altivum`, `/podcast`, `/beyond-the-assessment`, `/aws` links (60–91). The hoist + key change + ternary removal preserves identical DOM; this test is the regression guard for item 1.
  - `src/components/EpisodeCard.test.tsx` — its `guests`/`topics` assertions (59–77) are exactly why Option B is unsafe; under the recommendation (no change) they stay green. If Option A is taken, they stay green too (additive generator change).
  - `src/components/aws/__tests__/InfraTopology.test.tsx` — mocks `TopologyScene` (15–16), so item 6's internal refactor isn't directly exercised. Add coverage (below).
  - `src/components/claude/__tests__/ArchitectureXRay.test.tsx` — guards item 7 (trace flow, abort, reduced-motion node states).
  - `src/__tests__/integration/AWS.integration.test.tsx` and `Claude.integration.test.tsx` — page-level smoke for items 6 & 7.
- **New/updated tests:**
  - Item 6: `TopologyScene` has no direct test today and is mocked everywhere. Add a focused test that mounts `<TopologyScene controlRef={ref}>` with R3F mocked (per the project's "Three.js mocked in all jsdom tests" convention), then asserts `ref.current.flyTo('<id>')` calls `onSelectCluster('<id>')` and `ref.current.reset()` calls `onSelectCluster(null)` — verifying the dedup preserved the external contract. If full R3F mocking is too heavy, at minimum extend `InfraTopology.test.tsx` to assert the nav-bar buttons invoke `controlRef.flyTo`/`reset` (the public surface).
  - Item 7: extend `ArchitectureXRay.test.tsx` with an assertion that the initial render has all nodes `dim` (exercises `allDim` via the lazy useState init) and that a guardrail/system response still marks `guardrail-check` as `warning` (unchanged behavior).
  - Item 4 (only if Option A): add a `parseTopicsFromDescription`-style helper test (the script already exports helpers for this purpose).
- **Manual verification (real render, per CLAUDE.md):**
  - `npm run dev`, visit `/` (key-point tabs still link on scroll), `/altivum` (timeline + Imperatives both render, no icon gap), `/foundation` (4 CTAs identical), `/links` (both social grids identical), `/aws` (cluster nav fly-to + reset + Escape + empty-space click still move the camera; detail panel still opens via `FallbackDetail`), `/claude` (run a trace; run a blocked input to see the guardrail warning + cached replay).
  - `npm run build` end-to-end (the package's own deploy pipeline) — confirms EPUB removal and generator change don't break any build step.
- **Rollback check:** every change is on a feature branch. `git checkout -- <file>` reverts edits; the two deletions (`ClusterDetail.tsx`, EPUB dir) are recoverable via `git checkout HEAD~1 -- <path>` or `git revert` of the commit. No data migration, no env-var, no infra change — rollback is a pure git operation.

#### Risk & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Foundation CTA class string drifts during extraction (lost `min-h-[48px]`, width, or hover token) | Med | Med (broken tap target / visual) | Build the className by hand and diff against original lines 75/83/224/232; manual visual check at 3 breakpoints; keep hero-vs-bottom primary/secondary URL ordering exact. |
| Item 6 refactor changes camera behavior because `onComplete` present in fly but absent in reset is mishandled | Low | Med | Preserve the documented asymmetry (`flyToCluster` keeps `onComplete`; `resetView` omits it) verbatim; manual /aws fly+reset+Escape test; add the external-contract test. |
| Removing `EpisodeCard` branches (if Option B taken) regresses fallback render + breaks 4 unit tests | Med | High | Recommendation is to NOT change `EpisodeCard`; if change demanded, take additive Option A only. |
| `TopologyScene` dedup introduces a stale-closure / dependency-array lint error | Med | Low | Use `useCallback` with correct deps; `npx tsc --noEmit` + `npm run lint` catch it; helpers are referenced in the effect dep array. |
| `allDim()` lazy useState init mis-wired (calling `allDim()` vs passing `allDim`) | Low | Low | Pass the reference (`useState(allDim)`) for lazy init; covered by the new initial-state test and existing XRay tests. |
| heroShader comment edit (if forced to `#2E4A6B`) introduces a factual error | Med | Low | Plan recommends NOT editing; cross-checked against `@theme` tokens in `index.css`. |
| EPUB `git rm` accidentally catches an imported asset | Very Low | High | Grep confirmed zero importers; path is a self-contained dir; `npm run build` re-verifies. |
| Home `key={point.link}` collides if two entries share a link | Very Low | Low | Verified all 8 links distinct; a `routes.ts` drift would surface in `Home.integration.test.tsx`. |

#### Dependencies & Order of Operations

- Items are mutually **independent** (different files); any order works. Suggested order to front-load the safest, highest-confidence wins and isolate the one judgment call:
  1. Item 5 (EPUB delete) and Item 6.1 (delete `ClusterDetail.tsx`) — pure deletions, instant lint/tsc feedback.
  2. Item 8 (Links `SocialCard`) and Item 3 (Foundation CTAs) — local extractions, no cross-file impact.
  3. Item 1 (Home) and Item 2 (Altivum) — hoists + dedup; covered by `Home.integration.test.tsx`.
  4. Item 7 (Claude `allDim`/abort) — covered by `ArchitectureXRay.test.tsx`.
  5. Item 6.2–6.4 (TopologyScene dedup) — most behavioral; add the contract test alongside.
  6. Item 4 — DECISION gate: default is no-code-change (note in PR); only if maintainer chooses Option A, implement the generator change last (touches the build pipeline).
- Run `npm run lint && npx tsc --noEmit && npx vitest run` after each item (or at minimum after each numbered group) so a regression is attributed to one change. Final `npm run build` after all items. Item 9 (validate/commit) is strictly last.

#### Estimated Effort

- **Complexity: Medium** (mostly Low-complexity deletions and extractions; Item 6's TopologyScene dedup and Item 4's DECISION are the only Medium parts; Item 4 is recommended as no-op + note).
- **Time range: 2.5–4 hours** (≈3.5 h if Option A for Item 4 is implemented with a generator test; ≈2.5 h if Item 4 is left as a documented no-op).
- **Files affected: 8 edited + 2 deleted (`ClusterDetail.tsx`, EPUB dir) = up to 10 source paths**, plus 1–3 test files added/updated, plus optional `.gitignore` and (only under Option A) `generate-podcast-episodes.js`. `heroShader.ts` is intentionally not edited (documented rationale).

---

## WP-I: Accessibility polish

**Aggregate impact:** Medium

#### Objective

Resolve nine accessibility defects in WP-I (Medium aggregate impact) without adding any user-facing feature or changing visual design. All changes are refinement-only: correct heading hierarchy, fix redundant/misleading `alt` text, add missing ARIA relationships, restore semantic list markup, give a keyboard `role="button"` a real focus indicator, stop a streaming region from re-announcing every chunk, remove a broken/contradictory keyboard overlay, and silence decorative content from assistive technology. Each fix preserves existing layout (grid classes, typography tokens, motion gating) and stays inside the documented conventions.

#### Prerequisites

- Node 20 (`.nvmrc`); `npm ci` already run; `npm run lint`, `npx tsc --noEmit`, and `npm test` green at baseline.
- Files confirmed read at current state:
  - `src/pages/Home.tsx`, `src/components/SplitReveal.tsx` (+ `SplitReveal.test.tsx`)
  - `src/pages/About.tsx`, `src/pages/Altivum.tsx`, `src/pages/Foundation.tsx`
  - `src/components/EpisodeCard.tsx` (+ `EpisodeCard.test.tsx`)
  - `src/components/aws/InfraTopology.tsx`, `src/components/aws/TopologyScene.tsx` (+ `aws/__tests__/InfraTopology.test.tsx`)
  - `src/components/claude/PipelineNode.tsx`, `TraceResponseBubble.tsx`, `ArchitectureXRay.tsx` (+ `claude/__tests__/PipelineNode.test.tsx`, `ArchitectureXRay.test.tsx`)
  - `src/pages/Privacy.tsx`, `src/pages/NotFound.tsx`, `src/index.css` (focus-visible block lines 134–152)
- Confirmed: global focus styling lives in `src/index.css:134–143` and applies `outline: 2px solid #C5A572; outline-offset: 2px` to `a/button/input/textarea/select/[tabindex]:focus-visible`. `PipelineNode`'s inline `outline: 'none'` (line 54) suppresses it for the `<g role="button" tabIndex={0}>`.
- No new dependencies. No env, IAM, CSP, or Lambda changes.

#### Step-by-Step Implementation

**1. Home — fix h1 → h3 heading skip (item 1)**

DECISION (Home heading hierarchy). Two options:

- **Option A (recommended): promote keyPoint titles from `h3` to `h2`.** The 8 key points are the page's primary content sections under the sr-only `h1` (`Home.tsx:148`). Making them `h2` produces a correct `h1 → h2` outline, and the existing "Let's Connect" `h2` (`Home.tsx:187`) then sits at the same, correct level. Requires extending `SplitReveal`'s `as` union to include `'h2'` and changing the `as` prop on Home.
- Option B: keep `h3` and inject a visually-hidden section `h2` (e.g. "Highlights") before the tabs. This is more markup, invents a heading label not in the design, and leaves the key points one level deeper than they semantically are. Not recommended.

Proceeding with **Option A**.

- 1.1 In `src/components/SplitReveal.tsx:14`, widen the union:
  ```ts
  as?: 'h2' | 'h3' | 'p' | 'span';
  ```
  No other change needed in `SplitReveal` — `Tag` is rendered generically (`SplitReveal.tsx:72,78`), so `'h2'` flows through both the motion-disabled and animated branches.
- 1.2 In `src/pages/Home.tsx:58`, change `as="h3"` to `as="h2"` inside `renderTab`'s `SplitReveal`. The visible styling is driven by `typography.cardTitleLarge` (line 62), so the demotion is invisible. The "Let's Connect" `h2` (line 187) already exists and remains correct under the same `h1`.

**2. About — fix redundant hero alt (item 2)**

The `mpb.png` hero image (`About.tsx:35–36`) carries `alt="My Personal Biography"`, which duplicates the sr-only `h1` ("About Christian Perez - Personal Biography", line 48) and is a stylized brand wordmark, not informational.

- 2.1 In `src/pages/About.tsx:36`, set the image decorative: `alt=""`. The image is purely a typographic title graphic; the `h1` already conveys the page title to AT, so an empty `alt` removes the duplicate announcement (correct per WAI image-decision-tree for redundant text-in-image).

**3. Altivum — chamber-recognition anchor aria-label (item 3)**

The bottom-left anchor (`Altivum.tsx:224–232`) opens an external article in a new tab; its accessible name is the concatenation of two stylized spans ("Veteran Business of the Month" + "Clarksville Chamber - Dec 2025") with no new-tab/destination context.

- 3.1 In `src/pages/Altivum.tsx:224–229`, add an explicit `aria-label` to the `<a>`:
  ```tsx
  aria-label="Veteran Business of the Month — Clarksville Area Chamber of Commerce, December 2025 (opens in a new tab)"
  ```
  Keep the existing visible child spans unchanged (sighted users still see the two-line label). The `target="_blank" rel="noopener noreferrer"` already present stays. Do NOT add an icon — that would be scope creep.

**4. Foundation — semantic list for focus areas (item 4)**

The four focus areas render as a `<div>` grid of `<div>` cards (`Foundation.tsx:149–166`). Convert to `<ul>`/`<li>` while preserving grid classes so AT announces "list, 4 items".

- 4.1 In `src/pages/Foundation.tsx:149`, change the wrapper `<div className="grid ...">` to `<ul className="grid ... list-none">` (add `list-none` to suppress default markers; the visual look is unchanged). Close with `</ul>` at line 166.
- 4.2 In `src/pages/Foundation.tsx:151–164`, change each mapped card `<div key={area.ordinal} className="p-8 ...">` to `<li key={area.ordinal} className="p-8 ...">` (keep every class verbatim, including the hover/translate/group classes). Close with `</li>`.
- 4.3 Inner content (`<p>` ordinal, `<h3>` name, `<p>` description) is unchanged. The `<h3>` headings stay valid: this page already uses `h2` for the section header at line 141, so `h2 → h3` is correct.

**5. Podcast (EpisodeCard) — add aria-controls to compact accordion (item 5)**

The compact accordion button (`EpisodeCard.tsx:21–25`) has `aria-expanded` but no `aria-controls`, and the expanded panel (`EpisodeCard.tsx:66–67`) has no `id`.

- 5.1 In `src/components/EpisodeCard.tsx`, derive a stable panel id from the episode id at the top of the `isCompact` branch (after line 16, inside the component body). Use a sanitized id so arbitrary episode ids are valid HTML ids:
  ```ts
  const panelId = `episode-panel-${episode.id}`;
  ```
  `episode.id` (e.g. `ep-1`) is already a safe slug in the data; if defensiveness is wanted, `String(episode.id).replace(/[^a-zA-Z0-9_-]/g, '-')` — but the canonical ids in `generatedEpisodes.json` and the test fixture are already hyphenated slugs, so the plain template is sufficient and matches existing conventions.
- 5.2 On the `<button>` (`EpisodeCard.tsx:21–25`) add `aria-controls={panelId}`.
- 5.3 On the expanded panel `<div>` (`EpisodeCard.tsx:67`) add `id={panelId}`. The panel is conditionally rendered (`{isExpanded && (...)}`), which is valid: `aria-controls` may reference an element that is not in the DOM when collapsed; pairing it with `aria-expanded={false}` is the correct disclosure pattern. (Note for honesty: some strict validators warn that `aria-controls` should reference a present element. If we want zero validator noise, the panel could instead always render with `hidden` toggling — but that is a behavior change beyond refinement scope. Keep conditional render; it is WAI-ARIA-conformant for the disclosure pattern.)

**6. AWS (InfraTopology) — remove broken keyboard overlay (item 6, meatier)**

Current defects in `InfraTopology.tsx:98–123`:
- The overlay `<button>`s are positioned via `projectTo2D` (static `[x,y,z] → %`) but `TopologyScene` auto-rotates the camera (`TopologyScene.tsx:162,250–251`), so the invisible hit targets float over the wrong on-screen spots.
- The wrapper is `aria-hidden="true"` (line 101) yet each child sets `aria-hidden="false"` (line 108) — an invalid contradiction; an `aria-hidden` subtree cannot be re-exposed by descendants, and the focusable buttons inside it are a "focusable inside aria-hidden" violation.

DECISION (AWS overlay). Options:

- **Option A (recommended): delete the overlay layer + `projectTo2D` and rely on the already-present visible cluster nav bar (`InfraTopology.tsx:137–162`).** That nav bar is real, keyboard-focusable, visible, labeled (`{cluster.label}` + count), and already drives the same `flyTo`/`reset`/select behavior. It fully replaces the overlay's intent (keyboard access to every cluster) with a correct, visible control — strictly better for accessibility.
- Option B: keep the overlay but make positions track the live camera (subscribe to OrbitControls, project each cluster's world position through the camera every frame) and remove the `aria-hidden` contradiction. This is real new logic (per-frame projection wiring across the R3F boundary), higher risk, and duplicates the nav bar's function. Rejected as both scope-creep and redundant.

Proceeding with **Option A**.

- 6.1 In `src/components/aws/InfraTopology.tsx`, delete the entire overlay block `lines 98–123` (the comment `{/* Keyboard-accessible overlay ... */}` through its closing `</div>`).
- 6.2 Delete the now-unused `overlayButtons` memo (`InfraTopology.tsx:52–60`) and the `projectTo2D` helper + its doc comment (`InfraTopology.tsx:14–26`).
- 6.3 Remove the now-unused `useMemo` import if no other `useMemo` usage remains in the file (line 1 imports `useState, useMemo, useRef, useEffect`). After deletion, `useMemo` is unused → drop it from the import to keep lint clean. (`useState`, `useRef`, `useEffect` remain used: `selectedClusterId`, `controlRef`, `hintVisible` + the timeout effect.)
- 6.4 Leave the cluster nav bar (`lines 137–162`) and the hint/controls/detail-card untouched. No CSS changes.

**7. Claude — PipelineNode focus indicator + gate streaming aria-live (item 7)**

Part A — PipelineNode visible focus (`PipelineNode.tsx:48,54`):

The `<g role="button" tabIndex={0}>` sets inline `style={{ cursor: 'pointer', outline: 'none' }}` (line 54), which kills the global gold focus ring (`index.css:140–142`) for keyboard users. Restore a visible indicator. Because `outline-offset` on SVG `<g>` is unreliable cross-browser, drive the focus state via React state + the existing `stateStyles` stroke, rather than relying on CSS outline.

DECISION (PipelineNode focus). Options:

- **Option A (recommended): remove `outline: 'none'` and let the global CSS focus-visible ring apply.** Simplest; `[tabindex]:focus-visible` (index.css:140) already targets the `<g>`. Browsers do render `outline` on SVG elements; `outline-offset` may render flush on some engines but the ring is still clearly visible. Zero new state, smallest diff.
- Option B: keep `outline:'none'` and add a focus-driven visual (e.g. a focus ring `<rect>` or a strokeWidth bump) via `onFocus`/`onBlur` state. More robust offset control but adds state and markup — more than a refinement needs.

Proceeding with **Option A**, with a defensive enhancement that is still refinement-scoped: replace the blanket `outline: 'none'` with reliance on the global ring.

- 7.1 In `src/components/claude/PipelineNode.tsx:54`, change `style={{ cursor: 'pointer', outline: 'none' }}` to `style={{ cursor: 'pointer' }}`. This lets `index.css:140–142` paint the 2px gold ring on `:focus-visible`. (Keyboard-only ring: `:focus-visible` already excludes mouse-down focus, so click users see no ring — matches existing site behavior.)
- 7.2 Verify no inline outline override remains; the global rule does the rest. No CSS edit required.

Part B — gate `TraceResponseBubble` aria-live (`TraceResponseBubble.tsx:9–12`; consumed at `ArchitectureXRay.tsx:435–441`):

`aria-live="polite"` is set on the always-present container, so every streamed chunk (`setResponseContent(accumulated)` in the read loop, `ArchitectureXRay.tsx:297`) re-announces the partial text — a screen-reader flood.

- 7.3 Add an `isStreaming`-aware live region. In `src/components/claude/TraceResponseBubble.tsx:9–12`, make the live politeness conditional so the region announces only the settled response, not each chunk:
  ```tsx
  <div
    className="mt-4 bg-altivum-navy/30 border border-altivum-slate/30 rounded-lg p-4"
    aria-live={isStreaming ? 'off' : 'polite'}
    aria-busy={isStreaming}
  >
  ```
  `isStreaming` is already a prop (`TraceResponseBubble.tsx:3`) wired to `traceState === 'tracing'` (`ArchitectureXRay.tsx:438`). When streaming ends (`traceState` → `complete`/`error`, set at `ArchitectureXRay.tsx:330,319,341`), `aria-live` flips to `polite` and the final, complete content is announced once. `aria-busy` communicates the in-progress state during streaming. The blinking caret stays `aria-hidden` (already, line 28). This is the recommended "gate to settled response" fix.

**8. Privacy — silence manual bullet glyphs (item 8)**

Four `<ul>` blocks use `<span className="text-altivum-gold mr-3">•</span>` as manual markers (`Privacy.tsx:72, 76, 80, 105, 109, 113, 117, 121, 137, 141, 145, 149, 199, 203, 207, 211, 227, 231, 235, 239`). AT may read each "•" as "bullet". The prompt cites the four representative pairs (72,104,198,226); the fix applies to every such span in the file.

DECISION (Privacy bullets). Options:

- **Option A (recommended): add `aria-hidden="true"` to each `•` span.** Smallest, most targeted, zero visual change, preserves the exact custom gold-bullet styling and the existing `flex items-start` layout.
- Option B: drop the manual spans and use native `list-disc list-inside marker:text-altivum-gold` on the `<ul>`. Cleaner semantically but changes the visual marker rendering and the `flex` item structure (each `<li>` is currently `flex items-start` with a separate `<span>` content wrapper), risking layout regressions across ~20 list items. Rejected to stay refinement-only.

Proceeding with **Option A**.

- 8.1 In `src/pages/Privacy.tsx`, on every `<span className="text-altivum-gold mr-3">•</span>` add `aria-hidden="true"` →
  ```tsx
  <span className="text-altivum-gold mr-3" aria-hidden="true">•</span>
  ```
  Apply with a single find-and-replace across the file (the span string is identical at every occurrence, so `replace_all` on the exact `old_string` `<span className="text-altivum-gold mr-3">•</span>` is safe and covers all bullets, not just the four cited lines).

**9. 404 — hide decorative "404" glyph (item 9)**

The oversized "404" (`NotFound.tsx:18–28`) is a decorative numeral; the real page title is the `h1` "Page Not Found" (line 32). AT currently announces "404".

- 9.1 In `src/pages/NotFound.tsx:18`, add `aria-hidden="true"` to the `<span className="text-altivum-gold opacity-20" ...>`. The `h1` already provides the accessible page heading, so hiding the glyph removes the redundant/decorative announcement.

#### File & Code Changes

| Action | File Path | Description |
|---|---|---|
| Edit | `/Users/cperez/dev/altivum-dev/thechrisgrey/src/components/SplitReveal.tsx` | Widen `as` union (line 14) to `'h2' \| 'h3' \| 'p' \| 'span'` (item 1). |
| Edit | `/Users/cperez/dev/altivum-dev/thechrisgrey/src/pages/Home.tsx` | Change `SplitReveal` `as="h3"` → `as="h2"` (line 58) so key points are `h2` under the sr-only `h1` (item 1). |
| Edit | `/Users/cperez/dev/altivum-dev/thechrisgrey/src/pages/About.tsx` | Set hero `mpb.png` `alt=""` (line 36), decorative — removes duplicate of sr-only `h1` (item 2). |
| Edit | `/Users/cperez/dev/altivum-dev/thechrisgrey/src/pages/Altivum.tsx` | Add `aria-label` with destination + "(opens in a new tab)" to chamber-recognition `<a>` (lines 224–229) (item 3). |
| Edit | `/Users/cperez/dev/altivum-dev/thechrisgrey/src/pages/Foundation.tsx` | Convert focus-areas grid `<div>`→`<ul className="grid ... list-none">` and card `<div>`→`<li>` (lines 149–166), classes preserved (item 4). |
| Edit | `/Users/cperez/dev/altivum-dev/thechrisgrey/src/components/EpisodeCard.tsx` | Add `panelId` const, `aria-controls={panelId}` on compact button (line ~24), `id={panelId}` on expanded panel (line ~67) (item 5). |
| Edit | `/Users/cperez/dev/altivum-dev/thechrisgrey/src/components/aws/InfraTopology.tsx` | Delete overlay block (98–123), `overlayButtons` memo (52–60), `projectTo2D` + comment (14–26); drop unused `useMemo` import (item 6). |
| Edit | `/Users/cperez/dev/altivum-dev/thechrisgrey/src/components/claude/PipelineNode.tsx` | Remove inline `outline: 'none'` (line 54) so global `:focus-visible` gold ring shows on the `role="button"` `<g>` (item 7A). |
| Edit | `/Users/cperez/dev/altivum-dev/thechrisgrey/src/components/claude/TraceResponseBubble.tsx` | Gate `aria-live` to `isStreaming ? 'off' : 'polite'` + add `aria-busy={isStreaming}` (lines 9–12) (item 7B). |
| Edit | `/Users/cperez/dev/altivum-dev/thechrisgrey/src/pages/Privacy.tsx` | Add `aria-hidden="true"` to every `•` marker span (replace_all) (item 8). |
| Edit | `/Users/cperez/dev/altivum-dev/thechrisgrey/src/pages/NotFound.tsx` | Add `aria-hidden="true"` to decorative "404" `<span>` (line 18) (item 9). |
| Edit (test) | `/Users/cperez/dev/altivum-dev/thechrisgrey/src/components/SplitReveal.test.tsx` | Add a case rendering `as="h2"` to lock the widened union (item 1). |
| Edit (test) | `/Users/cperez/dev/altivum-dev/thechrisgrey/src/components/EpisodeCard.test.tsx` | Assert compact button `aria-controls` matches expanded panel `id` (item 5). |
| Edit (test) | `/Users/cperez/dev/altivum-dev/thechrisgrey/src/components/aws/__tests__/InfraTopology.test.tsx` | When `use3D` true, assert visible cluster nav buttons render and no `aria-hidden` overlay buttons exist (item 6). |
| Edit (test) | `/Users/cperez/dev/altivum-dev/thechrisgrey/src/components/claude/__tests__/PipelineNode.test.tsx` | Assert the `role="button"` `<g>` style no longer contains `outline: none` (item 7A). |

#### Testing & Validation

Unit/integration tests (Vitest + Testing Library; 3D/GSAP mocked per existing setup):

- **SplitReveal (item 1):** add `it('renders as h2 when as="h2"')` → `render(<SplitReveal as="h2">Heading</SplitReveal>)` and assert `container.querySelector('h2')` non-null. Existing `as="h3"` and reduced-motion/prerender cases must still pass.
- **Home (item 1):** existing `src/__tests__/integration/Home.integration.test.tsx` covers the page render. Add (or extend) an assertion that key-point titles are now `h2` and the document has exactly one `h1` (the sr-only one). Run the whole integration file to confirm no regression in the 8-key-point rendering.
- **EpisodeCard (item 5):** add a compact-variant test: after expanding, read `screen.getByRole('button')` `aria-controls` and assert it equals the expanded panel's `id` (query the panel via that id). Keep existing aria-expanded toggle tests.
- **InfraTopology (item 6):** the current test mocks `TopologyScene` and only exercises the fallback path. Add a `use3D`-true case (`mockedCheckWebGL.mockReturnValue(true)`, `isPrerender` false, `useMediaQuery` true) asserting: (a) cluster nav buttons render (one `getByRole('button', { name: /cluster.label/ })` per cluster, e.g. assert `screen.getAllByRole('button').length` ≥ `clusters.length`), and (b) `container.querySelector('[aria-hidden="false"]')` is null (overlay gone). This is the live-DOM check that the broken layer is removed.
- **PipelineNode (item 7A):** add `it('does not suppress the focus outline')` → render, get the `role="button"` element, assert its inline `style.outline` is not `'none'` (e.g. `expect(button.getAttribute('style')).not.toMatch(/outline:\s*none/)`). Keep existing Enter/Space tests.
- **ArchitectureXRay / TraceResponseBubble (item 7B):** the XRay test currently mocks `TraceResponseBubble` to `null`, so add a focused unit test for `TraceResponseBubble` itself: render with `isStreaming` true → assert container `aria-live="off"` and `aria-busy="true"`; render with `isStreaming` false → assert `aria-live="polite"` and `aria-busy="false"`. (New file `src/components/claude/__tests__/TraceResponseBubble.test.tsx`, or co-located — match repo convention of `__tests__/` under `claude/`.)
- **Privacy / NotFound / Altivum / Foundation / About:** no existing page-level tests; rely on lint + tsc + manual axe pass below (adding full page tests for these is out of WP scope, but a render-smoke test could be added if desired — flag, do not auto-expand scope).

Commands:
```bash
npm run lint
npx tsc --noEmit
npm test
npm test -- SplitReveal EpisodeCard InfraTopology PipelineNode TraceResponseBubble
```

Manual verification (run the real thing per repo policy):
```bash
npm run dev
```
- Keyboard-tab through `/claude` pipeline nodes → confirm a visible gold ring on each focused node (item 7A). Trigger a trace with a screen reader (VoiceOver) → confirm the partial text is NOT announced per chunk and the final answer is announced once (item 7B).
- On `/aws` (desktop, WebGL on): Tab through controls → confirm the cluster nav bar buttons are reachable/operable and there are no phantom focus stops floating over the canvas (item 6).
- VoiceOver rotor / headings on `/` → `h1` then `h2`s, no `h3` skip (item 1). On `/about` the hero wordmark is silent; the `h1` is announced (item 2). On `/altivum` the chamber link announces the full label + new-tab context (item 3). On `/foundation` the focus areas announce as "list, 4 items" (item 4). On `/podcast` expand a compact episode → SR reports the controlled panel (item 5). On `/privacy` no "bullet/bullet/bullet" spam (item 8). On a bad URL (404) the "404" glyph is silent, "Page Not Found" `h1` is announced (item 9).
- Build-time prerender sanity: `npm run build` then inspect `dist/index.html` and `dist/about/index.html` — Home key points still present as `h2` text (SplitReveal prerender branch), About hero `alt=""` present.
- Optional automated a11y: run the browser devtools Lighthouse/axe accessibility audit on `/`, `/about`, `/altivum`, `/foundation`, `/podcast`, `/claude`, `/aws`, `/privacy`, `/404` and confirm the heading-order, aria-hidden-focus, and aria-allowed-attr findings clear.

Rollback check: every change is an isolated attribute/markup/style edit; `git revert` of the WP-I commit fully restores prior behavior. The InfraTopology deletion is the only structural change — revert restores `projectTo2D`, the memo, and the overlay block intact. No data, env, or infra state to unwind.

#### Risk & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Widening `SplitReveal.as` breaks an existing call site | Low | Low | Only Home uses `as`; union is a superset (adds `'h2'`), no existing value removed. tsc covers it. |
| `aria-controls` references a not-present element when accordion collapsed (validator noise) | Med | Low | WAI disclosure pattern allows this with `aria-expanded`; documented in step 5.3. Tested only in expanded state. |
| Removing InfraTopology overlay drops keyboard access to clusters | Low | Med | The visible cluster nav bar (lines 137–162) already provides full keyboard select/flyTo for every cluster; new test asserts those buttons render. |
| Deleting `projectTo2D`/`overlayButtons` leaves an unused import → lint failure | Med | Low | Step 6.3 explicitly drops `useMemo` from the import; `npm run lint` gate confirms. |
| Removing inline `outline:'none'` shows a ring for mouse users too | Low | Low | Global rule is `:focus-visible` only (index.css:140), which excludes mouse focus — matches sitewide behavior. |
| `aria-live="off"` during stream hides progress from SR entirely | Low | Low | `aria-busy={isStreaming}` signals in-progress; final content announced once when politeness flips to `polite`. This is the intended "settled response" behavior. |
| `alt=""` on About hero hides meaningful content if image were informational | Low | Low | Image is a stylized title wordmark; sr-only `h1` carries the same text — empty alt is correct per WAI decision tree. |
| Privacy `replace_all` over-matches | Low | Low | The `old_string` is the exact, unique bullet-span markup; only the 20 marker spans match. Verified by reading all occurrences. |
| Foundation `<div>`→`<li>` alters layout via default list styling | Low | Low | `list-none` added to `<ul>`; grid/card classes preserved verbatim; `<li>` is a block box like the `<div>` it replaces. Visual diff check on `/foundation`. |

#### Dependencies & Order of Operations

1. **Item 1 first** (`SplitReveal.tsx` union → then `Home.tsx as="h2"`): the Home edit depends on the widened union, or tsc fails. Do them together.
2. Items 2, 3, 4, 5, 8, 9 are fully independent page/component attribute edits — any order.
3. **Item 6** (InfraTopology) is self-contained but multi-line; do the three deletions + import cleanup as one atomic edit, then run lint before moving on.
4. **Item 7A** (PipelineNode) and **7B** (TraceResponseBubble) are independent of each other and of all else.
5. Update tests alongside their target (SplitReveal, EpisodeCard, InfraTopology, PipelineNode, new TraceResponseBubble) — TDD-friendly: write/adjust the assertion, then make the source change.
6. Final gate: `npm run lint && npx tsc --noEmit && npm test`, then `npm run dev` manual a11y pass, then `npm run build` prerender sanity. No deploy step in this WP unless the user requests it (push to `main` triggers Amplify).

#### Estimated Effort

Complexity **Low–Med** (item 6 is the only structural change; the rest are attribute/markup one-liners) · Time **2.5–4 hours** including test updates and a real screen-reader/keyboard verification pass · **Files affected: 16** (11 source: SplitReveal, Home, About, Altivum, Foundation, EpisodeCard, InfraTopology, PipelineNode, TraceResponseBubble, Privacy, NotFound; 5 test: SplitReveal, EpisodeCard, InfraTopology, PipelineNode, + new TraceResponseBubble).

---

## WP-J: Consistency, tokens & UX residuals

**Aggregate impact:** Low/Medium

#### Objective

Resolve seven low/medium-impact consistency, token, and UX residuals across six pages plus two shared components, with zero new features. Every change either routes raw values through existing SSOT (`typography.ts`, `SOCIAL_LINKS`, the live `GUARDRAIL_VERSION`), repairs a real correctness/consistency drift (stale guardrail version, X-handle divergence, missing listen-link row, always-rendered consent button), or hardens an existing pattern (iframe `sandbox`, normalized typography classes/quotes). The work must preserve the established conventions: `style={typography.X}`, `altivum-*` tokens, `italic` Tailwind class (already the codebase norm), no emojis, and `<a>` only for external/tel/mailto links.

#### Prerequisites

- Repo on a fresh branch off `main` (current branch is `main`; branch before committing).
- `npm install` already run; able to run `npm run lint`, `npx tsc --noEmit`, `npx vitest run`.
- One **blocking owner decision** before touching `Links.tsx` (Item 6): confirm the correct personal X handle — `x.com/thechrisgrey` (the `SOCIAL_LINKS.twitter` constant) vs `x.com/x_thechrisgrey` (the live hardcoded value on the page). Do not guess; the URL points at a real third-party account.
- One **LIVE verification gate** for Item 3 (SpotifyFacade `sandbox`): after adding `sandbox`, the Spotify embed must be confirmed to still load and play in a real browser. Spotify's embed iframe runs first-party scripts and (depending on track vs. show) may require popups/storage; a too-restrictive `sandbox` can silently break playback while tests stay green. This cannot be validated by jsdom.

#### Step-by-Step Implementation

**1. About — italic via inline style → Tailwind `italic` class (Item 1)**

1.1 In `src/pages/About.tsx:74`, replace the inline-style italic span:
- From: `<span className="text-white" style={{ fontStyle: 'italic' }}>Beyond the Assessment</span>`
- To: `<span className="text-white italic">Beyond the Assessment</span>`

1.2 Rationale check: `italic` is already the established codebase pattern (`Home.tsx:76`, `Altivum.tsx:31/355`, `BeyondTheAssessment.tsx:60/80`, `NodeDetailPanel.tsx:100`). This is a pure consistency fix; no visual change (`font-style: italic` ≡ `.italic`). The span carries no `style={typography.X}`, so there is no token to preserve.

**2. Altivum — route branch cards / HQ node through typography tokens + intentional corner offset (Item 2)**

2.1 HQ node (`src/pages/Altivum.tsx:255-256`): the `<h3>` and `<p>` use raw `text-lg` / `text-sm`. Route through tokens while preserving the existing visual intent (uppercase tracked label + small caption):
- `:255` `<h3 className="text-altivum-gold font-semibold tracking-widest uppercase text-lg">Altivum HQ</h3>` → `<h3 className="text-altivum-gold font-semibold tracking-widest uppercase" style={typography.cardTitleSmall}>Altivum HQ</h3>`
- `:256` `<p className="text-altivum-silver text-sm mt-2">Strategic Core</p>` → `<p className="text-altivum-silver mt-2" style={typography.smallText}>Strategic Core</p>`

2.2 Branch card titles (`:266`, `:288`, `:305`): the three `<h4 ... text-xl ...>` headings → token. Apply to all three identically:
- `<h4 className="text-white text-xl mb-3 group-hover:text-altivum-gold transition-colors">` → `<h4 className="text-white mb-3 group-hover:text-altivum-gold transition-colors" style={typography.cardTitleSmall}>`

2.3 Branch card body copy (`:267-269`, `:289-291`, `:306-308`): the three `<p ... text-sm leading-relaxed mb-4>` → token. `leading-relaxed` is dropped because `typography.bodyText` already sets `lineHeight: 1.5`:
- `<p className="text-altivum-silver text-sm leading-relaxed mb-4">` → `<p className="text-altivum-silver mb-4" style={typography.bodyText}>`

2.4 Branch card bullet lists (`:270`, `:292`, `:309`): the `<ul ... text-xs ...>` → token. Keep `space-y-1`, border, and padding utilities; add `style={typography.smallText}` and drop `text-xs` (smallText is 12px→14px):
- `<ul className="text-xs text-altivum-silver/70 space-y-1 border-t border-altivum-slate/20 pt-3">` → `<ul className="text-altivum-silver/70 space-y-1 border-t border-altivum-slate/20 pt-3" style={typography.smallText}>`

2.5 **Boundary note (do not exceed):** the bullet `<li>` items and the inline `<a>` brand links keep their existing classes — they inherit the `<ul>`'s font sizing. Do not restyle the dot spans or links; that drifts beyond the flagged "branch cards/HQ node" scope.

2.6 Magic badge offset (`:215` and `:228`): both decorations use `absolute bottom-50` (resolves to `12.5rem`/200px in Tailwind v4's spacing scale), which is an arbitrary mid-section position on a `min-h-screen` hero (`:199`), not a corner. The comments say "Bottom Right" / "Bottom Left" but `bottom-50` does not place them at the bottom. Replace with an intentional, symmetric corner offset matching the existing horizontal inset (`right-8` / `left-8` = `2rem`):
- `:215` `<div className="absolute bottom-50 right-8 z-20">` → `<div className="absolute bottom-8 right-8 z-20">`
- `:228` `className="absolute bottom-50 left-8 z-20 ..."` → `className="absolute bottom-8 left-8 z-20 ..."`

2.7 **Verify visually** (manual): both badges should sit at the true bottom corners of the hero, symmetric with their 2rem horizontal inset, not floating mid-screen. Confirm they don't overlap the centered logo on small viewports (the logo is vertically centered; `bottom-8` clears it). If overlap occurs on very short viewports, fall back to `bottom-6 sm:bottom-8` — but only if the manual check shows a collision.

**3. Podcast — featured "Now Playing" listen-link row + SpotifyFacade sandbox (Item 3)**

3.1 Add the listen-link row to the featured details card. The featured episode's `links` object is populated (`generatedEpisodes.json` ep0 has `youtube`, `spotify`, `apple`), and the type `PodcastEpisode.links` supports all three. Reuse the exact markup/ordering/colors `EpisodeCard`'s non-compact variant uses (`EpisodeCard.tsx:234-268`: Spotify → Apple → YouTube) for visual consistency, plus the platform brand icons already imported there.

3.2 In `src/pages/Podcast.tsx`, add the icon import at the top (mirroring `EpisodeCard.tsx:5`):
- `import { SpotifyIcon, ApplePodcastIcon, YouTubeIcon } from '../components/PodcastPlatformIcons';`

3.3 In the featured details card (`Podcast.tsx:183-185`), after the description `<p>`, insert a listen-link row guarded per-link (so a missing link omits its chip):
```tsx
              <p className="text-altivum-silver" style={typography.bodyText}>
                {featuredEpisode.description}
              </p>
              {/* Listen Links (mirror EpisodeCard ordering/styling) */}
              {(featuredEpisode.links.spotify || featuredEpisode.links.apple || featuredEpisode.links.youtube) && (
                <div className="flex flex-wrap gap-3 mt-6">
                  {featuredEpisode.links.spotify && (
                    <a
                      href={featuredEpisode.links.spotify}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-[#1DB954]/10 text-[#1DB954] rounded-full text-sm font-medium hover:bg-[#1DB954]/20 transition-colors"
                    >
                      <SpotifyIcon className="w-4 h-4" />
                      Spotify
                    </a>
                  )}
                  {featuredEpisode.links.apple && (
                    <a
                      href={featuredEpisode.links.apple}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-[#872EC4]/10 text-[#872EC4] rounded-full text-sm font-medium hover:bg-[#872EC4]/20 transition-colors"
                    >
                      <ApplePodcastIcon className="w-4 h-4" />
                      Apple
                    </a>
                  )}
                  {featuredEpisode.links.youtube && (
                    <a
                      href={featuredEpisode.links.youtube}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-[#FF0000]/10 text-[#FF0000] rounded-full text-sm font-medium hover:bg-[#FF0000]/20 transition-colors"
                    >
                      <YouTubeIcon className="w-4 h-4" />
                      YouTube
                    </a>
                  )}
                </div>
              )}
```
These are external links, so `<a target="_blank" rel="noopener noreferrer">` is correct per conventions (not `ViewTransitionLink`). `min-h-[48px]` is not required to match the EpisodeCard precedent (same chips there are `py-2`), so do not add it — keep visual parity with the existing chips.

3.4 **Boundary note:** Do NOT refactor the shared chip markup into a new component. That is a worthwhile DRY improvement but is a structural change beyond this refinement package; matching `EpisodeCard`'s inline markup is the correct conservative scope. (Optionally record the duplication as a follow-up idea in `docs/ideas-to-consider.md` — out of scope to implement here.)

3.5 SpotifyFacade `sandbox` (`src/components/SpotifyFacade.tsx:13-22`): add a `sandbox` attribute to the iframe, mirroring `YouTubeFacade.tsx:30`. Spotify's embed needs scripts, same-origin, popups (open-in-app / open-in-Spotify), and presentation; it also needs `allow-popups-to-escape-sandbox` for the open-in-app handoff. Start from the YouTube set and add the two popup-escape/forms tokens Spotify's player uses:
```tsx
      <iframe
        src={embedUrl}
        width="100%"
        height="352"
        frameBorder="0"
        allowFullScreen
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox"
        title={title}
        className="rounded-xl"
      />
```

3.6 **LIVE-VERIFY (mandatory gate, per project rules):** run `npm run dev`, open `/podcast`, click the Spotify facade, and confirm the embedded player (a) renders the show, and (b) actually plays audio / the play control works. If playback breaks, do NOT ship the `sandbox` as-is — incrementally relax (the most likely culprits are missing `allow-forms` for the email-capture UI, or `allow-storage-access-by-user-activation`). If no safe `sandbox` value preserves playback, the correct outcome is to **revert the SpotifyFacade sandbox change and document why** (Spotify embed is incompatible with `sandbox`), keeping the rest of the package. Report the observed result honestly — "tests pass" ≠ "Spotify still plays."

**4. BTA — CTA hover token + quote/apostrophe normalization (Item 4)**

4.1 CTA hover color (`src/pages/BeyondTheAssessment.tsx:94`): replace the off-palette `hover:bg-amber-400` with the brand token at reduced opacity (matching the codebase's CTA convention, e.g. `hover:bg-altivum-gold/90`):
- `... bg-altivum-gold hover:bg-amber-400 text-altivum-dark font-bold ...` → `... bg-altivum-gold hover:bg-altivum-gold/90 text-altivum-dark font-bold ...`

4.2 Quote/apostrophe normalization. The file mixes straight ASCII quotes with curly punctuation:
- `:61` decorative quote uses straight `"…"` (`"Control the controllable. Influence the variables."`).
- `:75` uses curly `"…"` quotes AND a curly apostrophe `You’ve`.
- `:78` uses curly em-dash context + curly apostrophe `wasn’t`.
- `:81` uses straight `"…"` quotes (`"Do not make the catastrophic mistake…"`).

Normalize to a single consistent style. **Recommendation: curly typographic quotes/apostrophes everywhere** (matches the already-curly `:75`/`:78` body prose and reads as intentional editorial typography). Concretely:
- `:61` `"Control the controllable. Influence the variables."` → `“Control the controllable. Influence the variables.”`
- `:81` `"Do not make the catastrophic mistake of forgetting the following: you are always being assessed."` → `“Do not make the catastrophic mistake of forgetting the following: you are always being assessed.”`
- Leave `:75` and `:78` as-is (already curly), but verify no stray straight apostrophes remain in those lines.

4.3 **Alternative (if owner prefers ASCII):** normalize the other direction — convert `:75`/`:78` curly marks to straight `"` and `'`. Recommendation stands with curly (higher editorial polish, and JSX text renders both identically with no escaping needed). Either way the rule is: one style across all four lines. Pick one; do not leave the mix.

4.4 **Boundary note:** Do not touch the `<em>` on `:84` (`<em>Beyond the Assessment</em>`) — that is correct semantic emphasis, not a quote/apostrophe.

**5. Claude — Architecture X-Ray stale guardrail version (Item 5)**

5.1 In `src/data/architectureNodes.ts:66`, the `guardrail-check` node config shows `'Version': '2'`. The live Lambda (`lambda/chat-stream/index.mjs:55`) uses `GUARDRAIL_VERSION = "5"`, and `CLAUDE.md` documents the live guardrail as `5kofhp46ssob` v5. Update the displayed version:
- `'Version': '2',` → `'Version': '5',`

5.2 Add a source-of-truth comment immediately above the `config` block (or above the `'Version'` line) so this display value is kept in sync deliberately. Match the file's existing terse comment style (it currently has none in this object; add a single clarifying line):
```ts
    config: {
      'Guardrail ID': '5kofhp46ssob',
      // Keep in sync with GUARDRAIL_VERSION in lambda/chat-stream/index.mjs (live: v5).
      'Version': '5',
      'Filters': 'PROMPT_ATTACK, HATE, SEXUAL, VIOLENCE, MISCONDUCT',
      'Denied Topics': 'Code assistance, general trivia, other public figures',
    },
```

5.3 **Boundary note / honest limitation:** This is a *display string*, not wired to the Lambda. A real drift-guard would parse `index.mjs` and assert equality (like `validation-drift.test.mjs` does for `VALID_PATHS`). That is a genuinely valuable addition but is **new test infrastructure beyond a refinement** — flag it as a recommended follow-up, do not build it in this package. The comment is the in-scope mitigation. (If the reviewer wants the drift test, treat it as a separate work item.)

**6. Links — source URLs from `SOCIAL_LINKS` + resolve X-handle drift (Item 6) — DECISION REQUIRED**

6.1 **DECISION (blocking, owner input required): which personal X handle is correct?**
- **Option A — `x.com/thechrisgrey`** (the `SOCIAL_LINKS.twitter` constant, `links.ts:9`). The site's brand is `@thechrisgrey` everywhere (nav, hero eyebrow `Links.tsx:83`, all other socials). This is almost certainly the intended handle; `x_thechrisgrey` looks like a typo/placeholder.
- **Option B — `x.com/x_thechrisgrey`** (the current live page value, `Links.tsx:43`). Only correct if the owner genuinely registered that handle.
- **Recommendation: Option A.** Confirm with the owner first (it links to a real external account — shipping the wrong one sends visitors to the wrong/nonexistent profile). If owner confirms `x_thechrisgrey` is real, update the *constant* instead (so SSOT reflects reality) rather than diverging the page again.

6.2 After the handle is confirmed, source the personal-socials URLs from `SOCIAL_LINKS` (it is already imported at `Links.tsx:5` but only used for `linkedin` at `:44`). Update the hardcoded `url:` values in the `personalSocials` array (`:38-47`) to reference the constant where a matching key exists. Mapping:
- `:38` AWS Builder `'https://builder.aws.com/profile'` → `SOCIAL_LINKS.awsBuilder`
- `:39` Substack `'https://substack.com/@thechrisgrey'` → `SOCIAL_LINKS.substack`
- `:40` Linktree `'https://linktr.ee/thechrisgrey'` → `SOCIAL_LINKS.linktree`
- `:41` ASU `'https://search.asu.edu/profile/3714457'` → `SOCIAL_LINKS.asu`
- `:42` Facebook `'https://www.facebook.com/thechrisgrey'` → `SOCIAL_LINKS.facebook`
- `:43` X `'https://x.com/x_thechrisgrey'` → `SOCIAL_LINKS.twitter` (after 6.1 resolves the handle)
- `:44` LinkedIn → already `SOCIAL_LINKS.linkedin` (no change)
- `:45` GitHub `'https://github.com/AltivumInc-Admin'` → `SOCIAL_LINKS.github`
- `:46` DEV Community `'https://dev.to/thechrisgrey'` → `SOCIAL_LINKS.devto`
- `:47` Email `'mailto:christian.perez@altivum.ai'` → `SOCIAL_LINKS.email`

6.3 Company socials (`:51-55`) — also source from the company keys in `SOCIAL_LINKS` for the same SSOT consistency (these don't currently drift, but routing them through the constant prevents future drift and is the stated intent "source all URLs from SOCIAL_LINKS"):
- `:51` Facebook `'https://www.facebook.com/profile.php?id=61576915349985'` → `SOCIAL_LINKS.altivumFacebook`
- `:52` X `'https://x.com/AltivumAI'` → `SOCIAL_LINKS.altivumTwitter`
- `:53` LinkedIn `'https://www.linkedin.com/company/altivuminc'` → `SOCIAL_LINKS.altivumLinkedIn`
- `:54` YouTube `'https://www.youtube.com/@AltivumPress'` → `SOCIAL_LINKS.altivumYouTube`
- `:55` Email `'mailto:info@altivum.ai'` → `SOCIAL_LINKS.altivumEmail`

6.4 **Handle text vs URL:** the `handle:` display strings (`@thechrisgrey`, `@x_thechrisgrey` at `:43`) are display-only labels, not in `SOCIAL_LINKS`. After 6.1, update the X `handle:` label to match the confirmed URL (e.g. `'@thechrisgrey'` if Option A). Keep other `handle` labels as-is.

6.5 **Boundary note:** The `websites` array (`:10-35`) overlaps `SOCIAL_LINKS.altivum`/`altivumLogic`/`vetroi` but also has Elo (which has its own key only via product subdomains) and carries `description`/`category` metadata not in the constant. Routing `websites` URLs through the constant is in the spirit of the item, but the **flagged drift is specifically the personal X handle**; do the `personalSocials` + `companySocials` sourcing (the explicit "bypassed import" the item names) and treat `websites` as optional. Recommendation: also map the three `websites` URLs that have constants (`altivum`→`SOCIAL_LINKS.altivum`, `Altivum Logic`→`SOCIAL_LINKS.altivumLogic`, `VetROI`→`SOCIAL_LINKS.vetroi`) for completeness, leaving Elo's literal URL (no exact constant) — but do not invent new constant keys (that is scope creep into `links.ts`).

**7. Privacy — gate consent-reset button + add WebPage schema (Item 7)**

7.1 Gate the "Reset analytics preference" button (`src/pages/Privacy.tsx:182-189`) so it only renders when PostHog is actually configured AND the visitor has granted consent — there is nothing to reset otherwise, and the button is meaningless/dead when PostHog is absent or consent was never granted/was denied.

7.2 Add imports (`Privacy.tsx:1-4` area):
- `import { getConsent } from '../utils/consent';`
- `import { isPostHogConfigured } from '../utils/posthog';`
- Add `buildWebPageSchema` to the existing schemas import (currently none imported in this file — add `import { buildWebPageSchema } from '../utils/schemas';`).

7.3 Compute visibility at the top of the component body (`Privacy.tsx:6-13` area). Because consent lives in `localStorage`, compute it in render (the page is client-rendered; prerender will simply not render the button, which is correct — the button needs the live browser state):
```tsx
const Privacy = () => {
  const lastUpdated = 'June 14, 2026';
  const canResetConsent = isPostHogConfigured() && getConsent() === 'granted';

  const resetAnalyticsPreference = () => {
    clearConsent();
    disablePostHog();
    window.location.reload();
  };
```

7.4 Gate the button JSX (`Privacy.tsx:182-189`):
```tsx
              {canResetConsent && (
                <button
                  type="button"
                  onClick={resetAnalyticsPreference}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 border border-altivum-gold/40 text-altivum-gold text-sm rounded-md hover:bg-altivum-gold/10 active:scale-[0.98] transition-all duration-200 touch-manipulation focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-altivum-gold focus-visible:outline-offset-2"
                >
                  <span className="material-icons text-base" aria-hidden="true">tune</span>
                  Reset analytics preference
                </button>
              )}
```

7.5 **Copy coherence check:** the paragraph at `:175-181` ends "...You can withdraw your consent at any time:" with a trailing colon that introduces the button. When the button is hidden (no consent granted), that dangling colon reads oddly. Recommendation: change the trailing `":"` to a `"."` (`...withdraw your consent at any time.`) so the sentence stands alone whether or not the button renders. This is the minimal in-scope copy fix that keeps the gated state coherent; it does not alter meaning.

7.6 Add the page-level WebPage schema to the SEO block (`Privacy.tsx:17-25`) via the `structuredData` prop (Privacy currently passes none). Match the breadcrumbs already declared:
```tsx
      <SEO
        title="Privacy Policy"
        description="Privacy policy for thechrisgrey.com - how we collect, use, and protect your personal information."
        url="https://thechrisgrey.com/privacy"
        breadcrumbs={[
          { name: "Home", url: "https://thechrisgrey.com" },
          { name: "Privacy Policy", url: "https://thechrisgrey.com/privacy" }
        ]}
        structuredData={[
          buildWebPageSchema({
            name: "Privacy Policy",
            description: "Privacy policy for thechrisgrey.com - how we collect, use, and protect your personal information.",
            url: "https://thechrisgrey.com/privacy",
            breadcrumbs: [
              { name: "Home", url: "https://thechrisgrey.com" },
              { name: "Privacy Policy", url: "https://thechrisgrey.com/privacy" }
            ]
          })
        ]}
      />
```
`buildWebPageSchema` accepts exactly `{ name, description, url, breadcrumbs? }` (`schemas.ts:221-242`); passing breadcrumbs makes it emit the `breadcrumb` `@id` reference.

7.7 **Optional item (explicitly "acceptable as-is" per the package):** the `window.location.reload()` in `resetAnalyticsPreference` (`:12`) is heavy-handed but correct, and the full reload also re-evaluates `canResetConsent` so the button self-hides after reset. **Recommendation: leave the reload as-is.** A reactive re-show (lifting consent into state / a `useSyncExternalStore`) is a behavior change, not a refinement — do not implement it in this package.

#### File & Code Changes

| Action | File Path | Description |
|---|---|---|
| Edit | `/Users/cperez/dev/altivum-dev/thechrisgrey/src/pages/About.tsx` | L74: `style={{ fontStyle: 'italic' }}` → Tailwind `italic` class. |
| Edit | `/Users/cperez/dev/altivum-dev/thechrisgrey/src/pages/Altivum.tsx` | L255-256, L266/288/305, L267-308 (×3), L270/292/309 (×3): route HQ node + branch card titles/body/lists through `typography.cardTitleSmall`/`bodyText`/`smallText`, drop redundant `text-*`/`leading-relaxed`. L215 & L228: `bottom-50` → `bottom-8` (intentional corner offset). |
| Edit | `/Users/cperez/dev/altivum-dev/thechrisgrey/src/pages/Podcast.tsx` | Add `PodcastPlatformIcons` import; insert Spotify/Apple/YouTube listen-link row (per-link guarded) into the featured "Now Playing" details card after L185 description. |
| Edit | `/Users/cperez/dev/altivum-dev/thechrisgrey/src/components/SpotifyFacade.tsx` | L13-22: add `sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox"` to the iframe. **LIVE-VERIFY playback before commit.** |
| Edit | `/Users/cperez/dev/altivum-dev/thechrisgrey/src/pages/BeyondTheAssessment.tsx` | L94: `hover:bg-amber-400` → `hover:bg-altivum-gold/90`. L61 & L81: straight quotes → curly to match L75/L78 (single consistent style). |
| Edit | `/Users/cperez/dev/altivum-dev/thechrisgrey/src/data/architectureNodes.ts` | L66: `'Version': '2'` → `'5'`; add SSOT comment pointing at `lambda/chat-stream/index.mjs` `GUARDRAIL_VERSION`. |
| Edit | `/Users/cperez/dev/altivum-dev/thechrisgrey/src/pages/Links.tsx` | L43: fix X handle (URL + label) per owner decision; route `personalSocials` + `companySocials` (and optionally the 3 matching `websites`) URLs through `SOCIAL_LINKS`. |
| Edit (conditional) | `/Users/cperez/dev/altivum-dev/thechrisgrey/src/constants/links.ts` | Only if owner confirms `x_thechrisgrey` is the real handle: update `twitter` (L9) to reflect reality (keeps SSOT correct). Otherwise no change. |
| Edit | `/Users/cperez/dev/altivum-dev/thechrisgrey/src/pages/Privacy.tsx` | Add `getConsent`/`isPostHogConfigured`/`buildWebPageSchema` imports; compute `canResetConsent`; gate the reset button (L182-189); change trailing `:`→`.` on L181 copy; add `buildWebPageSchema` to SEO `structuredData`. |
| Edit (test) | `/Users/cperez/dev/altivum-dev/thechrisgrey/src/components/SpotifyFacade.test.tsx` | Add a test asserting the loaded iframe has the new `sandbox` attribute (mirrors `YouTubeFacade.test.tsx:145`). |
| Edit (test) | `/Users/cperez/dev/altivum-dev/thechrisgrey/src/components/claude/__tests__/ArchitectureXRay.test.tsx` (or new `architectureNodes.test.ts`) | Add an assertion that the `guardrail-check` node's `config.Version` equals `'5'` (lock the value so future drift is caught). |

#### Testing & Validation

**Unit / integration tests to add or update**
- `SpotifyFacade.test.tsx`: add `it('sets sandbox attribute on iframe')` — click the facade, get `screen.getByTitle('The Vector Podcast')`, assert `toHaveAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox')`. Existing tests already cover facade→iframe swap.
- Architecture guardrail-version lock: add a small data test asserting `pipelineNodes.find(n => n.id === 'guardrail-check')!.config.Version === '5'`. (Honest note: this locks the *display* value; it does not assert equality with the Lambda — that cross-file drift test is a flagged follow-up, not in this package.)
- Optional Podcast featured-links test: a new `Podcast` render test is heavy (the page imports R3F-adjacent children, Sanity client, GSAP-using `AskTheVector`); given existing pages have **no** page-level tests and mocking burden is high, **recommendation: rely on `EpisodeCard`'s existing coverage of the identical chip markup + manual verification** rather than adding a brittle full-page test. If a test is desired, extract is out of scope; prefer manual.

**Manual verification (run `npm run dev`)**
- `/about`: "Beyond the Assessment" still renders italic (visual identical).
- `/altivum`: HQ node + 3 branch cards render with consistent typographic sizing (no jarring size shift); the AWS Partner badge and Chamber link sit at the true bottom corners, symmetric, not mid-section; no overlap with the centered logo at 320px/375px/desktop widths.
- `/podcast`: featured "Now Playing" card shows Spotify/Apple/YouTube chips matching the per-episode cards below; **click Spotify facade and confirm the player loads and audibly plays** (the `sandbox` gate — mandatory).
- `/beyond-the-assessment`: CTA hover shows gold-at-90% (no amber); all four quote lines use one consistent quote/apostrophe style; `<em>Beyond the Assessment</em>` unchanged.
- `/claude`: open the Architecture X-Ray, click the Guardrail node, confirm detail panel shows Version 5.
- `/links`: X (Twitter) row points to the confirmed handle; spot-check 2-3 other personal/company links open the correct destinations.
- `/privacy`: with no consent / PostHog unconfigured, the "Reset analytics preference" button is absent and the surrounding copy reads cleanly (period, not dangling colon). With consent granted (set `localStorage` `tcg-analytics-consent=granted` and configure `VITE_POSTHOG_KEY` locally, or temporarily force `canResetConsent` true), the button appears and reset works. View source / SEO inspector confirms a `WebPage` JSON-LD node is emitted.

**Pipeline checks**
- `npx tsc --noEmit` (catches missing imports, `SOCIAL_LINKS` key typos, schema option shape).
- `npm run lint`.
- `npx vitest run` (full suite green, incl. new sandbox + guardrail-version assertions and the existing `ArchitectureXRay` "renders all 7 node labels" test).
- `npm run build` before pushing (validates env + full pipeline).

**Rollback check**
- All changes are isolated, additive, or value swaps — each file reverts cleanly via `git checkout -- <file>`. The single risky behavior change is `SpotifyFacade` `sandbox`: if live playback breaks and no safe value works, revert *only* that file + its test assertion; the other six items are independent and ship regardless.

#### Risk & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `sandbox` breaks Spotify embed playback (jsdom can't catch it) | Medium | High | Mandatory live click-to-play verification on `/podcast`; incrementally relax tokens; if unfixable, revert only SpotifyFacade and document incompatibility. Per project "run the real thing" rule. |
| Wrong X handle shipped (sends visitors to wrong/nonexistent account) | Medium | Medium | Blocking owner decision before edit; default to `SOCIAL_LINKS.twitter` (Option A) only after confirmation; if `x_thechrisgrey` is real, fix the constant instead of re-diverging. |
| Typography token swap shifts visual sizing on Altivum cards (e.g. `text-xl`→`cardTitleSmall` 20-24px is close but not identical; `text-lg`→`cardTitleSmall` enlarges HQ label) | Medium | Low | Visual diff at 3 breakpoints; tokens chosen to be the nearest established style; acceptable since the item's intent is *deliberate* tokenization over magic values. |
| `bottom-8` badges overlap centered logo on very short viewports | Low | Low | Manual check at 320px height; fallback `bottom-6 sm:bottom-8` only if collision observed. |
| WebPage schema `@id` collision with existing `@graph` (SEO appends graph) | Low | Low | `buildWebPageSchema` uses `${url}/#webpage` — distinct from Person/Org/WebSite `@id`s; verify no duplicate `@id` in rendered JSON-LD. |
| Guardrail version comment becomes stale again (display not wired to Lambda) | Medium | Low | SSOT comment is the in-scope mitigation + value-lock test; flag the cross-file drift test as a follow-up (out of scope). |
| Privacy button gating hides reset for a user who *did* grant consent but `getConsent()` reads stale during prerender | Low | Low | Computed in render on the client; prerender intentionally omits it (correct — needs live browser state); reload after reset re-evaluates. |
| Quote normalization accidentally alters meaning or breaks JSX | Low | Low | JSX text nodes render curly/straight identically with no escaping; change is text-only on 2 lines; lint+tsc+visual confirm. |

#### Dependencies & Order of Operations

1. **Resolve the X-handle DECISION (Item 6.1)** — blocking for Links; gather before coding.
2. Items **1, 2, 4, 5, 7** are fully independent — implement in any order (no shared files).
3. **Item 3** has two parts: the Podcast listen-row (independent) and the SpotifyFacade `sandbox` (gated on live verification). Do the markup first; do the `sandbox` change last so the live-play check is the final gate before commit.
4. Run `tsc` + `lint` + `vitest` after each file or in one batch at the end; then `npm run build`.
5. Branch off `main` before any commit. Commit only when the user asks; the SpotifyFacade live-verify result must be reported before claiming Item 3 "works."

#### Estimated Effort

**Complexity: Low–Medium** (mostly mechanical token/value swaps; the only genuine risk surface is the SpotifyFacade `sandbox` live behavior and the X-handle decision). **Time: 2–3 hours** (≈1.5h edits + tests, ≈0.5–1h manual/live verification across six routes incl. Spotify playback and breakpoint checks). **Files affected: 9–11** (8 source files: About, Altivum, Podcast, SpotifyFacade, BeyondTheAssessment, architectureNodes, Links, Privacy; +1 conditional: `links.ts`; +1–2 test files: SpotifyFacade.test, ArchitectureXRay/architectureNodes test).
