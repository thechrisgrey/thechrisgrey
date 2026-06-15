# Feature Optimization

> This file tracks ways to REFINE features that already exist in this project.
> It is NOT a roadmap of new features to add — nothing here introduces new
> functionality. Every item makes an existing feature cleaner, faster, safer,
> more accessible, or otherwise better.
>
> Maintained by the `/optimize-features` command. Last full inventory: 2026-06-14

## Feature Inventory

### A. Content & marketing pages

| # | Feature | What it does | Where it lives | Last reviewed |
|---|---------|--------------|----------------|---------------|
| 1 | Home | Hero + sticky scroll-storytelling (8 key points via GSAP ScrollTrigger) → CTA | `src/pages/Home.tsx`, `src/components/home/` | 2026-06-14 |
| 2 | About / Personal Biography | Christian's bio, career, leadership philosophy | `src/pages/About.tsx` | 2026-06-14 |
| 3 | Altivum Inc | Company page (Altivum Logic, Vanguard) | `src/pages/Altivum.tsx` | 2026-06-14 |
| 4 | The Altivum Foundation | Foundation mission, programs, support | `src/pages/Foundation.tsx` | 2026-06-14 |
| 5 | The Vector Podcast | Episodes, guests, subscribe platforms | `src/pages/Podcast.tsx`, `src/components/podcast/`, `EpisodeCard.tsx`, `SpotifyFacade.tsx` | 2026-06-14 |
| 6 | Beyond the Assessment | Book landing page | `src/pages/BeyondTheAssessment.tsx` | 2026-06-14 |
| 7 | AWS | AWS Community Builder page | `src/pages/AWS.tsx`, `src/components/aws/` | 2026-06-14 |
| 8 | Claude | AI work / Anthropic page | `src/pages/Claude.tsx`, `src/components/claude/` | 2026-06-14 |
| 9 | Links | Link-in-bio hub | `src/pages/Links.tsx` | 2026-06-14 |
| 10 | Contact & Speaking | Contact form + speaking/press info | `src/pages/Contact.tsx` (+ contact endpoint) | 2026-06-14 |
| 11 | Privacy Policy | Privacy/legal page | `src/pages/Privacy.tsx` | 2026-06-14 |
| 12 | 404 / Not Found | Catch-all error page | `src/pages/NotFound.tsx` | 2026-06-14 |

### B. Blog system

| # | Feature | What it does | Where it lives | Last reviewed |
|---|---------|--------------|----------------|---------------|
| 13 | Blog listing | Series/category/featured filtering from Sanity | `src/pages/Blog.tsx`, `src/sanity/queries.ts` | 2026-06-14 |
| 14 | Blog post reading | Portable Text, Shiki highlighting, reading progress, image CLS fix | `src/pages/BlogPost.tsx`, `src/sanity/PortableTextComponents.tsx`, `HighlightedCodeBlock.tsx`, `ReadingProgressBar.tsx` | 2026-06-14 |
| 15 | RSS feed | Sanity posts → `dist/rss.xml` | `scripts/generate-rss.js` | 2026-06-14 |

### C. Alti — AI agent

| # | Feature | What it does | Where it lives | Last reviewed |
|---|---------|--------------|----------------|---------------|
| 16 | Alti chat (frontend) | Full-page `/chat` + floating widget, shared engine, sessionStorage sync | `src/pages/Chat.tsx`, `src/components/chat/`, `src/hooks/useChatEngine.ts` | 2026-06-14 |
| 17 | Alti backend | Streaming agent (Strands + Bedrock Haiku), 8 tools, KB RAG, events | `lambda/chat-stream/` | 2026-06-14 |
| 18 | Alti 3D mascot | R3F mascot in widget button + canvas safety | `src/components/chat/` (AltiMascot), `SafeCanvas.tsx`, `public/alti.glb` | 2026-06-14 |
| 19 | Visitor memory | Per-device fact memory, PII-sanitized, 90-day TTL | `lambda/chat-stream/memory.mjs`, `src/utils/deviceId.ts` | 2026-06-14 |
| 20 | Knowledge Base + sync | Bedrock KB retrieval + S3-event ingestion | `lambda/kb-sync/`, KB `ARFYABW8HP` | 2026-06-14 |

### D. Other interactive / platform features

