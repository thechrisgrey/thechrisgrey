# UI Redesign — Editorial Design System & Home (Phase 1)

**Date:** 2026-06-11
**Status:** Approved by Christian Perez
**Reference:** "Elyse Residence" by Phenomenon Studio (Dribbble) — dark editorial luxury: high-contrast serif display type, parenthetical section labels, asymmetric stat layouts, horizontal project carousels, restrained motion. The real-estate content is irrelevant; the layout, typography, and style language are the target.

## 1. Goals

Fundamentally redesign thechrisgrey.com's visual identity around a dark editorial language while keeping the existing brand colors as the foundation. Leverage GSAP (scroll choreography) and Three.js (signature 3D) as first-class tools. Phase 1 delivers the design system plus redesigned Home, Navigation, and Footer; inner pages follow in phase 2.

## 2. Color System — "Gallery," 60/20/10/10

| Token | Hex | Ratio | Role |
|---|---|---|---|
| `altivum-dark` (existing) | `#0A0F1C` | 60% | Page canvas, section backgrounds |
| `altivum-porcelain` (new) | `#F2EFE9` | 20% | Display type on dark, the single light (CTA) section, cards |
| `altivum-gold` (existing) | `#C5A572` | 10% | Italic accent words, CTAs, contour lines, dividers, stat suffixes |
| `altivum-umber` (new) | `#3E3A33` | 10% | Tags, secondary tile surfaces, hover states, image grading anchor |

- New tokens are **added** to `tailwind.config.js`; nothing existing is removed.
- Navy `#1A2332`, blue `#2E4A6B`, slate `#4A5A73`, silver `#9BA6B8` demote to supporting neutrals (borders, muted captions) and do not count toward the dominant ratio.
- The 60/20/10/10 governs the dominant visual impression per page. Design rule: any new section declares its ratio contribution. Home audit: dark ~60% (hero, about, stats, ventures), porcelain ~20% (CTA section + display type mass), gold ~10% (contours, italics, pills), umber ~10% (tiles, graded imagery).
- Contrast (verified): porcelain on dark ≈ 15.8:1; gold on dark ≈ 7.8:1 (large type only); porcelain on umber ≈ 9.7:1.

## 3. Typography

- **Display:** Playfair Display, self-hosted via `@fontsource/playfair-display` (npm). Weights 400 + 500 with italics only. woff2 preloaded (two critical files), `font-display: swap` with metrics-tuned local-serif fallback (`size-adjust` etc.) to avoid swap CLS. **No Google Fonts CDN. No CSP changes** (fonts are same-origin).
- **Body/UI:** SF Pro Display stays exactly as today. The serif/system-sans contrast is intentional.
- New module `src/utils/editorialType.ts` (existing `typography.ts` untouched), styles:
  - `displayHero` — clamp(~4.5rem–11rem), uppercase, line-height ≈ 0.95–1.0
  - `displaySection` — clamp(~2.25rem–4rem)
  - `statNumeral` — clamp(~3rem–5.5rem), with smaller italic gold suffix style
  - `pullQuote` — italic, porcelain
  - `eyebrow` — the signature parenthetical label, e.g. `(ABOUT)`: small italic Playfair, letter-spacing ~0.25em, porcelain at 55% opacity
- **Accent rule:** within any display headline, exactly one word may be italic gold. Hierarchy comes from scale and italics — never bold.

## 4. Scope & Architecture: Parallel Design-System Layer

- New editorial components live in `src/components/editorial/`; new tokens/utilities sit alongside existing ones. Only Home, Navigation, and Footer consume them in phase 1. All other routes keep their existing page content and layout untouched — they are framed by the new Nav/Footer chrome only.
- Phase 2 (separate effort, separate spec addendum): migrate inner pages (About, Altivum, Podcast, Book, AWS, Claude, Blog, Links, Contact, Chat page chrome, Privacy, Admin, 404) onto the editorial system.
- Chat widget (Alti mascot) is untouched in phase 1.

## 5. Home Page Structure

Replaces the current Hero → 675/840vh sticky summary → CTA with six editorial sections:

### 5.1 Hero — "Command Grid" bento (100vh)
12-column bento grid, 8px gaps, tiles on `#0D1322` with 1px `rgba(242,239,233,0.07)` hairline borders, 6px radius:

