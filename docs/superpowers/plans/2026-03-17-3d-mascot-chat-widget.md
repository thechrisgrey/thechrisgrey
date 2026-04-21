# 3D Mascot Chat Widget Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the gold circle chat FAB with a 3D rendering of the Alti mascot (alti.glb), floating above a dark circular platform.

**Architecture:** New `AltiMascot.tsx` component renders a Three.js Canvas with the GLB model inside the existing `ChatWidgetButton`. The button element is preserved for a11y. `frameloop="demand"` with manual `invalidate()` keeps GPU cost at zero when idle. The model is meshopt-compressed and lazy-loaded.

**Tech Stack:** React Three Fiber, Three.js, @react-three/drei (useGLTF), @gltf-transform/cli (meshopt compression)

**Spec:** `docs/superpowers/specs/2026-03-17-3d-mascot-chat-widget-design.md`

---

## File Structure

| File | Responsibility |
|------|---------------|
| `public/alti.glb` | Meshopt-compressed 3D model served statically |
| `src/components/chat/AltiMascot.tsx` | Three.js Canvas, model loading, lighting, hover animation, platform div |
| `src/components/chat/ChatWidgetButton.tsx` | Button wrapper with a11y, lazy-loads AltiMascot |
| `src/components/chat/ChatWidget.tsx` | No changes needed (already passes `isOpen` to button) |
| `amplify.yml` | Cache header for `.glb` files |
| `vite.config.ts` | Manual chunk for `three` to keep vendor bundle clean |

---

### Task 1: Install Dependencies and Compress Model

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`
- Create: `public/alti.glb` (compressed copy)

- [ ] **Step 1: Install Three.js ecosystem**

```bash
npm install three @react-three/fiber @react-three/drei
npm install --save-dev @types/three
```

- [ ] **Step 2: Verify gltf-transform CLI syntax**

```bash
npx @gltf-transform/cli --help
```

Confirm the `optimize` subcommand exists and accepts `--compress meshopt`. If the syntax has changed in the latest version, adjust the command in Step 3 accordingly.

- [ ] **Step 3: Compress the GLB with meshopt**

```bash
npx @gltf-transform/cli optimize alti.glb public/alti.glb --compress meshopt
```

Expected: `public/alti.glb` is created, significantly smaller than the 13MB original.

- [ ] **Step 4: Verify compressed file size**

```bash
ls -lh public/alti.glb
```

Expected: File size between 3-8MB. If it's barely smaller or the model looks broken when rendered later, copy the original instead: `cp alti.glb public/alti.glb`

- [ ] **Step 5: Add three to manual chunks in vite.config.ts**

In `vite.config.ts`, add `'three-vendor'` to `manualChunks`. Only include `three` — let `@react-three/fiber` and `@react-three/drei` be split naturally by Rollup so their internal lazy imports work correctly:

```ts
manualChunks: {
  'vendor': ['react', 'react-dom'],
  'sanity': ['@sanity/client', '@sanity/image-url', '@portabletext/react'],
  'router': ['react-router-dom'],
  'cognito': ['@aws-sdk/client-cognito-identity-provider'],
  'three-vendor': ['three'],
}
```

- [ ] **Step 6: Verify build succeeds**

```bash
npm run build
```

Expected: Build passes. New `three-vendor-[hash].js` chunk appears in `dist/assets/`. Verify the chunk size is reasonable (Three.js core is ~600KB minified).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json public/alti.glb vite.config.ts
git commit -m "feat: add Three.js dependencies and compressed Alti mascot model"
```

---

### Task 2: Create AltiMascot Component

**Files:**
- Create: `src/components/chat/AltiMascot.tsx`

- [ ] **Step 1: Create AltiMascot.tsx**

This component renders the 3D mascot canvas and the HTML platform underneath. It receives `isOpen` to toggle the close icon on the platform.

```tsx
import { Suspense, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

function AltiModel() {
  const { scene } = useGLTF('/alti.glb');
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const scaleRef = useRef(1);

  useFrame(({ invalidate }) => {
    if (!groupRef.current) return;
    const target = hovered ? 1.1 : 1.0;
    const current = scaleRef.current;
    if (Math.abs(current - target) > 0.001) {
      scaleRef.current = THREE.MathUtils.lerp(current, target, 0.1);
      groupRef.current.scale.setScalar(scaleRef.current);
      invalidate();
    }
  });

  return (
    <group
      ref={groupRef}
      onPointerEnter={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerLeave={(e) => {
        e.stopPropagation();
        setHovered(false);
      }}
    >
      <primitive object={scene} />
    </group>
  );
}

useGLTF.preload('/alti.glb');

interface AltiMascotProps {
  isOpen: boolean;
}

const AltiMascot = ({ isOpen }: AltiMascotProps) => {
  return (
    <div className="flex flex-col items-center">
      <div className="w-16 h-16" style={{ pointerEvents: 'none' }}>
        <Canvas
          frameloop="demand"
          gl={{ alpha: true, antialias: true }}
          camera={{ position: [0, 0, 3], fov: 45 }}
          style={{ pointerEvents: 'auto' }}
        >
          <ambientLight intensity={0.6} />
          <directionalLight position={[2, 2, 5]} intensity={0.8} />
          <Suspense fallback={null}>
            <AltiModel />
          </Suspense>
        </Canvas>
      </div>
      {/* Platform */}
      <div
        className={`w-12 h-3 rounded-[50%] flex items-center justify-center transition-all duration-200 ${
          isOpen
            ? 'bg-altivum-navy/90 border border-white/15'
            : 'bg-altivum-navy/70 border border-white/8'
        }`}
        style={{ marginTop: '-4px' }}
      >
        {isOpen && (
          <span className="material-icons text-altivum-silver text-[10px] leading-none">
            close
          </span>
        )}
      </div>
    </div>
  );
};

export default AltiMascot;
```

