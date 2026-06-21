# Feature Optimization

> This file tracks ways to REFINE features that already exist in this project.
> It is NOT a roadmap of new features to add — nothing here introduces new
> functionality. Every item makes an existing feature cleaner, faster, safer,
> more accessible, or otherwise better.
>
> Maintained by the `/optimize-features` command. Last full inventory: 2026-06-21

## Feature Inventory

### A. Content & marketing pages

| # | Feature | What it does | Where it lives | Last reviewed |
|---|---------|--------------|----------------|---------------|
| 1 | Home | Hero + sticky scroll-storytelling (8 key points via GSAP ScrollTrigger) → CTA | `src/pages/Home.tsx`, `src/components/home/` | 2026-06-20 |
| 2 | About / Personal Biography | Christian's bio, career, leadership philosophy | `src/pages/About.tsx` | 2026-06-20 |
| 3 | Altivum Inc | Company page (Altivum Logic, Vanguard) | `src/pages/Altivum.tsx` | 2026-06-20 |
| 4 | The Altivum Foundation | Foundation mission, programs, support | `src/pages/Foundation.tsx` | 2026-06-20 |
| 5 | The Vector Podcast | Episodes, guests, subscribe platforms | `src/pages/Podcast.tsx`, `src/components/podcast/`, `EpisodeCard.tsx`, `SpotifyFacade.tsx` | 2026-06-20 |
| 6 | Beyond the Assessment | Book landing page | `src/pages/BeyondTheAssessment.tsx` | 2026-06-20 |
| 7 | AWS | AWS Community Builder page | `src/pages/AWS.tsx`, `src/components/aws/` | 2026-06-20 |
| 8 | Claude | AI work / Anthropic page | `src/pages/Claude.tsx`, `src/components/claude/` | 2026-06-20 |
| 9 | Links | Link-in-bio hub | `src/pages/Links.tsx` | 2026-06-20 |
| 10 | Contact & Speaking | Contact form + speaking/press info | `src/pages/Contact.tsx` (+ contact endpoint) | 2026-06-20 |
| 11 | Privacy Policy | Privacy/legal page | `src/pages/Privacy.tsx` | 2026-06-20 |
| 12 | 404 / Not Found | Catch-all error page | `src/pages/NotFound.tsx` | 2026-06-20 |

### B. Blog system

| # | Feature | What it does | Where it lives | Last reviewed |
|---|---------|--------------|----------------|---------------|
| 13 | Blog listing | Series/category/featured filtering from Sanity | `src/pages/Blog.tsx`, `src/sanity/queries.ts` | 2026-06-20 |
| 14 | Blog post reading | Portable Text, Shiki highlighting, reading progress, image CLS fix | `src/pages/BlogPost.tsx`, `src/sanity/PortableTextComponents.tsx`, `HighlightedCodeBlock.tsx`, `ReadingProgressBar.tsx` | 2026-06-20 |
| 15 | RSS feed | Sanity posts → `dist/rss.xml` | `scripts/generate-rss.js` | 2026-06-20 |

### C. Alti — AI agent

| # | Feature | What it does | Where it lives | Last reviewed |
|---|---------|--------------|----------------|---------------|
| 16 | Alti chat (frontend) | Full-page `/chat` + floating widget, shared engine, sessionStorage sync | `src/pages/Chat.tsx`, `src/components/chat/`, `src/hooks/useChatEngine.ts` | 2026-06-20 |
| 17 | Alti backend | Streaming agent (Strands + Bedrock Haiku), 8 tools, KB RAG, events | `lambda/chat-stream/` | 2026-06-20 |
| 18 | Alti 3D mascot | R3F mascot in widget button + canvas safety | `src/components/chat/` (AltiMascot), `SafeCanvas.tsx`, `public/alti.glb` | 2026-06-20 |
| 19 | Visitor memory | Per-device fact memory, PII-sanitized, 90-day TTL | `lambda/chat-stream/memory.mjs`, `src/utils/deviceId.ts` | 2026-06-20 |
| 20 | Knowledge Base + sync | Bedrock KB retrieval + S3-event ingestion | `lambda/kb-sync/`, KB `ARFYABW8HP` | 2026-06-20 |

### D. Other interactive / platform features

| # | Feature | What it does | Where it lives | Last reviewed |
|---|---------|--------------|----------------|---------------|
| 21 | Blueprint generator | Architecture generator (Opus + Haiku verdict), golden-example RAG | `src/pages/Blueprint.tsx`, `lambda/blueprint/`, `src/hooks/useBlueprint.ts` | 2026-06-20 |
| 22 | KB Admin console | Cognito-gated CRUD on Sanity `kbEntry` → `knowledge-base.txt` → S3 | `src/pages/Admin.tsx`, `src/components/admin/`, `lambda/kb-builder/` | 2026-06-20 |
| 23 | Site Health dashboard | Live metrics/alarms view on `/admin` | `src/hooks/useSiteHealth.ts` | 2026-06-20 |
| 24 | Newsletter signup | Signup form + CTA (reused for Blueprint waitlist) | `src/components/NewsletterForm.tsx`, `NewsletterCTA.tsx` (+ newsletter endpoint) | 2026-06-20 |
| 25 | Public MCP server | `ask_alti` tool over KB + Bedrock + guardrail; install badge | `lambda/mcp-server/`, `src/components/McpInstallBadge.tsx` | 2026-06-20 |
| 26 | Social proof / testimonials | Testimonial display | `src/components/Testimonials.tsx` | 2026-06-20 |

### E. Cross-cutting site systems