| Tile | Position | Content |
|---|---|---|
| Scene | cols 1–8, rows 1–6 (dominant) | Live Three.js ridge (gold contour terrain). Eyebrow top-left: `(FOUNDER & CEO — ALTIVUM INC.)`. Name lower-left **inside** the tile: "Christian *Perez*" in Playfair (Perez italic gold), caption "Green Beret · Founder · Author · Host". `<h1>` = "Christian Perez" |
| Intro | cols 9–12 | 2–3 sentence positioning copy, SF Pro |
| Stat | cols 9–12, umber bg | "18*D*" + caption "SF Medical Sergeant" |
| Contact | cols 9–12 | "Start a conversation" + gold pill → /contact |
| Venture strip | bottom row, 4 tiles | (PODCAST) The Vector · (BOOK) Beyond the Assessment · (VENTURE) Altivum Inc. · SCROLL ↓ |

Hero venture tiles are wayfinding (compact links); the (VENTURES) carousel below is storytelling — intentional dual presence. Mobile: collapses to 2-col stack, scene tile first.

### 5.2 (ABOUT)
Three-column editorial split: stacked display headline left (e.g. "QUIET DISCIPLINE. *RELENTLESS* EXECUTION."), WebGL image surface center — the existing portrait (`public/profile1.jpeg`) duotone-graded into the palette via the §8 pipeline — quiet copy + "THE FULL STORY" pill right → /about.

### 5.3 (THE RECORD)
Four serif stats scattered asymmetrically (absolute positioning on desktop, stacked on mobile): 18*D* / 60*+* episodes / 1 book / 3*x* ventures, each with tiny uppercase caption. Initial values above are editable content, structure supports any count of 3–5 stats.

### 5.4 (VENTURES)
Pinned section; vertical scroll drives horizontal travel through 4 full-bleed panels: Altivum Inc. → The Vector Podcast → Beyond the Assessment → AWS/Claude work. Numbered indicator (1)–(4). Serif titles parallax against panel imagery. Touch: native horizontal swipe, no pin.

### 5.5 Image break
Full-bleed graded architectural image, 0.85x parallax, one italic porcelain pull-quote crossing it.

### 5.6 (NEXT) — CTA
The single porcelain section (palette inversion as punctuation): dark display headline "BUILD SOMETHING *WORTH KEEPING.*", dark pill → /contact, outline pill → newsletter. Newsletter reuses existing Lambda endpoint.

## 6. Motion System (GSAP)

Rule: **things settle, they never bounce.** Eases `power3.out` or slower; nothing oscillates.

**Load (hero, once):** tiles cascade (opacity + 12px rise, 60ms stagger, ~0.9s) → ridge contours draw in (~1.8s) → stillness (only gold-dust drift at 2% opacity).

**Scroll (ScrollTrigger, building on existing SplitReveal/FadeReveal):**
- (ABOUT): word-by-word headline reveal; image parallax 0.9x; copy fades last
- (THE RECORD): numerals roll up to value, staggered; captions fade after
- (VENTURES): pin + horizontal scrub; per-panel title parallax
- Image break: 0.85x parallax + pull-quote crossing
- Eyebrows: left→right clip-path wipe

**Micro:** tile hover = gold border bloom + 2px lift; existing `active:scale-[0.98]`, `.link-underline` carry forward.

**Reduced motion:** all ScrollTriggers disabled, counters render final values, carousel becomes plain scroll, hero renders settled. Extends the existing Lenis/`prefers-reduced-motion` pattern.

## 7. Three.js Architecture

**One shared WebGL context:** single R3F `<Canvas>` (fixed, full-viewport, `pointer-events:none`, behind DOM) multiplexing scenes via drei `<View>` tied to DOM placeholder rects:

- **Ridge View** (hero scene tile): procedural terrain — ~128×128 plane displaced by simplex noise, gold contour-line shader. Draw-in once, then static. No GLB, no network weight.
- **Atmosphere View** (hero): ≤400 particles desktop / ≤150 mobile, additive, 2% opacity, 30fps cap when idle.
- **Surface Views** ((ABOUT) image, image break, venture panels): textured planes, displacement shader — cursor ripple (desktop hover only) + Lenis scroll-velocity distortion.

