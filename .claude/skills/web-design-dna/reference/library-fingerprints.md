# Library Fingerprints — identify the stack

The coded signatures live in `scripts/lib/fingerprints.mjs` (used by both extractors).
This is the human-readable companion for **manual tiers** — identifying the stack from a
rendered page, DevTools, or a creator writeup when the parser isn't running.

## Fastest signals
- **`window` globals** (console / live tier): `gsap`, `THREE` (+ `THREE.REVISION`), `Lenis`, `LocomotiveScroll`, `barba`, `PIXI`, `Swiper`, `__NEXT_DATA__`, `__NUXT__`, `SPLINE`. Most libraries announce themselves here.
- **Network tab:** script/font URLs are the cleanest tell — `gsap.min.js`, `three.module.js`, `lenis`, `/_next/`, `framerusercontent.com`, `prod.spline.design`.
- **DOM attributes:** `data-scroll` (Locomotive), `data-barba` (Barba), `data-aos` (AOS), `data-tilt` (vanilla-tilt), `--char-index` (Splitting.js), `<spline-viewer>`, `<lottie-player>`.

## By behavior (visual / Tier A)
- **Buttery, weighted scroll that overshoots slightly** → Lenis or Locomotive smooth-scroll.
- **Elements pinning while content scrubs through** → GSAP ScrollTrigger (pin + scrub).
- **Text animating in per-character / per-word** → SplitText / SplitType / Splitting.js.
- **No white flash between pages; content morphs** → Barba/Swup/Taxi or View Transitions.
- **A `<canvas>` with fluid, light-reactive, or distorted visuals** → Three.js/OGL + custom GLSL shaders.
- **Draggable 3D object you can orbit** → Spline or React Three Fiber.
- **Magnetic buttons / custom cursor / hover parallax** → bespoke JS or vanilla-tilt.

## Framework substrate
| Tell | Framework |
| --- | --- |
| `__NEXT_DATA__`, `/_next/`, `#__next` | Next.js |
| `__NUXT__`, `/_nuxt/`, `#__nuxt` | Nuxt |
| `data-sveltekit`, `/_app/immutable/` | SvelteKit |
| `<astro-island>`, `data-astro-` | Astro |
| `#___gatsby`, `/page-data/` | Gatsby |
| hashed `/assets/index-*.js`, `type="module"` | Vite |
| `data-wf-page`, `.w-` classes | Webflow |
| `framerusercontent.com`, generator "Framer" | Framer (sites) |
| `/wp-content/` | WordPress |

## Shaders (the highest-value find)
Look for: `<script type="x-shader/x-fragment">`, and in JS — `gl_FragColor`, `gl_Position`,
`uniform`, `varying`, `precision highp float`, `void main()`. Custom shaders are usually the
single most distinctive ingredient; flag them prominently and capture the uniforms in play.

## Caveats
- **Bundlers hide names.** A minified/tree-shaken bundle may strip recognizable strings — absence isn't proof. Fall back to behavior and runtime globals.
- **Framer-motion vs. Framer:** the React library (`framer-motion`) is not the site builder (`framerusercontent.com`).
- **A `<canvas>` alone** proves nothing — confirm `THREE`/`PIXI`/shader source before claiming WebGL.

When adding a new library, add it to `FINGERPRINTS` in `scripts/lib/fingerprints.mjs`
(with `globals` / `src` / `js` / `html` signals) **and** a line here.
