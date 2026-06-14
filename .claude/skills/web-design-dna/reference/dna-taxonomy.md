# DNA Taxonomy — what to extract

The complete checklist of what makes a site stunning. The scripts capture most of
this automatically from CSS/DOM; for manual tiers (screenshots, creator writeups)
this is the rubric to score the site against by eye.

Always separate **what** the site does from **why it works** — the second is the
synthesis the user actually wants.

## 1. Tech stack (the machinery)
- **Animation engine:** GSAP (+ ScrollTrigger / ScrollSmoother / SplitText), Framer Motion, Motion One, anime.js, AOS.
- **Smooth scroll:** Lenis, Locomotive, GSAP ScrollSmoother. (Changes the entire *feel*.)
- **WebGL / 3D:** Three.js, React Three Fiber + drei, OGL, PixiJS, Babylon, Curtains, Vanta, Spline. Note **custom GLSL shaders** separately — they're the biggest "wow" lever.
- **Page transitions:** Barba, Swup, Taxi/Highway, or the native View Transitions API.
- **Framework / builder:** Next, Nuxt, SvelteKit, Astro, Gatsby, Remix, Vite — or Webflow, Framer, WordPress, Squarespace, Shopify.
- Record **versions** when a live tier exposes them (`THREE.REVISION`, `gsap.version`).

## 2. Typography
- **Typefaces** and their **source**: Google Fonts, Adobe/Typekit, self-hosted `@font-face`, or system stack. Source matters for licensing, performance, and brand rules.
- **Weights** actually used (a single thin weight is itself a strong style signal).
- **Type scale:** every `font-size`, especially fluid `clamp()` expressions — capture the min / preferred / max.
- **Rhythm:** line-height and letter-spacing per role (tight display vs. airy body).
- **Hierarchy:** how many distinct sizes/weights; the display-to-body contrast ratio.

## 3. Color
- **Palette** ranked by frequency, with **roles** assigned: background, surface, text, accent.
- **Gradients:** linear / radial / conic, including the stops and angle.
- **Color model:** hex vs. `rgb` vs. `hsl` vs. `oklch`/`oklab` vs. `color-mix()`. Modern perceptual color (oklch) is a tell of a current, considered palette.
- **Contrast & mood:** dark vs. light, saturated vs. muted, the temperature.

## 4. Spacing & layout
- **Spacing scale** and its **base unit** (is it a 4px / 8px grid?).
- **Grid vs. flex**, `grid-template-columns`, gaps.
- **Container widths** (`max-width`) and the **breakpoints** the design pivots on.
- **Whitespace strategy** — generous negative space is often the whole trick.

## 5. Motion
- **Easing curves** — the named `cubic-bezier()` values. The signature ease is a fingerprint (e.g. expo-out `0.16, 1, 0.3, 1`).
- **Durations** and their consistency.
- **Keyframe inventory** (`@keyframes`).
- **Scroll-driven techniques:** pinning/sticky sections, scrub, parallax, scroll-snap, `animation-timeline`.
- **Choreography:** stagger, sequencing, orchestration across a section.
- **Feel** (manual only): weight, snappiness, restraint — describe it; scripts can't.

## 6. Effects (the heavy lifting on "stunning")
- **Shadows:** layered/long box-shadow, text-shadow.
- **Blur:** `backdrop-filter` (glassmorphism), `filter: blur()`.
- **Blend modes:** `mix-blend-mode`, `background-blend-mode` (difference/overlay for striking contrast).
- **Masking:** `clip-path`, `mask-image` for shaped reveals.
- **3D:** `transform-style: preserve-3d`, `perspective`, tilt.
- **Texture:** noise/grain overlays, film grain, dithering.

## 7. Composition & UX (manual tiers)
- Hero strategy (full-bleed media, kinetic type, 3D, video).
- Navigation pattern and how it transforms on scroll.
- Imagery treatment (duotone, grain, masked, displaced).
- Micro-interactions (hover, cursor effects, magnetic buttons).
- Pacing and narrative as you scroll.

## Synthesis: the 3–5 signature moves
After cataloguing, name the few combinations that create the magic. Good synthesis is
*compositional*: "a custom-shader hero driven by Lenis smooth-scroll with GSAP-scrubbed
SplitText reveals, on a near-black oklch palette with one warm accent and a single thin
typeface." That sentence is the deliverable — the catalog is just the evidence.