Alti mascot keeps its separate existing canvas.

**Contract:**
- Canvas mounts post-first-paint via `requestIdleCallback`; LCP is DOM hero text
- Static SVG contour ridge renders first and **is** the fallback (reduced-motion, no WebGL, context-lost, low-end). Failure mode = staying on first paint
- Images ship as real `<img>` (SEO/fallback); WebGL surface visually replaces when ready
- DPR clamp 2; pause when tab hidden / scrolled past; `frameloop="demand"` after settle

## 8. Imagery Pipeline

- Sources: Unsplash/Pexels (commercial-use licenses). Subjects: abstract textures (dark marble, smoke, contour patterns, fabric) + architectural minimalism (concrete, glass, light studies)
- Selection bar: must read at 60% darkness with type over it; no busy mid-tones
- One-time grading script (`sharp`): darken, desaturate slightly, warm-tint toward umber — uniform set
- Output AVIF + WebP + JPEG at 640/1280/1920 into `src/assets/editorial/`, 80% quality
- Every placement declares `aspect-ratio` (existing CLS rule). No hotlinking; no CSP changes

## 9. Navigation & Footer

**Navigation:** same structure (About dropdown 6 items; Home/Blog/Links/Contact). Transparent over hero → solid dark + hairline gold bottom border past 20px (existing threshold logic). Wordmark in Playfair small caps. Mobile: hamburger opens full-screen dark overlay — Playfair display-size entries, staggered reveal, `useFocusTrap`. Nav transparency on Home updates for the new 100vh hero (old `innerHeight*10` threshold replaced).

**Footer:** one large Playfair line ("Build something *worth keeping.*"), three columns under eyebrows (NAVIGATE) / (VENTURES) / (CONNECT), porcelain on dark, hairline gold dividers; existing legal/social/newsletter content carried over; newsletter input as gold-bordered pill.

Nav + Footer ship in phase 1 and frame all pages, including unmigrated ones.

## 10. Performance, Accessibility, Errors

- **LCP < 2.0s** (hero name, DOM text); fonts ≈ 60KB added; GSAP/Three already in bundle
- CLS ≈ 0 (fixed tile aspect ratios, font metrics override); existing `high-cls` CloudWatch alarm is the post-deploy guardrail; Web Vitals reporting already wired
- A11y: semantic tile links; one accessible `<h1>` string; keyboard-operable carousel that never traps scroll; reduced-motion full static path; skip-to-content, gold `focus-visible`, `useFocusTrap` carried forward; contrast verified (§2)
- Errors: WebGL failure → SVG/static path; image failure → umber tile holds layout; Three components client-only so prerender sees clean markup

## 11. Testing

- Unit: editorialType tokens; SVG fallback render; counter logic (GSAP mocked per existing jsdom pattern); bento semantics; Three mocked everywhere (no WebGL in jsdom)
- Integration: section order; reduced-motion path renders final state; mobile overlay focus trap
- Cypress smoke: hero renders, sections reveal, carousel advances, CTAs navigate
- Build pipeline (env validation → episodes → lint → tsc → vite → sitemap → RSS) unchanged

## 12. Out of Scope (Phase 1)

- Inner-page migration (phase 2), Blueprint UI, chat widget/page restyle, blog Sanity content design, admin tooling
- Copy is implementer-editable content: stat values, intro/about copy, pull-quote text are initial values to be confirmed by Christian during build, not blockers

## 13. Decision Log

| Decision | Choice | Alternatives considered |
|---|---|---|
| Palette | Gallery (porcelain + umber) | Highland (olive), Library (oxblood) |
| Display type | Playfair Display | Instrument Serif, Fraunces |
| Build approach | Parallel design-system layer | Global mutation, /v2 fork |
| Hero | Command Grid bento + live ridge, monumental stillness | Centered name (rejected), Masthead Mosaic, Split Signature |
| Three.js | Shared canvas: ridge + atmosphere + surfaces | Per-component canvases |
| Imagery | Abstract textures + architectural minimalism | Alpine, human/mission |
| Home structure | Full editorial restructure | Re-skin sticky summary, hybrid |