| # | Feature | What it does | Where it lives | Last reviewed |
|---|---------|--------------|----------------|---------------|
| 27 | Navigation | Header + About dropdown, mobile hamburger, routes SSOT | `src/components/Navigation.tsx`, `src/routes.ts` | 2026-06-20 |
| 28 | Design system & motion | Typography/colors, Lenis smooth scroll, View Transitions, scroll reveals, micro-interactions | `src/index.css`, `src/utils/typography.ts`, `LenisProvider.tsx`, `ViewTransitionLink.tsx`, `SplitReveal.tsx`, `FadeReveal.tsx`, `src/utils/motion.ts` | 2026-06-20 |
| 29 | SEO | Meta tags + JSON-LD `@graph` schemas | `src/components/SEO.tsx`, `src/utils/schemas.ts` | 2026-06-20 |
| 30 | Analytics & consent | Plausible/Cloudflare/PostHog, consent-gated | `src/components/ConsentBanner.tsx`, `public/plausible-init.js` | 2026-06-20 |
| 31 | Web Vitals & monitoring | Vitals + CSP-report ingestion → CloudWatch, alarms | `src/utils/webVitals.ts`, `lambda/metrics/` | 2026-06-20 |
| 32 | Error handling | Global + page-level error boundaries, pathname-keyed reset | `src/components/ErrorBoundary.tsx`, `ErrorFallbacks.tsx` | 2026-06-20 |
| 33 | Security layer | HMAC request signing, Turnstile-gated session token, rate limiting, Bedrock guardrail | `src/utils/chatSigning.ts`, `src/utils/sessionToken.ts`, `src/utils/turnstile.ts`, `lambda/session-token/`, `lambda/shared/` (hmac, rateLimit) | 2026-06-20 |

### F. Build-time & ops

| # | Feature | What it does | Where it lives | Last reviewed |
|---|---------|--------------|----------------|---------------|
| 34 | Build pipeline & env validation | Fail-fast env checks + Amplify build config | `scripts/validate-env.js`, `amplify.yml` | 2026-06-20 |
| 35 | Sitemap generation | Sanity posts → `dist/sitemap.xml` (SSOT for indexable set) | `scripts/generate-sitemap.js` | 2026-06-20 |
| 36 | SSG prerendering | Build-time prerender crawl of static routes | `scripts/prerender.js` | 2026-06-20 |
| 37 | Podcast episode generation | YouTube API → `generatedEpisodes.json` (static fallback) | `scripts/generate-podcast-episodes.js` | 2026-06-20 |
| 38 | OG image generation | Build-time Open Graph image assets | `scripts/generate-og-images.mjs`, `scripts/og-assets/` | 2026-06-20 |
| 39 | Podcast transcription & ingestion | Transcribe episodes + ingest transcripts into KB | `scripts/transcribe-podcast.mjs`, `transcribe-youtube.mjs`, `ingest-podcast-transcripts.mjs` | 2026-06-20 |
| 40 | Lambda deploy & verification tooling | Verified deploy + import smoke check + IAM drift | `scripts/deploy-lambda.sh`, `smoke-test-lambdas.mjs`, `iam-drift.sh` | 2026-06-20 |
| 41 | CI/CD & dependency security | GitHub Actions: PR/push test+build gate + per-PR npm audit; weekly scheduled audit opens tracked issues; Dependabot; greptile AI PR review | `.github/workflows/ci.yml`, `.github/workflows/security-audit.yml`, `.github/dependabot.yml` | 2026-06-21 |

## Optimization Opportunities

> Populated per feature as `/optimize-features` reviews them. Each item:
> `- [ ] **[Lens]** <title> — <summary>. Impact: <H/M/L>. Effort: <L/M/H>. (file:line) — added <date>`
> Completed items are checked off with a completion date rather than deleted.

**Group A (content & marketing pages) reviewed 2026-06-15** — 61 verified refinements via parallel review + adversarial verification.

**Feature 29 (SEO) reviewed 2026-06-20** — 37 verified refinements (33 after dedup: 7 Medium, 26 Low) via an 8-dimension parallel audit (structured-data, head/meta, crawl-infra, on-page content, perf-head, code/arch, tests, AI/GEO) with per-finding adversarial verification against current 2025-2026 Google/schema.org standards. 0 findings rejected; several High claims honestly downgraded after the live site refuted the premise (e.g. Amplify serves noindex routes with a real 404 status).

### 1. Home
- [x] **[Accessibility]** Heading outline skips h1→h3 with the lone h2 out of order — sr-only h1, then 8× `as="h3"` keyPoints, then the CTA h2; primary content has no parent h2. Demote keyPoints to h2 or add a visually-hidden section h2 (`SplitReveal` `as` union needs `'h2'`). Impact: Medium. Effort: Low. (`src/pages/Home.tsx:57-66`, `src/components/SplitReveal.tsx:14`) — added 2026-06-15 — **completed 2026-06-15 (WP-E…J)**
- [x] **[Performance]** Below-the-fold profile image eager-loads and competes with the LCP hero — add `loading="lazy" decoding="async"`. Impact: Medium. Effort: Low. (`src/pages/Home.tsx:158-163`) — added 2026-06-15 — **completed 2026-06-15 (WP-D)**
- [x] **[Cleaner code]** Dead conditional branch — the `point.link` ternary's `<div>` fallback is unreachable (every keyPoint has a link). Impact: Low. Effort: Low. (`src/pages/Home.tsx:89-93`) — added 2026-06-15 — **completed 2026-06-15 (WP-E…J)**
- [x] **[Architecture]** Static `keyPoints` array and `renderTab` are reconstructed on every render — hoist `keyPoints` to module scope. Impact: Low. Effort: Low. (`src/pages/Home.tsx:30-41`) — added 2026-06-15 — **completed 2026-06-15 (WP-E…J)**
- [x] **[Consistency]** keyPoint tabs keyed by array index while sibling lists key by content. Impact: Low. Effort: Low. (`src/pages/Home.tsx:84`) — added 2026-06-15 — **completed 2026-06-15 (WP-E…J)**
- [x] **[Cleaner code]** Hero shader comment documents the wrong navy hex (`// #1A2332` vs actual `#2E4A6B`). Impact: Low. Effort: Low. (`src/components/home/heroShader.ts:32`) — added 2026-06-15 — **completed 2026-06-15 (WP-E…J)**

