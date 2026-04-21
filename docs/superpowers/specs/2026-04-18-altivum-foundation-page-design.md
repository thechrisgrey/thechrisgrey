# The Altivum Foundation page — design

**Date:** 2026-04-18
**Status:** Approved (pending implementation plan)
**Author:** Christian Perez (with Claude)

## Problem

thechrisgrey.com is the personal site for Christian Perez. It currently surfaces six pillars of his work via a scroll-triggered "Table of Contents" on the home page and an About dropdown in the navigation (Personal Biography, Altivum Inc, The Vector Podcast, Beyond the Assessment, Amazon Web Services, Claude).

Christian has launched a seventh pillar — **The Altivum Foundation**, a 501(c)(3) nonprofit funding veteran education in cloud, AI, and robotics. The foundation has its own canonical website at `altivumfoundation.org`. thechrisgrey.com has no surface that acknowledges it.

## Goals

1. Add a seventh page on thechrisgrey.com — `/foundation` — that introduces The Altivum Foundation from Christian's perspective and funnels visitors to `altivumfoundation.org`.
2. Integrate the new page into the home-page summary scroll and the About dropdown navigation, matching the existing pattern exactly.
3. Preserve the current home-page scroll pacing — no per-tab timing changes, just a proportional extension of the sticky section.
4. Ship SEO metadata (WebPage, NonprofitOrganization JSON-LD, FAQ schema) and sitemap coverage for the new route.

## Non-goals

- Duplicating the full content of `altivumfoundation.org`. This is a pointer page, not a mirror.
- Building a donation flow, scholarship application form, or board-of-directors listing on thechrisgrey.com. All of those live on the foundation site.
- Any standalone brand identity for the foundation beyond what the existing thechrisgrey.com design system supports (altivum-* palette, typography tokens, card hover patterns).
- New tests. No existing tests cover Home's `keyPoints` array or Navigation's dropdown contents; this change matches the pattern of prior additions like `/aws` and `/claude`.

## Design

### Chosen approach

**Approach A — pointer page**, matching the `/altivum` → `altivum.ai` pattern. A short, curated introduction on thechrisgrey.com with all deep CTAs pointing at `altivumfoundation.org`. Low-maintenance (single source of truth remains the foundation site), on-brand for a personal site.

Considered and rejected:
- *Full informational page* — duplicates the foundation site; creates two sources of truth that will drift.
- *Personal-lens essay only* — loses the concrete proof points (stats, focus areas) that communicate what the foundation actually funds.

### Page structure (`/foundation`)

Six sections, in order. All section styling reuses existing Tailwind utilities and `src/utils/typography.ts` tokens.

| # | Section | Purpose |
|---|---------|---------|
| 1 | Hero | Foundation image backdrop (darkened), kicker "The Altivum Foundation", headline "Veteran scholarships in AI, Cloud & Robotics.", subtitle, two CTAs: primary "Visit altivumfoundation.org" + secondary "Give Now" (both `target="_blank"`). |
| 2 | Vision | Centered copy with the foundation's core framing: "The military trains the operators the AI economy is looking for." + supporting paragraph adapted from the foundation site's HomeMission. |
| 3 | Stats band | 3-column layout on navy tint. Gold numerals: `200K+` veterans transitioning annually, `3.5M` unfilled US tech jobs, `$0` cost to scholars. |
| 4 | Focus Areas | 2×2 grid of four cards: Cloud Computing, Artificial Intelligence, Robotics, Cybersecurity. Ordinal (01–04) + name + short description per card. |
| 5 | Founder tie-in | Left gold-rule block: kicker "Founder & President" → headline "Why I built this." → three first-person paragraphs → "More about Christian →" link back to `/about`. This is the section that justifies the page living on a personal site. |
| 6 | CTA band | Gradient navy → blue. Headline "Ready to invest in a veteran's future?", subtitle "Every contribution is tax-deductible.", micro-line "501(c)(3) · EIN 41-4163272", two buttons: Give Now + Visit altivumfoundation.org. |

**File:** `src/pages/Foundation.tsx`

- Lazy-loaded; no ErrorBoundary wrapper (static content, matches `/altivum`).
- Uses `foundationImage` imported from `src/assets/foundation.jpg`.
- Uses `foundationFAQs` and `buildFoundationOrganizationSchema` from `src/utils/schemas.ts`.
- No new CSS files. No new animation keyframes. Uses existing `animate-fade-in` for hero entrance.

### Home page integration

**File:** `src/pages/Home.tsx`

- `keyPoints` array grows from 6 → 7. Inserted at index 1 (after Altivum Inc):
  ```
  { title: "The Altivum Foundation", subtitle: "Founder & President", link: "/foundation" }
  ```
- Sticky summary section height: `h-[575vh] md:h-[680vh]` → `h-[625vh] md:h-[760vh]`. Preserves the existing per-tab pacing rhythm exactly; only the total scroll length changes (+50vh mobile, +80vh desktop).
- Scroll-progress clamp: `Math.min(..., 5)` → `Math.min(..., 6)`.

No other changes to `Home.tsx`. The `useEffect` throttling, `isMobileRef`, and `willChange` hints are unaffected.

### Navigation integration

**File:** `src/components/Navigation.tsx`