| # | Feature | What it does | Where it lives | Last reviewed |
|---|---------|--------------|----------------|---------------|
| 21 | Blueprint generator | Architecture generator (Opus + Haiku verdict), golden-example RAG | `src/pages/Blueprint.tsx`, `lambda/blueprint/`, `src/hooks/useBlueprint.ts` | 2026-06-14 |
| 22 | KB Admin console | Cognito-gated CRUD on Sanity `kbEntry` → `knowledge-base.txt` → S3 | `src/pages/Admin.tsx`, `src/components/admin/`, `lambda/kb-builder/` | 2026-06-14 |
| 23 | Site Health dashboard | Live metrics/alarms view on `/admin` | `src/hooks/useSiteHealth.ts` | 2026-06-14 |
| 24 | Newsletter signup | Signup form + CTA (reused for Blueprint waitlist) | `src/components/NewsletterForm.tsx`, `NewsletterCTA.tsx` (+ newsletter endpoint) | 2026-06-14 |
| 25 | Public MCP server | `ask_alti` tool over KB + Bedrock + guardrail; install badge | `lambda/mcp-server/`, `src/components/McpInstallBadge.tsx` | 2026-06-14 |
| 26 | Social proof / testimonials | Testimonial display | `src/components/Testimonials.tsx` | 2026-06-14 |

### E. Cross-cutting site systems

| # | Feature | What it does | Where it lives | Last reviewed |
|---|---------|--------------|----------------|---------------|
| 27 | Navigation | Header + About dropdown, mobile hamburger, routes SSOT | `src/components/Navigation.tsx`, `src/routes.ts` | 2026-06-14 |
| 28 | Design system & motion | Typography/colors, Lenis smooth scroll, View Transitions, scroll reveals, micro-interactions | `src/index.css`, `src/utils/typography.ts`, `LenisProvider.tsx`, `ViewTransitionLink.tsx`, `SplitReveal.tsx`, `FadeReveal.tsx`, `src/utils/motion.ts` | 2026-06-14 |
| 29 | SEO | Meta tags + JSON-LD `@graph` schemas | `src/components/SEO.tsx`, `src/utils/schemas.ts` | 2026-06-14 |
| 30 | Analytics & consent | Plausible/Cloudflare/PostHog, consent-gated | `src/components/ConsentBanner.tsx`, `public/plausible-init.js` | 2026-06-14 |
| 31 | Web Vitals & monitoring | Vitals + CSP-report ingestion → CloudWatch, alarms | `src/utils/webVitals.ts`, `lambda/metrics/` | 2026-06-14 |
| 32 | Error handling | Global + page-level error boundaries, pathname-keyed reset | `src/components/ErrorBoundary.tsx`, `ErrorFallbacks.tsx` | 2026-06-14 |
| 33 | Security layer | HMAC request signing, session token, rate limiting, guardrail | `src/utils/chatSigning.ts`, `lambda/session-token/`, `lambda/shared/` (hmac, rateLimit) | 2026-06-14 |

### F. Build-time & ops

| # | Feature | What it does | Where it lives | Last reviewed |
|---|---------|--------------|----------------|---------------|
| 34 | Build pipeline & env validation | Fail-fast env checks + Amplify build config | `scripts/validate-env.js`, `amplify.yml` | 2026-06-14 |
| 35 | Sitemap generation | Sanity posts → `dist/sitemap.xml` (SSOT for indexable set) | `scripts/generate-sitemap.js` | 2026-06-14 |
| 36 | SSG prerendering | Build-time prerender crawl of static routes | `scripts/prerender.js` | 2026-06-14 |
| 37 | Podcast episode generation | YouTube API → `generatedEpisodes.json` (static fallback) | `scripts/generate-podcast-episodes.js` | 2026-06-14 |
| 38 | OG image generation | Build-time Open Graph image assets | `scripts/generate-og-images.mjs`, `scripts/og-assets/` | 2026-06-14 |
| 39 | Podcast transcription & ingestion | Transcribe episodes + ingest transcripts into KB | `scripts/transcribe-podcast.mjs`, `transcribe-youtube.mjs`, `ingest-podcast-transcripts.mjs` | 2026-06-14 |
| 40 | Lambda deploy & verification tooling | Verified deploy + import smoke check + IAM drift | `scripts/deploy-lambda.sh`, `smoke-test-lambdas.mjs`, `iam-drift.sh` | 2026-06-14 |

## Optimization Opportunities

> Populated per feature as `/optimize-features` reviews them. Each item:
> `- [ ] **[Lens]** <title> — <summary>. Impact: <H/M/L>. Effort: <L/M/H>. (file:line) — added <date>`
> Completed items are checked off with a completion date rather than deleted.