### 2. About / Personal Biography
- [x] **[Consistency]** "Altivum Inc." and "Beyond the Assessment" are plain text — wrap in `ViewTransitionLink` to `/altivum` and `/beyond-the-assessment`. Impact: Medium. Effort: Low. (`src/pages/About.tsx:52-53,74,83-84`) — added 2026-06-15 — **completed 2026-06-15 (WP-E…J)**
- [x] **[Performance]** Hero signature image has no width/height/aspect-ratio (CLS risk) — add `width={1500} height={1500}`. Impact: Low. Effort: Low. (`src/pages/About.tsx:34-39`) — added 2026-06-15 — **completed 2026-06-15 (WP-D)**
- [ ] **[Performance]** 1500×1500 hero PNG ships full-res for a ≤768px box (mostly-transparent canvas) — pre-resize/crop the asset. Impact: Low. Effort: Low. (`src/pages/About.tsx:34-39`) — added 2026-06-15
- [x] **[Cleaner code]** Italic via inline `style={{ fontStyle: 'italic' }}` instead of the Tailwind `italic` class used everywhere else. Impact: Low. Effort: Low. (`src/pages/About.tsx:74`) — added 2026-06-15 — **completed 2026-06-15 (WP-E…J)**
- [x] **[Accessibility]** Hero image alt ("My Personal Biography") duplicates the sr-only h1 and misses the mark's text — tighten or set `alt=""`. Impact: Low. Effort: Low. (`src/pages/About.tsx:36,48`) — added 2026-06-15 — **completed 2026-06-15 (WP-E…J)**

### 3. Altivum Inc
- [x] **[Consistency]** CTAs/external links drop the standard button recipe (`min-h-[48px] touch-manipulation active:scale-[0.98]`, gold glow) that Foundation uses. Impact: Medium. Effort: Low. (`src/pages/Altivum.tsx:408-421`) — added 2026-06-15 — **completed 2026-06-15 (WP-E…J)**
- [x] **[Consistency]** Branch cards & HQ node bypass `typography.ts` with raw `text-*`/`leading-*` utilities. Impact: Medium. Effort: Low. (`src/pages/Altivum.tsx:255-309`) — added 2026-06-15 — **completed 2026-06-15 (WP-E…J)**
- [x] **[Cleaner code]** Each `timelineItems` entry defines an `icon` SVG that is never rendered — render it or drop the field. Impact: Medium. Effort: Low. (`src/pages/Altivum.tsx:13-17,344-362`) — added 2026-06-15 — **completed 2026-06-15 (WP-E…J)**
- [x] **[Cleaner code]** The three "Imperatives" are authored verbatim twice (timeline + Mission) — hoist to one array (cf. Foundation `FOCUS_AREAS`). Impact: Medium. Effort: Low. (`src/pages/Altivum.tsx:52-71,383-396`) — added 2026-06-15 — **completed 2026-06-15 (WP-E…J)**
- [x] **[UI]** Hero badges positioned with magic `bottom-50` (200px) — can crowd the logo on short viewports; use an intentional corner offset. Impact: Low. Effort: Low. (`src/pages/Altivum.tsx:215,228`) — added 2026-06-15 — **completed 2026-06-15 (WP-E…J)**
- [x] **[Performance]** LCP hero logo has no width/height (verifier scoped to hero only; AWS logo & full-screen image already reserve boxes). Impact: Low. Effort: Low. (`src/pages/Altivum.tsx:203-208`) — added 2026-06-15 — **completed 2026-06-15 (WP-D)**
- [x] **[Accessibility]** Chamber-recognition anchor needs an `aria-label` with new-tab/destination context (decorative-SVG portion mostly moot). Impact: Low. Effort: Low. (`src/pages/Altivum.tsx:224-232`) — added 2026-06-15 — **completed 2026-06-15 (WP-E…J)**

### 4. The Altivum Foundation
- [x] **[Consistency]** Cybersecurity is a 4th funded field (grid + FAQ + schema) but dropped from H1, meta description, keywords, and Vision copy — align the crawlable/snippet copy to the four-field model. Impact: High. Effort: Low. (`src/pages/Foundation.tsx:64,35-36,103`; `src/utils/schemas.ts:531,561`) — added 2026-06-15 — **completed 2026-06-15 (WP-B; also aligned the JSON-LD `description` at schemas.ts:551)**
- [x] **[Performance]** Hero LCP JPEG ships 175 KB un-re-encoded with no WebP variant — convert to q80 WebP (AWS.tsx convention). Impact: Medium. Effort: Low. (`src/pages/Foundation.tsx:3,49-54`) — added 2026-06-15 — **completed 2026-06-15 (WP-D; 175 KB → 106 KB, orphaned JPEG removed)**
- [x] **[Accessibility]** The four focus areas are a `<div>` grid, not a semantic list — wrap in `<ul>`/`<li>`. Impact: Low. Effort: Low. (`src/pages/Foundation.tsx:149-166`) — added 2026-06-15 — **completed 2026-06-15 (WP-E…J)**
- [x] **[Cleaner code]** Four near-identical CTA button blocks hand-duplicated — extract local button variants. Impact: Low. Effort: Low. (`src/pages/Foundation.tsx:71-86,220-235`) — added 2026-06-15 — **completed 2026-06-15 (WP-E…J)**

