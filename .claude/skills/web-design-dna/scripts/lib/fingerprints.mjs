// Library / framework / technique fingerprints for web-design-DNA extraction.
//
// Each entry declares signals matched against text blobs (html, css, js) and a
// list of `srcs` substrings (checked against <script src> / <link href> values
// only, to avoid false positives from page copy). `globals` lists runtime
// window keys — used by the live (Playwright) extractor, ignored by the static
// one. Keep signals HIGH-signal and LOW-false-positive.

export const FINGERPRINTS = [
  // ---- Animation engines ----
  {
    name: 'GSAP',
    category: 'animation',
    globals: ['gsap', 'GreenSockGlobals', 'TweenMax', 'TweenLite'],
    src: ['gsap', 'tweenmax', 'tweenlite', 'greensock'],
    js: [/\bgsap\s*\.\s*(to|from|fromTo|timeline|set|registerPlugin)\b/i, /TweenMax|TweenLite|TimelineMax/],
    html: [/data-gsap/i],
    note: 'The dominant professional animation engine. Check for its ScrollTrigger / ScrollSmoother / SplitText plugins.',
  },
  {
    name: 'GSAP ScrollTrigger',
    category: 'scroll',
    globals: ['ScrollTrigger'],
    src: ['scrolltrigger'],
    js: [/ScrollTrigger/],
    note: 'Scroll-linked timelines: pinning, scrub, snap. The backbone of most scroll-choreographed sites.',
  },
  {
    name: 'GSAP ScrollSmoother',
    category: 'scroll',
    globals: ['ScrollSmoother'],
    src: ['scrollsmoother'],
    js: [/ScrollSmoother/],
    note: 'GSAP-native smooth scrolling with parallax data-speed/data-lag.',
  },
  {
    name: 'GSAP SplitText',
    category: 'typography-motion',
    globals: ['SplitText'],
    src: ['splittext'],
    js: [/SplitText/],
    note: 'Per-character / word / line splitting for staggered text reveals.',
  },
  {
    name: 'Framer Motion',
    category: 'animation',
    globals: ['__framer_importFromPackage'],
    src: ['framer-motion', 'framer_motion'],
    js: [/framer-motion|framerMotion|useAnimate\(|AnimatePresence/],
    note: 'React declarative animation (layout, gestures, springs).',
  },
  {
    name: 'Motion One',
    category: 'animation',
    globals: ['Motion'],
    src: ['motion.dev', '/motion/', 'motion.min'],
    js: [/from\s+["']motion["']|animate\(\s*["']/],
    note: 'Tiny WAAPI-based animation library.',
  },
  {
    name: 'anime.js',
    category: 'animation',
    globals: ['anime'],
    src: ['anime.min', 'animejs'],
    js: [/\banime\s*\(\s*\{/],
    note: 'Lightweight timeline/keyframe animation.',
  },
  {
    name: 'AOS (Animate On Scroll)',
    category: 'scroll',
    globals: ['AOS'],
    src: ['aos.js', 'aos.min'],
    html: [/data-aos=/i],
    note: 'Declarative scroll reveal via data-aos attributes.',
  },

  // ---- Smooth scroll ----
  {
    name: 'Lenis',
    category: 'smooth-scroll',
    globals: ['Lenis'],
    src: ['lenis', '@studio-freight/lenis', 'darkroom.engineering'],
    js: [/new\s+Lenis\(/],
    html: [/data-lenis/i, /class=["'][^"']*\blenis\b/i],
    note: 'Modern inertial smooth-scroll (the current premium-feel default).',
  },
  {
    name: 'Locomotive Scroll',
    category: 'smooth-scroll',
    globals: ['LocomotiveScroll'],
    src: ['locomotive-scroll', 'locomotive_scroll'],
    js: [/new\s+LocomotiveScroll\(/],
    html: [/data-scroll-container/i, /has-scroll-smooth/i],
    note: 'Smooth scroll + scroll-triggered parallax via data-scroll attributes.',
  },

  // ---- Page transitions ----
  {
    name: 'Barba.js',
    category: 'page-transition',
    globals: ['barba'],
    src: ['barba'],
    js: [/barba\s*\.\s*init\(/],
    html: [/data-barba/i],
    note: 'AJAX page transitions — no white flash between routes.',
  },
  {
    name: 'Swup',
    category: 'page-transition',
    globals: ['Swup'],
    src: ['swup'],
    js: [/new\s+Swup\(/],
    html: [/id=["']swup["']/i],
    note: 'Lightweight page-transition engine.',
  },
  {
    name: 'Taxi.js / Highway',
    category: 'page-transition',
    globals: ['Taxi', 'Highway'],
    src: ['@unseenco/taxi', 'highway'],
    html: [/data-taxi/i, /data-router-view/i],
    note: 'SPA-style transitions for multi-page sites.',
  },

  // ---- WebGL / 3D ----
  {
    name: 'Three.js',
    category: 'webgl',
    globals: ['THREE'],
    src: ['three.module', 'three.min', '/three.js', 'three@', 'cdn.skypack.dev/three'],
    js: [/THREE\.(WebGLRenderer|Scene|PerspectiveCamera|Mesh|ShaderMaterial)/],
    note: 'The dominant WebGL library. Often paired with custom GLSL shaders.',
  },
  {
    name: 'React Three Fiber',
    category: 'webgl',
    globals: ['__r3f'],
    src: ['@react-three/fiber', 'react-three-fiber', '@react-three/drei'],
    js: [/useFrame\(|useThree\(|<Canvas[\s>]/],
    note: 'React renderer for Three.js. drei = its helper kit.',
  },
  {
    name: 'OGL',
    category: 'webgl',
    src: ['ogl.js', 'ogl@', '/ogl/'],
    js: [/from\s+["']ogl["']/],
    note: 'Minimal low-level WebGL — favored on hyper-optimized award sites.',
  },
  {
    name: 'PixiJS',
    category: 'webgl',
    globals: ['PIXI'],
    src: ['pixi.js', 'pixi.min'],
    js: [/new\s+PIXI\./],
    note: '2D WebGL renderer (image displacement, particle fields).',
  },
  {
    name: 'Babylon.js',
    category: 'webgl',
    globals: ['BABYLON'],
    src: ['babylon.js', 'babylon.max'],
    js: [/new\s+BABYLON\./],
    note: 'Full 3D engine.',
  },
  {
    name: 'Curtains.js',
    category: 'webgl',
    globals: ['Curtains'],
    src: ['curtains'],
    js: [/new\s+Curtains\(/],
    note: 'Maps DOM elements onto WebGL planes (image/text shader effects).',
  },
  {
    name: 'Vanta.js',
    category: 'webgl',
    globals: ['VANTA'],
    src: ['vanta'],
    js: [/VANTA\./],
    note: 'Drop-in animated WebGL backgrounds.',
  },
  {
    name: 'Spline',
    category: '3d-tool',
    globals: ['SPLINE'],
    src: ['spline-viewer', 'prod.spline.design', '@splinetool'],
    html: [/<spline-viewer/i],
    note: 'No-code 3D scenes embedded via <spline-viewer>.',
  },
  {
    name: 'Lottie',
    category: 'motion-graphics',
    globals: ['lottie', 'bodymovin'],
    src: ['lottie', 'bodymovin', 'dotlottie'],
    html: [/<lottie-player|<dotlottie-player/i],
    note: 'After Effects vector animations played as JSON.',
  },
  {
    name: 'p5.js',
    category: 'creative-coding',
    globals: ['p5'],
    src: ['p5.js', 'p5.min'],
    js: [/new\s+p5\(/, /function\s+setup\s*\(\)/],
    note: 'Creative-coding / generative canvas sketches.',
  },

  // ---- Text-split / UI ----
  {
    name: 'Splitting.js',
    category: 'typography-motion',
    globals: ['Splitting'],
    src: ['splitting'],
    html: [/data-splitting/i, /--char-index/i],
    note: 'CSS-variable based char/word/line splitting.',
  },
  {
    name: 'SplitType',
    category: 'typography-motion',
    src: ['split-type', 'splittype'],
    js: [/new\s+SplitType\(/],
    note: 'GSAP-friendly text splitter.',
  },
  {
    name: 'Swiper',
    category: 'carousel',
    globals: ['Swiper'],
    src: ['swiper'],
    html: [/class=["'][^"']*\bswiper\b/i],
    note: 'The ubiquitous touch slider/carousel.',
  },
  {
    name: 'Embla Carousel',
    category: 'carousel',
    globals: ['EmblaCarousel'],
    src: ['embla-carousel'],
    note: 'Lightweight, dependency-free carousel.',
  },
  {
    name: 'vanilla-tilt',
    category: 'micro-interaction',
    globals: ['VanillaTilt'],
    src: ['vanilla-tilt'],
    html: [/data-tilt/i],
    note: '3D parallax tilt on hover.',
  },
  {
    name: 'Matter.js',
    category: 'physics',
    globals: ['Matter'],
    src: ['matter.js', 'matter.min'],
    js: [/Matter\.(Engine|World|Bodies)/],
    note: '2D rigid-body physics (draggable/colliding UI).',
  },

  // ---- Frameworks & site builders (the substrate) ----
  {
    name: 'Next.js',
    category: 'framework',
    globals: ['__NEXT_DATA__', 'next'],
    src: ['/_next/'],
    html: [/__NEXT_DATA__/, /id=["']__next["']/],
    note: 'React meta-framework (App/Pages router).',
  },
  {
    name: 'Nuxt',
    category: 'framework',
    globals: ['__NUXT__'],
    src: ['/_nuxt/'],
    html: [/__NUXT__/, /id=["']__nuxt["']/],
    note: 'Vue meta-framework.',
  },
  {
    name: 'SvelteKit',
    category: 'framework',
    src: ['/_app/immutable/'],
    html: [/data-sveltekit/i, /__sveltekit/],
    note: 'Svelte meta-framework.',
  },
  {
    name: 'Astro',
    category: 'framework',
    html: [/<astro-island/i, /data-astro-/i],
    note: 'Islands-architecture static framework.',
  },
  {
    name: 'Gatsby',
    category: 'framework',
    globals: ['___gatsby'],
    src: ['/page-data/', 'gatsby'],
    html: [/id=["']___gatsby["']/],
    note: 'React static-site framework.',
  },
  {
    name: 'Remix / React Router',
    category: 'framework',
    globals: ['__remixContext'],
    html: [/__remixContext|__reactRouter/],
    note: 'React full-stack framework.',
  },
  {
    name: 'Vite',
    category: 'build-tool',
    src: ['/@vite/client', '/assets/index-'],
    html: [/type=["']module["'][^>]*src=["'][^"']*\/assets\//i],
    note: 'Modern build tool (hashed /assets/ chunks in prod).',
  },
  {
    name: 'Webflow',
    category: 'site-builder',
    src: ['webflow', 'assets.website-files.com', 'uploads-ssl.webflow'],
    html: [/data-wf-(page|site)/i, /class=["'][^"']*\bw-/i],
    note: 'Visual builder — exports verbose .w- utility classes.',
  },
  {
    name: 'Framer (sites)',
    category: 'site-builder',
    globals: ['__framer'],
    src: ['framerusercontent.com', 'framer.com'],
    html: [/<meta[^>]+generator[^>]+Framer/i],
    note: 'Framer-published site (not framer-motion the library).',
  },
  {
    name: 'WordPress',
    category: 'cms',
    src: ['/wp-content/', '/wp-includes/'],
    html: [/<meta[^>]+generator[^>]+WordPress/i],
    note: 'CMS — check the active theme/page-builder.',
  },
  {
    name: 'Squarespace',
    category: 'site-builder',
    src: ['static1.squarespace.com', 'squarespace-cdn'],
    html: [/Squarespace/],
    note: 'Hosted site builder.',
  },
  {
    name: 'Shopify',
    category: 'ecommerce',
    globals: ['Shopify'],
    src: ['cdn.shopify.com'],
    html: [/Shopify\.theme/],
    note: 'Commerce platform (Liquid themes).',
  },
];

function testSignals(signals, text) {
  if (!signals || !text) return [];
  const hits = [];
  for (const s of signals) {
    if (s instanceof RegExp) {
      const m = text.match(s);
      if (m) hits.push(String(m[0]).slice(0, 50).replace(/\s+/g, ' ').trim());
    } else if (typeof s === 'string') {
      if (text.toLowerCase().includes(s.toLowerCase())) hits.push(s);
    }
  }
  return hits;
}

// Detect from static text blobs. `srcs` = array of <script src>/<link href> values.
export function detectFromText({ html = '', css = '', js = '', srcs = [] } = {}) {
  const srcBlob = (srcs || []).join('\n').toLowerCase();
  const out = [];
  for (const fp of FINGERPRINTS) {
    const evidence = [];
    if (fp.src) for (const sub of fp.src) if (srcBlob.includes(sub.toLowerCase())) evidence.push(`src~${sub}`);
    evidence.push(...testSignals(fp.html, html).map((e) => `html:${e}`));
    evidence.push(...testSignals(fp.css, css).map((e) => `css:${e}`));
    evidence.push(...testSignals(fp.js, js).map((e) => `js:${e}`));
    if (evidence.length) {
      out.push({ name: fp.name, category: fp.category, note: fp.note, evidence: evidence.slice(0, 6) });
    }
  }
  return out;
}

// Detect from a list of runtime window keys (live extractor only).
export function detectFromGlobals(globalNames = []) {
  const set = new Set(globalNames);
  const out = [];
  for (const fp of FINGERPRINTS) {
    if (!fp.globals) continue;
    const hit = fp.globals.filter((g) => set.has(g));
    if (hit.length) out.push({ name: fp.name, category: fp.category, note: fp.note, evidence: hit.map((g) => `window.${g}`) });
  }
  return out;
}

// Merge detections from multiple sources, unioning evidence by library name.
export function mergeDetections(...lists) {
  const map = new Map();
  for (const list of lists) {
    for (const d of list || []) {
      if (!map.has(d.name)) map.set(d.name, { name: d.name, category: d.category, note: d.note, evidence: new Set() });
      (d.evidence || []).forEach((e) => map.get(d.name).evidence.add(e));
    }
  }
  return [...map.values()].map((d) => ({ ...d, evidence: [...d.evidence].slice(0, 8) }));
}

// Raw shader / GLSL detection over html + js text.
export function detectShaders(text = '') {
  const signals = [
    [/<script[^>]+type=["']x-shader\/x-(fragment|vertex)["']/i, 'x-shader script block'],
    [/gl_FragColor/, 'gl_FragColor (fragment shader)'],
    [/gl_Position/, 'gl_Position (vertex shader)'],
    [/\bvoid\s+main\s*\(\s*\)\s*\{[^}]*gl_/, 'GLSL main()'],
    [/\buniform\s+(float|vec[234]|sampler2D|mat[234])\b/, 'GLSL uniforms'],
    [/\bvarying\s+(float|vec[234])\b/, 'GLSL varyings'],
    [/precision\s+(highp|mediump|lowp)\s+float/, 'GLSL precision qualifier'],
  ];
  const evidence = [];
  for (const [re, label] of signals) if (re.test(text)) evidence.push(label);
  return evidence;
}
