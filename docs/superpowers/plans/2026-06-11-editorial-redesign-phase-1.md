# Editorial Redesign Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved editorial design system (Gallery palette 60/20/10/10, self-hosted Playfair Display) and rebuild Home, Navigation, and Footer per `docs/superpowers/specs/2026-06-11-ui-redesign-design.md`.

**Architecture:** Parallel design-system layer — new tokens and `src/components/editorial/` components consumed only by Home/Nav/Footer in this phase; all other routes keep their page content untouched. One shared R3F canvas (drei `<View>` multiplexing) hosts the procedural ridge, gold-dust atmosphere, and image displacement surfaces; static SVG/`<img>` fallbacks are the default first paint and the permanent reduced-motion/no-WebGL path.

**Tech Stack:** React 19, TypeScript, Tailwind 3, GSAP 3 + ScrollTrigger (already wired to Lenis via `useLenis.ts`), @react-three/fiber 9 + drei 10 + three 0.183 (already installed), @fontsource/playfair-display (new), sharp (already a devDependency, used by the grading script).

**Existing infrastructure to reuse (do NOT reinvent):**
- `src/components/SafeCanvas.tsx` — ErrorBoundary+Suspense wrapper for WebGL trees
- `src/utils/checkWebGL.ts` — cached WebGL support probe
- `src/utils/prerender.ts` — `isPrerender()`; ALL GSAP/WebGL effects must early-return when true
- `src/hooks/useMediaQuery.ts`, `src/hooks/useLenis.ts` (`useLenisContext`), `src/hooks/useFocusTrap.ts`
- `src/components/SplitReveal.tsx` / `FadeReveal.tsx` — existing scroll reveals
- `src/components/NewsletterForm.tsx` — existing newsletter form (reused in Footer)
- GSAP jsdom mock pattern from `src/components/SplitReveal.test.tsx`

**Conventions that gate the build:** `npm run lint` has `--max-warnings 0`; `tsc` must pass; vitest coverage thresholds lines 62 / statements 60 / branches 59 / functions 55; tests are colocated `*.test.tsx`; Three.js must be mocked in jsdom.

**Layering contract (whole redesign relies on this):** the shared canvas is `position:fixed; inset:0; z-20; pointer-events:none`. DOM content that must read ABOVE the WebGL (headline text, pills, captions) gets `relative z-30`. Sections must NOT create stacking contexts that trap their children below the canvas (no `transform`, `opacity`, or `z-index` on section wrappers themselves). Fallback visuals sit at default z and are hidden (`opacity-0`) once the canvas reports ready.

---

### Task 1: Branch + dependency

**Files:** none modified (setup only)

- [ ] **Step 1: Create the branch**

```bash
git checkout -b redesign/editorial-phase-1
```

- [ ] **Step 2: Install Playfair Display (self-hosted, no Google CDN)**

```bash
npm install @fontsource/playfair-display
```

Expected: package added to `dependencies` in `package.json`.

- [ ] **Step 3: Verify the font files exist**

Run: `ls node_modules/@fontsource/playfair-display/files/ | grep "latin-400-normal.woff2"`
Expected: `playfair-display-latin-400-normal.woff2`

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat(redesign): add self-hosted Playfair Display via fontsource"
```

---

### Task 2: Design tokens + font wiring

**Files:**
- Modify: `tailwind.config.js:25-34` (colors) and `:9-13` (fontFamily)
- Modify: `src/main.tsx` (font CSS imports)

- [ ] **Step 1: Add the two new colors and the editorial font family to Tailwind**

In `tailwind.config.js`, replace the `colors` block:

```js
      colors: {
        'altivum': {
          'dark': '#0A0F1C',
          'navy': '#1A2332',
          'blue': '#2E4A6B',
          'slate': '#4A5A73',
          'silver': '#9BA6B8',
          'gold': '#C5A572',
          'porcelain': '#F2EFE9',
          'umber': '#3E3A33',
        },
      },
```

And add to the `fontFamily` block (keep the existing three entries):

```js
        'editorial': ['"Playfair Display"', 'Didot', 'Georgia', 'serif'],
```

- [ ] **Step 2: Import the four font faces in `src/main.tsx`**

Add at the very top of `src/main.tsx`, before any other import:

```ts
import '@fontsource/playfair-display/400.css';
import '@fontsource/playfair-display/400-italic.css';
import '@fontsource/playfair-display/500.css';
import '@fontsource/playfair-display/500-italic.css';
```

- [ ] **Step 3: Metrics-tuned local fallback (kills font-swap CLS — spec §3)**

Append to `src/index.css` (after the `@layer` blocks):

```css
/* Metrics-tuned local fallback for Playfair Display: while the woff2 loads
   (font-display: swap), Georgia renders at adjusted metrics so the swap does
   not shift layout. Keep in sync with EDITORIAL_FONT_FAMILY. */
@font-face {
  font-family: 'Playfair Fallback';
  src: local('Georgia');
  size-adjust: 112%;
  ascent-override: 95%;
  descent-override: 24%;
  line-gap-override: 0%;
}
```

And in `src/utils/editorialType.ts` (Task 3) the family constant already reads:
`'"Playfair Display", "Playfair Fallback", Didot, Georgia, serif'` — use exactly that string in Task 3, and the same stack in the Tailwind `editorial` entry from Step 1:

```js
        'editorial': ['"Playfair Display"', '"Playfair Fallback"', 'Didot', 'Georgia', 'serif'],
```

- [ ] **Step 4: Verify dev server renders the font**

Run: `npm run dev` — open http://localhost:5173, in DevTools console run:
`document.fonts.check('16px "Playfair Display"')`
Expected: `true`. Stop the server.

- [ ] **Step 5: Commit**

```bash
git add tailwind.config.js src/main.tsx src/index.css
git commit -m "feat(redesign): Gallery palette tokens (porcelain, umber) + editorial font family"
```

---

### Task 3: `editorialType` module (TDD)

**Files:**
- Create: `src/utils/editorialType.ts`
- Test: `src/utils/editorialType.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/utils/editorialType.test.ts
import { describe, it, expect } from 'vitest';
import { editorialType, EDITORIAL_FONT_FAMILY } from './editorialType';