### 5. The Vector Podcast
- [x] **[Cleaner code]** Episode dates render one day early for US visitors — `new Date('YYYY-MM-DD')` parses as UTC; make `formatDate` TZ-safe (cf. existing `formatMonthYear`). Impact: High. Effort: Low. (`src/utils/dateFormatter.ts:8`, `src/components/EpisodeCard.tsx:53,72,179`) — added 2026-06-15 — **completed 2026-06-15 (WP-A)**
- [x] **[UX]** Featured "Now Playing" details card omits Spotify/Apple/YouTube listen links that every other card shows — add the link row. Impact: Medium. Effort: Low. (`src/pages/Podcast.tsx:169-187`) — added 2026-06-15 — **completed 2026-06-15 (WP-E…J)**
- [x] **[Architecture]** EpisodeCard `topics`/`guests` sections are dead for production data (generator emits `topics: []`, never `guests`) — pick one source of truth. Impact: Medium. Effort: Medium. (`src/components/EpisodeCard.tsx:196,220`; `scripts/generate-podcast-episodes.js:261`) — added 2026-06-15 — **completed 2026-06-15 (WP-E…J)**
- [x] **[Resilience & tests]** EpisodeCard date test uses a midday-UTC fixture that masks the date bug and never asserts the rendered date — use bare `YYYY-MM-DD` + assert under a fixed TZ. Impact: Medium. Effort: Low. (`src/components/EpisodeCard.test.tsx:11,22`) — added 2026-06-15 — **completed 2026-06-15 (WP-A)**
- [x] **[Accessibility]** Compact episode accordion button has `aria-expanded` but no `aria-controls`/labelled region — add a panel id. Impact: Low. Effort: Low. (`src/components/EpisodeCard.tsx:24,66-67`) — added 2026-06-15 — **completed 2026-06-15 (WP-E…J)**
- [x] **[Consistency]** `SpotifyFacade` iframe lacks the `sandbox` hardening `YouTubeFacade` applies (live-verify Spotify still plays). Impact: Low. Effort: Low. (`src/components/SpotifyFacade.tsx:13`, `src/components/YouTubeFacade.tsx:30`) — added 2026-06-15 — **completed 2026-06-15 (WP-E…J)**

### 6. Beyond the Assessment
- [x] **[Performance]** Hero + reading images lack intrinsic width/height — CLS on a tracked metric; add `1500×1500` / `1131×1600` (Home pattern). Impact: High. Effort: Low. (`src/pages/BeyondTheAssessment.tsx:31-36,52-56`) — added 2026-06-15 — **completed 2026-06-15 (WP-D)**
- [x] **[Architecture]** 2.1 MB unused source EPUB committed in `src/assets/` (56 XHTML files, never imported) — remove from repo. Impact: Low. Effort: Low. (`src/assets/Beyond the Assessment FINAL.epub/`) — added 2026-06-15 — **completed 2026-06-15 (WP-E…J)**
- [x] **[Consistency]** CTA hover uses stock `amber-400` instead of `hover:bg-altivum-gold/90`. Impact: Low. Effort: Low. (`src/pages/BeyondTheAssessment.tsx:94`) — added 2026-06-15 — **completed 2026-06-15 (WP-E…J)**
- [x] **[Accessibility]** CTA omits touch-target/press-feedback classes; arrow SVG lacks `aria-hidden`. Impact: Low. Effort: Low. (`src/pages/BeyondTheAssessment.tsx:89-100`) — added 2026-06-15 — **completed 2026-06-15 (WP-E…J)**
- [x] **[Consistency]** Mixed straight/curly quotes & apostrophes in body copy — normalize to typographic glyphs. Impact: Low. Effort: Low. (`src/pages/BeyondTheAssessment.tsx:61,75,78,81`) — added 2026-06-15 — **completed 2026-06-15 (WP-E…J)**

### 7. AWS
- [x] **[Accessibility]** Keyboard overlay buttons (static `projectTo2D`) float over the wrong spots because the canvas auto-rotates — remove the invisible overlay layer; the visible cluster nav bar is the real accessible control. Impact: Medium. Effort: Low. (`src/components/aws/InfraTopology.tsx:98-123`, `TopologyScene.tsx:162,250`) — added 2026-06-15 — **completed 2026-06-15 (WP-E…J)**
- [x] **[Accessibility]** Overlay buttons are focusable children of an `aria-hidden="true"` wrapper with per-child `aria-hidden="false"` (unreliable anti-pattern) — resolved by removing the overlay. Impact: Medium. Effort: Low. (`src/components/aws/InfraTopology.tsx:99-108`) — added 2026-06-15 — **completed 2026-06-15 (WP-E…J)**
- [x] **[Cleaner code]** `ClusterDetail.tsx` is dead code (162 lines, exported, never imported; pulls in drei `Html`) — delete. Impact: Medium. Effort: Low. (`src/components/aws/ClusterDetail.tsx:1,98`) — added 2026-06-15 — **completed 2026-06-15 (WP-E…J)**
- [x] **[Cleaner code]** `flyTo` and `handleClusterClick` (and `reset`/`handleDeselect`) duplicate the camera-fly logic — extract `flyToCluster(id)`. Impact: Medium. Effort: Low. (`src/components/aws/TopologyScene.tsx:137,172`) — added 2026-06-15 — **completed 2026-06-15 (WP-E…J)**
- [x] **[Performance]** Hero + Community Builder images lack dimensions (CLS); below-fold banner eager-loads — add width/height + `loading="lazy"`. Impact: Medium. Effort: Low. (`src/pages/AWS.tsx:35-40,50-54`) — added 2026-06-15 — **completed 2026-06-15 (WP-D)**
- [x] **[Consistency]** Reduced-motion read via raw `window.matchMedia` (non-reactive) instead of `useMediaQuery`/`isMotionDisabled()`. Impact: Low. Effort: Low. (`src/components/aws/TopologyScene.tsx:58`, `ClusterEdge.tsx:15`) — added 2026-06-15 — **completed 2026-06-15 (WP-E…J)**

