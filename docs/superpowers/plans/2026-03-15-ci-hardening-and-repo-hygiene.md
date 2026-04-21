# CI Hardening & Repo Hygiene Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix broken tests, add test execution to CI, enable dependency scanning, add a LICENSE file, and clean up dead CI config.

**Architecture:** Five independent changes that harden the CI pipeline and improve repo hygiene. Task 1 (fix broken tests) is a prerequisite for Task 2 (add tests to CI). Tasks 3-5 are independent of each other and of Tasks 1-2.

**Tech Stack:** Vitest, GitHub Actions, GitHub Dependabot, AWS Amplify (amplify.yml)

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `src/__tests__/integration/BlogPost.integration.test.tsx` | Fix `SanityResponsiveImage` mock |
| Modify | `src/__tests__/integration/Blog.integration.test.tsx` | Fix same `SanityResponsiveImage` mock |
| Modify | `.github/workflows/ci.yml` | Add test step, npm audit, pin Node 20, remove `develop` branch |
| Create | `.github/dependabot.yml` | Automated dependency vulnerability scanning |
| Create | `LICENSE` | Repository license file |
| Modify | `amplify.yml` | Add `npm run test` before build, remove dead `develop` reference if present |

---

## Chunk 1: Fix Broken Tests

### Task 1: Fix SanityResponsiveImage Mock in Blog Integration Tests

**Context:** `SanityResponsiveImage` (added recently) calls `urlFor(source).width(w).height(h).auto('format').quality(q).url()` and also `.blur(50)` for the LQIP placeholder. The existing `urlFor` mock in both Blog and BlogPost integration tests returns a shallow chain that doesn't include `.height()` or `.blur()`, causing `@sanity/image-url` to throw `"Malformed asset _ref"` when the real `urlFor` tries to parse the mock asset ID (`img-1`). The cleanest fix is to mock `SanityResponsiveImage` itself at the module level so these integration tests don't exercise the Sanity image URL builder at all.

**Files:**
- Modify: `src/__tests__/integration/BlogPost.integration.test.tsx:14-28`
- Modify: `src/__tests__/integration/Blog.integration.test.tsx:14-26`

- [ ] **Step 1: Add SanityResponsiveImage mock to BlogPost integration test**

Add this mock block after the existing `vi.mock('../../sanity', ...)` block (after line 28) and before the `vi.mock('../../utils/routeManifest', ...)` block in `src/__tests__/integration/BlogPost.integration.test.tsx`:

```tsx
// Mock SanityResponsiveImage to avoid @sanity/image-url parsing real asset refs
vi.mock('../../components/SanityResponsiveImage', () => ({
  default: ({ alt, className }: { alt: string; className?: string }) => (
    <img src="https://mock-image.jpg" alt={alt} className={className} />
  ),
}));
```

- [ ] **Step 2: Run BlogPost integration tests to verify they pass**

Run: `npx vitest run src/__tests__/integration/BlogPost.integration.test.tsx --reporter=verbose`
Expected: All tests PASS (0 failures)

- [ ] **Step 3: Add SanityResponsiveImage mock to Blog integration test**

Add the same mock block after the existing `vi.mock('../../sanity', ...)` block in `src/__tests__/integration/Blog.integration.test.tsx`:

```tsx
// Mock SanityResponsiveImage to avoid @sanity/image-url parsing real asset refs
vi.mock('../../components/SanityResponsiveImage', () => ({
  default: ({ alt, className }: { alt: string; className?: string }) => (
    <img src="https://mock-image.jpg" alt={alt} className={className} />
  ),
}));
```

- [ ] **Step 4: Run Blog integration tests to verify they pass**

Run: `npx vitest run src/__tests__/integration/Blog.integration.test.tsx --reporter=verbose`
Expected: All tests PASS (0 failures)

- [ ] **Step 5: Run the full test suite to confirm no regressions**

Run: `npx vitest run`
Expected: 51 test files pass, 0 failures, 729 total tests passing. (Before this fix: 2 files failed with 33 test failures / 32 uncaught errors.)

- [ ] **Step 6: Commit**

