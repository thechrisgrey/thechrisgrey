// Synthesis layer: turns raw extraction (stack + css DNA + computed styles) into
// a human DNA report AND a portable Injection Kit. Transport-agnostic — the
// static and live extractors both feed it the same shape.

import { readFileSync, existsSync } from 'node:fs';

// Default brand profile = the Altivum / thechrisgrey rules from CLAUDE.md.
// Override per-project with a brand.json (see loadBrand). Set to null to skip
// conflict flagging entirely (pure faithful extraction).
export const DEFAULT_BRAND = {
  name: 'Altivum / thechrisgrey',
  fonts: {
    allowed: ['SF Pro Display', '-apple-system', 'system-ui'],
    forbiddenSources: ['Google Fonts'],
    note: 'SF Pro Display, weight 200. NEVER use Google Fonts.',
  },
  palette: {
    'altivum-dark': '#0A0F1C',
    'altivum-navy': '#1A2332',
    'altivum-blue': '#2E4A6B',
    'altivum-slate': '#4A5A73',
    'altivum-silver': '#9BA6B8',
    'altivum-gold': '#C5A572',
  },
  noEmojis: true,
  requireCspUpdateForCdns: true,
  motionMustRespectReducedMotion: true,
};

export function loadBrand(pathOrNull) {
  if (pathOrNull === 'none') return null;
  if (pathOrNull && existsSync(pathOrNull)) {
    try { return JSON.parse(readFileSync(pathOrNull, 'utf8')); } catch { /* fall through */ }
  }
  return DEFAULT_BRAND;
}

export function synthesizeSignatureMoves(stack, dna, shaders = []) {
  const names = new Set(stack.map((s) => s.name));
  const has = (...n) => n.some((x) => names.has(x));
  const moves = [];

  if (has('Three.js', 'React Three Fiber', 'OGL', 'Babylon.js') || (shaders && shaders.length)) {
    moves.push('Real-time WebGL with custom GLSL shaders — the centerpiece "how did they do that" moment.');
  }
  if (has('Lenis', 'Locomotive Scroll', 'GSAP ScrollSmoother') && has('GSAP ScrollTrigger')) {
    moves.push('Inertial smooth-scroll fused with scroll-scrubbed GSAP timelines — fully choreographed scrolling.');
  } else if (has('Lenis', 'Locomotive Scroll', 'GSAP ScrollSmoother')) {
    moves.push('Momentum / inertial smooth-scroll for a premium, weighted feel.');
  }
  if (has('GSAP SplitText', 'Splitting.js', 'SplitType')) {
    moves.push('Per-character / word staggered text reveals.');
  }
  if (has('Barba.js', 'Swup', 'Taxi.js / Highway')) {
    moves.push('Seamless AJAX page transitions — no white flash between routes.');
  }
  if (has('Spline')) moves.push('Embedded interactive 3D scene (Spline) as a hero element.');
  if (dna.effects?.backdropFilter?.length) moves.push('Glassmorphism — layered backdrop-blur surfaces over rich backgrounds.');
  if (dna.effects?.mixBlendMode?.length) moves.push('Blend-mode compositing (difference / overlay) for striking figure-ground contrast.');
  if (dna.effects?.clipPath?.length) moves.push('clip-path masking for non-rectangular reveals and shaped media.');
  if (dna.typography?.fluidSizes?.length) moves.push('Fully fluid clamp() typography that scales continuously with the viewport.');
  if ((dna.color?.models || []).includes('oklch/oklab')) moves.push('Perceptual oklch color for richer, more uniform gradients and tints.');

  if (!moves.length) {
    moves.push('Restraint: a tight type scale, generous whitespace, and a minimal palette doing the heavy lifting.');
  }
  return moves.slice(0, 5);
}