**Key decisions in this code:**
- `useGLTF` loads the model. `useGLTF.preload()` at module scope starts fetching the GLB as soon as the lazy chunk loads, before the component mounts — reduces time-to-visible.
- `frameloop="demand"` — Canvas only renders when `invalidate()` is called. The `useFrame` callback destructures `invalidate` from its state parameter and calls it only while the lerp is active. Once the lerp converges, rendering stops. Zero idle GPU.
- Pointer events: `setHovered(true/false)` triggers a React re-render, which causes `useFrame` to run (React Three Fiber invalidates on re-render in demand mode), starting the lerp loop.
- `scaleRef` avoids React re-renders during animation — only the Three.js scene graph updates.
- Platform is a plain HTML div below the canvas, not a 3D object.
- `pointerEvents: 'none'` on the canvas container wrapper, `'auto'` on the Canvas itself — this lets the button's click handler work while still allowing Three.js pointer events for hover detection.
- Camera at `[0, 0, 3]` with 45 fov — adjust these during Task 5 (visual tuning) after seeing the actual model.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/chat/AltiMascot.tsx
git commit -m "feat: add AltiMascot 3D component with hover animation"
```

---

### Task 3: Update ChatWidgetButton and Tests

**Files:**
- Modify: `src/components/chat/ChatWidgetButton.tsx`
- Modify: `src/components/chat/ChatWidgetButton.test.tsx`
- Modify: `src/__tests__/integration/ChatWidget.integration.test.tsx`

- [ ] **Step 1: Update ChatWidgetButton.tsx and its test simultaneously**

Both files change together — updating one without the other creates an intermediate state where nothing passes.

Replace `ChatWidgetButton.tsx`:

```tsx
import { lazy, Suspense } from 'react';

const AltiMascot = lazy(() => import('./AltiMascot'));

interface ChatWidgetButtonProps {
  isOpen: boolean;
  onClick: () => void;
}

const ChatWidgetButton = ({ isOpen, onClick }: ChatWidgetButtonProps) => {
  return (
    <button
      onClick={onClick}
      aria-label={isOpen ? 'Close chat' : 'Open chat'}
      aria-expanded={isOpen}
      className="fixed bottom-6 right-6 z-40 flex items-center justify-center cursor-pointer bg-transparent border-none p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-altivum-gold focus-visible:ring-offset-2 focus-visible:ring-offset-altivum-dark"
    >
      <Suspense fallback={null}>
        <AltiMascot isOpen={isOpen} />
      </Suspense>
    </button>
  );
};

export default ChatWidgetButton;
```

**Key points:**
- Button element preserved — all a11y intact.
- `React.lazy()` + local `<Suspense>` for lazy loading (outside App.tsx's Suspense boundary).
- `fallback={null}` — invisible until the 3D chunk loads, no flash.
- Removed gold circle styles (`rounded-full bg-altivum-gold w-14 h-14`), replaced with transparent background.
- Kept `focus-visible` ring styles for keyboard users.

Replace `ChatWidgetButton.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatWidgetButton from './ChatWidgetButton';

// Mock AltiMascot since Three.js Canvas doesn't work in jsdom
vi.mock('./AltiMascot', () => ({
  default: ({ isOpen }: { isOpen: boolean }) => (
    <div data-testid="alti-mascot" data-is-open={isOpen} />
  ),
}));