**Group A (content & marketing pages) reviewed 2026-06-15** — 61 verified refinements via parallel review + adversarial verification.

### 1. Home
- [ ] **[Accessibility]** Heading outline skips h1→h3 with the lone h2 out of order — sr-only h1, then 8× `as="h3"` keyPoints, then the CTA h2; primary content has no parent h2. Demote keyPoints to h2 or add a visually-hidden section h2 (`SplitReveal` `as` union needs `'h2'`). Impact: Medium. Effort: Low. (`src/pages/Home.tsx:57-66`, `src/components/SplitReveal.tsx:14`) — added 2026-06-15
- [ ] **[Performance]** Below-the-fold profile image eager-loads and competes with the LCP hero — add `loading="lazy" decoding="async"`. Impact: Medium. Effort: Low. (`src/pages/Home.tsx:158-163`) — added 2026-06-15
- [ ] **[Cleaner code]** Dead conditional branch — the `point.link` ternary's `<div>` fallback is unreachable (every keyPoint has a link). Impact: Low. Effort: Low. (`src/pages/Home.tsx:89-93`) — added 2026-06-15
- [ ] **[Architecture]** Static `keyPoints` array and `renderTab` are reconstructed on every render — hoist `keyPoints` to module scope. Impact: Low. Effort: Low. (`src/pages/Home.tsx:30-41`) — added 2026-06-15
- [ ] **[Consistency]** keyPoint tabs keyed by array index while sibling lists key by content. Impact: Low. Effort: Low. (`src/pages/Home.tsx:84`) — added 2026-06-15
- [ ] **[Cleaner code]** Hero shader comment documents the wrong navy hex (`// #1A2332` vs actual `#2E4A6B`). Impact: Low. Effort: Low. (`src/components/home/heroShader.ts:32`) — added 2026-06-15

### 2. About / Personal Biography
- [ ] **[Consistency]** "Altivum Inc." and "Beyond the Assessment" are plain text — wrap in `ViewTransitionLink` to `/altivum` and `/beyond-the-assessment`. Impact: Medium. Effort: Low. (`src/pages/About.tsx:52-53,74,83-84`) — added 2026-06-15
- [ ] **[Performance]** Hero signature image has no width/height/aspect-ratio (CLS risk) — add `width={1500} height={1500}`. Impact: Low. Effort: Low. (`src/pages/About.tsx:34-39`) — added 2026-06-15
- [ ] **[Performance]** 1500×1500 hero PNG ships full-res for a ≤768px box (mostly-transparent canvas) — pre-resize/crop the asset. Impact: Low. Effort: Low. (`src/pages/About.tsx:34-39`) — added 2026-06-15
- [ ] **[Cleaner code]** Italic via inline `style={{ fontStyle: 'italic' }}` instead of the Tailwind `italic` class used everywhere else. Impact: Low. Effort: Low. (`src/pages/About.tsx:74`) — added 2026-06-15
- [ ] **[Accessibility]** Hero image alt ("My Personal Biography") duplicates the sr-only h1 and misses the mark's text — tighten or set `alt=""`. Impact: Low. Effort: Low. (`src/pages/About.tsx:36,48`) — added 2026-06-15

### 3. Altivum Inc
- [ ] **[Consistency]** CTAs/external links drop the standard button recipe (`min-h-[48px] touch-manipulation active:scale-[0.98]`, gold glow) that Foundation uses. Impact: Medium. Effort: Low. (`src/pages/Altivum.tsx:408-421`) — added 2026-06-15
- [ ] **[Consistency]** Branch cards & HQ node bypass `typography.ts` with raw `text-*`/`leading-*` utilities. Impact: Medium. Effort: Low. (`src/pages/Altivum.tsx:255-309`) — added 2026-06-15
- [ ] **[Cleaner code]** Each `timelineItems` entry defines an `icon` SVG that is never rendered — render it or drop the field. Impact: Medium. Effort: Low. (`src/pages/Altivum.tsx:13-17,344-362`) — added 2026-06-15
- [ ] **[Cleaner code]** The three "Imperatives" are authored verbatim twice (timeline + Mission) — hoist to one array (cf. Foundation `FOCUS_AREAS`). Impact: Medium. Effort: Low. (`src/pages/Altivum.tsx:52-71,383-396`) — added 2026-06-15
- [ ] **[UI]** Hero badges positioned with magic `bottom-50` (200px) — can crowd the logo on short viewports; use an intentional corner offset. Impact: Low. Effort: Low. (`src/pages/Altivum.tsx:215,228`) — added 2026-06-15
- [ ] **[Performance]** LCP hero logo has no width/height (verifier scoped to hero only; AWS logo & full-screen image already reserve boxes). Impact: Low. Effort: Low. (`src/pages/Altivum.tsx:203-208`) — added 2026-06-15
- [ ] **[Accessibility]** Chamber-recognition anchor needs an `aria-label` with new-tab/destination context (decorative-SVG portion mostly moot). Impact: Low. Effort: Low. (`src/pages/Altivum.tsx:224-232`) — added 2026-06-15