// --- Injection Kit ----------------------------------------------------------
export function buildInjectionKit(dna, stack, brand) {
  const tokens = deriveTokens(dna);
  return {
    tokens,
    cssVars: renderCssVars(tokens),
    tailwind: renderTailwindTheme(tokens),
    json: JSON.stringify(tokens, null, 2),
    recipes: buildRecipes(stack, dna),
    conflicts: brand ? flagBrandConflicts(dna, stack, brand) : [],
  };
}

function deriveTokens(dna) {
  const roles = dna.color?.roles || {};
  const palette = (dna.color?.palette || []).slice(0, 8);
  const colors = palette.map((c, i) => ({ name: colorRole(c.value, roles, i), value: c.value, count: c.count }));

  const type = [...new Set((dna.typography?.sizes || []).filter((s) => /clamp|rem|px|em/.test(s)))].slice(0, 8);

  const easings = dna.motion?.easings || [];
  const bezier = easings.filter((e) => e.startsWith('cubic-bezier'));
  const signatureEase = bezier[0] || easings[0] || 'cubic-bezier(0.16, 1, 0.3, 1)';

  return {
    fonts: (dna.typography?.families || []).slice(0, 3),
    fontSource: dna.typography?.source || [],
    colors,
    roles,
    type,
    space: (dna.spacing?.scale || []).map((s) => s.value).slice(0, 8),
    baseUnit: dna.spacing?.baseUnit ?? null,
    breakpoints: dna.spacing?.breakpoints || [],
    easings: bezier.length ? bezier : [signatureEase],
    signatureEase,
    durations: dna.motion?.durations || [],
    customProps: dna.customProps || {},
  };
}

function colorRole(value, roles, i) {
  const v = value.toLowerCase();
  if (roles.background && roles.background.toLowerCase().includes(v)) return 'bg';
  if (roles.text && roles.text.toLowerCase().includes(v)) return 'text';
  return `c${i + 1}`;
}

function renderCssVars(t) {
  const lines = [':root {'];
  t.fonts.forEach((f, i) => lines.push(`  --font-${i === 0 ? 'display' : i === 1 ? 'body' : 'mono'}: ${f};`));
  t.colors.forEach((c) => lines.push(`  --color-${c.name}: ${c.value};`));
  t.type.forEach((s, i) => lines.push(`  --text-${i}: ${s};`));
  t.space.forEach((s, i) => lines.push(`  --space-${i}: ${s};`));
  lines.push(`  --ease-signature: ${t.signatureEase};`);
  t.durations.slice(0, 4).forEach((d, i) => lines.push(`  --dur-${i}: ${d};`));
  lines.push('}');
  return lines.join('\n');
}

function renderTailwindTheme(t) {
  // Tailwind v4 CSS-first @theme block — matches this repo's setup (no JS config).
  const lines = ['@theme {'];
  t.colors.forEach((c) => lines.push(`  --color-${c.name}: ${c.value};`));
  t.fonts.forEach((f, i) => lines.push(`  --font-${i === 0 ? 'display' : i === 1 ? 'body' : 'mono'}: ${f};`));
  lines.push(`  --ease-signature: ${t.signatureEase};`);
  lines.push('}');
  return lines.join('\n');
}

