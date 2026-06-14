---
name: web-design-dna
description: >-
  Extract the complete design "DNA" of any website the user finds beautiful — typography,
  color, spacing, motion/easing, effects, and the full front-end tech stack (GSAP, Three.js,
  Lenis, GLSL shaders, the framework) — then synthesize its 3–5 signature moves into a
  portable Injection Kit (CSS variables, Tailwind v4 @theme, JSON tokens, and React/Vite
  technique recipes) to drop into the user's own site. Use when the user shares a site they
  call gorgeous / stunning / beautiful and wants to know what makes it look so good,
  reverse-engineer or "steal" its design system, capture its vibe, or inject/replicate its
  aesthetic into their own project.
---

# Web Design DNA Extractor

Dissect a beautiful website down to the details that make it stunning — then translate
that into something droppable into the user's own builds.

The skill is **capability-tiered**: it detects what the current environment can do and
climbs to the strongest extraction path available, degrading gracefully. The expensive,
high-fidelity work (live rendering, computed styles, runtime probing) only runs where the
network and a browser are available.

## Capability tiers — use the highest one available

| Tier | Needs | Yields | When |
| --- | --- | --- | --- |
| **A — Live browser** | Claude in Chrome / a browser-control MCP | Real rendered page, full-page + scroll-state screenshots, the rendered DOM. Owns the *visual* layer: hierarchy, composition, the *feel* of motion. | Best paired with B. |
| **B — Headless Playwright** | Open network + Chromium (`extract-live.mjs`) | Resolved `getComputedStyle`, full network resource manifest, `window` globals (`THREE`/`gsap`/version probing), raw HTML/CSS/JS. Owns the *precise* layer: exact fonts, colors, easings, libraries + versions. | The powerhouse. Runs on an open-network machine (the user's Mac). |
| **C — Fetch + search** | `WebFetch`/`WebSearch` reaching arbitrary hosts | Content/structure/meta + **the creators' own tech writeups** (Awwwards case studies routinely disclose the stack). | When no browser, but the web is reachable. |
| **D — User-supplied source** | A saved `.html` or pasted View-Source (`extract-static.mjs`) | Full fidelity on the *static* layer: stack fingerprint, type scale, palette, spacing, motion, effects. | Always works, even fully offline/sandboxed. |

**Detect the ceiling, then extract:**
1. Is a live-browser tool available (Claude in Chrome, a Playwright/browser MCP)? → **Tier A** (and run B alongside if you can).
2. Else, can this machine reach the target and launch Chromium? Quick probe:
   `curl -sS -o /dev/null -w "%{http_code}" --max-time 8 <url>` — a `403 host_not_allowed` means a walled sandbox; skip to D. A real status → **Tier B**.
3. Else, does `WebFetch` return content for arbitrary URLs? → **Tier C**.
4. Else → **Tier D**: ask the user to save the page (⌘S "Web Page, Complete") or paste View-Source (⌘U), and parse it.

> **This cloud sandbox is Tier D only.** Its network is allowlisted (`x-deny-reason: host_not_allowed` on arbitrary sites) and Chromium can't be downloaded, so live extraction is impossible here — it is for authoring/testing the skill. The real Tier A/B firepower fires when this skill runs on an open-network machine.

## Workflow

1. **Confirm target + intent.** Which site, and what's the goal — *understand* what makes it beautiful, or *inject* its aesthetic into a specific project?
2. **Pick the highest tier** (above) and extract.
3. **Map to the taxonomy.** The scripts do this automatically. For manual tiers (A screenshots, C writeups), score the site against `reference/dna-taxonomy.md` — the same rubric, by eye.
4. **Synthesize the signature moves** — the 3–5 things that actually create the magic (a shader hero + Lenis + scrubbed GSAP, say), not a flat feature dump.
5. **Produce the Injection Kit** — portable CSS variables + Tailwind v4 `@theme` + JSON tokens + copy-paste React/Vite technique recipes. See `reference/injection-kit.md`.
6. **Flag brand conflicts.** Extract *faithfully*, but flag where the DNA collides with the target project's rules (e.g. Google Fonts vs. an SF-Pro-only brand) so the user overrides consciously.
7. **Offer to apply.** Hand back the report, then offer to wire the kit into the user's project.

## Setup (one-time, for live Tier B)

```bash
cd .claude/skills/web-design-dna/scripts
npm install           # installs Playwright (isolated from the host repo)
npx playwright install chromium
```

## Commands (all verified from the `scripts/` dir)

```bash
# Tier B — live (open-network machine):
node extract-live.mjs <url> [--scroll] [--shots ./shots] [--label "Name"] [--brand <path|none>]

# Tier D — static (anywhere, offline):
node extract-static.mjs <file.html | saved-dir | ->      # '-' reads View-Source on stdin
pbpaste | node extract-static.mjs -                       # macOS: paste View-Source directly

# Self-test the static pipeline (no network needed):
node test-static.mjs
```

Both extractors write `dna-report.md` (human) + `dna-report.json` (machine) and print a console summary. Override paths with `--out` / `--json`.

## Tier-specific notes

- **Tier A (live browser):** capture a full-page screenshot plus 3–4 scroll-state shots, read the rendered DOM, and trigger scroll to wake animations. Use the taxonomy as your scoring rubric; describe the *feel* (weight, pacing, restraint) the scripts can't measure.
- **Tier B (Playwright):** `extract-live.mjs` already pulls computed styles, the resource manifest, `window` globals (+ THREE/GSAP versions), and optional screenshots. This is the most accurate path for exact tokens and library fingerprinting.
- **Tier C (writeups):** search `"<site name>" awwwards`, `"<studio>" case study`, `"<site>" built with`. Designers publish how they did it. Combine with whatever `WebFetch` returns.
- **Tier D (source):** the static parser fingerprints the stack from `<script>`/`<link>`, reads inline `<style>` + locally-saved CSS, detects shader blocks, and analyzes the full CSS-DNA. It cannot see runtime-injected styles — note that gap in the report.

## Brand-conflict flagging

By default the skill flags conflicts against the **Altivum / thechrisgrey** brand (SF Pro Display, no Google Fonts, the altivum palette, no emojis, CSP allowlist, reduced-motion). To target a different project, pass `--brand path/to/brand.json` (shape in `reference/injection-kit.md`), or `--brand none` for pure faithful extraction with no flagging. When running inside another repo, also read that repo's own design system (its `@theme` block / CLAUDE.md) and prefer it.

## References (load as needed)

- `reference/dna-taxonomy.md` — the complete "what makes it stunning" checklist (the rubric for every tier).
- `reference/library-fingerprints.md` — how to identify the tech stack by eye and by signal.
- `reference/injection-kit.md` — the output contract, the brand-profile schema, and how to apply DNA to a React/Vite/Tailwind project.

## Honesty rule

Report what each tier actually saw. Tier D can't observe runtime-injected styles or true motion feel; Tier B resolves exact values but doesn't judge taste; only a live render (A) shows the real thing. Say which tier produced each finding, and never claim a value was "confirmed in the running page" unless a live tier actually saw it.