### 4. The Altivum Foundation
- [ ] **[Consistency]** Cybersecurity is a 4th funded field (grid + FAQ + schema) but dropped from H1, meta description, keywords, and Vision copy — align the crawlable/snippet copy to the four-field model. Impact: High. Effort: Low. (`src/pages/Foundation.tsx:64,35-36,103`; `src/utils/schemas.ts:531,561`) — added 2026-06-15
- [ ] **[Performance]** Hero LCP JPEG ships 175 KB un-re-encoded with no WebP variant — convert to q80 WebP (AWS.tsx convention). Impact: Medium. Effort: Low. (`src/pages/Foundation.tsx:3,49-54`) — added 2026-06-15
- [ ] **[Accessibility]** The four focus areas are a `<div>` grid, not a semantic list — wrap in `<ul>`/`<li>`. Impact: Low. Effort: Low. (`src/pages/Foundation.tsx:149-166`) — added 2026-06-15
- [ ] **[Cleaner code]** Four near-identical CTA button blocks hand-duplicated — extract local button variants. Impact: Low. Effort: Low. (`src/pages/Foundation.tsx:71-86,220-235`) — added 2026-06-15

### 5. The Vector Podcast
- [x] **[Cleaner code]** Episode dates render one day early for US visitors — `new Date('YYYY-MM-DD')` parses as UTC; make `formatDate` TZ-safe (cf. existing `formatMonthYear`). Impact: High. Effort: Low. (`src/utils/dateFormatter.ts:8`, `src/components/EpisodeCard.tsx:53,72,179`) — added 2026-06-15 — **completed 2026-06-15 (WP-A)**
- [ ] **[UX]** Featured "Now Playing" details card omits Spotify/Apple/YouTube listen links that every other card shows — add the link row. Impact: Medium. Effort: Low. (`src/pages/Podcast.tsx:169-187`) — added 2026-06-15
- [ ] **[Architecture]** EpisodeCard `topics`/`guests` sections are dead for production data (generator emits `topics: []`, never `guests`) — pick one source of truth. Impact: Medium. Effort: Medium. (`src/components/EpisodeCard.tsx:196,220`; `scripts/generate-podcast-episodes.js:261`) — added 2026-06-15
- [x] **[Resilience & tests]** EpisodeCard date test uses a midday-UTC fixture that masks the date bug and never asserts the rendered date — use bare `YYYY-MM-DD` + assert under a fixed TZ. Impact: Medium. Effort: Low. (`src/components/EpisodeCard.test.tsx:11,22`) — added 2026-06-15 — **completed 2026-06-15 (WP-A)**
- [ ] **[Accessibility]** Compact episode accordion button has `aria-expanded` but no `aria-controls`/labelled region — add a panel id. Impact: Low. Effort: Low. (`src/components/EpisodeCard.tsx:24,66-67`) — added 2026-06-15
- [ ] **[Consistency]** `SpotifyFacade` iframe lacks the `sandbox` hardening `YouTubeFacade` applies (live-verify Spotify still plays). Impact: Low. Effort: Low. (`src/components/SpotifyFacade.tsx:13`, `src/components/YouTubeFacade.tsx:30`) — added 2026-06-15