describe('ChatWidgetButton', () => {
  it('should render with "Open chat" label when closed', () => {
    render(<ChatWidgetButton isOpen={false} onClick={vi.fn()} />);
    const button = screen.getByRole('button', { name: /open chat/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('should render with "Close chat" label when open', () => {
    render(<ChatWidgetButton isOpen={true} onClick={vi.fn()} />);
    const button = screen.getByRole('button', { name: /close chat/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });

  it('should render AltiMascot with isOpen prop', () => {
    render(<ChatWidgetButton isOpen={false} onClick={vi.fn()} />);
    const mascot = screen.getByTestId('alti-mascot');
    expect(mascot).toBeInTheDocument();
    expect(mascot).toHaveAttribute('data-is-open', 'false');
  });

  it('should pass isOpen=true to AltiMascot when open', () => {
    render(<ChatWidgetButton isOpen={true} onClick={vi.fn()} />);
    const mascot = screen.getByTestId('alti-mascot');
    expect(mascot).toHaveAttribute('data-is-open', 'true');
  });

  it('should call onClick when clicked', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<ChatWidgetButton isOpen={false} onClick={onClick} />);

    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run unit tests**

```bash
npx vitest run src/components/chat/ChatWidgetButton.test.tsx
```

Expected: All 5 tests pass.

- [ ] **Step 3: Add AltiMascot mock to integration test**

Three.js Canvas will throw in jsdom — this mock is mandatory, not optional. Add this mock at the top of `src/__tests__/integration/ChatWidget.integration.test.tsx`, after the existing imports but before the `beforeEach`:

```tsx
// Mock AltiMascot since Three.js Canvas doesn't work in jsdom
vi.mock('../../components/chat/AltiMascot', () => ({
  default: ({ isOpen }: { isOpen: boolean }) => (
    <div data-testid="alti-mascot" data-is-open={isOpen}>
      {isOpen && <span>close</span>}
    </div>
  ),
}));
```

- [ ] **Step 4: Run full test suite**

```bash
npm run test
```

Expected: All tests pass — unit tests, integration tests, everything.

- [ ] **Step 5: Commit**

```bash
git add src/components/chat/ChatWidgetButton.tsx src/components/chat/ChatWidgetButton.test.tsx src/__tests__/integration/ChatWidget.integration.test.tsx
git commit -m "feat: replace gold circle FAB with 3D Alti mascot"
```

---

### Task 4: Add GLB Cache Header to amplify.yml

**Files:**
- Modify: `amplify.yml`

- [ ] **Step 1: Add cache header rule**

Add a new pattern block after the `**/*.webp` entry in `amplify.yml` (before `sitemap.xml`):

```yaml
  - pattern: '**/*.glb'
    headers:
      - key: Cache-Control
        value: 'public, max-age=604800'
```

This gives the GLB file 1-week browser caching, matching the image cache policy. No `immutable` since the file has no content hash.

- [ ] **Step 2: Verify amplify.yml is valid YAML**

Visually confirm the indentation of the new block matches the other `pattern` blocks (2 spaces for the list item, 6 spaces for nested keys).

- [ ] **Step 3: Commit**

```bash
git add amplify.yml
git commit -m "chore: add cache header for GLB model files"
```

---

### Task 5: Visual Verification and Tuning

This task is manual — it requires running the dev server and adjusting camera/model positioning based on how the actual model looks.

**Files:**
- May modify: `src/components/chat/AltiMascot.tsx` (camera position, model scale, lighting)

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

Open http://localhost:5173 in a browser. The Alti mascot should appear in the bottom-right corner.

- [ ] **Step 2: Check model orientation and framing**

The default camera is at `[0, 0, 3]` with fov 45. If the model is too large, too small, or facing the wrong direction, adjust these values in `AltiMascot.tsx`:

- **Too small/large:** Change the camera `position` z-value (closer = larger) or add a `scale` prop on the `<primitive>` element: `<primitive object={scene} scale={0.5} />`
- **Wrong orientation:** Add `rotation` prop: `<primitive object={scene} rotation={[0, Math.PI, 0]} />`
- **Too dark/bright:** Adjust `ambientLight intensity` and `directionalLight intensity`
- **Canvas too small/large:** Adjust the `w-16 h-16` classes on the canvas wrapper div

- [ ] **Step 3: Test hover animation**

Hover over the mascot. It should smoothly scale up ~10% and scale back down when the pointer leaves. Verify:
- Animation is smooth (not stuttery)
- No continuous GPU activity after hover ends (check with browser GPU monitor if needed)

- [ ] **Step 4: Test chat open/close states**

Click the mascot — the chat panel should open. Verify:
- The platform below shows an "X" close icon when the panel is open
- Clicking the mascot again closes the panel
- The panel still closes via Escape key and the panel's own close button

- [ ] **Step 5: Check compressed model quality**

Compare the compressed model to the original. If the model looks degraded (missing textures, distorted geometry, artifacts), replace with the uncompressed original:

```bash
cp alti.glb public/alti.glb
```

- [ ] **Step 6: Verify build succeeds**

```bash
npm run build
```

Expected: Full build passes (including tests, TypeScript, linting).

- [ ] **Step 7: Preview production build**

```bash
npm run preview
```

Open http://localhost:4173 — verify the mascot renders correctly in the production build.

- [ ] **Step 8: Commit any tuning changes**

```bash
git add src/components/chat/AltiMascot.tsx
git commit -m "fix: tune Alti mascot camera position and model scale"
```

Only commit this if changes were made during tuning. Skip if defaults worked.

---

## Done Checklist

After all tasks are complete, verify:

- [ ] `npm run build` passes (tests + types + lint + build)
- [ ] Mascot renders in bottom-right on all pages (except `/chat` and `/admin`)
- [ ] Hovering the mascot smoothly scales it up
- [ ] Clicking opens the chat panel
- [ ] Platform shows "X" when chat is open
- [ ] Clicking again closes the chat panel
- [ ] Keyboard: Tab to button, Enter/Space opens chat, focus ring visible
- [ ] No console errors or CSP violations in browser dev tools
- [ ] GLB loads lazily (doesn't block initial page render)