describe('editorialType', () => {
  it('exposes the Playfair Display stack', () => {
    expect(EDITORIAL_FONT_FAMILY).toContain('Playfair Display');
    expect(EDITORIAL_FONT_FAMILY).toContain('serif');
  });

  it('defines all six editorial styles', () => {
    expect(Object.keys(editorialType).sort()).toEqual([
      'displayHero',
      'displaySection',
      'eyebrow',
      'pullQuote',
      'statNumeral',
      'statSuffix',
    ]);
  });

  it('every style uses the editorial font family and fluid clamp sizing', () => {
    for (const style of Object.values(editorialType)) {
      expect(style.fontFamily).toBe(EDITORIAL_FONT_FAMILY);
      expect(style.fontSize).toMatch(/^clamp\(/);
    }
  });

  it('display styles are uppercase, never bold', () => {
    expect(editorialType.displayHero.textTransform).toBe('uppercase');
    expect(editorialType.displaySection.textTransform).toBe('uppercase');
    for (const style of Object.values(editorialType)) {
      expect(style.fontWeight).toBeLessThanOrEqual(500);
    }
  });

  it('eyebrow and pullQuote are italic', () => {
    expect(editorialType.eyebrow.fontStyle).toBe('italic');
    expect(editorialType.pullQuote.fontStyle).toBe('italic');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/editorialType.test.ts`
Expected: FAIL — "Cannot find module './editorialType'"

- [ ] **Step 3: Write the module**

```ts
// src/utils/editorialType.ts
// Editorial display typography — Playfair Display (self-hosted via fontsource).
// Companion to typography.ts (SF Pro body/UI), never a replacement for it.
// Accent rule: within any display headline exactly one word may be italic gold;
// hierarchy comes from scale and italics — never bold (max weight 500).

export const EDITORIAL_FONT_FAMILY =
  '"Playfair Display", "Playfair Fallback", Didot, Georgia, serif';

export const editorialType = {
  // Hero display — the bento scene-tile name (44px -> 104px)
  displayHero: {
    fontFamily: EDITORIAL_FONT_FAMILY,
    fontWeight: 500,
    fontSize: 'clamp(2.75rem, 7vw, 6.5rem)',
    lineHeight: 0.98,
    letterSpacing: '0.01em',
    textTransform: 'uppercase',
  },

  // Section display headlines (36px -> 64px)
  displaySection: {
    fontFamily: EDITORIAL_FONT_FAMILY,
    fontWeight: 400,
    fontSize: 'clamp(2.25rem, 4.5vw, 4rem)',
    lineHeight: 1.08,
    letterSpacing: '0.01em',
    textTransform: 'uppercase',
  },

  // Animated stat numerals (48px -> 88px)
  statNumeral: {
    fontFamily: EDITORIAL_FONT_FAMILY,
    fontWeight: 400,
    fontSize: 'clamp(3rem, 6vw, 5.5rem)',
    lineHeight: 1,
    letterSpacing: '0em',
  },

  // Italic suffix beside a numeral, e.g. the D in 18D (20px -> 28px)
  statSuffix: {
    fontFamily: EDITORIAL_FONT_FAMILY,
    fontWeight: 400,
    fontStyle: 'italic',
    fontSize: 'clamp(1.25rem, 2vw, 1.75rem)',
    lineHeight: 1,
    letterSpacing: '0em',
  },

  // Porcelain italic pull-quotes on image breaks (24px -> 40px)
  pullQuote: {
    fontFamily: EDITORIAL_FONT_FAMILY,
    fontWeight: 400,
    fontStyle: 'italic',
    fontSize: 'clamp(1.5rem, 3vw, 2.5rem)',
    lineHeight: 1.3,
    letterSpacing: '0.01em',
  },

  // Parenthetical section labels, e.g. (ABOUT) (10px -> 12px)
  eyebrow: {
    fontFamily: EDITORIAL_FONT_FAMILY,
    fontWeight: 400,
    fontStyle: 'italic',
    fontSize: 'clamp(0.625rem, 1vw, 0.75rem)',
    lineHeight: 1.4,
    letterSpacing: '0.25em',
  },
} as const;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/editorialType.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/utils/editorialType.ts src/utils/editorialType.test.ts
git commit -m "feat(redesign): editorialType display typography module"
```

---

### Task 4: `Eyebrow` component (TDD)

**Files:**
- Create: `src/components/editorial/Eyebrow.tsx`
- Test: `src/components/editorial/Eyebrow.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/editorial/Eyebrow.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Eyebrow from './Eyebrow';

vi.mock('gsap', () => ({
  default: {
    registerPlugin: vi.fn(),
    fromTo: vi.fn(() => ({ scrollTrigger: { kill: vi.fn() }, kill: vi.fn() })),
  },
  gsap: {
    registerPlugin: vi.fn(),
    fromTo: vi.fn(() => ({ scrollTrigger: { kill: vi.fn() }, kill: vi.fn() })),
  },
}));

vi.mock('gsap/ScrollTrigger', () => ({ ScrollTrigger: {} }));

describe('Eyebrow', () => {
  it('wraps the label in parentheses', () => {
    render(<Eyebrow>ABOUT</Eyebrow>);
    expect(screen.getByText('(ABOUT)')).toBeInTheDocument();
  });

  it('applies the editorial eyebrow style (italic, letter-spaced)', () => {
    render(<Eyebrow>THE RECORD</Eyebrow>);
    const el = screen.getByText('(THE RECORD)');
    expect(el.style.fontStyle).toBe('italic');
    expect(el.style.letterSpacing).toBe('0.25em');
  });

  it('passes through className', () => {
    render(<Eyebrow className="text-altivum-dark/50">NEXT</Eyebrow>);
    expect(screen.getByText('(NEXT)')).toHaveClass('text-altivum-dark/50');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/editorial/Eyebrow.test.tsx`
Expected: FAIL — "Cannot find module './Eyebrow'"

- [ ] **Step 3: Write the component**

```tsx
// src/components/editorial/Eyebrow.tsx
import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { editorialType } from '../../utils/editorialType';
import { isPrerender } from '../../utils/prerender';

gsap.registerPlugin(ScrollTrigger);

interface EyebrowProps {
  children: string;
  className?: string;
}

/**
 * The reference design's signature parenthetical section label, e.g. (ABOUT).
 * Reveals once with a left-to-right clip-path wipe when scrolled into view.
 * Default color is porcelain at 55% opacity — override via className on
 * light backgrounds.
 */
const Eyebrow = ({ children, className = 'text-altivum-porcelain/55' }: EyebrowProps) => {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (isPrerender()) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const el = ref.current;
    if (!el) return;

    const tween = gsap.fromTo(
      el,
      { clipPath: 'inset(0 100% 0 0)' },
      {
        clipPath: 'inset(0 0% 0 0)',
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none none' },
      }
    );

    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, []);

  return (
    <span ref={ref} className={`relative z-30 inline-block ${className}`} style={editorialType.eyebrow}>
      ({children})
    </span>
  );
};

export default Eyebrow;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/editorial/Eyebrow.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/editorial/Eyebrow.tsx src/components/editorial/Eyebrow.test.tsx
git commit -m "feat(redesign): Eyebrow parenthetical section label"
```

---

### Task 5: `EditorialPill` component (TDD)

**Files:**
- Create: `src/components/editorial/EditorialPill.tsx`
- Test: `src/components/editorial/EditorialPill.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/editorial/EditorialPill.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EditorialPill from './EditorialPill';

describe('EditorialPill', () => {
  it('renders an internal link when `to` is given', () => {
    render(
      <MemoryRouter>
        <EditorialPill to="/contact">CONTACT</EditorialPill>
      </MemoryRouter>
    );
    const link = screen.getByRole('link', { name: 'CONTACT' });
    expect(link).toHaveAttribute('href', '/contact');
  });

  it('renders a button when `onClick` is given', () => {
    const onClick = vi.fn();
    render(<EditorialPill onClick={onClick}>NEWSLETTER</EditorialPill>);
    fireEvent.click(screen.getByRole('button', { name: 'NEWSLETTER' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('defaults to the gold-outline variant', () => {
    render(<EditorialPill onClick={() => {}}>GO</EditorialPill>);
    expect(screen.getByRole('button')).toHaveClass('border-altivum-gold');
  });

  it('supports the dark-solid variant for porcelain backgrounds', () => {
    render(
      <EditorialPill onClick={() => {}} variant="dark-solid">
        START
      </EditorialPill>
    );
    expect(screen.getByRole('button')).toHaveClass('bg-altivum-dark');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/editorial/EditorialPill.test.tsx`
Expected: FAIL — "Cannot find module './EditorialPill'"

- [ ] **Step 3: Write the component**

```tsx
// src/components/editorial/EditorialPill.tsx
import type { ReactNode } from 'react';
import ViewTransitionLink from '../ViewTransitionLink';

type PillVariant = 'gold-outline' | 'dark-solid' | 'dark-outline';

interface EditorialPillProps {
  children: ReactNode;
  to?: string;
  href?: string;
  onClick?: () => void;
  variant?: PillVariant;
  className?: string;
}

const VARIANT_CLASSES: Record<PillVariant, string> = {
  // On dark backgrounds
  'gold-outline':
    'border-altivum-gold text-altivum-gold hover:bg-altivum-gold/10 hover:shadow-[0_0_20px_rgba(197,165,114,0.3)]',
  // On the porcelain CTA section
  'dark-solid':
    'border-altivum-dark bg-altivum-dark text-altivum-porcelain hover:bg-altivum-navy',
  'dark-outline':
    'border-altivum-dark/30 text-altivum-dark hover:border-altivum-dark hover:bg-altivum-dark/5',
};

const BASE_CLASSES =
  'relative z-30 inline-flex items-center justify-center rounded-full border px-7 py-3.5 ' +
  'text-xs font-medium uppercase tracking-[0.2em] transition-all duration-300 ' +
  'active:scale-[0.98] touch-manipulation min-h-[48px]';

/**
 * The editorial CTA pill — uppercase letter-spaced SF Pro inside a rounded
 * hairline border. Renders a router link (`to`), anchor (`href`), or button
 * (`onClick`) depending on which prop is provided.
 */
const EditorialPill = ({
  children,
  to,
  href,
  onClick,
  variant = 'gold-outline',
  className = '',
}: EditorialPillProps) => {
  const classes = `${BASE_CLASSES} ${VARIANT_CLASSES[variant]} ${className}`;

  if (to) {
    return (
      <ViewTransitionLink to={to} className={classes}>
        {children}
      </ViewTransitionLink>
    );
  }
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={classes}>
      {children}
    </button>
  );
};

export default EditorialPill;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/editorial/EditorialPill.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/editorial/EditorialPill.tsx src/components/editorial/EditorialPill.test.tsx
git commit -m "feat(redesign): EditorialPill CTA component"
```

---

### Task 6: `CountUp` stat numeral (TDD)

**Files:**
- Create: `src/components/editorial/CountUp.tsx`
- Test: `src/components/editorial/CountUp.test.tsx`

Design note: the FINAL value is rendered as real DOM text from the first paint (SEO + reduced-motion + prerender all correct by default). The GSAP tween only mutates `textContent` transiently during the roll-up, then lands back on the final value.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/editorial/CountUp.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import CountUp from './CountUp';

vi.mock('gsap', () => ({
  default: {
    registerPlugin: vi.fn(),
    fromTo: vi.fn(() => ({ scrollTrigger: { kill: vi.fn() }, kill: vi.fn() })),
  },
  gsap: {
    registerPlugin: vi.fn(),
    fromTo: vi.fn(() => ({ scrollTrigger: { kill: vi.fn() }, kill: vi.fn() })),
  },
}));

vi.mock('gsap/ScrollTrigger', () => ({ ScrollTrigger: {} }));

describe('CountUp', () => {
  it('renders the final value as text from first paint', () => {
    render(<CountUp value={18} suffix="D" caption="Special Forces Medical Sergeant" />);
    expect(screen.getByText('18')).toBeInTheDocument();
    expect(screen.getByText('D')).toBeInTheDocument();
  });

  it('exposes one combined accessible label', () => {
    render(<CountUp value={60} suffix="+" caption="podcast episodes" />);
    expect(
      screen.getByLabelText('60+ — podcast episodes')
    ).toBeInTheDocument();
  });

  it('renders the caption', () => {
    render(<CountUp value={3} suffix="x" caption="ventures built and operating" />);
    expect(screen.getByText('ventures built and operating')).toBeInTheDocument();
  });

  it('renders without a suffix', () => {
    render(<CountUp value={1} caption="book" />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByLabelText('1 — book')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/editorial/CountUp.test.tsx`
Expected: FAIL — "Cannot find module './CountUp'"

- [ ] **Step 3: Write the component**

```tsx
// src/components/editorial/CountUp.tsx
import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { editorialType } from '../../utils/editorialType';
import { isPrerender } from '../../utils/prerender';

gsap.registerPlugin(ScrollTrigger);

interface CountUpProps {
  /** Final numeric value the numeral rolls up to. */
  value: number;
  /** Italic gold suffix rendered beside the numeral, e.g. "D", "+", "x". */
  suffix?: string;
  /** Small uppercase caption under the numeral. */
  caption: string;
  className?: string;
}

/**
 * The reference design's signature animated serif stat. The final value is in
 * the DOM from first paint; GSAP only animates the displayed text transiently
 * (reduced motion / prerender / no-JS all read correct values by default).
 */
const CountUp = ({ value, suffix = '', caption, className = '' }: CountUpProps) => {
  const numeralRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (isPrerender()) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const el = numeralRef.current;
    if (!el) return;

    const counter = { n: 0 };
    const tween = gsap.fromTo(
      counter,
      { n: 0 },
      {
        n: value,
        duration: 1.6,
        ease: 'power3.out',
        snap: { n: 1 },
        onUpdate: () => {
          el.textContent = String(Math.round(counter.n));
        },
        scrollTrigger: { trigger: el, start: 'top 85%', toggleActions: 'play none none none' },
      }
    );

    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
      el.textContent = String(value);
    };
  }, [value]);

  return (
    <div className={`relative z-30 ${className}`} aria-label={`${value}${suffix} — ${caption}`}>
      <span aria-hidden="true">
        <span ref={numeralRef} className="text-altivum-porcelain" style={editorialType.statNumeral}>
          {value}
        </span>
        {suffix && (
          <span className="text-altivum-gold" style={editorialType.statSuffix}>
            {suffix}
          </span>
        )}
      </span>
      <p
        aria-hidden="true"
        className="mt-2 max-w-[10rem] text-[0.625rem] uppercase tracking-[0.12em] leading-relaxed text-altivum-silver"
      >
        {caption}
      </p>
    </div>
  );
};

export default CountUp;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/editorial/CountUp.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/editorial/CountUp.tsx src/components/editorial/CountUp.test.tsx
git commit -m "feat(redesign): CountUp serif stat numeral with roll-up animation"
```

---

### Task 7: Shared editorial canvas (provider + context)

**Files:**
- Create: `src/components/editorial/EditorialCanvas.tsx`
- Test: `src/components/editorial/EditorialCanvas.test.tsx`

In jsdom, `checkWebGLSupport()` returns false, so tests exercise the disabled path (children render, no canvas) — exactly the production fallback behavior.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/editorial/EditorialCanvas.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EditorialCanvasProvider, useEditorialCanvas } from './EditorialCanvas';

vi.mock('@react-three/fiber', () => ({
  Canvas: () => null,
}));
vi.mock('@react-three/drei', () => ({
  View: Object.assign(() => null, { Port: () => null }),
}));

const Probe = () => {
  const { ready } = useEditorialCanvas();
  return <span data-testid="probe">{ready ? 'ready' : 'fallback'}</span>;
};

describe('EditorialCanvasProvider', () => {
  it('renders children', () => {
    render(
      <EditorialCanvasProvider>
        <p>page content</p>
      </EditorialCanvasProvider>
    );
    expect(screen.getByText('page content')).toBeInTheDocument();
  });

  it('reports not-ready when WebGL is unavailable (jsdom)', () => {
    render(
      <EditorialCanvasProvider>
        <Probe />
      </EditorialCanvasProvider>
    );
    expect(screen.getByTestId('probe')).toHaveTextContent('fallback');
  });

  it('useEditorialCanvas defaults to not-ready outside a provider', () => {
    render(<Probe />);
    expect(screen.getByTestId('probe')).toHaveTextContent('fallback');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/editorial/EditorialCanvas.test.tsx`
Expected: FAIL — "Cannot find module './EditorialCanvas'"

- [ ] **Step 3: Write the provider**

```tsx
// src/components/editorial/EditorialCanvas.tsx
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { Canvas } from '@react-three/fiber';
import { View } from '@react-three/drei';
import SafeCanvas from '../SafeCanvas';
import { checkWebGLSupport } from '../../utils/checkWebGL';
import { isPrerender } from '../../utils/prerender';
import { useMediaQuery } from '../../hooks/useMediaQuery';

interface EditorialCanvasValue {
  /** True once the shared WebGL canvas has created a context and can host Views. */
  ready: boolean;
}

const EditorialCanvasContext = createContext<EditorialCanvasValue>({ ready: false });

export function useEditorialCanvas(): EditorialCanvasValue {
  return useContext(EditorialCanvasContext);
}

/**
 * One shared, fixed, pointer-events-none WebGL canvas for the whole page,
 * multiplexed into DOM rects via drei <View track={ref}>. Mounts idle-time
 * after first paint so the DOM (hero name) stays the LCP element. When this
 * never becomes ready (reduced motion, no WebGL, prerender, mount error) the
 * static fallbacks simply remain visible — failure is staying on first paint.
 *
 * Layering contract: canvas z-20; content that must read above the WebGL
 * uses `relative z-30`; fallback visuals hide via opacity when ready.
 */
export const EditorialCanvasProvider = ({ children }: { children: ReactNode }) => {
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [idle, setIdle] = useState(false);
  const [ready, setReady] = useState(false);

  const enabled =
    !reducedMotion &&
    typeof document !== 'undefined' &&
    checkWebGLSupport() &&
    !isPrerender();

  useEffect(() => {
    if (!enabled) return;
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(() => setIdle(true), { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    }
    const t = setTimeout(() => setIdle(true), 350);
    return () => clearTimeout(t);
  }, [enabled]);

  // Pause rendering entirely when the tab is hidden (same policy as AltiMascot).
  const [docVisible, setDocVisible] = useState(() =>
    typeof document === 'undefined' ? true : !document.hidden
  );
  useEffect(() => {
    const onVisibility = () => setDocVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  return (
    <EditorialCanvasContext.Provider value={{ ready }}>
      {children}
      {enabled && idle && (
        <div className="fixed inset-0 z-20 pointer-events-none" aria-hidden="true">
          <SafeCanvas>
            <Canvas
              frameloop={docVisible ? 'demand' : 'never'}
              dpr={[1, 2]}
              gl={{ alpha: true, antialias: true }}
              onCreated={() => setReady(true)}
              style={{ width: '100%', height: '100%' }}
            >
              <View.Port />
            </Canvas>
          </SafeCanvas>
        </div>
      )}
    </EditorialCanvasContext.Provider>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/editorial/EditorialCanvas.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/editorial/EditorialCanvas.tsx src/components/editorial/EditorialCanvas.test.tsx
git commit -m "feat(redesign): shared editorial WebGL canvas with View multiplexing"
```

---

### Task 8: Ridge — shader, fallback SVG, View (TDD on fallback)

**Files:**
- Create: `src/components/editorial/ridgeShader.ts`
- Create: `src/components/editorial/RidgeFallback.tsx`
- Create: `src/components/editorial/RidgeView.tsx`
- Test: `src/components/editorial/RidgeFallback.test.tsx`

- [ ] **Step 1: Write the failing fallback test**

```tsx
// src/components/editorial/RidgeFallback.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import RidgeFallback from './RidgeFallback';

describe('RidgeFallback', () => {
  it('renders a decorative SVG with gold contour paths', () => {
    const { container } = render(<RidgeFallback />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelectorAll('path').length).toBeGreaterThanOrEqual(4);
  });

  it('hides itself when the canvas is ready', () => {
    const { container } = render(<RidgeFallback hidden />);
    expect((container.firstChild as HTMLElement).className).toContain('opacity-0');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/editorial/RidgeFallback.test.tsx`
Expected: FAIL — "Cannot find module './RidgeFallback'"

- [ ] **Step 3: Write the fallback SVG**

```tsx
// src/components/editorial/RidgeFallback.tsx
interface RidgeFallbackProps {
  /** Fades the fallback out once the WebGL ridge is live in the same rect. */
  hidden?: boolean;
}

/**
 * Static gold contour-line horizon. This is the FIRST paint of the hero scene
 * tile and the permanent visual for reduced-motion / no-WebGL / prerender.
 */
const RidgeFallback = ({ hidden = false }: RidgeFallbackProps) => (
  <div
    className={`absolute inset-x-0 bottom-0 h-[62%] transition-opacity duration-700 ${
      hidden ? 'opacity-0' : 'opacity-100'
    }`}
  >
    <svg
      viewBox="0 0 500 200"
      preserveAspectRatio="none"
      className="h-full w-full"
      aria-hidden="true"
    >
      <g fill="none" stroke="#C5A572" strokeWidth="0.7">
        <path d="M0,160 Q80,90 150,125 T290,80 T420,115 T500,60" opacity="0.9" />
        <path d="M0,172 Q90,110 160,140 T300,100 T430,130 T500,82" opacity="0.6" />
        <path d="M0,184 Q100,130 170,155 T310,120 T440,145 T500,104" opacity="0.4" />
        <path d="M0,196 Q110,152 180,170 T320,142 T450,160 T500,126" opacity="0.22" />
      </g>
      <g fill="none" stroke="#F2EFE9" strokeWidth="0.4" opacity="0.25">
        <path d="M0,166 Q85,100 155,132 T295,90 T425,122 T500,71" />
      </g>
    </svg>
  </div>
);

export default RidgeFallback;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/editorial/RidgeFallback.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Write the ridge shader module**

```ts
// src/components/editorial/ridgeShader.ts
// Procedural contour-line terrain. Vertex displaces a plane with 4-octave
// value-noise FBM; fragment draws iso-elevation lines and reveals them from
// low to high elevation as uProgress animates 0 -> 1 (the once-on-load
// "draw-in"), after which the scene is fully static.

export const ridgeVertexShader = /* glsl */ `
  uniform float uAmp;
  varying float vH;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * vnoise(p);
      p *= 2.1;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vUv = uv;
    // Ridge profile: higher toward the back, fades at the sides.
    float h = fbm(uv * 3.0 + vec2(7.3, 1.7));
    h *= smoothstep(0.0, 0.35, uv.y) * (1.0 - 0.35 * abs(uv.x - 0.5) * 2.0);
    vH = h;
    vec3 displaced = position + normal * h * uAmp;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`;

export const ridgeFragmentShader = /* glsl */ `
  uniform float uProgress;
  uniform vec3 uColorGold;
  uniform vec3 uColorPorcelain;
  varying float vH;
  varying vec2 vUv;

  void main() {
    // Iso-elevation contour bands.
    float bands = 14.0;
    float f = fract(vH * bands);
    float dist = min(f, 1.0 - f);
    float w = fwidth(vH * bands) * 1.4;
    float line = 1.0 - smoothstep(0.0, w + 0.03, dist);

    // Draw-in: contours appear from low elevation to high as uProgress rises.
    float reveal = smoothstep(vH - 0.06, vH + 0.02, uProgress);

    // Depth fade toward the back edge keeps the horizon airy.
    float fade = mix(1.0, 0.25, smoothstep(0.55, 1.0, vUv.y));

    // Nearest band (contour lines straddle band boundaries) — every 5th gets
    // a porcelain highlight for tonal variation.
    float band = floor(vH * bands + 0.5);
    float isHighlight = step(3.5, mod(band, 5.0));
    vec3 color = mix(uColorGold, uColorPorcelain, isHighlight * 0.35);

    float alpha = line * reveal * fade * 0.85;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(color, alpha);
  }
`;
```

- [ ] **Step 6: Write the RidgeView**

```tsx
// src/components/editorial/RidgeView.tsx
import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { View, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { ridgeVertexShader, ridgeFragmentShader } from './ridgeShader';

const COLOR_GOLD = new THREE.Color('#C5A572');
const COLOR_PORCELAIN = new THREE.Color('#F2EFE9');

function RidgeTerrain() {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const { invalidate } = useThree();
  const elapsedRef = useRef(0);

  const uniforms = useMemo(
    () => ({
      uProgress: { value: 0 },
      uAmp: { value: 0.55 },
      uColorGold: { value: COLOR_GOLD.clone() },
      uColorPorcelain: { value: COLOR_PORCELAIN.clone() },
    }),
    []
  );

  // Draw-in once (~1.8s, power3-like curve), then never invalidate again —
  // with frameloop="demand" the settled ridge costs zero per-frame GPU work.
  // Accumulates clamped frame deltas rather than reading clock.elapsedTime:
  // R3F resets the clock whenever the provider flips frameloop (tab switch),
  // which would rewind an absolute-time draw-in.
  useFrame((_, delta) => {
    const mat = materialRef.current;
    if (!mat) return;
    if (mat.uniforms.uProgress.value >= 1) return;
    elapsedRef.current += Math.min(delta, 0.1);
    const t = Math.min(elapsedRef.current / 1.8, 1);
    mat.uniforms.uProgress.value = 1 - Math.pow(1 - t, 3);
    if (t < 1) invalidate();
  });

  return (
    <mesh rotation={[-Math.PI / 2.35, 0, 0]} position={[0, -0.55, 0]}>
      <planeGeometry args={[6, 3, 160, 80]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={ridgeVertexShader}
        fragmentShader={ridgeFragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

interface RidgeViewProps {
  /** Positions the View's own div inside the hero scene tile. */
  className?: string;
}

/**
 * Live contour-line terrain rendered into the hero scene tile. drei 10's
 * out-of-canvas View renders AND tracks its own div (the `track` prop is dead
 * in that path) — so the View must BE the positioned element.
 */
const RidgeView = ({ className = 'pointer-events-none absolute inset-0' }: RidgeViewProps) => (
  <View className={className}>
    <PerspectiveCamera makeDefault position={[0, 0.7, 2.4]} fov={40} />
    <RidgeTerrain />
  </View>
);

export default RidgeView;
```

- [ ] **Step 7: Type-check and lint**

Run: `npx tsc --noEmit && npx eslint src/components/editorial --ext ts,tsx --max-warnings 0`
Expected: clean exit. (RidgeView has no jsdom test — Three is unavailable; the fallback test covers the DOM path, consistent with the existing HeroCanvas precedent.)

- [ ] **Step 8: Commit**

```bash
git add src/components/editorial/ridgeShader.ts src/components/editorial/RidgeFallback.tsx src/components/editorial/RidgeView.tsx src/components/editorial/RidgeFallback.test.tsx
git commit -m "feat(redesign): procedural contour ridge — shader, WebGL view, SVG fallback"
```

---

### Task 9: Atmosphere particles

**Files:**
- Create: `src/components/editorial/AtmosphereView.tsx`
- Test: `src/components/editorial/atmosphere.test.ts` (pure-math helper test)

- [ ] **Step 1: Write the failing test for the drift helper**

```ts
// src/components/editorial/atmosphere.test.ts
import { describe, it, expect } from 'vitest';
import { advanceParticleY, PARTICLE_BOUNDS } from './AtmosphereView';

describe('advanceParticleY', () => {
  it('drifts particles upward', () => {
    expect(advanceParticleY(0, 0.5)).toBeGreaterThan(0);
  });

  it('wraps to the bottom after passing the top bound', () => {
    const y = advanceParticleY(PARTICLE_BOUNDS.y, 0.5);
    expect(y).toBeLessThanOrEqual(-PARTICLE_BOUNDS.y + 0.1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/editorial/atmosphere.test.ts`
Expected: FAIL — "Cannot find module './AtmosphereView'"

- [ ] **Step 3: Write the component**

```tsx
// src/components/editorial/AtmosphereView.tsx
import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { View, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

export const PARTICLE_BOUNDS = { x: 3, y: 1.6, z: 1 };
const DRIFT_SPEED = 0.045; // units/second — barely-there rise

/** Pure drift step, exported for unit testing. Wraps at the top bound. */
export function advanceParticleY(y: number, dt: number): number {
  const next = y + DRIFT_SPEED * dt;
  return next > PARTICLE_BOUNDS.y ? -PARTICLE_BOUNDS.y : next;
}

interface DustProps {
  count: number;
}

function Dust({ count }: DustProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const { invalidate } = useThree();

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() * 2 - 1) * PARTICLE_BOUNDS.x;
      arr[i * 3 + 1] = (Math.random() * 2 - 1) * PARTICLE_BOUNDS.y;
      arr[i * 3 + 2] = (Math.random() * 2 - 1) * PARTICLE_BOUNDS.z;
    }
    return arr;
  }, [count]);

  // 30fps invalidation cap: with frameloop="demand" the dust drives its own
  // clock instead of forcing a 60fps loop on the whole shared canvas.
  useEffect(() => {
    const id = setInterval(() => invalidate(), 33);
    return () => clearInterval(id);
  }, [invalidate]);

  useFrame((_, delta) => {
    const points = pointsRef.current;
    if (!points) return;
    const pos = points.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, advanceParticleY(pos.getY(i), Math.min(delta, 0.1)));
    }
    pos.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#C5A572"
        size={0.018}
        sizeAttenuation
        transparent
        opacity={0.28}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

interface AtmosphereViewProps {
  /** Positions the View's own div inside the hero scene tile. */
  className?: string;
  /** Lower particle count on coarse-pointer (mobile) devices. */
  mobile?: boolean;
}

/** Sparse gold-dust drift behind the hero — quiet depth, never busy.
 *  View-as-element per the EditorialCanvas consumer contract. */
const AtmosphereView = ({ className = 'pointer-events-none absolute inset-0', mobile = false }: AtmosphereViewProps) => (
  <View className={className}>
    <PerspectiveCamera makeDefault position={[0, 0, 3]} fov={50} />
    <Dust count={mobile ? 150 : 400} />
  </View>
);

export default AtmosphereView;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/editorial/atmosphere.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/editorial/AtmosphereView.tsx src/components/editorial/atmosphere.test.ts
git commit -m "feat(redesign): gold-dust atmosphere view with 30fps demand cap"
```

---

### Task 10: Imagery — sourcing, grading script, assets

**Files:**
- Create: `scripts/grade-editorial-images.mjs`
- Create: `scripts/editorial-raw/` (working dir, gitignored)
- Create: `src/assets/editorial/` (graded outputs, committed)
- Modify: `.gitignore` (add `scripts/editorial-raw/`)

Needed images (6 total) — subjects per spec §8 (abstract textures + architectural minimalism), each must read at 60% darkness with type over it, no busy mid-tones:

| File stem | Subject | Used by |
|---|---|---|
| `portrait` | existing `public/profile1.jpeg` | (ABOUT) center |
| `venture-altivum` | concrete architectural curve | Ventures panel 1 |
| `venture-podcast` | dark fabric / smoke texture | Ventures panel 2 |
| `venture-book` | paper / linen texture, moody light | Ventures panel 3 |
| `venture-aws` | glass facade light study | Ventures panel 4 |
| `break-interior` | minimal interior or stair shadow, wide | Image break |

- [ ] **Step 1: Gitignore the raw working dir**

Append to `.gitignore`:

```
scripts/editorial-raw/
```

- [ ] **Step 2: Download source images**

```bash
mkdir -p scripts/editorial-raw
cp public/profile1.jpeg scripts/editorial-raw/portrait.jpeg
```

For the five stock images: go to unsplash.com, search the subject terms above, and for each pick a photo matching the selection bar (dark or gradeable, quiet mid-tones, ≥1920px wide; Unsplash license). Download the full-size JPEG and save as `scripts/editorial-raw/<stem>.jpeg`. Verify all six exist:

Run: `ls scripts/editorial-raw/ | sort`
Expected: `break-interior.jpeg`, `portrait.jpeg`, `venture-altivum.jpeg`, `venture-aws.jpeg`, `venture-book.jpeg`, `venture-podcast.jpeg`

- [ ] **Step 3: Write the grading script**

```js
// scripts/grade-editorial-images.mjs
// One-time grading pass: darken, desaturate, warm-tint toward umber so every
// editorial image sits in the dark/porcelain/gold world. Outputs AVIF + WebP
// + JPEG at 640/1280/1920 into src/assets/editorial/.
import { readdir, mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const RAW_DIR = 'scripts/editorial-raw';
const OUT_DIR = 'src/assets/editorial';
const WIDTHS = [640, 1280, 1920];

const files = (await readdir(RAW_DIR)).filter((f) => /\.(jpe?g|png)$/i.test(f));
if (files.length === 0) {
  console.error(`No source images in ${RAW_DIR}`);
  process.exit(1);
}
await mkdir(OUT_DIR, { recursive: true });

for (const file of files) {
  const stem = path.parse(file).name;
  const src = sharp(path.join(RAW_DIR, file)).rotate();
  const { width: srcWidth } = await src.metadata();

  for (const width of WIDTHS) {
    if (srcWidth && srcWidth < width) continue;
    const resized = await src
      .clone()
      .resize(width)
      .modulate({ saturation: 0.78, brightness: 0.92 })
      .toBuffer();
    const { width: w, height: h } = await sharp(resized).metadata();
    // Warm umber multiply wash (#3E3A33 at 30%) pulls every image into the palette.
    const wash = await sharp({
      create: {
        width: w,
        height: h,
        channels: 4,
        background: { r: 62, g: 58, b: 51, alpha: 0.3 },
      },
    })
      .png()
      .toBuffer();
    const graded = sharp(resized).composite([{ input: wash, blend: 'multiply' }]);

    await graded.clone().avif({ quality: 60 }).toFile(`${OUT_DIR}/${stem}-${width}.avif`);
    await graded.clone().webp({ quality: 75 }).toFile(`${OUT_DIR}/${stem}-${width}.webp`);
    await graded.clone().jpeg({ quality: 80 }).toFile(`${OUT_DIR}/${stem}-${width}.jpg`);
    console.log(`graded ${stem} @ ${width}`);
  }
}
console.log('done');
```

- [ ] **Step 4: Run the script and verify output**

Run: `node scripts/grade-editorial-images.mjs`
Expected: "graded <stem> @ <width>" lines, then "done".
Run: `ls src/assets/editorial/ | wc -l`
Expected: up to 54 files (6 stems × 3 widths × 3 formats; fewer if a source is narrower than 1920).

- [ ] **Step 5: Commit**

```bash
git add .gitignore scripts/grade-editorial-images.mjs src/assets/editorial/
git commit -m "feat(redesign): graded editorial image set + sharp grading pipeline"
```

---

### Task 11: `EditorialImage` + displacement surface (TDD on DOM path)

> **AMENDED IN EXECUTION** — quality review found three critical defects in the code below (no cover-fit/rect-fill on non-square placements; hover dead on a parked page; umber flash during crossfade). The committed implementation in `src/components/editorial/EditorialImage.tsx`, `surfaceShader.ts`, and the `{ ready, invalidate }` context shape in `EditorialCanvas.tsx` is canonical and supersedes the snippets below. Downstream tasks already reflect the changes (Task 15's `onUpdate` invalidate).

**Files:**
- Create: `src/components/editorial/surfaceShader.ts`
- Create: `src/components/editorial/EditorialImage.tsx`
- Test: `src/components/editorial/EditorialImage.test.tsx`

`EditorialImage` is the single component for all graded imagery: it always renders a real `<picture>`/`<img>` (SEO, layout, fallback) and, when the shared canvas is ready, overlays a drei View that re-renders the same image through a displacement shader (cursor ripple on hover + scroll-velocity wave). The `<img>` fades out when the surface is live.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/editorial/EditorialImage.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import EditorialImage from './EditorialImage';

vi.mock('@react-three/fiber', () => ({
  useFrame: vi.fn(),
  useThree: () => ({ invalidate: vi.fn() }),
}));
vi.mock('@react-three/drei', () => ({
  View: Object.assign(() => null, { Port: () => null }),
  PerspectiveCamera: () => null,
  useTexture: () => ({}),
}));

describe('EditorialImage', () => {
  const stem = 'venture-altivum';

  it('renders a real img with alt text and reserved aspect ratio', () => {
    render(<EditorialImage stem={stem} alt="Concrete curve" aspect="4 / 3" />);
    const img = screen.getByAltText('Concrete curve');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('loading', 'lazy');
    const wrapper = img.closest('[data-editorial-image]') as HTMLElement;
    expect(wrapper.style.aspectRatio).toBe('4 / 3');
  });

  it('builds avif/webp sources and jpg fallback from the stem', () => {
    const { container } = render(
      <EditorialImage stem={stem} alt="Concrete curve" aspect="4 / 3" />
    );
    const sources = container.querySelectorAll('source');
    expect(sources[0].getAttribute('type')).toBe('image/avif');
    expect(sources[1].getAttribute('type')).toBe('image/webp');
    expect(sources[0].getAttribute('srcset')).toContain(`${stem}-640.avif 640w`);
    expect(sources[0].getAttribute('srcset')).toContain(`${stem}-1920.avif 1920w`);
  });

  it('keeps the img fully visible when the canvas is not ready (jsdom default)', () => {
    render(<EditorialImage stem={stem} alt="Concrete curve" aspect="4 / 3" />);
    expect(screen.getByAltText('Concrete curve').className).not.toContain('opacity-0');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/editorial/EditorialImage.test.tsx`
Expected: FAIL — "Cannot find module './EditorialImage'"

- [ ] **Step 3: Write the surface shader**

```ts
// src/components/editorial/surfaceShader.ts
// Image displacement surface: gentle UV warp driven by cursor proximity
// (desktop hover) and Lenis scroll velocity. Settles to a perfect, unwarped
// image when both inputs are at rest.

export const surfaceVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const surfaceFragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec2 uPointer;   // image-local UV of the cursor, (-1,-1) = inactive
  uniform float uHover;    // 0..1 hover energy
  uniform float uScroll;   // 0..1 normalized scroll velocity
  varying vec2 vUv;

  void main() {
    vec2 uv = vUv;

    // Cursor ripple — displacement falls off with distance from the pointer.
    if (uPointer.x >= 0.0) {
      vec2 toPointer = uv - uPointer;
      float dist = length(toPointer);
      float influence = smoothstep(0.45, 0.0, dist) * uHover;
      uv -= normalize(toPointer + 1e-5) * influence * 0.035;
    }

    // Scroll wave — subtle vertical shear proportional to velocity.
    uv.y += sin(uv.x * 6.2831) * uScroll * 0.012;

    gl_FragColor = texture2D(uMap, clamp(uv, 0.0, 1.0));
  }
`;
```

- [ ] **Step 4: Write the component**

```tsx
// src/components/editorial/EditorialImage.tsx
import { useRef, useEffect, Suspense, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { View, PerspectiveCamera, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import type Lenis from 'lenis';
import { useEditorialCanvas } from './EditorialCanvas';
import { useLenisContext } from '../../hooks/useLenis';
import { surfaceVertexShader, surfaceFragmentShader } from './surfaceShader';

// Vite glob-imports every graded asset so stems resolve to hashed URLs.
const ASSETS = import.meta.glob('../../assets/editorial/*', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

interface AssetEntry {
  width: number;
  url: string;
}

// Widths are discovered from the actual graded files, not a fixed list —
// undersized sources (the 1200px portrait) emit native-width sets that a
// hardcoded 640/1280/1920 builder would miss.
function assetsFor(stem: string, ext: string): AssetEntry[] {
  const re = new RegExp(`/${stem}-(\\d+)\\.${ext}$`);
  return Object.entries(ASSETS)
    .flatMap(([assetPath, url]) => {
      const m = assetPath.match(re);
      return m ? [{ width: Number(m[1]), url }] : [];
    })
    .sort((a, b) => a.width - b.width);
}

function srcSet(stem: string, ext: string): string {
  return assetsFor(stem, ext)
    .map((e) => `${e.url} ${e.width}w`)
    .join(', ');
}

/** Largest jpg at or below 1280 — the WebGL texture and the <img> src. */
function primaryJpg(stem: string): string | undefined {
  const jpgs = assetsFor(stem, 'jpg');
  if (jpgs.length === 0) return undefined;
  const upTo1280 = jpgs.filter((e) => e.width <= 1280);
  return (upTo1280.length > 0 ? upTo1280[upTo1280.length - 1] : jpgs[0]).url;
}

interface SurfaceDriver {
  pointer: { x: number; y: number }; // image-local UV; -1,-1 when inactive
  hover: number;
  scroll: number;
}

interface SurfaceSceneProps {
  textureUrl: string;
  driver: RefObject<SurfaceDriver>;
}

function SurfaceScene({ textureUrl, driver }: SurfaceSceneProps) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const { invalidate } = useThree();
  const texture = useTexture(textureUrl);

  useFrame(() => {
    const mat = materialRef.current;
    const d = driver.current;
    if (!mat || !d) return;
    mat.uniforms.uPointer.value.set(d.pointer.x, d.pointer.y);
    mat.uniforms.uHover.value = THREE.MathUtils.lerp(mat.uniforms.uHover.value, d.hover, 0.08);
    mat.uniforms.uScroll.value = THREE.MathUtils.lerp(mat.uniforms.uScroll.value, d.scroll, 0.08);
    // Keep invalidating only while there is energy in the system.
    if (mat.uniforms.uHover.value > 0.004 || mat.uniforms.uScroll.value > 0.004 || d.hover > 0) {
      invalidate();
    }
  });

  return (
    <mesh scale={[2, 2, 1]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={surfaceVertexShader}
        fragmentShader={surfaceFragmentShader}
        uniforms={{
          uMap: { value: texture },
          uPointer: { value: new THREE.Vector2(-1, -1) },
          uHover: { value: 0 },
          uScroll: { value: 0 },
        }}
      />
    </mesh>
  );
}

interface EditorialImageProps {
  /** Graded asset stem in src/assets/editorial, e.g. "venture-altivum". */
  stem: string;
  alt: string;
  /** CSS aspect-ratio value, reserved up front (CLS rule). */
  aspect: string;
  className?: string;
  sizes?: string;
  /** Set for above-the-fold placements; defaults to lazy. */
  priority?: boolean;
}

/**
 * Graded editorial image. Always a real <picture>/<img> for SEO/layout/
 * fallback; when the shared canvas is ready, a displacement-shader surface
 * (cursor ripple + scroll wave) renders over the same rect and the img fades.
 */
const EditorialImage = ({
  stem,
  alt,
  aspect,
  className = '',
  sizes = '(max-width: 768px) 100vw, 50vw',
  priority = false,
}: EditorialImageProps) => {
  const slotRef = useRef<HTMLDivElement>(null);
  const driver = useRef<SurfaceDriver>({ pointer: { x: -1, y: -1 }, hover: 0, scroll: 0 });
  const { ready } = useEditorialCanvas();
  const { lenis } = useLenisContext();
  const textureUrl = primaryJpg(stem);

  // Cursor tracking on the slot (fine pointers only — touch gets no ripple).
  useEffect(() => {
    if (!ready) return;
    const el = slotRef.current;
    if (!el || !window.matchMedia('(pointer: fine)').matches) return;

    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      driver.current.pointer.x = (e.clientX - rect.left) / rect.width;
      driver.current.pointer.y = 1 - (e.clientY - rect.top) / rect.height;
      driver.current.hover = 1;
    };
    const onLeave = () => {
      driver.current.hover = 0;
      driver.current.pointer.x = -1;
      driver.current.pointer.y = -1;
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
    };
  }, [ready]);

  // Scroll-velocity energy from Lenis (same normalization as HeroCanvas).
  useEffect(() => {
    if (!ready || !lenis) return;
    const onScroll = (instance: Lenis) => {
      const v = Math.min(Math.abs(instance.velocity) / 30, 1);
      driver.current.scroll = Math.max(driver.current.scroll, v);
    };
    lenis.on('scroll', onScroll);
    let raf = 0;
    const decay = () => {
      driver.current.scroll *= 0.92;
      if (driver.current.scroll < 0.001) driver.current.scroll = 0;
      raf = requestAnimationFrame(decay);
    };
    raf = requestAnimationFrame(decay);
    return () => {
      lenis.off('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [ready, lenis]);

  const surfaceLive = ready && Boolean(textureUrl);

  return (
    <div
      ref={slotRef}
      data-editorial-image
      className={`relative overflow-hidden bg-altivum-umber ${className}`}
      style={{ aspectRatio: aspect }}
    >
      <picture>
        <source type="image/avif" srcSet={srcSet(stem, 'avif')} sizes={sizes} />
        <source type="image/webp" srcSet={srcSet(stem, 'webp')} sizes={sizes} />
        <img
          src={primaryJpg(stem)}
          srcSet={srcSet(stem, 'jpg')}
          sizes={sizes}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          className={`h-full w-full object-cover transition-opacity duration-700 ${
            surfaceLive ? 'opacity-0' : 'opacity-100'
          }`}
        />
      </picture>
      {surfaceLive && textureUrl && (
        /* View-as-element per the EditorialCanvas consumer contract; its own
           Suspense so a loading texture never blanks the other views. */
        <View className="pointer-events-none absolute inset-0">
          <Suspense fallback={null}>
            <PerspectiveCamera makeDefault position={[0, 0, 1]} fov={90} />
            <SurfaceScene textureUrl={textureUrl} driver={driver} />
          </Suspense>
        </View>
      )}
    </div>
  );
};

export default EditorialImage;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/editorial/EditorialImage.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add src/components/editorial/surfaceShader.ts src/components/editorial/EditorialImage.tsx src/components/editorial/EditorialImage.test.tsx
git commit -m "feat(redesign): EditorialImage with WebGL displacement surface + picture fallback"
```

---

### Task 12: `useCascadeReveal` + Command Grid hero (TDD)

**Files:**
- Create: `src/components/editorial/useCascadeReveal.ts`
- Create: `src/components/editorial/CommandGridHero.tsx`
- Test: `src/components/editorial/CommandGridHero.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/editorial/CommandGridHero.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CommandGridHero from './CommandGridHero';

vi.mock('gsap', () => ({
  default: {
    registerPlugin: vi.fn(),
    fromTo: vi.fn(() => ({ kill: vi.fn() })),
  },
  gsap: {
    registerPlugin: vi.fn(),
    fromTo: vi.fn(() => ({ kill: vi.fn() })),
  },
}));
vi.mock('gsap/ScrollTrigger', () => ({ ScrollTrigger: {} }));
vi.mock('@react-three/fiber', () => ({
  useFrame: vi.fn(),
  useThree: () => ({ invalidate: vi.fn() }),
}));
vi.mock('@react-three/drei', () => ({
  View: Object.assign(() => null, { Port: () => null }),
  PerspectiveCamera: () => null,
  useTexture: () => ({}),
}));

const renderHero = () =>
  render(
    <MemoryRouter>
      <CommandGridHero />
    </MemoryRouter>
  );

describe('CommandGridHero', () => {
  it('renders one h1 with the full accessible name', () => {
    renderHero();
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent(/Christian\s+Perez/);
  });

  it('renders the eyebrow with founder title', () => {
    renderHero();
    expect(screen.getByText('(FOUNDER & CEO — ALTIVUM INC.)')).toBeInTheDocument();
  });

  it('renders the 18D stat tile', () => {
    renderHero();
    expect(screen.getByText('18')).toBeInTheDocument();
    expect(screen.getByText(/SF Medical Sergeant/i)).toBeInTheDocument();
  });

  it('links the wayfinding tiles to their routes', () => {
    renderHero();
    expect(screen.getByRole('link', { name: /The Vector Podcast/i })).toHaveAttribute(
      'href',
      '/podcast'
    );
    expect(screen.getByRole('link', { name: /Beyond the Assessment/i })).toHaveAttribute(
      'href',
      '/beyond-the-assessment'
    );
    expect(screen.getByRole('link', { name: /Altivum Inc/i })).toHaveAttribute('href', '/altivum');
    expect(screen.getByRole('link', { name: /Start a conversation/i })).toHaveAttribute(
      'href',
      '/contact'
    );
  });

  it('renders the static ridge fallback in jsdom (no WebGL)', () => {
    const { container } = renderHero();
    expect(container.querySelector('svg path')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/editorial/CommandGridHero.test.tsx`
Expected: FAIL — "Cannot find module './CommandGridHero'"

- [ ] **Step 3: Write the cascade hook**

```ts
// src/components/editorial/useCascadeReveal.ts
import { useLayoutEffect, type RefObject } from 'react';
import gsap from 'gsap';
import { isPrerender } from '../../utils/prerender';

/**
 * Once-on-mount staggered tile cascade: every child carrying [data-cascade]
 * rises 12px and fades in, 60ms apart. gsap.fromTo sets the initial hidden
 * state inside useLayoutEffect (before paint), so content is never hidden for
 * reduced-motion / prerender / no-JS readers.
 */
export function useCascadeReveal(containerRef: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    if (isPrerender()) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const container = containerRef.current;
    if (!container) return;
    const tiles = container.querySelectorAll('[data-cascade]');
    if (!tiles.length) return;

    const tween = gsap.fromTo(
      tiles,
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, duration: 0.7, stagger: 0.06, ease: 'power3.out' }
    );
    return () => {
      tween.kill();
    };
  }, [containerRef]);
}
```

- [ ] **Step 4: Write the hero**

```tsx
// src/components/editorial/CommandGridHero.tsx
import { useRef } from 'react';
import ViewTransitionLink from '../ViewTransitionLink';
import Eyebrow from './Eyebrow';
import EditorialPill from './EditorialPill';
import RidgeFallback from './RidgeFallback';
import RidgeView from './RidgeView';
import AtmosphereView from './AtmosphereView';
import { useEditorialCanvas } from './EditorialCanvas';
import { useCascadeReveal } from './useCascadeReveal';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { editorialType, EDITORIAL_FONT_FAMILY } from '../../utils/editorialType';

const TILE_BASE =
  'relative overflow-hidden rounded-md border border-altivum-porcelain/[0.07] bg-[#0D1322] ' +
  'transition-all duration-300 hover:border-altivum-gold/40 hover:-translate-y-0.5';

const WAYFINDING = [
  { eyebrow: 'PODCAST', title: 'The Vector', italic: 'Podcast', to: '/podcast', label: 'The Vector Podcast' },
  { eyebrow: 'BOOK', title: 'Beyond the', italic: 'Assessment', to: '/beyond-the-assessment', label: 'Beyond the Assessment' },
  { eyebrow: 'VENTURE', title: 'Altivum', italic: 'Inc.', to: '/altivum', label: 'Altivum Inc.' },
];

/**
 * The Command Grid bento hero: one dominant live-ridge scene tile with the
 * name set inside it, a disciplined satellite rail (intro / stat / contact),
 * and a wayfinding strip. 100svh on desktop; collapses to a stacked 2-col
 * grid on mobile with the scene tile first.
 */
const CommandGridHero = () => {
  const gridRef = useRef<HTMLDivElement>(null);
  const { ready } = useEditorialCanvas();
  const coarse = useMediaQuery('(pointer: coarse)');
  useCascadeReveal(gridRef);

  return (
    <section className="min-h-[100svh] px-3 pt-24 pb-3 md:px-4 md:pb-4" aria-label="Introduction">
      <div
        ref={gridRef}
        className="grid h-full min-h-[calc(100svh-7rem)] grid-cols-2 gap-2 md:grid-cols-12 md:grid-rows-8 md:gap-2.5"
      >
        {/* Scene tile — the eye-catcher */}
        <div
          data-cascade
          className={`${TILE_BASE} col-span-2 min-h-[22rem] md:col-span-8 md:col-start-1 md:row-span-6 md:row-start-1`}
        >
          <RidgeFallback hidden={ready} />
          {ready && <RidgeView />}
          {ready && <AtmosphereView mobile={coarse} />}
          <div className="absolute left-5 top-5 md:left-6 md:top-6">
            <Eyebrow>FOUNDER &amp; CEO — ALTIVUM INC.</Eyebrow>
          </div>
          <div className="absolute bottom-5 left-5 z-30 md:bottom-6 md:left-6">
            <h1 className="text-altivum-porcelain" style={editorialType.displayHero}>
              Christian{' '}
              <span className="italic text-altivum-gold" style={{ fontFamily: EDITORIAL_FONT_FAMILY }}>
                Perez
              </span>
            </h1>
            <p className="mt-3 text-[0.625rem] uppercase tracking-[0.18em] text-altivum-silver">
              Green Beret · Founder · Author · Host
            </p>
          </div>
        </div>

        {/* Intro tile */}
        <div data-cascade className={`${TILE_BASE} col-span-2 p-5 md:col-span-4 md:row-span-2`}>
          <p className="relative z-30 text-sm leading-relaxed text-altivum-silver">
            Special Forces medic turned founder. Building AI-native systems at Altivum,
            asking better questions on The Vector Podcast.
          </p>
        </div>

        {/* Stat tile — sr-only real-text label (aria-label is prohibited on
            generic roles; see CountUp's Task 6 review) */}
        <div data-cascade className={`${TILE_BASE} col-span-1 bg-altivum-umber p-5 md:col-span-4 md:row-span-2`}>
          <span className="sr-only">18D — Special Forces Medical Sergeant</span>
          <span aria-hidden="true">
            <span className="text-altivum-porcelain" style={editorialType.statNumeral}>
              18
            </span>
            <span className="text-altivum-gold" style={editorialType.statSuffix}>
              D
            </span>
          </span>
          <p aria-hidden="true" className="mt-2 text-[0.625rem] uppercase tracking-[0.12em] text-altivum-silver">
            SF Medical Sergeant
          </p>
        </div>

        {/* Contact tile */}
        <div
          data-cascade
          className={`${TILE_BASE} col-span-1 flex flex-col items-start justify-between gap-3 p-5 md:col-span-4 md:row-span-2 md:flex-row md:items-center`}
        >
          <span className="relative z-30 text-[0.625rem] uppercase tracking-[0.15em] text-altivum-porcelain">
            Start a<br />conversation
          </span>
          <EditorialPill to="/contact" className="!px-5 !py-2.5 !min-h-0 text-[0.625rem]">
            <span className="sr-only">Start a conversation — </span>Contact
          </EditorialPill>
        </div>

        {/* Wayfinding strip */}
        {WAYFINDING.map((item) => (
          <ViewTransitionLink
            key={item.to}
            to={item.to}
            data-cascade
            aria-label={item.label}
            className={`${TILE_BASE} group col-span-1 block p-5 md:col-span-3 md:row-span-2`}
          >
            <Eyebrow className="text-altivum-porcelain/40">{item.eyebrow}</Eyebrow>
            <p className="relative z-30 mt-2 text-altivum-porcelain" style={{ fontFamily: EDITORIAL_FONT_FAMILY, fontSize: '1rem' }}>
              {item.title}{' '}
              <span className="italic text-altivum-gold group-hover:underline">{item.italic}</span>
            </p>
          </ViewTransitionLink>
        ))}

        {/* Scroll cue tile */}
        <div
          data-cascade
          className={`${TILE_BASE} col-span-1 flex items-center justify-center p-5 md:col-span-3 md:row-span-2`}
          aria-hidden="true"
        >
          <span className="text-[0.625rem] uppercase tracking-[0.25em] text-altivum-porcelain/50">
            Scroll ↓
          </span>
        </div>
      </div>
    </section>
  );
};

export default CommandGridHero;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/editorial/CommandGridHero.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add src/components/editorial/useCascadeReveal.ts src/components/editorial/CommandGridHero.tsx src/components/editorial/CommandGridHero.test.tsx
git commit -m "feat(redesign): Command Grid bento hero with live ridge scene tile"
```

---

### Task 13: (ABOUT) section (TDD)

**Files:**
- Create: `src/components/editorial/AboutSection.tsx`
- Test: `src/components/editorial/AboutSection.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/editorial/AboutSection.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AboutSection from './AboutSection';

vi.mock('gsap', () => ({
  default: {
    registerPlugin: vi.fn(),
    fromTo: vi.fn(() => ({ scrollTrigger: { kill: vi.fn() }, kill: vi.fn() })),
    timeline: vi.fn(() => ({
      fromTo: vi.fn(),
      scrollTrigger: { kill: vi.fn() },
      kill: vi.fn(),
    })),
  },
  gsap: {
    registerPlugin: vi.fn(),
    fromTo: vi.fn(() => ({ scrollTrigger: { kill: vi.fn() }, kill: vi.fn() })),
    timeline: vi.fn(() => ({
      fromTo: vi.fn(),
      scrollTrigger: { kill: vi.fn() },
      kill: vi.fn(),
    })),
  },
}));
vi.mock('gsap/ScrollTrigger', () => ({ ScrollTrigger: {} }));
vi.mock('@react-three/fiber', () => ({
  useFrame: vi.fn(),
  useThree: () => ({ invalidate: vi.fn() }),
}));
vi.mock('@react-three/drei', () => ({
  View: Object.assign(() => null, { Port: () => null }),
  PerspectiveCamera: () => null,
  useTexture: () => ({}),
}));

describe('AboutSection', () => {
  const renderSection = () =>
    render(
      <MemoryRouter>
        <AboutSection />
      </MemoryRouter>
    );

  it('renders the (ABOUT) eyebrow', () => {
    renderSection();
    expect(screen.getByText('(ABOUT)')).toBeInTheDocument();
  });

  it('renders the display headline words', () => {
    renderSection();
    expect(screen.getByText(/QUIET/)).toBeInTheDocument();
    expect(screen.getByText(/RELENTLESS/)).toBeInTheDocument();
  });

  it('links to the full story', () => {
    renderSection();
    expect(screen.getByRole('link', { name: /THE FULL STORY/i })).toHaveAttribute(
      'href',
      '/about'
    );
  });

  it('renders the graded portrait', () => {
    renderSection();
    expect(screen.getByAltText(/Christian Perez/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/editorial/AboutSection.test.tsx`
Expected: FAIL — "Cannot find module './AboutSection'"

- [ ] **Step 3: Write the component**

```tsx
// src/components/editorial/AboutSection.tsx
import SplitReveal from '../SplitReveal';
import FadeReveal from '../FadeReveal';
import Eyebrow from './Eyebrow';
import EditorialPill from './EditorialPill';
import EditorialImage from './EditorialImage';
import { editorialType, EDITORIAL_FONT_FAMILY } from '../../utils/editorialType';

/**
 * (ABOUT) — three-column editorial split: stacked display headline, graded
 * portrait as a WebGL surface, quiet copy + pill. Stacks on mobile.
 */
const AboutSection = () => (
  <section className="mx-auto max-w-7xl px-6 py-24 md:py-36 lg:px-12" aria-label="About">
    <Eyebrow>ABOUT</Eyebrow>
    <div className="mt-12 grid grid-cols-1 items-start gap-10 md:grid-cols-[1.2fr_1fr_0.9fr] md:gap-12">
      {/* SplitReveal's `as` union is 'h3' | 'p' | 'span' — so the h2 is the
          wrapper and each line is a SplitReveal span (one accessible heading). */}
      <h2 className="relative z-30" style={editorialType.displaySection}>
        <SplitReveal as="span" className="block text-altivum-porcelain">
          QUIET DISCIPLINE.
        </SplitReveal>
        <SplitReveal
          as="span"
          className="block italic text-altivum-gold"
          style={{ fontFamily: EDITORIAL_FONT_FAMILY, fontStyle: 'italic' }}
        >
          RELENTLESS
        </SplitReveal>
        <SplitReveal as="span" className="block text-altivum-porcelain">
          EXECUTION.
        </SplitReveal>
      </h2>

      <EditorialImage
        stem="portrait"
        alt="Christian Perez"
        aspect="3 / 4"
        className="rounded-sm"
        sizes="(max-width: 768px) 100vw, 33vw"
      />

      <FadeReveal direction="right" className="relative z-30 md:pt-8">
        <p className="text-sm leading-relaxed text-altivum-silver">
          Eighteen years from Special Forces medic to founder &amp; CEO. Every venture —
          Altivum, The Vector Podcast, Beyond the Assessment — runs on the same operating
          system: assess honestly, decide fast, execute completely.
        </p>
        <div className="mt-8">
          <EditorialPill to="/about">The Full Story</EditorialPill>
        </div>
      </FadeReveal>
    </div>
  </section>
);

export default AboutSection;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/editorial/AboutSection.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/editorial/AboutSection.tsx src/components/editorial/AboutSection.test.tsx
git commit -m "feat(redesign): (ABOUT) editorial split section"
```

---

### Task 14: (THE RECORD) stats section (TDD)

**Files:**
- Create: `src/components/editorial/RecordSection.tsx`
- Test: `src/components/editorial/RecordSection.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/editorial/RecordSection.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import RecordSection from './RecordSection';

vi.mock('gsap', () => ({
  default: {
    registerPlugin: vi.fn(),
    fromTo: vi.fn(() => ({ scrollTrigger: { kill: vi.fn() }, kill: vi.fn() })),
  },
  gsap: {
    registerPlugin: vi.fn(),
    fromTo: vi.fn(() => ({ scrollTrigger: { kill: vi.fn() }, kill: vi.fn() })),
  },
}));
vi.mock('gsap/ScrollTrigger', () => ({ ScrollTrigger: {} }));

describe('RecordSection', () => {
  it('renders the (THE RECORD) eyebrow', () => {
    render(<RecordSection />);
    expect(screen.getByText('(THE RECORD)')).toBeInTheDocument();
  });

  it('renders all four stats with accessible labels', () => {
    render(<RecordSection />);
    expect(screen.getByLabelText('18D — Special Forces Medical Sergeant')).toBeInTheDocument();
    expect(
      screen.getByLabelText('60+ — podcast episodes & conversations')
    ).toBeInTheDocument();
    expect(screen.getByLabelText('1 — book — Beyond the Assessment')).toBeInTheDocument();
    expect(screen.getByLabelText('3x — ventures built and operating')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/editorial/RecordSection.test.tsx`
Expected: FAIL — "Cannot find module './RecordSection'"

- [ ] **Step 3: Write the component**

```tsx
// src/components/editorial/RecordSection.tsx
import Eyebrow from './Eyebrow';
import CountUp from './CountUp';

/**
 * (THE RECORD) — four serif stats scattered asymmetrically on desktop
 * (the reference's signature layout), stacked 2-col on mobile. Values are
 * editable content; the layout supports 3-5 stats.
 */
const STATS = [
  { value: 18, suffix: 'D', caption: 'Special Forces Medical Sergeant', desktop: 'md:absolute md:left-[8%] md:top-[10%]' },
  { value: 60, suffix: '+', caption: 'podcast episodes & conversations', desktop: 'md:absolute md:right-[12%] md:top-0' },
  { value: 1, suffix: '', caption: 'book — Beyond the Assessment', desktop: 'md:absolute md:bottom-[18%] md:left-[34%]' },
  { value: 3, suffix: 'x', caption: 'ventures built and operating', desktop: 'md:absolute md:bottom-0 md:right-[8%]' },
];

const RecordSection = () => (
  <section className="mx-auto max-w-7xl px-6 py-24 md:py-36 lg:px-12" aria-label="The record">
    <Eyebrow>THE RECORD</Eyebrow>
    <div className="relative mt-12 grid grid-cols-2 gap-10 md:block md:h-[26rem]">
      {STATS.map((stat) => (
        <CountUp
          key={stat.caption}
          value={stat.value}
          suffix={stat.suffix}
          caption={stat.caption}
          className={stat.desktop}
        />
      ))}
    </div>
  </section>
);

export default RecordSection;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/editorial/RecordSection.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/editorial/RecordSection.tsx src/components/editorial/RecordSection.test.tsx
git commit -m "feat(redesign): (THE RECORD) asymmetric stat section"
```

---

### Task 15: (VENTURES) pinned horizontal carousel (TDD)

**Files:**
- Create: `src/components/editorial/VenturesSection.tsx`
- Test: `src/components/editorial/VenturesSection.test.tsx`

Behavior matrix: desktop fine-pointer + motion-OK + not-prerender → section pins, vertical scroll scrubs horizontal travel. Touch / reduced-motion / prerender → plain `overflow-x-auto` snap scroller (same DOM).

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/editorial/VenturesSection.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import VenturesSection from './VenturesSection';

const scrollTriggerStub = { kill: vi.fn(), progress: 0 };
vi.mock('gsap', () => ({
  default: {
    registerPlugin: vi.fn(),
    to: vi.fn(() => ({ scrollTrigger: scrollTriggerStub, kill: vi.fn() })),
    fromTo: vi.fn(() => ({ scrollTrigger: scrollTriggerStub, kill: vi.fn() })),
  },
  gsap: {
    registerPlugin: vi.fn(),
    to: vi.fn(() => ({ scrollTrigger: scrollTriggerStub, kill: vi.fn() })),
    fromTo: vi.fn(() => ({ scrollTrigger: scrollTriggerStub, kill: vi.fn() })),
  },
}));
vi.mock('gsap/ScrollTrigger', () => ({ ScrollTrigger: { refresh: vi.fn() } }));
vi.mock('@react-three/fiber', () => ({
  useFrame: vi.fn(),
  useThree: () => ({ invalidate: vi.fn() }),
}));
vi.mock('@react-three/drei', () => ({
  View: Object.assign(() => null, { Port: () => null }),
  PerspectiveCamera: () => null,
  useTexture: () => ({}),
}));

describe('VenturesSection', () => {
  const renderSection = () =>
    render(
      <MemoryRouter>
        <VenturesSection />
      </MemoryRouter>
    );

  it('renders the (VENTURES) eyebrow and numbered indicator', () => {
    renderSection();
    expect(screen.getByText('(VENTURES)')).toBeInTheDocument();
    expect(screen.getByText('(1)')).toBeInTheDocument();
    expect(screen.getByText('(4)')).toBeInTheDocument();
  });

  it('renders all four venture panels with links', () => {
    renderSection();
    expect(screen.getByRole('link', { name: /Altivum/i })).toHaveAttribute('href', '/altivum');
    expect(screen.getByRole('link', { name: /Vector/i })).toHaveAttribute('href', '/podcast');
    expect(screen.getByRole('link', { name: /Assessment/i })).toHaveAttribute(
      'href',
      '/beyond-the-assessment'
    );
    expect(screen.getByRole('link', { name: /Cloud & AI/i })).toHaveAttribute('href', '/aws');
  });

  it('uses a horizontally scrollable list (keyboard/touch fallback path)', () => {
    const { container } = renderSection();
    const track = container.querySelector('[data-ventures-track]');
    expect(track).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/editorial/VenturesSection.test.tsx`
Expected: FAIL — "Cannot find module './VenturesSection'"

- [ ] **Step 3: Write the component**

```tsx
// src/components/editorial/VenturesSection.tsx
import { useRef, useEffect, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import ViewTransitionLink from '../ViewTransitionLink';
import Eyebrow from './Eyebrow';
import EditorialImage from './EditorialImage';
import { useEditorialCanvas } from './EditorialCanvas';
import { editorialType, EDITORIAL_FONT_FAMILY } from '../../utils/editorialType';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { isPrerender } from '../../utils/prerender';

gsap.registerPlugin(ScrollTrigger);

const VENTURES = [
  {
    title: 'Altivum',
    italic: 'Inc.',
    desc: 'AI-native consultancy. Bedrock, agents, production systems.',
    to: '/altivum',
    stem: 'venture-altivum',
  },
  {
    title: 'The Vector',
    italic: 'Podcast',
    desc: 'Conversations on service, technology, and what comes next.',
    to: '/podcast',
    stem: 'venture-podcast',
  },
  {
    title: 'Beyond the',
    italic: 'Assessment',
    desc: 'The book — what selection actually selects for.',
    to: '/beyond-the-assessment',
    stem: 'venture-book',
  },
  {
    title: 'Cloud & AI',
    italic: 'Engineering',
    desc: 'AWS Community Builder. Applied AI engineering with Claude.',
    to: '/aws',
    stem: 'venture-aws',
  },
];

/**
 * (VENTURES) — pinned section where vertical scroll drives horizontal travel
 * through four full-bleed panels (desktop fine-pointer only). Touch, reduced
 * motion, and prerender all get a native horizontal snap scroller instead.
 */
const VenturesSection = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const { invalidate } = useEditorialCanvas();
  const finePointer = useMediaQuery('(pointer: fine)');
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const pinned = finePointer && !reducedMotion && !isPrerender();

  useEffect(() => {
    if (!pinned) return;
    const section = sectionRef.current;
    const track = trackRef.current;
    if (!section || !track) return;

    const distance = () => track.scrollWidth - window.innerWidth;
    const tween = gsap.to(track, {
      x: () => -distance(),
      ease: 'none',
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: () => `+=${distance()}`,
        scrub: 1,
        pin: true,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          setActive(Math.min(3, Math.round(self.progress * 3)));
          // Consumer contract rule 4: scrub tails outlive scroll events, so the
          // scrubbed track must drive canvas frames itself or the panel Views
          // freeze while the DOM keeps sliding.
          invalidate();
        },
      },
    });

    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [pinned, invalidate]);

  return (
    <section ref={sectionRef} className="overflow-hidden py-24 md:py-0" aria-label="Ventures">
      <div className="flex items-center justify-between px-6 pb-10 md:pt-28 lg:px-12">
        <Eyebrow>VENTURES</Eyebrow>
        <div className="relative z-30 flex gap-3 text-[0.625rem] tracking-[0.2em] text-altivum-silver" aria-hidden="true">
          {VENTURES.map((v, i) => (
            <span key={v.to} className={i === active ? 'text-altivum-gold' : ''}>
              ({i + 1})
            </span>
          ))}
        </div>
      </div>

      <div
        ref={trackRef}
        data-ventures-track
        className={
          pinned
            ? 'flex gap-4 px-6 will-change-transform lg:px-12'
            : 'flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-6 lg:px-12'
        }
      >
        {VENTURES.map((venture) => (
          <ViewTransitionLink
            key={venture.to}
            to={venture.to}
            className="group relative min-w-[82vw] snap-start overflow-hidden rounded-md md:min-w-[60vw]"
          >
            <EditorialImage
              stem={venture.stem}
              alt=""
              aspect="16 / 9"
              sizes="82vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-altivum-dark/85 via-altivum-dark/20 to-transparent" />
            <div className="absolute bottom-8 left-8 z-30">
              <h3 className="text-altivum-porcelain" style={editorialType.displaySection}>
                {venture.title}{' '}
                <span className="italic text-altivum-gold" style={{ fontFamily: EDITORIAL_FONT_FAMILY }}>
                  {venture.italic}
                </span>
              </h3>
              <p className="mt-3 max-w-xs text-xs uppercase tracking-[0.12em] text-altivum-silver">
                {venture.desc}
              </p>
            </div>
            <span className="absolute right-8 top-8 z-30 text-altivum-gold opacity-0 transition-all duration-300 group-hover:translate-x-1 group-hover:opacity-100" aria-hidden="true">
              →
            </span>
          </ViewTransitionLink>
        ))}
      </div>
    </section>
  );
};

export default VenturesSection;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/editorial/VenturesSection.test.tsx`
Expected: PASS (3 tests). (jsdom's matchMedia mock returns `matches: false`, so the un-pinned fallback path renders — which is the path under test.)

- [ ] **Step 5: Commit**

```bash
git add src/components/editorial/VenturesSection.tsx src/components/editorial/VenturesSection.test.tsx
git commit -m "feat(redesign): (VENTURES) pinned horizontal carousel with touch fallback"
```

---

### Task 16: Image break + porcelain CTA (TDD)

**Files:**
- Create: `src/components/editorial/ImageBreak.tsx`
- Create: `src/components/editorial/CtaSection.tsx`
- Test: `src/components/editorial/CtaSection.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/editorial/CtaSection.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CtaSection from './CtaSection';

vi.mock('gsap', () => ({
  default: {
    registerPlugin: vi.fn(),
    fromTo: vi.fn(() => ({ scrollTrigger: { kill: vi.fn() }, kill: vi.fn() })),
  },
  gsap: {
    registerPlugin: vi.fn(),
    fromTo: vi.fn(() => ({ scrollTrigger: { kill: vi.fn() }, kill: vi.fn() })),
  },
}));
vi.mock('gsap/ScrollTrigger', () => ({ ScrollTrigger: {} }));

const scrollToMock = vi.fn();
vi.mock('../../hooks/useLenis', () => ({
  useLenisContext: () => ({ lenis: null, scrollTo: scrollToMock }),
}));

describe('CtaSection', () => {
  const renderSection = () =>
    render(
      <MemoryRouter>
        <CtaSection />
      </MemoryRouter>
    );

  it('renders the porcelain section with the display headline', () => {
    renderSection();
    expect(screen.getByText(/BUILD SOMETHING/)).toBeInTheDocument();
    expect(screen.getByText(/WORTH KEEPING\./)).toBeInTheDocument();
  });

  it('links the primary pill to /contact', () => {
    renderSection();
    expect(screen.getByRole('link', { name: /Start a conversation/i })).toHaveAttribute(
      'href',
      '/contact'
    );
  });

  it('scrolls to the footer newsletter on secondary pill click', () => {
    renderSection();
    screen.getByRole('button', { name: /Newsletter/i }).click();
    expect(scrollToMock).toHaveBeenCalledWith('#newsletter', expect.anything());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/editorial/CtaSection.test.tsx`
Expected: FAIL — "Cannot find module './CtaSection'"

- [ ] **Step 3: Write ImageBreak**

```tsx
// src/components/editorial/ImageBreak.tsx
import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import EditorialImage from './EditorialImage';
import { editorialType } from '../../utils/editorialType';
import { isPrerender } from '../../utils/prerender';

gsap.registerPlugin(ScrollTrigger);

/**
 * Full-bleed graded architectural image at 0.85x parallax with one italic
 * porcelain pull-quote crossing it — the breath between ventures and the ask.
 */
const ImageBreak = () => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isPrerender()) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const wrap = wrapRef.current;
    const image = imageRef.current;
    if (!wrap || !image) return;

    // 0.85x: the image lags the scroll by 15% of the section height.
    const tween = gsap.fromTo(
      image,
      { y: '-7.5%' },
      {
        y: '7.5%',
        ease: 'none',
        scrollTrigger: { trigger: wrap, start: 'top bottom', end: 'bottom top', scrub: true },
      }
    );
    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, []);

  return (
    <div ref={wrapRef} className="relative overflow-hidden" aria-label="Interlude">
      <div ref={imageRef} className="scale-110">
        <EditorialImage
          stem="break-interior"
          alt=""
          aspect="21 / 9"
          sizes="100vw"
          className="w-full"
        />
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-altivum-dark/35">
        <p className="relative z-30 max-w-3xl px-6 text-center text-altivum-porcelain" style={editorialType.pullQuote}>
          The standard is the standard — in the field, in the company, on the page.
        </p>
      </div>
    </div>
  );
};

export default ImageBreak;
```

- [ ] **Step 4: Write CtaSection**

```tsx
// src/components/editorial/CtaSection.tsx
import Eyebrow from './Eyebrow';
import EditorialPill from './EditorialPill';
import { editorialType, EDITORIAL_FONT_FAMILY } from '../../utils/editorialType';
import { useLenisContext } from '../../hooks/useLenis';

/**
 * (NEXT) — the single porcelain section on the page; the palette inversion is
 * the punctuation mark for the whole scroll (the 20% of 60/20/10/10).
 */
const CtaSection = () => {
  const { scrollTo } = useLenisContext();

  return (
    <section className="bg-altivum-porcelain px-6 py-24 text-center md:py-36" aria-label="Get in touch">
      <Eyebrow className="text-altivum-dark/50">NEXT</Eyebrow>
      <h2 className="mt-8 text-altivum-dark" style={editorialType.displaySection}>
        BUILD SOMETHING
        <br />
        <span className="italic text-altivum-gold" style={{ fontFamily: EDITORIAL_FONT_FAMILY }}>
          WORTH KEEPING.
        </span>
      </h2>
      <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
        <EditorialPill to="/contact" variant="dark-solid">
          Start a conversation
        </EditorialPill>
        <EditorialPill
          onClick={() => scrollTo('#newsletter', { offset: -120 })}
          variant="dark-outline"
        >
          Newsletter
        </EditorialPill>
      </div>
    </section>
  );
};

export default CtaSection;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/editorial/CtaSection.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add src/components/editorial/ImageBreak.tsx src/components/editorial/CtaSection.tsx src/components/editorial/CtaSection.test.tsx
git commit -m "feat(redesign): parallax image break + porcelain CTA section"
```

---

### Task 17: Rebuild Home + remove the old hero

> **DECISION (from Task 12 review, I2):** `/` is prerendered and Amplify serves the snapshot to everyone — without mitigation, cold loads show the static hero, then React mount hides it and replays the 0.9s cascade (visible die-and-reanimate). Implement in this task: in `src/main.tsx`, before `createRoot(...)`, capture `const hadPrerenderPaint = Boolean(document.getElementById('root')?.hasChildNodes());` and stash it on `window.__HAD_PRERENDER_PAINT__`; `useCascadeReveal` skips when that flag is true. Net behavior: cold loads keep the already-painted hero perfectly still (monumental stillness, clean LCP); client-side navigations back to Home still play the cascade.

**Files:**
- Modify: `src/pages/Home.tsx` (full rewrite)
- Delete: `src/components/home/HeroCanvas.tsx`, `src/components/home/heroShader.ts`, `src/components/home/HeroCanvas.test.tsx`
- Delete: `src/assets/hero2.png` (only if unreferenced — verified below)

- [ ] **Step 1: Find every reference to the components being removed**

Run: `grep -rn "HeroCanvas\|heroShader\|hero2" src cypress --include="*.ts*" --include="*.cy.ts"`
Expected: matches only in `src/pages/Home.tsx` and `src/components/home/*`. If anything else matches (e.g. a Cypress spec), note it for Task 20.

- [ ] **Step 2: Rewrite Home**

Replace the entire contents of `src/pages/Home.tsx`:

```tsx
// src/pages/Home.tsx
import { Helmet } from 'react-helmet-async';
import { SEO } from '../components/SEO';
import { homeFAQs, buildWebPageSchema } from '../utils/schemas';
// Preload the two critical display faces (spec §3/§10) — `?url` resolves the
// hashed asset paths Vite gives the fontsource woff2 files.
import playfair400 from '@fontsource/playfair-display/files/playfair-display-latin-400-normal.woff2?url';
import playfair500 from '@fontsource/playfair-display/files/playfair-display-latin-500-normal.woff2?url';
import { EditorialCanvasProvider } from '../components/editorial/EditorialCanvas';
import CommandGridHero from '../components/editorial/CommandGridHero';
import AboutSection from '../components/editorial/AboutSection';
import RecordSection from '../components/editorial/RecordSection';
import VenturesSection from '../components/editorial/VenturesSection';
import ImageBreak from '../components/editorial/ImageBreak';
import CtaSection from '../components/editorial/CtaSection';

/**
 * Editorial Home — six sections per the 2026-06-11 redesign spec:
 * Command Grid bento hero -> (ABOUT) -> (THE RECORD) -> (VENTURES) ->
 * image break -> porcelain CTA. All WebGL lives on the shared editorial
 * canvas; static fallbacks are the first paint and the reduced-motion path.
 *
 * Layering contract: do NOT add transform/opacity/z-index to these section
 * wrappers — content that must read above the canvas uses `relative z-30`
 * inside the editorial components.
 */
const Home = () => (
  <div className="min-h-screen bg-altivum-dark">
    <Helmet>
      <link rel="preload" as="font" type="font/woff2" href={playfair400} crossOrigin="anonymous" />
      <link rel="preload" as="font" type="font/woff2" href={playfair500} crossOrigin="anonymous" />
    </Helmet>
    <SEO
      title="Christian Perez"
      description="Personal website of Christian Perez, Founder & CEO of Altivum Inc., Former Green Beret, Bronze Star Recipient, and Host of The Vector Podcast."
      keywords="Christian Perez, thechrisgrey, Altivum Inc, Green Beret, The Vector Podcast, veteran entrepreneur, AI technology, cloud architecture"
      url="https://thechrisgrey.com"
      faq={homeFAQs}
      structuredData={[
        buildWebPageSchema({
          name: 'Christian Perez - thechrisgrey',
          description:
            'Personal website of Christian Perez, Founder & CEO of Altivum Inc., Former Green Beret, and Host of The Vector Podcast.',
          url: 'https://thechrisgrey.com',
        }),
      ]}
    />
    <EditorialCanvasProvider>
      <CommandGridHero />
      <AboutSection />
      <RecordSection />
      <VenturesSection />
      <ImageBreak />
      <CtaSection />
    </EditorialCanvasProvider>
  </div>
);

export default Home;
```

- [ ] **Step 3: Delete the old hero implementation**

```bash
git rm src/components/home/HeroCanvas.tsx src/components/home/heroShader.ts src/components/home/HeroCanvas.test.tsx
```

Then re-run the reference check: `grep -rn "HeroCanvas\|heroShader" src` — Expected: no matches.
Check hero2 usage: `grep -rn "hero2" src` — Expected: no matches; then `git rm src/assets/hero2.png`.

- [ ] **Step 4: Run the full unit suite**

Run: `npx vitest run`
Expected: PASS. If any pre-existing Home integration test fails on removed content (old hero alt text, key-point titles), update those assertions to the new section structure (h1 "Christian Perez", eyebrows, CTA pills) — the new DOM is the source of truth.

- [ ] **Step 5: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add -A src/pages/Home.tsx src/components/home src/assets
git commit -m "feat(redesign): editorial Home — bento hero, about, record, ventures, break, CTA"
```

---

### Task 18: Navigation restyle + full-screen mobile overlay

**Files:**
- Modify: `src/components/Navigation.tsx`

Changes (surgical — keep dropdown logic, skip link, keyboard handling intact):

- [ ] **Step 1: Update the Home scroll threshold**

In the `updateScrollState` function (`src/components/Navigation.tsx:36-43`), the old Home page kept the nav transparent for 10 viewport-heights of sticky scroll. The new hero is one viewport tall. Replace:

```ts
      if (location.pathname === '/') {
        const summaryEndPosition = window.innerHeight * 10;
        setIsScrolled(window.scrollY > summaryEndPosition);
      } else {
        setIsScrolled(window.scrollY > 20);
      }
```

with:

```ts
      if (location.pathname === '/') {
        setIsScrolled(window.scrollY > window.innerHeight * 0.85);
      } else {
        setIsScrolled(window.scrollY > 20);
      }
```

- [ ] **Step 2: Editorial chrome — scrolled state + wordmark**

Replace the `<nav>` className (line ~123):

```tsx
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 opacity-0 animate-nav-fade-in ${
        isScrolled
          ? 'bg-altivum-dark/95 backdrop-blur-md border-b border-altivum-gold/20'
          : 'bg-transparent'
      }`}
```

Replace the wordmark block (the `<div className="flex flex-col -ml-2">` containing the two spans) with:

```tsx
            <div className="flex flex-col -ml-2">
              <span
                className="text-altivum-porcelain"
                style={{ fontFamily: EDITORIAL_FONT_FAMILY, fontWeight: 500, fontSize: '1.25rem', letterSpacing: '0.04em' }}
              >
                CHRISTIAN <span className="italic text-altivum-gold">PEREZ</span>
              </span>
              <span className="text-altivum-silver tracking-wider" style={typography.smallText}>
                thechrisgrey
              </span>
            </div>
```

And add the import at the top: `import { EDITORIAL_FONT_FAMILY } from '../utils/editorialType';`

- [ ] **Step 3: Replace the inline mobile menu with a full-screen overlay**

Add imports: `import { useFocusTrap } from '../hooks/useFocusTrap';`

Inside the component add the trap + scroll lock:

```tsx
  const { containerRef: overlayRef, handleKeyDown: handleOverlayKeyDown } =
    useFocusTrap(isMobileMenuOpen);

  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);
```

(`useFocusTrap(isActive)` returns `{ containerRef, handleKeyDown }` — `containerRef` is a `RefObject<HTMLDivElement>`; `handleKeyDown` implements the Tab wrap and must be attached to the overlay's `onKeyDown`.)

Replace the entire `{isMobileMenuOpen && ( <div className="md:hidden pb-4 ..."> ... )}` block with:

```tsx
        {isMobileMenuOpen && (
          <div
            ref={overlayRef}
            onKeyDown={handleOverlayKeyDown}
            className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-altivum-dark px-8 pb-12 pt-24 md:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Site menu"
          >
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="absolute right-6 top-6 p-2 text-altivum-silver hover:text-altivum-porcelain"
              aria-label="Close menu"
            >
              <span className="material-icons" aria-hidden="true">close</span>
            </button>

            <span className="italic text-altivum-porcelain/50" style={editorialType.eyebrow}>
              (MENU)
            </span>

            <div className="mt-8 flex flex-col gap-5">
              {[{ path: '/', label: 'Home' }, ...NAV_ITEMS.slice(1)].map((item, i) => (
                <ViewTransitionLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="opacity-0 animate-fade-in text-altivum-porcelain"
                  style={{
                    ...editorialType.displaySection,
                    fontSize: 'clamp(2rem, 8vw, 2.75rem)',
                    animationDelay: `${i * 70}ms`,
                    animationDuration: '0.6s',
                  }}
                >
                  {item.label}
                </ViewTransitionLink>
              ))}
            </div>

            <span className="mt-10 italic text-altivum-porcelain/50" style={editorialType.eyebrow}>
              (ABOUT)
            </span>
            <div className="mt-4 flex flex-col gap-3">
              {ABOUT_DROPDOWN_ITEMS.map((item, i) => (
                <ViewTransitionLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="opacity-0 animate-fade-in text-altivum-silver hover:text-altivum-gold"
                  style={{
                    fontFamily: EDITORIAL_FONT_FAMILY,
                    fontSize: '1.125rem',
                    animationDelay: `${350 + i * 50}ms`,
                    animationDuration: '0.6s',
                  }}
                >
                  {item.label}
                </ViewTransitionLink>
              ))}
            </div>
          </div>
        )}
```

Also add the `editorialType` import: `import { editorialType, EDITORIAL_FONT_FAMILY } from '../utils/editorialType';` (replacing the import added in Step 2).

Note: `animate-fade-in` already snaps to visible under `prefers-reduced-motion` via the existing `index.css:80-95` override — no extra handling needed.

- [ ] **Step 4: Run existing navigation tests, fix expectations**

Run: `npx vitest run src/components/Navigation.test.tsx` (if this file exists; check with `ls src/components/Navigation.test.tsx`)
Expected: update any assertion that targeted the old inline mobile menu markup (`pb-4` block) to the new overlay (`role="dialog"`). All other behavior (dropdown, skip link) is unchanged.

- [ ] **Step 5: Manual smoke**

Run: `npm run dev` — verify: transparent nav over the bento hero; solid + gold hairline after scrolling past the hero; Playfair wordmark; on a narrow viewport the hamburger opens the full-screen overlay, focus is trapped, Escape/close works, body doesn't scroll behind. Stop the server.

- [ ] **Step 6: Commit**

```bash
git add src/components/Navigation.tsx src/components/Navigation.test.tsx
git commit -m "feat(redesign): editorial navigation — Playfair wordmark, gold hairline, full-screen mobile overlay"
```

---

### Task 19: Footer restyle

**Files:**
- Modify: `src/components/Footer.tsx` (full rewrite, same data + links)

- [ ] **Step 1: Rewrite the Footer**

```tsx
// src/components/Footer.tsx
import ViewTransitionLink from './ViewTransitionLink';
import NewsletterForm from './NewsletterForm';
import Eyebrow from './editorial/Eyebrow';
import { typography } from '../utils/typography';
import { editorialType, EDITORIAL_FONT_FAMILY } from '../utils/editorialType';
import { SOCIAL_LINKS } from '../constants/links';

const NAVIGATE = [
  { to: '/about', label: 'About' },
  { to: '/blog', label: 'Blog' },
  { to: '/links', label: 'Links' },
  { to: '/contact', label: 'Contact' },
];

const VENTURES = [
  { to: '/altivum', label: 'Altivum Inc.' },
  { to: '/podcast', label: 'The Vector Podcast' },
  { to: '/beyond-the-assessment', label: 'Beyond the Assessment' },
  { to: '/claude', label: 'Claude' },
];

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer data-vt-persist="footer" className="border-t border-altivum-gold/15 bg-altivum-dark">
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-12">
        {/* Editorial statement */}
        <p className="max-w-2xl text-altivum-porcelain" style={editorialType.displaySection}>
          BUILD SOMETHING{' '}
          <span className="italic text-altivum-gold" style={{ fontFamily: EDITORIAL_FONT_FAMILY }}>
            WORTH KEEPING.
          </span>
        </p>

        <div className="mt-12 grid grid-cols-2 gap-10 md:grid-cols-3">
          <div>
            <Eyebrow className="text-altivum-porcelain/40">NAVIGATE</Eyebrow>
            <ul className="mt-4 space-y-2">
              {NAVIGATE.map((item) => (
                <li key={item.to}>
                  <ViewTransitionLink
                    to={item.to}
                    className="link-underline text-altivum-silver transition-colors hover:text-altivum-gold"
                    style={typography.smallText}
                  >
                    {item.label}
                  </ViewTransitionLink>
                </li>
              ))}
              <li>
                <a
                  href="/rss.xml"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-underline text-altivum-silver transition-colors hover:text-altivum-gold"
                  style={typography.smallText}
                >
                  RSS Feed
                </a>
              </li>
            </ul>
          </div>

          <div>
            <Eyebrow className="text-altivum-porcelain/40">VENTURES</Eyebrow>
            <ul className="mt-4 space-y-2">
              {VENTURES.map((item) => (
                <li key={item.to}>
                  <ViewTransitionLink
                    to={item.to}
                    className="link-underline text-altivum-silver transition-colors hover:text-altivum-gold"
                    style={typography.smallText}
                  >
                    {item.label}
                  </ViewTransitionLink>
                </li>
              ))}
            </ul>
          </div>

          <div className="col-span-2 md:col-span-1">
            <Eyebrow className="text-altivum-porcelain/40">CONNECT</Eyebrow>
            <ul className="mt-4 space-y-2">
              <li>
                <a
                  href={SOCIAL_LINKS.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-underline text-altivum-silver transition-colors hover:text-altivum-gold"
                  style={typography.smallText}
                >
                  LinkedIn
                </a>
              </li>
              <li>
                <a
                  href={SOCIAL_LINKS.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-underline text-altivum-silver transition-colors hover:text-altivum-gold"
                  style={typography.smallText}
                >
                  GitHub
                </a>
              </li>
            </ul>
            <div id="newsletter" className="mt-6">
              <NewsletterForm />
            </div>
          </div>
        </div>

        <div className="mt-12 h-px bg-gradient-to-r from-transparent via-altivum-gold/15 to-transparent" />
        <p className="mt-6 text-center text-altivum-silver" style={typography.smallText}>
          &copy; {currentYear} Christian Perez. All rights reserved.
          <span className="mx-2">·</span>
          <ViewTransitionLink to="/privacy" className="link-underline transition-colors hover:text-altivum-gold">
            Privacy Policy
          </ViewTransitionLink>
        </p>
      </div>
    </footer>
  );
};

export default Footer;
```

- [ ] **Step 2: Check NewsletterForm renders acceptably on dark**

Run: `npm run dev` — view the footer. `NewsletterForm` already exists and posts to the newsletter Lambda; if its input styling clashes with the dark footer, wrap-level overrides only (no edits to NewsletterForm itself in this phase).

- [ ] **Step 3: Run tests + fix Footer test expectations**

Run: `npx vitest run` — update any existing Footer test assertions (old heading "Quick Links" → "(NAVIGATE)" etc.).
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/Footer.tsx
git commit -m "feat(redesign): editorial footer — statement line, eyebrow columns, newsletter"
```

---

### Task 20: Cypress smoke updates

**Files:**
- Modify: `cypress/e2e/home.cy.ts`
- Modify: `cypress/e2e/mobile-navigation.cy.ts` (overlay instead of inline menu)

- [ ] **Step 1: Rewrite the home smoke spec**

Replace the body of `cypress/e2e/home.cy.ts` assertions that referenced the old hero/sticky summary with:

```ts
// cypress/e2e/home.cy.ts
describe('Home (editorial redesign)', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('renders the bento hero with the accessible name', () => {
    cy.get('h1').should('contain.text', 'Christian').and('contain.text', 'Perez');
    cy.contains('(FOUNDER & CEO — ALTIVUM INC.)').should('be.visible');
  });

  it('hero wayfinding tiles navigate', () => {
    cy.contains('a', 'Podcast').click();
    cy.location('pathname').should('eq', '/podcast');
  });

  it('reveals editorial sections on scroll', () => {
    cy.contains('(ABOUT)').scrollIntoView().should('be.visible');
    cy.contains('QUIET').should('be.visible');
    cy.contains('(THE RECORD)').scrollIntoView().should('be.visible');
    cy.contains('(VENTURES)').scrollIntoView().should('be.visible');
  });

  it('CTA pills are wired', () => {
    cy.contains('BUILD SOMETHING').scrollIntoView();
    cy.contains('a', 'Start a conversation').should('have.attr', 'href', '/contact');
    cy.contains('button', 'Newsletter').should('be.visible');
  });
});
```

- [ ] **Step 2: Update the mobile navigation spec**

In `cypress/e2e/mobile-navigation.cy.ts`, update the open-menu assertions to the overlay: after clicking the hamburger expect `[role="dialog"][aria-label="Site menu"]` to be visible, containing "Home" and "(ABOUT)"; clicking the close button hides it. Keep the rest of the spec's structure.

- [ ] **Step 3: Run the suite locally**

Run: `npm run dev` in one shell, then `npx cypress run --spec "cypress/e2e/home.cy.ts,cypress/e2e/mobile-navigation.cy.ts"`
Expected: all specs pass. Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add cypress/e2e/home.cy.ts cypress/e2e/mobile-navigation.cy.ts
git commit -m "test(redesign): update home + mobile nav e2e for editorial layout"
```

---

### Task 21: Full verification

**Files:** none new

- [ ] **Step 1: Unit suite with coverage**

Run: `npm run test:coverage`
Expected: PASS with thresholds met (lines ≥62, statements ≥60, branches ≥59, functions ≥55). The new editorial components all carry colocated tests; if a threshold dips, add targeted tests to the lowest-coverage new file before proceeding.

- [ ] **Step 2: Full production build**

Run: `npm run build`
Expected: completes — env validation, podcast episodes, lint (0 warnings), tsc, vite build, prerender, sitemap, RSS. Watch the prerender step specifically: every editorial GSAP/WebGL effect early-returns under `isPrerender()`, so the crawl must reach a stable DOM. If prerender hangs, the leak is an effect missing the `isPrerender()` guard.

- [ ] **Step 3: Preview + manual checklist**

Run: `npm run preview` — at http://localhost:4173 verify:
- Hero: tiles cascade in, ridge contours draw once (~1.8s), then stillness; name is DOM text immediately
- Tab-switch during the hero draw-in: hide the tab mid-draw, return — the ridge must resume cleanly (no blank, no restart)
- SVG fallback ↔ WebGL ridge crossfade: the two horizons should roughly align at the 62% tile crop; no visible jump
- Reduced motion (toggle in OS/DevTools rendering emulation): static SVG ridge, final stat values, no pin — everything readable
- Scroll: about reveal, stat roll-ups staggered, ventures pin + horizontal scrub (desktop), parallax break, porcelain CTA
- Mobile viewport: bento stacks 2-col scene-first, ventures swipe natively, overlay menu works
- No console errors; check the Network tab — fonts load same-origin (no fonts.googleapis.com request beyond the pre-existing Material Icons)

- [ ] **Step 4: Ratio audit (design gate from spec §2)**

Eyeball the full scroll: dark ~60%, porcelain ~20% (CTA + display type), gold ~10%, umber ~10%. If a section drifts (e.g. porcelain CTA too tall on ultrawide), adjust paddings — not colors.

- [ ] **Step 5: Final commit + push for review**

```bash
git add -A
git commit -m "feat(redesign): phase 1 complete — editorial design system + Home/Nav/Footer"
git push -u origin redesign/editorial-phase-1
```

Open a PR; deployment to Amplify happens on merge to `main` (per CLAUDE.md). Post-deploy, watch the `high-cls` CloudWatch alarm and Web Vitals dashboard for regressions.

---

## Out of scope (phase 2)

Inner-page migration (About, Altivum, Podcast, Book, AWS, Claude, Blog, Links, Contact, Privacy, Admin, 404, Foundation, Blueprint), chat widget/page restyle, blog content design. The Nav/Footer chrome shipped here already frames those pages.