function buildRecipes(stack, dna) {
  const names = new Set(stack.map((s) => s.name));
  const has = (...n) => n.some((x) => names.has(x));
  const out = {};

  if (has('Lenis')) {
    out['Smooth scroll (Lenis, React)'] =
`import Lenis from 'lenis';
import { useEffect } from 'react';

export function useLenis() {
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    let id; const raf = (t) => { lenis.raf(t); id = requestAnimationFrame(raf); };
    id = requestAnimationFrame(raf);
    return () => { cancelAnimationFrame(id); lenis.destroy(); };
  }, []);
}`;
  }
  if (has('GSAP ScrollTrigger')) {
    out['Scroll-scrubbed reveal (GSAP ScrollTrigger, React)'] =
`import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useRef, useLayoutEffect } from 'react';
gsap.registerPlugin(ScrollTrigger);

export function Reveal({ children }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(ref.current, {
        yPercent: 20, opacity: 0, ease: 'power3.out',
        scrollTrigger: { trigger: ref.current, start: 'top 80%', end: 'top 40%', scrub: true },
      });
    }, ref);
    return () => ctx.revert();
  }, []);
  return <div ref={ref}>{children}</div>;
}`;
  }
  if (has('GSAP SplitText', 'SplitType', 'Splitting.js')) {
    out['Per-word staggered text reveal'] =
`import gsap from 'gsap';
import SplitType from 'split-type';
import { useRef, useLayoutEffect } from 'react';

export function SplitReveal({ text }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const split = new SplitType(ref.current, { types: 'words' });
    gsap.from(split.words, { yPercent: 100, opacity: 0, stagger: 0.04, ease: 'power4.out', duration: 0.8 });
    return () => split.revert();
  }, []);
  return <span ref={ref} style={{ display: 'inline-block', overflow: 'hidden' }}>{text}</span>;
}`;
  }
  if (has('Three.js', 'React Three Fiber') || (dna.shaders && dna.shaders.length)) {
    out['Fragment-shader hero (React Three Fiber)'] =
`// npm i three @react-three/fiber
import { Canvas, useFrame } from '@react-three/fiber';
import { useRef } from 'react';

const frag = \`
  uniform float uTime; varying vec2 vUv;
  void main() {
    vec3 col = 0.5 + 0.5 * cos(uTime + vUv.xyx + vec3(0.0, 2.0, 4.0));
    gl_FragColor = vec4(col, 1.0);
  }\`;
const vert = \`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);}\`;

function Plane() {
  const mat = useRef();
  useFrame((s) => { if (mat.current) mat.current.uniforms.uTime.value = s.clock.elapsedTime; });
  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial ref={mat} vertexShader={vert} fragmentShader={frag} uniforms={{ uTime: { value: 0 } }} />
    </mesh>
  );
}
export const ShaderHero = () => <Canvas><Plane /></Canvas>;`;
  }
  if (has('Barba.js', 'Swup', 'Taxi.js / Highway')) {
    out['Page transition (View Transitions API — native React Router alt)'] =
`// Prefer the platform: wrap navigations in document.startViewTransition().
// See this repo's src/hooks/useViewTransitionNavigate.ts for the pattern.
function navigateWithTransition(navigate, to) {
  if (!document.startViewTransition) return navigate(to);
  document.startViewTransition(() => navigate(to));
}`;
  }
  if (dna.typography?.fluidSizes?.length) {
    out['Fluid clamp() type scale'] =
`/* Derived from the source's clamp() values. Tune min/max to your grid. */
:root {
  --step-0: clamp(1rem, 0.9rem + 0.5vw, 1.25rem);
  --step-1: clamp(1.25rem, 1.0rem + 1.2vw, 2rem);
  --step-2: clamp(2rem, 1.4rem + 3vw, 4rem);
  --step-hero: clamp(2.5rem, 1rem + 7vw, 8rem);
}`;
  }
  return out;
}