- Transparency threshold on the home page: `window.innerHeight * 8` → `window.innerHeight * 9`. Keeps the nav transparent through the now-taller sticky section on desktop; without this bump, desktop would solidify mid-section because the summary extends past the current threshold.
- `ABOUT_DROPDOWN_ITEMS` array: insert `{ path: '/foundation', label: 'The Altivum Foundation' }` between `Altivum Inc` and `The Vector Podcast`.

Both desktop dropdown and mobile-expanded "About" section render from the same array, so both pick up the new entry automatically. Keyboard navigation (arrow keys, Escape, Tab) already uses `ABOUT_DROPDOWN_ITEMS.length` and needs no change.

### Routing and prefetch

**File:** `src/App.tsx`

- Add `const Foundation = lazy(() => import('./pages/Foundation'));`
- Add `<Route path="/foundation" element={<Foundation />} />` near the existing `/altivum` route.

**File:** `src/utils/routeManifest.ts`

- Add `['/foundation', () => import('../pages/Foundation')]` to `routeImports`. This enables `PrefetchLink` to prefetch the Foundation chunk on hover/focus from nav and home.

### SEO and schema

**File:** `src/utils/schemas.ts`

Add two exports:

1. `foundationFAQs: FAQItem[]` — three Q&As:
   - "What is The Altivum Foundation?"
   - "Who is eligible for a scholarship?"
   - "Is my donation tax-deductible?"

2. `buildFoundationOrganizationSchema()` — returns a JSON-LD `NonprofitOrganization` node:
   ```
   {
     "@type": "NonprofitOrganization",
     "@id": "https://altivumfoundation.org/#organization",
     "name": "The Altivum Foundation",
     "url": "https://altivumfoundation.org",
     "description": "A 501(c)(3) nonprofit funding U.S. military veterans pursuing education in cloud computing, artificial intelligence, and robotics — at no cost to the scholar.",
     "taxID": "41-4163272",
     "nonprofitStatus": "Nonprofit501c3",
     "founder": { "@id": "https://thechrisgrey.com/#person" },
     "knowsAbout": [
       "Cloud Computing",
       "Artificial Intelligence",
       "Robotics",
       "Cybersecurity",
       "Veteran Education"
     ],
     "areaServed": { "@type": "Country", "name": "United States" }
   }
   ```

**File:** `src/components/SEO.tsx`

No changes. Existing props (`faq`, `breadcrumbs`, `structuredData`) are sufficient. `Foundation.tsx` passes both `faq={foundationFAQs}` and `structuredData={[buildFoundationOrganizationSchema()]}`.

### Sitemap

**File:** `scripts/generate-sitemap.js`

- Add `{ url: '/foundation', priority: '0.9', changefreq: 'weekly' }` to `staticPages`. Matches the weights used for `/altivum`.

### Asset

- Copy `~/Desktop/altivum-dev/altivum-foundation/src/assets/originals/heroes/taf1.jpeg` (2.0 MB) → `src/assets/foundation.jpg`.
- Vite's `vite-plugin-image-optimizer` will compress to 80% quality at build; expected output < 500 KB.
- No CSP updates required (served same-origin from the bundled assets).

## Verification

Local, pre-commit:
- `npm run lint` — TS + ESLint clean.
- `npm run build` — full pipeline passes (env validation, podcast fetch, tsc, vite, sitemap, RSS). Confirms the new route compiles, the Foundation chunk is emitted, and `/foundation` appears in the generated sitemap.
- `npm run dev` — manual walk-through:
  - Home scroll on desktop + mobile viewport sizes: seven tabs reveal with the previous per-tab rhythm; nav stays transparent through the whole summary and solidifies within the CTA section.
  - About dropdown (desktop): seven items visible, new entry in the correct slot, keyboard navigation still works.
  - About section (mobile hamburger): seven items expanded inline in the correct order.
  - `/foundation` renders; hero image loads; both hero CTAs and both footer CTAs open `altivumfoundation.org` in a new tab; "More about Christian →" links to `/about`.

## Risks

- **Home scroll-math regression.** If the clamp max or section heights are off, the last tab may not appear before the sticky releases, or the nav will solidify early. Rollback is trivial (revert two numeric constants in `Home.tsx` and one in `Navigation.tsx`).
- **Image weight.** `taf1.jpeg` is 2 MB pre-optimization. If the post-build asset still exceeds ~500 KB, swap to a tighter crop or fall back to a CSS gradient hero like `/altivum`.
- **Foundation URL drift.** `altivumfoundation.org/give` and other deep links are hardcoded. Same risk class as every other `altivum.ai` link on the site — acceptable.

## Out of scope

- Foundation logo asset (wordmark via fonts is sufficient for a pointer page).
- Board-of-directors listing.
- Scholarship application flow.
- Automated tests — none of the surrounding pages (About, Altivum, AWS, Claude) have snapshot tests for their keyPoints/array contents; this change follows that precedent.
- Rewriting the existing `src/pages/Foundation.tsx` draft during brainstorming. The implementation plan will overwrite that file to match this spec (six sections, no Impact tiers).

## Commit strategy

Single commit. Prefix `feat`. Message along the lines of:

```
feat(foundation): add /foundation pointer page and home tab
```

Body describes the seven-tab home integration, the new route, SEO schema, and sitemap entry.
