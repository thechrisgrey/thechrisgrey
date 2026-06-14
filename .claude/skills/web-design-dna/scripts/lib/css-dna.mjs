// Pure-text CSS analysis. Operates on concatenated stylesheet text, so it needs
// no DOM and runs anywhere (static path). The live path reuses these same
// functions on collected sheet text, and layers computed-style precision on top.

const uniqPush = (arr, v) => {
  const t = typeof v === 'string' ? v.trim() : v;
  if (t && !arr.includes(t)) arr.push(t);
};
const strip = (s) => (s || '').trim().replace(/\s*!important\s*$/i, '').replace(/^["']|["']$/g, '');

// --- Typography -------------------------------------------------------------
export function extractTypography(css, hints = '') {
  const families = [];
  for (const m of css.matchAll(/font-family\s*:\s*([^;}{]+)/gi)) {
    for (const part of m[1].split(',')) uniqPush(families, strip(part));
  }

  const faces = [];
  for (const m of css.matchAll(/@font-face\s*\{([^}]*)\}/gi)) {
    const block = m[1];
    faces.push({
      family: strip((block.match(/font-family\s*:\s*([^;]+)/i) || [])[1]),
      weight: strip((block.match(/font-weight\s*:\s*([^;]+)/i) || [])[1]),
      display: strip((block.match(/font-display\s*:\s*([^;]+)/i) || [])[1]),
      src: ((block.match(/url\(([^)]+)\)/i) || [])[1] || '').replace(/["']/g, '').trim(),
    });
  }

  const sizes = [];
  for (const m of css.matchAll(/font-size\s*:\s*([^;}{]+)/gi)) uniqPush(sizes, strip(m[1]));
  const fluidSizes = sizes.filter((s) => /clamp\(/i.test(s));

  const weights = [];
  for (const m of css.matchAll(/font-weight\s*:\s*([^;}{]+)/gi)) uniqPush(weights, strip(m[1]));
  const lineHeights = [];
  for (const m of css.matchAll(/line-height\s*:\s*([^;}{]+)/gi)) uniqPush(lineHeights, strip(m[1]));
  const letterSpacings = [];
  for (const m of css.matchAll(/letter-spacing\s*:\s*([^;}{]+)/gi)) uniqPush(letterSpacings, strip(m[1]));

  return { families, faces, sizes, fluidSizes, weights, lineHeights, letterSpacings, source: classifyFontSource(css + '\n' + hints) };
}

function classifyFontSource(css) {
  const flags = [];
  if (/fonts\.googleapis\.com|fonts\.gstatic\.com/i.test(css)) flags.push('Google Fonts');
  if (/use\.typekit\.net|typekit|fonts\.adobe|adobe-fonts/i.test(css)) flags.push('Adobe Fonts (Typekit)');
  if (/@font-face/i.test(css)) flags.push('Self-hosted @font-face');
  if (/-apple-system|BlinkMacSystemFont|system-ui|["']SF Pro|Segoe UI/i.test(css)) flags.push('System font stack');
  return flags;
}

// --- Color ------------------------------------------------------------------
export function extractColors(css) {
  const tally = new Map();
  const bump = (v) => { const k = v.toLowerCase(); tally.set(k, (tally.get(k) || 0) + 1); };
  for (const m of css.matchAll(/#[0-9a-f]{3,8}\b/gi)) bump(m[0]);
  for (const m of css.matchAll(/rgba?\([^)]*\)/gi)) bump(m[0].replace(/\s+/g, ''));
  for (const m of css.matchAll(/hsla?\([^)]*\)/gi)) bump(m[0].replace(/\s+/g, ''));
  for (const m of css.matchAll(/okl(?:ch|ab)\([^)]*\)/gi)) bump(m[0].replace(/\s+/g, ' ').trim());
  for (const m of css.matchAll(/\bcolor-mix\([^;{}]*\)/gi)) bump(m[0].replace(/\s+/g, ' ').trim());

  const palette = [...tally.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([value, count]) => ({ value, count }));

  const gradients = [];
  for (const m of css.matchAll(/(?:repeating-)?(?:linear|radial|conic)-gradient\([^;{}]*\)/gi)) {
    uniqPush(gradients, m[0].replace(/\s+/g, ' ').trim());
  }

  const models = [];
  if (/okl(ch|ab)\(/i.test(css)) models.push('oklch/oklab');
  if (/\bcolor-mix\(/i.test(css)) models.push('color-mix');
  if (/#[0-9a-f]{3,8}\b/i.test(css)) models.push('hex');
  if (/rgba?\(/i.test(css)) models.push('rgb');
  if (/hsla?\(/i.test(css)) models.push('hsl');

  return { palette, gradients, models, roles: guessRoles(css) };
}

// Heuristic role guessing from the body/html rule (verify in the live path).
export function guessRoles(css) {
  const roles = {};
  const block = (css.match(/(?:^|[^.#\w-])(?:html|body)\b[^{]*\{([^}]*)\}/i) || [])[1] || '';
  const bg = (block.match(/background(?:-color)?\s*:\s*([^;]+)/i) || [])[1];
  const text = (block.match(/(?:^|[^-\w])color\s*:\s*([^;]+)/i) || [])[1];
  if (bg) roles.background = strip(bg);
  if (text) roles.text = strip(text);
  return roles;
}

// :root custom properties — often the cleanest design-token source.
export function extractCustomProps(css) {
  const props = {};
  const block = (css.match(/:root\s*\{([^}]*)\}/i) || [])[1] || '';
  for (const m of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+)/g)) props[m[1]] = strip(m[2]);
  return props;
}

// --- Spacing & layout -------------------------------------------------------
export function extractSpacing(css) {
  const values = new Map();
  const bump = (v) => values.set(v, (values.get(v) || 0) + 1);
  for (const m of css.matchAll(/(?:margin|padding|gap|row-gap|column-gap|inset)[^:;{}]*:\s*([^;}{]+)/gi)) {
    for (const t of m[1].matchAll(/(-?\d*\.?\d+)(px|rem|em)/g)) bump(`${t[1]}${t[2]}`);
  }
  const scale = [...values.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => toPx(a.value) - toPx(b.value));

  const pxNums = scale.map((s) => s.value).filter((v) => v.endsWith('px')).map((v) => parseFloat(v)).filter((n) => n > 0);

  const containers = [];
  for (const m of css.matchAll(/max-width\s*:\s*([^;}{]+)/gi)) uniqPush(containers, strip(m[1]));

  const breakpoints = [];
  for (const m of css.matchAll(/@media[^{]*?(\d+(?:\.\d+)?)(px|rem|em)/gi)) uniqPush(breakpoints, `${m[1]}${m[2]}`);

  const gridTemplates = [];
  for (const m of css.matchAll(/grid-template-columns\s*:\s*([^;}{]+)/gi)) uniqPush(gridTemplates, strip(m[1]));

  return {
    scale,
    baseUnit: guessBaseUnit(pxNums),
    containers,
    breakpoints,
    gridTemplates,
    usesGrid: /display\s*:\s*grid/i.test(css),
    usesFlex: /display\s*:\s*flex/i.test(css),
  };
}

// --- Motion -----------------------------------------------------------------
export function extractMotion(css) {
  const durations = new Set();
  for (const m of css.matchAll(/(?:transition(?:-duration)?|animation(?:-duration)?|animation)\s*:\s*([^;}{]+)/gi)) {
    for (const t of m[1].matchAll(/(\d*\.?\d+)(ms|s)\b/g)) durations.add(`${t[1]}${t[2]}`);
  }
  const easings = new Set();
  for (const m of css.matchAll(/cubic-bezier\([^)]*\)/gi)) easings.add(m[0].replace(/\s+/g, ''));
  for (const m of css.matchAll(/\b(ease-in-out|ease-in|ease-out|ease|linear|steps\([^)]*\))\b/gi)) easings.add(m[0]);

  const keyframes = [];
  for (const m of css.matchAll(/@(?:-webkit-)?keyframes\s+([\w-]+)/gi)) uniqPush(keyframes, m[1]);

  const scrollDriven = [];
  if (/animation-timeline\s*:/i.test(css)) scrollDriven.push('CSS scroll-driven animations (animation-timeline)');
  if (/scroll-snap-type/i.test(css)) scrollDriven.push('CSS scroll-snap');
  if (/position\s*:\s*sticky/i.test(css)) scrollDriven.push('sticky positioning (pinned sections)');

  return { durations: [...durations], easings: [...easings], keyframes, scrollDriven };
}

// --- Effects ----------------------------------------------------------------
export function extractEffects(css) {
  const grab = (re) => { const out = []; for (const m of css.matchAll(re)) uniqPush(out, strip(m[1])); return out; };
  return {
    boxShadow: grab(/box-shadow\s*:\s*([^;}{]+)/gi),
    textShadow: grab(/text-shadow\s*:\s*([^;}{]+)/gi),
    backdropFilter: grab(/backdrop-filter\s*:\s*([^;}{]+)/gi),
    filter: grab(/(?<![-\w])filter\s*:\s*([^;}{]+)/gi),
    mixBlendMode: grab(/mix-blend-mode\s*:\s*([^;}{]+)/gi),
    backgroundBlendMode: grab(/background-blend-mode\s*:\s*([^;}{]+)/gi),
    clipPath: grab(/clip-path\s*:\s*([^;}{]+)/gi),
    mask: grab(/(?:-webkit-)?mask(?:-image)?\s*:\s*([^;}{]+)/gi),
    has3d: /(transform-style\s*:\s*preserve-3d|perspective\s*:\s*\d)/i.test(css),
  };
}

// Resolve var(--token[, fallback]) against captured :root custom props so role
// colors come out concrete (e.g. #06070d) instead of "var(--color-bg)".
export function resolveVar(value, props, depth = 0) {
  if (!value || depth > 6) return value;
  const m = value.match(/var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)/);
  if (!m) return value;
  const replacement = (props[m[1]] ?? m[2] ?? m[0]).trim();
  return resolveVar(value.replace(m[0], replacement), props, depth + 1);
}

// `hints` is extra text (e.g. <link>/<script> src values) scanned only for font
// source classification — the Google/Adobe signal often lives in a link href.
export function analyzeCss(css = '', hints = '') {
  const customProps = extractCustomProps(css);
  const color = extractColors(css);
  for (const k of Object.keys(color.roles)) color.roles[k] = resolveVar(color.roles[k], customProps);
  return {
    customProps,
    typography: extractTypography(css, hints),
    color,
    spacing: extractSpacing(css),
    motion: extractMotion(css),
    effects: extractEffects(css),
  };
}

// --- helpers ----------------------------------------------------------------
function toPx(v) {
  const n = parseFloat(v);
  if (Number.isNaN(n)) return 0;
  if (v.endsWith('rem') || v.endsWith('em')) return n * 16;
  return n;
}

function guessBaseUnit(nums) {
  const ints = [...new Set(nums.map((n) => Math.round(n)).filter((n) => n > 0 && n <= 160))];
  if (!ints.length) return null;
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const g = ints.reduce((a, b) => gcd(a, b));
  if (g < 2) {
    for (const base of [8, 4]) {
      const mult = ints.filter((n) => n % base === 0).length;
      if (mult / ints.length >= 0.6) return base;
    }
  }
  return g;
}