```bash
git add src/__tests__/integration/BlogPost.integration.test.tsx src/__tests__/integration/Blog.integration.test.tsx
git commit -m "fix: mock SanityResponsiveImage in blog integration tests

The SanityResponsiveImage component calls urlFor().blur() which the
existing mock chain didn't support. Mock the component at module
level instead of trying to replicate the full image-url builder chain."
```

---

## Chunk 2: CI Pipeline Hardening

### Task 2: Add Test Execution to GitHub Actions CI

**Context:** The existing `.github/workflows/ci.yml` runs lint + build but not tests. It also targets a `develop` branch that doesn't exist, uses a Node 18.x/20.x matrix (but `.nvmrc` pins Node 20), and has `continue-on-error: true` on lint (which swallows failures).

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Rewrite the CI workflow**

Replace the entire contents of `.github/workflows/ci.yml` with:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test-and-build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint

      - name: Run tests
        run: npx vitest run --reporter=verbose

      - name: Audit dependencies
        run: npm audit --audit-level=high
        continue-on-error: true

      - name: Build project
        run: npm run build
        env:
          VITE_CONTACT_ENDPOINT: https://placeholder.example.com
          VITE_NEWSLETTER_ENDPOINT: https://placeholder.example.com
          VITE_CHAT_ENDPOINT: https://placeholder.example.com
          VITE_CHAT_SIGNING_KEY: ci-placeholder-key
          VITE_COGNITO_USER_POOL_ID: us-east-1_placeholder
          VITE_COGNITO_CLIENT_ID: placeholder
          VITE_KB_BUILDER_ENDPOINT: https://placeholder.example.com
          VITE_METRICS_ENDPOINT: https://placeholder.example.com
```

**Key changes from the original:**
- Removed `develop` branch (doesn't exist)
- Removed Node 18.x from matrix (`.nvmrc` pins 20, no reason to test 18)
- Uses `node-version-file: '.nvmrc'` instead of hardcoded version
- Added `npm run test` step before build
- Added `npm audit --audit-level=high` (with `continue-on-error: true` so advisory-level vulns don't block CI — only high/critical)
- Removed `continue-on-error: true` from lint (lint failures should block CI)
- Added placeholder `VITE_*` env vars for the build step (the build script runs `validate-env.js` which requires these)
- `YOUTUBE_API_KEY` is intentionally omitted — `generate-podcast-episodes.js` gracefully falls back to static episodes when it's missing
- Uses `--reporter=verbose` on tests for better failure diagnostics in GH Actions logs
- Removed `upload-artifact` step (the build artifact is deployed by Amplify, not GH Actions)

- [ ] **Step 2: Verify the workflow file is valid YAML**

Run: `npx yaml-lint .github/workflows/ci.yml 2>/dev/null || node -e "const fs=require('fs'); const yaml=require('yaml'); yaml.parse(fs.readFileSync('.github/workflows/ci.yml','utf8')); console.log('Valid YAML')"`

If `yaml` is not installed, just visually verify the indentation is correct.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add test execution, npm audit, and pin Node 20

- Add npm run test step to catch regressions before build
- Add npm audit --audit-level=high for dependency scanning
- Pin Node to .nvmrc (20) instead of 18.x/20.x matrix
- Remove nonexistent develop branch trigger
- Remove continue-on-error on lint (failures should block CI)
- Add placeholder VITE_* env vars for build validation"
```

### Task 3: Add Test Execution to Amplify Build

**Context:** The Amplify build pipeline (`amplify.yml`) runs `npm run build` but doesn't run tests. Since Amplify is the production deployment path, tests should gate the build there too.

**Files:**
- Modify: `amplify.yml:8-9`

- [ ] **Step 1: Add test step to amplify.yml build phase**

In `amplify.yml`, add `- npm run test` as the first command in the build phase, before `npm run build`:

```yaml
    build:
      commands:
        - npm run test
        - npm run build
```

The full build commands section (lines 8-9) becomes lines 8-10.

- [ ] **Step 2: Commit**

```bash
git add amplify.yml
git commit -m "ci: add test execution to Amplify build pipeline

Tests now gate production deployments. A failing test will prevent
the build from proceeding and the deploy from happening."
```

---

## Chunk 3: Dependency Scanning