### 8. Claude
- [x] **[Accessibility]** Keyboard-focused pipeline nodes have no visible focus indicator — inline `outline: 'none'` overrides the global gold focus-visible ring on the diagram's main control. Impact: High. Effort: Low. (`src/components/claude/PipelineNode.tsx:48,54`) — added 2026-06-15 — **completed 2026-06-15 (WP-E…J)**
- [x] **[Consistency]** Architecture X-Ray shows stale guardrail config (Version "2") vs live `GUARDRAIL_VERSION = "5"` on a page marketed as production-real. Impact: Medium. Effort: Low. (`src/data/architectureNodes.ts:66`, `lambda/chat-stream/index.mjs:55`) — added 2026-06-15 — **completed 2026-06-15 (WP-E…J)**
- [x] **[Accessibility]** Streaming response bubble re-announces on every chunk via `aria-live="polite"` — gate to the settled response. Impact: Medium. Effort: Low. (`src/components/claude/TraceResponseBubble.tsx:9-12`, `ArchitectureXRay.tsx:297,437`) — added 2026-06-15 — **completed 2026-06-15 (WP-E…J)**
- [x] **[Consistency]** Motion gating uses raw `matchMedia` in two places instead of `isMotionDisabled()` (misses prerender flag). Impact: Low. Effort: Low. (`src/components/claude/ArchitectureXRay.tsx:122,196`) — added 2026-06-15 — **completed 2026-06-15 (WP-E…J)**
- [x] **[Cleaner code]** Duplicate node-state builders (`buildInitialNodeStates`/`resetAllNodeStates` identical + a 3rd inline copy) and a redundant double `abort()`. Impact: Low. Effort: Low. (`src/components/claude/ArchitectureXRay.tsx:25-39,222,248`) — added 2026-06-15 — **completed 2026-06-15 (WP-E…J)**

### 9. Links
- [x] **[Architecture]** `SOCIAL_LINKS` imported but bypassed for all but one entry — already caused live drift (`x.com/x_thechrisgrey` vs constant `x.com/thechrisgrey`). Reconcile the X URL, then source all from the constant. Impact: Medium. Effort: Low. (`src/pages/Links.tsx:43-44,5`; `src/constants/links.ts:9`) — added 2026-06-15 — **completed 2026-06-15 (WP-E…J + X-handle reconcile): all links sourced from SOCIAL_LINKS + social cards deduped; owner confirmed canonical X handle = x.com/thechrisgrey, reconciled across Links.tsx + schemas.ts (Person sameAs)**
- [x] **[Consistency]** Contact CTA uses raw `<a href="/contact">` instead of `ViewTransitionLink`. Impact: Medium. Effort: Low. (`src/pages/Links.tsx:278-283`) — added 2026-06-15 — **completed 2026-06-15 (WP-E…J)**
- [x] **[Cleaner code]** Personal & company social-card grids are byte-identical markup — extract a `SocialCard`/section helper. Impact: Low. Effort: Low. (`src/pages/Links.tsx:201-224,239-262`) — added 2026-06-15 — **completed 2026-06-15 (WP-E…J)**
- [x] **[Performance]** Featured QR image has no width/height/loading/decoding (below fold) — add them (confirm intrinsic size). Impact: Low. Effort: Low. (`src/pages/Links.tsx:133-137`) — added 2026-06-15 — **completed 2026-06-15 (WP-D)**

### 10. Contact & Speaking
- [x] **[Accessibility]** Field validation errors aren't associated with the input (one shared alert; no `aria-invalid`/`aria-describedby`/focus) — track per-field errors (reuse `FormInput` pattern). Impact: High. Effort: Medium. (`src/pages/Contact.tsx:55-66,264-326`; `src/components/ui/FormInput.tsx:41-49`) — added 2026-06-15 — **completed 2026-06-15 (WP-C)**
- [x] **[Accessibility]** Inputs use `focus:outline-hidden`, suppressing the global gold focus-visible ring — drop it (mouse case already handled in CSS). Impact: Low. Effort: Low. (`src/pages/Contact.tsx:273,290,306,324`) — added 2026-06-15 — **completed 2026-06-15 (WP-C)**
- [x] **[Accessibility]** Success-modal confirmation text isn't in a live region — add `role="status" aria-live="polite"`. Impact: Low. Effort: Low. (`src/pages/Contact.tsx:531-537`) — added 2026-06-15 — **completed 2026-06-15 (WP-C)**
- [x] **[Cleaner code]** Dead `'success'` status branch — `formStatus` is never set to `'success'` (success path goes `'idle'` + modal). Impact: Low. Effort: Low. (`src/pages/Contact.tsx:20-23,344-352`) — added 2026-06-15 — **completed 2026-06-15 (WP-C)**
- [x] **[Architecture]** Six near-identical contact-info link blocks (~75 lines) should be data-driven (siblings already `.map`). Impact: Low. Effort: Low. (`src/pages/Contact.tsx:391-468`) — added 2026-06-15 — **completed 2026-06-15 (WP-C)**