### 6. Beyond the Assessment
- [ ] **[Performance]** Hero + reading images lack intrinsic width/height — CLS on a tracked metric; add `1500×1500` / `1131×1600` (Home pattern). Impact: High. Effort: Low. (`src/pages/BeyondTheAssessment.tsx:31-36,52-56`) — added 2026-06-15
- [ ] **[Architecture]** 2.1 MB unused source EPUB committed in `src/assets/` (56 XHTML files, never imported) — remove from repo. Impact: Low. Effort: Low. (`src/assets/Beyond the Assessment FINAL.epub/`) — added 2026-06-15
- [ ] **[Consistency]** CTA hover uses stock `amber-400` instead of `hover:bg-altivum-gold/90`. Impact: Low. Effort: Low. (`src/pages/BeyondTheAssessment.tsx:94`) — added 2026-06-15
- [ ] **[Accessibility]** CTA omits touch-target/press-feedback classes; arrow SVG lacks `aria-hidden`. Impact: Low. Effort: Low. (`src/pages/BeyondTheAssessment.tsx:89-100`) — added 2026-06-15
- [ ] **[Consistency]** Mixed straight/curly quotes & apostrophes in body copy — normalize to typographic glyphs. Impact: Low. Effort: Low. (`src/pages/BeyondTheAssessment.tsx:61,75,78,81`) — added 2026-06-15

### 7. AWS
- [ ] **[Accessibility]** Keyboard overlay buttons (static `projectTo2D`) float over the wrong spots because the canvas auto-rotates — remove the invisible overlay layer; the visible cluster nav bar is the real accessible control. Impact: Medium. Effort: Low. (`src/components/aws/InfraTopology.tsx:98-123`, `TopologyScene.tsx:162,250`) — added 2026-06-15
- [ ] **[Accessibility]** Overlay buttons are focusable children of an `aria-hidden="true"` wrapper with per-child `aria-hidden="false"` (unreliable anti-pattern) — resolved by removing the overlay. Impact: Medium. Effort: Low. (`src/components/aws/InfraTopology.tsx:99-108`) — added 2026-06-15
- [ ] **[Cleaner code]** `ClusterDetail.tsx` is dead code (162 lines, exported, never imported; pulls in drei `Html`) — delete. Impact: Medium. Effort: Low. (`src/components/aws/ClusterDetail.tsx:1,98`) — added 2026-06-15
- [ ] **[Cleaner code]** `flyTo` and `handleClusterClick` (and `reset`/`handleDeselect`) duplicate the camera-fly logic — extract `flyToCluster(id)`. Impact: Medium. Effort: Low. (`src/components/aws/TopologyScene.tsx:137,172`) — added 2026-06-15
- [ ] **[Performance]** Hero + Community Builder images lack dimensions (CLS); below-fold banner eager-loads — add width/height + `loading="lazy"`. Impact: Medium. Effort: Low. (`src/pages/AWS.tsx:35-40,50-54`) — added 2026-06-15
- [ ] **[Consistency]** Reduced-motion read via raw `window.matchMedia` (non-reactive) instead of `useMediaQuery`/`isMotionDisabled()`. Impact: Low. Effort: Low. (`src/components/aws/TopologyScene.tsx:58`, `ClusterEdge.tsx:15`) — added 2026-06-15

### 8. Claude
- [ ] **[Accessibility]** Keyboard-focused pipeline nodes have no visible focus indicator — inline `outline: 'none'` overrides the global gold focus-visible ring on the diagram's main control. Impact: High. Effort: Low. (`src/components/claude/PipelineNode.tsx:48,54`) — added 2026-06-15
- [ ] **[Consistency]** Architecture X-Ray shows stale guardrail config (Version "2") vs live `GUARDRAIL_VERSION = "5"` on a page marketed as production-real. Impact: Medium. Effort: Low. (`src/data/architectureNodes.ts:66`, `lambda/chat-stream/index.mjs:55`) — added 2026-06-15
- [ ] **[Accessibility]** Streaming response bubble re-announces on every chunk via `aria-live="polite"` — gate to the settled response. Impact: Medium. Effort: Low. (`src/components/claude/TraceResponseBubble.tsx:9-12`, `ArchitectureXRay.tsx:297,437`) — added 2026-06-15
- [ ] **[Consistency]** Motion gating uses raw `matchMedia` in two places instead of `isMotionDisabled()` (misses prerender flag). Impact: Low. Effort: Low. (`src/components/claude/ArchitectureXRay.tsx:122,196`) — added 2026-06-15
- [ ] **[Cleaner code]** Duplicate node-state builders (`buildInitialNodeStates`/`resetAllNodeStates` identical + a 3rd inline copy) and a redundant double `abort()`. Impact: Low. Effort: Low. (`src/components/claude/ArchitectureXRay.tsx:25-39,222,248`) — added 2026-06-15

