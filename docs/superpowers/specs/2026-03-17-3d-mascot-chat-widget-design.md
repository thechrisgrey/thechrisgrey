# 3D Mascot Chat Widget

Replace the current gold circle FAB (floating action button) for the AI chat widget with a 3D rendering of Alti, the Altivum company mascot, loaded from `alti.glb`.

## Decisions

- **Mascot floats above a minimal dark circular platform** that provides button affordance
- **Static by default**, animate only on hover (scale up ~10% with smooth lerp)
- **Compress the GLB** with meshopt (target ~3-5MB from 13MB), revert if quality degrades. Lazy load the 3D component after page is interactive. Meshopt chosen over Draco to avoid blob-URL Web Worker and CDN dependencies that conflict with the existing strict CSP (`worker-src 'none'`).
- **When chat is open**, Alti stays in place; the platform underneath shows an "X" close icon
- **No `prefers-reduced-motion` handling** — keep it simple

## Architecture

### New Dependencies

- `three` — Three.js core
- `@react-three/fiber` — React renderer for Three.js
- `@react-three/drei` — useGLTF model loader, helpers
- `@gltf-transform/cli` (dev only, one-time use) — model compression via meshopt

### File Changes

| File | Change |
|------|--------|
| `public/alti.glb` | NEW — Meshopt-compressed model served statically |
| `src/components/chat/AltiMascot.tsx` | NEW — 3D canvas, model, lighting, hover animation |
| `src/components/chat/ChatWidgetButton.tsx` | MODIFY — render AltiMascot instead of gold circle |
| `src/components/chat/ChatWidget.tsx` | MINOR — pass `isOpen` to button for platform state |
| `amplify.yml` | MODIFY — add cache header for `.glb` files |

### AltiMascot Component

```
AltiMascot (props: { isOpen })
├── <Canvas alpha={true} frameloop="demand">
│   ├── ambientLight (intensity ~0.6)
│   ├── directionalLight (position: [2, 2, 5])
│   └── <Suspense fallback={null}>
│       └── <AltiModel />
│           ├── useGLTF("/alti.glb")
│           ├── onPointerEnter → set hovered=true, invalidate()
│           ├── onPointerLeave → set hovered=false, invalidate()
│           └── useFrame → lerp scale toward target, call invalidate()
│                          while lerp delta > 0.001, then stop
│   </Suspense>
│
└── <div> platform — dark ellipse underneath (HTML, not 3D)
    ├── Default: subtle shadow/border
    └── isOpen: show material-icons "close" via CSS transition
```

### Interaction States

| State | Model | Platform |
|-------|-------|----------|
| Idle | Static, scale 1.0 | Dark ellipse, subtle border |
| Hover | Scale 1.1, smooth lerp | Unchanged |
| Chat open | Static, scale 1.0 | Shows "X" close icon |
| Chat open + hover | Scale 1.1 | "X" highlighted |

### Accessibility

The outer element in `ChatWidgetButton.tsx` remains a `<button>` to preserve:
- Keyboard operability (Enter/Space activation)
- `aria-label` and `aria-expanded` attributes
- `focus-visible` ring styles
- Screen reader semantics

The `<Canvas>` and platform render inside the button. The button loses the gold circle styles but keeps all interactive/ARIA behavior.

### Lazy Loading

`ChatWidgetButton.tsx` uses `React.lazy()` to import `AltiMascot`. A local `<Suspense fallback={null}>` wraps the lazy component inside `ChatWidgetButton` — this is necessary because the widget renders outside the main page `<Suspense>` boundary in `App.tsx`. The fallback is `null` (invisible until loaded) so no placeholder flashes.

### frameloop="demand" and Hover Animation

`frameloop="demand"` means R3F only renders when `invalidate()` is called. The hover lerp animation works as follows:

1. `onPointerEnter` / `onPointerLeave` sets the target scale and calls `invalidate()` (obtained via `useThree()` at component scope)
2. Inside `useFrame`, destructure `invalidate` from the state parameter:
   ```ts
   useFrame(({ invalidate }) => {
     // lerp current scale toward target
     if (Math.abs(current - target) > 0.001) {
       current = THREE.MathUtils.lerp(current, target, 0.1);
       mesh.scale.setScalar(current);
       invalidate(); // request another frame
     }
   });
   ```
3. Once the lerp converges (delta < 0.001), stop calling `invalidate()` — rendering stops, zero idle GPU.

This gives smooth animation during hover transitions with zero cost at rest.

### Performance Strategy

1. **Model compression**: One-time setup step:
   ```bash
   npx @gltf-transform/cli optimize alti.glb public/alti.glb --compress meshopt
   ```
   Meshopt runs entirely on the main thread with no Web Worker or CDN dependency, so no CSP changes are needed. Visually verify the output. If quality degrades, copy the original uncompressed file to `public/alti.glb` instead.

2. **Lazy loading**: `React.lazy()` wraps AltiMascot. Loads only after page is interactive. No impact on LCP/FCP.

3. **GPU budget**: ~80x80px canvas, no shadows, no post-processing. `frameloop="demand"` — zero idle GPU.

4. **Cache header**: Add a `**/*.glb` rule in `amplify.yml` with `Cache-Control: public, max-age=604800` (1 week, same as images). The file lives in `public/` with no content hash, so immutable caching is inappropriate.

### amplify.yml Changes

No CSP changes needed. Three.js compiles WebGL shaders via `WebGLRenderingContext.compileShader()`, which is not governed by CSP directives. Meshopt compression (unlike Draco) does not spawn Web Workers or fetch from CDN, so the existing strict CSP (`worker-src 'none'`) is fully compatible.

Add cache header for GLB files:
```yaml
- pattern: '**/*.glb'
  headers:
    - key: Cache-Control
      value: 'public, max-age=604800'
```

### ChatWidgetButton Changes

The current button is a 56px gold circle with a material icon. It becomes:

```tsx
// Before
<button className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-altivum-gold ...">
  <span className="material-icons">{isOpen ? 'close' : 'chat'}</span>
</button>

// After — button element preserved for a11y
<button
  onClick={onClick}
  aria-label={isOpen ? 'Close chat' : 'Open chat'}
  aria-expanded={isOpen}
  className="fixed bottom-6 right-6 z-40 ... focus-visible styles ..."
>
  <Suspense fallback={null}>
    <AltiMascot isOpen={isOpen} />
  </Suspense>
</button>
```

## Out of Scope

- No idle animations (floating, rotating)
- No sound effects
- No reduced-motion handling
- No fallback for WebGL-unsupported browsers (negligible share)
- No orbit/drag interaction — click only