### 11. Privacy Policy
- [x] **[Consistency]** "contact form" link is a raw `<a href>` (only raw internal anchor in `src/`) — use `ViewTransitionLink`. Impact: Medium. Effort: Low. (`src/pages/Privacy.tsx:306`) — added 2026-06-15 — **completed 2026-06-15 (WP-E…J)**
- [x] **[Accessibility]** Manual `•` bullet spans are announced by AT — add `aria-hidden` or use native `list-disc marker`. Impact: Low. Effort: Low. (`src/pages/Privacy.tsx:71-72,104-105,198-199,226-227`) — added 2026-06-15 — **completed 2026-06-15 (WP-E…J)**
- [x] **[UX]** "Reset analytics preference" button always renders, even with no consent on file — gate behind `isPostHogConfigured() && getConsent() === 'granted'`. Impact: Low. Effort: Low. (`src/pages/Privacy.tsx:182`) — added 2026-06-15 — **completed 2026-06-15 (WP-E…J)**
- [x] **[Consistency]** Privacy is the only SEO page with no page-level `structuredData` — add `buildWebPageSchema`. Impact: Low. Effort: Low. (`src/pages/Privacy.tsx:17-25`) — added 2026-06-15 — **completed 2026-06-15 (WP-E…J)**
- [ ] **[Cleaner code]** Consent reset forces a full `window.location.reload()` to re-show the banner — could re-show reactively (acceptable as-is for a rare control). Impact: Low. Effort: Medium. (`src/pages/Privacy.tsx:9-13`) — added 2026-06-15 — **deferred 2026-06-15 (WP-J): kept the full reload — acceptable for a rarely-used control per plan; reactive rewrite is out of refinement scope**

### 12. 404 / Not Found
- [x] **[Accessibility]** CTAs/quick-links miss the 48px touch-target + `touch-manipulation` convention. Impact: Medium. Effort: Low. (`src/pages/NotFound.tsx:41-61,69-85`) — added 2026-06-15 — **completed 2026-06-15 (WP-E…J)**
- [x] **[Accessibility]** Decorative oversized `404` glyph is announced to screen readers — add `aria-hidden="true"`. Impact: Low. Effort: Low. (`src/pages/NotFound.tsx:18-28`) — added 2026-06-15 — **completed 2026-06-15 (WP-E…J)**
- [x] **[Consistency]** Buttons use `transition-colors` only — missing `active:scale-[0.98]` press feedback and the gold CTA glow. Impact: Low. Effort: Low. (`src/pages/NotFound.tsx:43,50,57`) — added 2026-06-15 — **completed 2026-06-15 (WP-E…J)**

### 29. SEO