function flagBrandConflicts(dna, stack, brand) {
  const flags = [];
  const push = (severity, message, fix) => flags.push({ severity, message, fix });

  const src = dna.typography?.source || [];
  for (const forbidden of brand.fonts?.forbiddenSources || []) {
    if (src.includes(forbidden)) {
      push('high', `Source uses ${forbidden}, which your brand forbids (${brand.fonts.note || ''}).`,
        `Re-map the extracted type roles onto ${(brand.fonts.allowed || []).join(', ')} and drop the ${forbidden} <link>.`);
    }
  }

  const fams = (dna.typography?.families || []).map((f) => f.toLowerCase());
  const allowed = (brand.fonts?.allowed || []).map((f) => f.toLowerCase());
  const foreign = fams.filter((f) => f && !allowed.some((a) => f.includes(a) || a.includes(f)) && !/sans-serif|serif|monospace|inherit/.test(f));
  if (foreign.length && allowed.length) {
    push('medium', `Typefaces not in your brand set: ${foreign.slice(0, 4).join(', ')}.`,
      'Keep as inspiration for the *scale/weight*, but render with your brand typeface.');
  }

  const cdnLibs = stack.filter((s) => /animation|webgl|scroll|carousel|3d-tool|motion-graphics/.test(s.category));
  if (brand.requireCspUpdateForCdns && cdnLibs.length) {
    push('medium', `Injecting ${cdnLibs.map((l) => l.name).slice(0, 5).join(', ')} may load from a CDN.`,
      'Self-host or add the origin to the CSP allowlist in amplify.yml before shipping.');
  }

  if (brand.motionMustRespectReducedMotion && (dna.motion?.keyframes?.length || stack.some((s) => /animation|scroll|webgl/.test(s.category)))) {
    push('low', 'Heavy motion detected.', 'Gate it behind prefers-reduced-motion (this repo: isMotionDisabled()).');
  }

  if (brand.noEmojis) {
    push('info', 'Brand rule: no emojis.', 'If the source uses emoji as UI/iconography, substitute Material Icons or inline SVG.');
  }
  return flags;
}

// --- Markdown report --------------------------------------------------------
export function buildReport({ source, tier, stack = [], shaders = [], dna = {}, meta = {}, computed = null, resources = null, brand = null }) {
  const moves = synthesizeSignatureMoves(stack, dna, shaders);
  const kit = buildInjectionKit({ ...dna, shaders }, stack, brand);
  return { source, tier, stack, shaders, dna, meta, computed, resources, moves, kit, generatedAt: new Date().toISOString() };
}