### Task 4: Enable GitHub Dependabot

**Context:** No dependency vulnerability scanning is configured. Dependabot will automatically open PRs when vulnerabilities are found in npm dependencies and GitHub Actions versions.

**Files:**
- Create: `.github/dependabot.yml`

- [ ] **Step 1: Create the Dependabot configuration**

Create `.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
    open-pull-requests-limit: 10
    labels:
      - "dependencies"

  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
    labels:
      - "dependencies"
```

**Notes:**
- Only scans the root `package.json`. Lambda dirs have their own `package.json` files but are not npm workspaces, so Dependabot won't auto-detect them. Adding Lambda dirs would require separate `directory` entries — consider adding these later if Lambda dependency drift becomes a concern.
- Weekly on Monday keeps noise manageable.
- `github-actions` ecosystem catches outdated action versions (e.g., `actions/checkout@v4`).

- [ ] **Step 2: Commit**

```bash
git add .github/dependabot.yml
git commit -m "ci: enable Dependabot for npm and GitHub Actions

Weekly scanning on Mondays with a 10 PR limit. Covers root
package.json and GitHub Actions versions."
```

---

## Chunk 4: License & Cleanup

### Task 5: Add LICENSE File

**Context:** The repo is public on GitHub but has no license file, which legally means "all rights reserved." Since this is a personal brand site (not a reusable template), an all-rights-reserved notice with a viewing permission clause is appropriate — it lets people read and learn from the code without granting permission to copy or redistribute the brand/content.

**Files:**
- Create: `LICENSE`

- [ ] **Step 1: Confirm license choice with the user (MANDATORY HUMAN CHECKPOINT)**

This step blocks execution until the user responds. Before creating the file, confirm with the user which license they want. Present the options:
- **Option A: MIT** — permissive, anyone can fork/reuse
- **Option B: CC BY-NC 4.0** — attribution required, no commercial use
- **Option C: All Rights Reserved** — explicit notice that code may be viewed but not copied

Recommended for a personal brand site: **Option C** (All Rights Reserved), since the site contains personal branding, content, and identity that shouldn't be freely cloned.

- [ ] **Step 2: Create the LICENSE file based on user's choice**

If the user chooses All Rights Reserved, create `LICENSE`:

```
Copyright (c) 2024-2026 Christian Perez / Altivum Inc. All rights reserved.

This source code is published for educational reference only. You may view
and study the code, but you may not copy, modify, merge, publish, distribute,
sublicense, or sell copies of the software or its derivatives without prior
written permission from the copyright holder.

For licensing inquiries: chris@altivum.ai
```

If the user chooses MIT or CC BY-NC 4.0, use the standard text for that license with "Christian Perez / Altivum Inc." as the copyright holder.

- [ ] **Step 3: Commit**

```bash
git add LICENSE
git commit -m "docs: add LICENSE file

Clarifies that the repository is viewable for educational reference
but all rights are reserved."
```

(Adjust commit message based on actual license chosen.)

### Task 6: Remove Dead `develop` Branch Config from Amplify

**Context:** The `amplify.yml` file does NOT reference a `develop` branch — only the GitHub Actions `ci.yml` did, and that was already cleaned up in Task 2. No further changes needed here.

**Status:** Already handled in Task 2. No action required.

---

## Dependency Graph

```
Task 1 (fix tests) ──► Task 2 (CI test execution) ──► Task 3 (Amplify test execution)
                        Task 4 (Dependabot)         [independent]
                        Task 5 (LICENSE)             [independent]
```

Tasks 4 and 5 can run in parallel with Tasks 1-3. Task 2 depends on Task 1 (tests must pass before adding them to CI). Task 3 depends on Task 1 for the same reason.

---

## Verification

After all tasks are complete:

- [ ] Run `npx vitest run` — all 729 tests pass
- [ ] Run `npm run build` — build succeeds
- [ ] Run `npm run lint` — no warnings or errors
- [ ] Verify `.github/workflows/ci.yml` includes test + audit steps
- [ ] Verify `.github/dependabot.yml` exists
- [ ] Verify `LICENSE` exists at repo root
- [ ] Verify `amplify.yml` includes `npm run test` before `npm run build`