_Medium impact (correctness / authority defects):_
- [x] **[Resilience & tests]** Podcast featured-episode `VideoObject` ships without Google's REQUIRED `uploadDate` — `buildVideoObjectSchema` makes it optional and Podcast.tsx never passes it (the ISO date `LATEST_EPISODE_DATE` is already imported), so the episode is ineligible for video rich results; the blog path passes it correctly. Wire it through + make the builder param required. Impact: Medium. Effort: Low. (`src/utils/schemas.ts:386-397`, `src/pages/Podcast.tsx:8,75-79`) — added 2026-06-20 — **completed 2026-06-20: uploadDate now a required builder param + passed from `LATEST_EPISODE_DATE` (guarded); covered by schemas.test.ts**
- [x] **[Structured data]** `@id` node collisions — the default-graph Person & Organization nodes are re-declared with DIVERGENT content by Altivum.tsx (a 2nd `altivum.ai/#organization`) and by every blog post (a partial Person `author` re-using `thechrisgrey.com/#person`), so two nodes share one `@id` in a single `@graph` and the per-post tag `knowsAbout` can leak onto the global Person identity. Emit bare `{ "@id": ... }` references instead; add a graph-uniqueness test. Impact: Medium. Effort: Medium. (`src/components/SEO.tsx:82-84`, `src/pages/Altivum.tsx:139-187`, `src/pages/BlogPost.tsx:305-311`) — added 2026-06-20 — **completed 2026-06-20: inline Org node removed from Altivum (canonical default node is a superset; dropped `vector.altivum.ai`), BlogPost author → bare `@id` ref; top-level `@graph` uniqueness test added to SEO.test.tsx**
- [x] **[Structured data]** `VideoObject.thumbnailUrl` (a REQUIRED field) defaults to `maxresdefault.jpg`, which 404s for SD/third-party videos; both callers rely on the default (the repo's own YouTubeFacade already falls back maxres→hq). Default to `hqdefault.jpg` (universally generated). Impact: Medium. Effort: Low. (`src/utils/schemas.ts:390`) — added 2026-06-20 — **completed 2026-06-20**
- [x] **[Security]** `/admin` renders NO `<SEO>` and is served as the raw SPA shell carrying index.html's `index, follow` — the `noIndex: true` route flag only drives sitemap/prerender exclusion, not a runtime robots tag (Blueprint handles the same case correctly). Render `<SEO noindex url=".../admin">` (mirror Blueprint) and add `Disallow: /admin` to robots.txt for a pre-JS guarantee. (404 status currently mitigates, so this is defense-in-depth.) Impact: Medium. Effort: Low. (`src/pages/Admin.tsx`, `src/routes.ts:234`, `index.html:21`, `src/pages/Blueprint.tsx:138`) — added 2026-06-20 — **completed 2026-06-20: `<SEO noindex>` now renders for all admin states; chose noindex-only (a robots.txt Disallow would block the noindex from being read, and the route is already 404-served)**
- [x] **[Resilience & tests]** JSON-LD is never structurally validated — every SEO test is a `toContain` substring check; no test asserts schema.org REQUIRED fields, so a builder can drop a required property (e.g. VideoObject `uploadDate`, Book `Offer.price`) and ship green (the project's own documented failure mode). Add per-`@type` required-field assertions in schemas.test.ts. Impact: Medium. Effort: Medium. (`src/utils/schemas.test.ts:202-216`, `src/components/SEO.test.tsx:90-94`) — added 2026-06-20 — **completed 2026-06-20: `REQUIRED_FIELDS_BY_TYPE` harness asserts every builder's required fields + a parseable-`@graph` assertion in SEO.test.tsx**
- [x] **[Resilience & tests]** No build-time gate validates the JSON-LD / canonical / OG of the actually-prerendered dist HTML (the file Google indexes) — only `isPrerender()` is tested. Extend the existing ogCards drift-test idiom to parse each prerendered `<head>`; scope as opt-in/STRICT to respect prerender's deliberately non-fatal design. (Repo was just burned by a prerender/canonical bug, #170.) Impact: Medium. Effort: Medium. (`src/utils/prerender.test.ts`, `scripts/prerender.js`, `src/utils/ogCards.test.ts:42-54`) — added 2026-06-20 — **completed 2026-06-20: `scripts/validate-prerender-seo.mjs` added to the build chain after prerender; non-fatal by default, fails under `STRICT_PRERENDER`; verified against the real `dist/` (JSON-LD + canonical clean on all 13 routes)**
- [x] **[Consistency]** Organization `sameAs` LinkedIn URL is a dead 404 — `/company/altivum-inc` vs the canonical `/company/altivuminc` (200) already in `SOCIAL_LINKS`; a 404 `sameAs` ships site-wide in the default graph and weakens entity grounding. Fix the hyphen / source from `SOCIAL_LINKS` (mirror the #169 X-handle reconcile). Impact: Medium. Effort: Low. (`src/utils/schemas.ts:168`, `src/constants/links.ts:22`) — added 2026-06-20 — **completed 2026-06-20: Org `sameAs` now sourced from `SOCIAL_LINKS` (`.altivumLinkedIn`/`.github`/`.altivumLogic`); regression test added**

_Low impact (standards completeness, hygiene, tests, GEO/E-E-A-T):_
- [ ] **[Structured data]** Person `image` is the 1200×630 social card (`og.png`), not a clean portrait — point at `profile1.jpeg` as an `ImageObject` (keep og.png for og:image). Impact: Low. Effort: Low. (`src/utils/schemas.ts:37`) — added 2026-06-20
- [ ] **[Consistency]** Person `sameAs` diverges from `SOCIAL_LINKS` — omits the live Instagram profile and includes `logic.altivum.ai` (a service site, not a personal identity URL). Add IG, drop the service, derive from the constant. Impact: Low. Effort: Low. (`src/utils/schemas.ts:99-109`, `src/constants/links.ts:10`) — added 2026-06-20
- [ ] **[Content]** Two podcast FAQ answers don't lead with a citable fact (release cadence vague; guest answer opens with marketing copy) — weak GEO/answer-engine extraction. Rewrite first sentences to be standalone-citable (use the real cadence; don't fabricate). Impact: Low. Effort: Low. (`src/utils/schemas.ts:482-487`) — added 2026-06-20
- [ ] **[Cleaner code]** CSR-served noindex routes carry a conflicting double robots directive (shell `index,follow` + helmet `noindex,nofollow`) — make robots a single always-emitted tag in SEO.tsx and remove the hardcoded one from index.html. Impact: Low. Effort: Low. (`index.html:21`, `src/components/SEO.tsx:111`) — added 2026-06-20
- [ ] **[Accessibility]** OG/Twitter cards have no `og:image:alt` / `twitter:image:alt` — add an optional `imageAlt` prop defaulting to `fullTitle`/post title. Impact: Low. Effort: Low. (`src/components/SEO.tsx:121-126,144`) — added 2026-06-20
- [ ] **[UX]** `/blueprint` flag-on state is unhandled for SEO — the enabled `<SEO>` variant omits `noindex` AND the route is never prerendered (served as a 404 generic Home shell pre-JS). Decide indexability: noindex both branches, or add to `STATIC_ROUTES` gated on the flag so prerender writes a 200 with the right canonical. Impact: Low. Effort: Medium. (`src/pages/Blueprint.tsx:138,152-162`, `scripts/generate-sitemap.js:29-43`) — added 2026-06-20
- [ ] **[Cleaner code]** `<meta name="keywords">` is emitted on ~13 pages — ignored by all engines since 2009; drop the emission, the prop, and the per-page strings (keep the JSON-LD `keywords` on Article). Impact: Low. Effort: Low. (`src/components/SEO.tsx:110,25,39`) — added 2026-06-20
- [ ] **[Cleaner code]** `hreflang` `en-US` + `x-default` both self-point on a single-language site — pure clutter; drop both (canonical already conveys the URL). Impact: Low. Effort: Low. (`src/components/SEO.tsx:113-114`) — added 2026-06-20
- [ ] **[Consistency]** `og:image:type` is never emitted though every static card is PNG — add `og:image:type=image/png` for the static path (omit/derive for the Sanity blog crops, whose format auto-negotiates). Impact: Low. Effort: Low. (`src/components/SEO.tsx:121-126`) — added 2026-06-20
- [ ] **[Consistency]** robots.txt AI allow-list names retired Anthropic tokens (`Claude-Web`, `Anthropic-AI`) + non-current `Cohere-ai` and omits the bots that actually drive citations (`ClaudeBot`, `Claude-User`, `Claude-SearchBot`, `OAI-SearchBot`, `Perplexity-User`, `Applebot-Extended`). Refresh the named set. Impact: Low. Effort: Low. (`public/robots.txt:25,28,34`) — added 2026-06-20
- [ ] **[Cleaner code]** Sitemap stamps every static page with TODAY's build date on every build (lastmod inflation Google learns to distrust) while blog posts correctly use `_updatedAt` — drop `<lastmod>` for static pages or derive it from git. Impact: Low. Effort: Low. (`scripts/generate-sitemap.js:104,107-114`) — added 2026-06-20
- [ ] **[Cleaner code]** robots.txt `Disallow: /api/` and `Disallow: /*.json$` match nothing on this origin (dead rules; `/*.json$` is a latent footgun if a `site.webmanifest` is added). Remove `/api/`; narrow the json rule. Impact: Low. Effort: Low. (`public/robots.txt:41-42`) — added 2026-06-20
- [ ] **[UX]** Eight meta descriptions exceed ~160 chars and truncate in SERPs/cards (Contact 213, Claude 207, Podcast 200, Foundation 199, Blueprint 192, Altivum 189, About 183, Beyond-the-Assessment 181) — trim and front-load the hook (worst offenders bury the CTA). Impact: Low. Effort: Low. (`src/pages/Contact.tsx:179` + 7 others) — added 2026-06-20
- [ ] **[UX]** `/privacy` description is 97 chars of boilerplate — expand to ~150 with concrete detail (cookie-free analytics, 90-day chat-memory TTL); keep in sync with the duplicate string in its WebPage schema. Impact: Low. Effort: Low. (`src/pages/Privacy.tsx:31,40`) — added 2026-06-20
- [ ] **[Performance]** Dead `preconnect` to `www.buzzsprout.com` on every page (origin never requested anywhere) — also a dead CSP `frame-src` entry; remove both. Impact: Low. Effort: Low. (`index.html:47`, `customHttp.yml:47`) — added 2026-06-20
- [ ] **[Performance]** Single-route origins (cognito + KB-builder, both `/admin`-only) are eagerly `preconnect`ed site-wide, crowding the ~6-connection budget against critical-path origins — downgrade to `dns-prefetch` or move to the consuming route. Impact: Low. Effort: Low. (`index.html:45-49`) — added 2026-06-20
- [ ] **[Performance]** The third-party media origins `/podcast` actually loads (`i.ytimg.com`, `www.youtube.com`, `open.spotify.com`) have no resource hints — add route-scoped `dns-prefetch` (reusing the budget freed by the dead preconnects). Impact: Low. Effort: Low. (`index.html:38-52`) — added 2026-06-20
- [ ] **[Performance]** LCP hero (hashed `src/assets/hero2.png`) has no `<link rel="preload">` — marginal: the `<img>` IS present in the prerendered body so the preload scanner already finds it; a head preload buys ~9KB-earlier discovery only. Low-value polish. Impact: Low. Effort: Low. (`src/pages/Home.tsx:7,137-144`, `index.html:38-52`) — added 2026-06-20
- [ ] **[Architecture]** The WebPage↔BreadcrumbList back-reference is wired by hand twice; AWS/Claude/Blueprint pass `breadcrumbs` to `<SEO>` but not to `buildWebPageSchema`, so 3 of 5 WebPage nodes never reference the BreadcrumbList beside them. Centralize the link in SEO.tsx. Impact: Low. Effort: Low. (`src/components/SEO.tsx:66-68`, `src/utils/schemas.ts:238-240`) — added 2026-06-20
- [ ] **[Consistency]** Canonical origin is hardcoded as three independent `SITE_URL` sources + inline literals — hoist to one shared `siteConfig` (the codebase centralizes paths in routes.ts; origin should match). Impact: Low. Effort: Low. (`src/utils/schemas.ts:7`, `src/utils/ogCards.ts:16`, `src/components/SEO.tsx:41,136`) — added 2026-06-20
- [ ] **[Cleaner code]** `structuredData` is typed via an inline intersection OUTSIDE `SEOProps` as weak `Record<string,unknown>[]` though 14 pages use it — move into the interface and require `@type` per entry. Impact: Low. Effort: Low. (`src/components/SEO.tsx:22-34,48-49`) — added 2026-06-20
- [ ] **[Cleaner code]** `buildWebPageSchema` emits an explicit `breadcrumb: undefined` key when no breadcrumbs — use the conditional-spread idiom the file already uses elsewhere (`...(opt ? {} : {})`). Impact: Low. Effort: Low. (`src/utils/schemas.ts:238-240`) — added 2026-06-20
- [ ] **[Cleaner code]** Repeated literal blocks in schemas.ts — `areaServed`-US ×3, `inLanguage:"en-US"` ×5, overlapping `knowsAbout` arrays — hoist invariants to shared constants. Impact: Low. Effort: Low. (`src/utils/schemas.ts:150-153,329-332,564-567`) — added 2026-06-20
- [ ] **[Resilience & tests]** Three live builders are completely untested (`buildVideoObjectSchema`, `buildItemListSchema`, `buildFoundationOrganizationSchema`) + `foundationFAQs` — add describe blocks incl. BOTH branches of VideoObject's `uploadDate` spread and ItemList position indexing. Impact: Low. Effort: Low. (`src/utils/schemas.test.ts:2-22`) — added 2026-06-20
- [ ] **[Resilience & tests]** The risky `url`-default→homepage-canonical path is exercised but never asserted — add a test that `<SEO>` with no `url` yields canonical/og:url/hreflang = the homepage (guards against an accidental homepage-canonical-on-a-subpage regression). Impact: Low. Effort: Low. (`src/components/SEO.tsx:41`, `src/components/SEO.test.tsx:77-83`) — added 2026-06-20
- [ ] **[Resilience & tests]** The custom-structuredData merge is only substring-checked — parse the emitted script and assert the 3 default nodes (Person/Org/WebSite) survive + exact length, pinning append-not-replace semantics. Impact: Low. Effort: Low. (`src/components/SEO.tsx:82-84`, `src/components/SEO.test.tsx:96-104`) — added 2026-06-20