export function renderMarkdown(r) {
  const L = [];
  const dna = r.dna || {};
  L.push(`# Web Design DNA — ${r.source || 'unknown source'}`);
  L.push('');
  L.push(`> Extracted via **Tier ${r.tier}** on ${r.generatedAt}.`);
  if (r.meta?.title) L.push(`> Page title: ${r.meta.title}`);
  if (r.meta?.generator) L.push(`> Generator: ${r.meta.generator}`);
  L.push('');

  L.push('## Signature Moves');
  L.push('*The 3–5 things that actually make it feel stunning.*');
  L.push('');
  r.moves.forEach((m, i) => L.push(`${i + 1}. ${m}`));
  L.push('');

  L.push('## Tech Stack');
  if (r.stack.length) {
    L.push('| Library | Category | Evidence |');
    L.push('| --- | --- | --- |');
    for (const s of r.stack) L.push(`| **${s.name}** | ${s.category} | ${(s.evidence || []).join(', ')} |`);
  } else {
    L.push('_No JS libraries fingerprinted — likely hand-rolled or heavily bundled/minified._');
  }
  if (r.shaders?.length) { L.push(''); L.push(`**Shaders:** ${r.shaders.join(', ')}`); }
  L.push('');

  const t = dna.typography || {};
  L.push('## Typography');
  L.push(`- **Families:** ${(t.families || []).join(', ') || '—'}`);
  L.push(`- **Source:** ${(t.source || []).join(', ') || '—'}`);
  if (t.faces?.length) L.push(`- **@font-face:** ${t.faces.map((f) => `${f.family || '?'}${f.weight ? ' ' + f.weight : ''}`).join('; ')}`);
  L.push(`- **Type scale:** ${(t.sizes || []).slice(0, 10).join('  ·  ') || '—'}`);
  if (t.fluidSizes?.length) L.push(`- **Fluid (clamp):** ${t.fluidSizes.slice(0, 6).join('  ·  ')}`);
  L.push(`- **Weights:** ${(t.weights || []).join(', ') || '—'}  |  **Line-height:** ${(t.lineHeights || []).slice(0, 6).join(', ') || '—'}  |  **Letter-spacing:** ${(t.letterSpacings || []).slice(0, 6).join(', ') || '—'}`);
  L.push('');

  const c = dna.color || {};
  L.push('## Color');
  if (c.roles && (c.roles.background || c.roles.text)) L.push(`- **Roles:** bg \`${c.roles.background || '?'}\` · text \`${c.roles.text || '?'}\``);
  L.push(`- **Palette (by frequency):** ${(c.palette || []).slice(0, 10).map((p) => `\`${p.value}\`×${p.count}`).join('  ') || '—'}`);
  if (c.gradients?.length) L.push(`- **Gradients:** ${c.gradients.slice(0, 4).map((g) => `\`${g}\``).join('  ')}`);
  L.push(`- **Color model:** ${(c.models || []).join(', ') || '—'}`);
  L.push('');

  const sp = dna.spacing || {};
  L.push('## Spacing & Layout');
  L.push(`- **Base unit:** ${sp.baseUnit ? sp.baseUnit + 'px' : '—'}  |  **Grid:** ${sp.usesGrid ? 'yes' : 'no'}  |  **Flex:** ${sp.usesFlex ? 'yes' : 'no'}`);
  L.push(`- **Spacing scale:** ${(sp.scale || []).slice(0, 12).map((s) => s.value).join('  ·  ') || '—'}`);
  L.push(`- **Containers (max-width):** ${(sp.containers || []).slice(0, 6).join(', ') || '—'}`);
  L.push(`- **Breakpoints:** ${(sp.breakpoints || []).join(', ') || '—'}`);
  L.push('');

  const mo = dna.motion || {};
  L.push('## Motion');
  L.push(`- **Easings:** ${(mo.easings || []).join('  ·  ') || '—'}`);
  L.push(`- **Durations:** ${(mo.durations || []).join(', ') || '—'}`);
  L.push(`- **@keyframes:** ${(mo.keyframes || []).join(', ') || '—'}`);
  if (mo.scrollDriven?.length) L.push(`- **Scroll-driven:** ${mo.scrollDriven.join('; ')}`);
  L.push('');

  const ef = dna.effects || {};
  L.push('## Effects');
  const effLine = (label, arr) => arr?.length ? L.push(`- **${label}:** ${arr.slice(0, 4).map((x) => `\`${x}\``).join('  ')}`) : null;
  effLine('Box-shadow', ef.boxShadow);
  effLine('Backdrop-filter', ef.backdropFilter);
  effLine('Filter', ef.filter);
  effLine('mix-blend-mode', ef.mixBlendMode);
  effLine('clip-path', ef.clipPath);
  effLine('mask', ef.mask);
  if (ef.has3d) L.push('- **3D transforms:** preserve-3d / perspective present');
  L.push('');

  if (r.computed) {
    L.push('## Computed Styles (live, resolved)');
    for (const [sel, styles] of Object.entries(r.computed)) {
      L.push(`- \`${sel}\` → ${Object.entries(styles).map(([k, v]) => `${k}: ${v}`).join('; ')}`);
    }
    L.push('');
  }

  L.push('---');
  L.push('## Injection Kit');
  L.push('### Portable CSS variables');
  L.push('```css'); L.push(r.kit.cssVars); L.push('```');
  L.push('### Tailwind v4 `@theme` (this repo)');
  L.push('```css'); L.push(r.kit.tailwind); L.push('```');
  L.push('### Tokens (JSON)');
  L.push('```json'); L.push(r.kit.json); L.push('```');

  const recipeKeys = Object.keys(r.kit.recipes || {});
  if (recipeKeys.length) {
    L.push('### Technique recipes');
    for (const k of recipeKeys) {
      L.push(`#### ${k}`);
      L.push('```tsx'); L.push(r.kit.recipes[k]); L.push('```');
    }
  }

  if (r.kit.conflicts?.length) {
    L.push('### ⚠ Brand-conflict flags');
    L.push('| Severity | Conflict | Suggested fix |');
    L.push('| --- | --- | --- |');
    for (const f of r.kit.conflicts) L.push(`| ${f.severity} | ${f.message} | ${f.fix} |`);
  }
  L.push('');
  return L.join('\n');
}