### 9. Links
- [ ] **[Architecture]** `SOCIAL_LINKS` imported but bypassed for all but one entry — already caused live drift (`x.com/x_thechrisgrey` vs constant `x.com/thechrisgrey`). Reconcile the X URL, then source all from the constant. Impact: Medium. Effort: Low. (`src/pages/Links.tsx:43-44,5`; `src/constants/links.ts:9`) — added 2026-06-15
- [ ] **[Consistency]** Contact CTA uses raw `<a href="/contact">` instead of `ViewTransitionLink`. Impact: Medium. Effort: Low. (`src/pages/Links.tsx:278-283`) — added 2026-06-15
- [ ] **[Cleaner code]** Personal & company social-card grids are byte-identical markup — extract a `SocialCard`/section helper. Impact: Low. Effort: Low. (`src/pages/Links.tsx:201-224,239-262`) — added 2026-06-15
- [ ] **[Performance]** Featured QR image has no width/height/loading/decoding (below fold) — add them (confirm intrinsic size). Impact: Low. Effort: Low. (`src/pages/Links.tsx:133-137`) — added 2026-06-15

### 10. Contact & Speaking
- [ ] **[Accessibility]** Field validation errors aren't associated with the input (one shared alert; no `aria-invalid`/`aria-describedby`/focus) — track per-field errors (reuse `FormInput` pattern). Impact: High. Effort: Medium. (`src/pages/Contact.tsx:55-66,264-326`; `src/components/ui/FormInput.tsx:41-49`) — added 2026-06-15
- [ ] **[Accessibility]** Inputs use `focus:outline-hidden`, suppressing the global gold focus-visible ring — drop it (mouse case already handled in CSS). Impact: Low. Effort: Low. (`src/pages/Contact.tsx:273,290,306,324`) — added 2026-06-15
- [ ] **[Accessibility]** Success-modal confirmation text isn't in a live region — add `role="status" aria-live="polite"`. Impact: Low. Effort: Low. (`src/pages/Contact.tsx:531-537`) — added 2026-06-15
- [ ] **[Cleaner code]** Dead `'success'` status branch — `formStatus` is never set to `'success'` (success path goes `'idle'` + modal). Impact: Low. Effort: Low. (`src/pages/Contact.tsx:20-23,344-352`) — added 2026-06-15
- [ ] **[Architecture]** Six near-identical contact-info link blocks (~75 lines) should be data-driven (siblings already `.map`). Impact: Low. Effort: Low. (`src/pages/Contact.tsx:391-468`) — added 2026-06-15

### 11. Privacy Policy
- [ ] **[Consistency]** "contact form" link is a raw `<a href>` (only raw internal anchor in `src/`) — use `ViewTransitionLink`. Impact: Medium. Effort: Low. (`src/pages/Privacy.tsx:306`) — added 2026-06-15
- [ ] **[Accessibility]** Manual `•` bullet spans are announced by AT — add `aria-hidden` or use native `list-disc marker`. Impact: Low. Effort: Low. (`src/pages/Privacy.tsx:71-72,104-105,198-199,226-227`) — added 2026-06-15
- [ ] **[UX]** "Reset analytics preference" button always renders, even with no consent on file — gate behind `isPostHogConfigured() && getConsent() === 'granted'`. Impact: Low. Effort: Low. (`src/pages/Privacy.tsx:182`) — added 2026-06-15
- [ ] **[Consistency]** Privacy is the only SEO page with no page-level `structuredData` — add `buildWebPageSchema`. Impact: Low. Effort: Low. (`src/pages/Privacy.tsx:17-25`) — added 2026-06-15
- [ ] **[Cleaner code]** Consent reset forces a full `window.location.reload()` to re-show the banner — could re-show reactively (acceptable as-is for a rare control). Impact: Low. Effort: Medium. (`src/pages/Privacy.tsx:9-13`) — added 2026-06-15

### 12. 404 / Not Found
- [ ] **[Accessibility]** CTAs/quick-links miss the 48px touch-target + `touch-manipulation` convention. Impact: Medium. Effort: Low. (`src/pages/NotFound.tsx:41-61,69-85`) — added 2026-06-15
- [ ] **[Accessibility]** Decorative oversized `404` glyph is announced to screen readers — add `aria-hidden="true"`. Impact: Low. Effort: Low. (`src/pages/NotFound.tsx:18-28`) — added 2026-06-15
- [ ] **[Consistency]** Buttons use `transition-colors` only — missing `active:scale-[0.98]` press feedback and the gold CTA glow. Impact: Low. Effort: Low. (`src/pages/NotFound.tsx:43,50,57`) — added 2026-06-15
