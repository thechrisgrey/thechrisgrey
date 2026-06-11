import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
  /**
   * Requests a frame (noop until the canvas exists). Under the continuous
   * frameloop this is rarely needed — kept for API stability and for any
   * future return to demand-driven rendering.
   */
  invalidate: () => void;
}

const EditorialCanvasContext = createContext<EditorialCanvasValue>({
  ready: false,
  invalidate: () => {},
});

// eslint-disable-next-line react-refresh/only-export-components
export function useEditorialCanvas(): EditorialCanvasValue {
  return useContext(EditorialCanvasContext);
}

/**
 * Mounted as SafeCanvas's fallback: if the canvas tree errors (or suspends)
 * after `ready` flipped true, this resets it so consumers restore their
 * static fallbacks instead of staying hidden behind a dead canvas.
 */
const ResetReady = ({ onMount }: { onMount: () => void }) => {
  useEffect(() => {
    onMount();
  }, [onMount]);
  return null;
};

/**
 * One shared, fixed, pointer-events-none WebGL canvas for the whole page,
 * multiplexed into DOM rects via drei <View>. Mounts idle-time after first
 * paint so the DOM (hero name) stays the LCP element. When this never becomes
 * ready (reduced motion, no WebGL, prerender, mount error) the static
 * fallbacks simply remain visible — failure is staying on first paint.
 *
 * Layering contract: canvas z-20; content that must read above the WebGL
 * uses `relative z-30`; fallback visuals hide via opacity when ready.
 *
 * Frameloop policy: 'always' while the tab is visible, 'never' when hidden.
 * Demand mode was tried and abandoned — drei's portal-mounted Views starve
 * under it (late-mounted Views never get a first frame, root invalidations
 * clear the canvas without re-rendering scissored views, and onCreated/first-
 * frame ordering races `ready`). Continuous scissored rendering of a few
 * small views matches how the old HeroCanvas ran and what drei View expects;
 * per-view cost gates (IntersectionObserver `active` flags, settled shaders)
 * keep the per-frame work trivial.
 *
 * Consumer contract:
 * 1. Render `<View className="absolute inset-0">…</View>` AS the positioned
 *    element inside your tile — never `<View track={ref}>`. drei 10.x's
 *    out-of-canvas View ignores the `track` prop (its HtmlView branch renders
 *    and tracks its own div), so a track-based View scissors nothing.
 * 2. Every View whose children may suspend (textures, GLTFs) must wrap them
 *    in its own `<Suspense fallback={null}>` — otherwise one loading asset
 *    blanks ALL views through SafeCanvas's outer Suspense.
 * 3. Exactly ONE <View.Port /> may exist app-wide (tunnel-rat singleton); a
 *    second Port duplicates every view. This provider owns the single Port.
 */
export const EditorialCanvasProvider = ({ children }: { children: ReactNode }) => {
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [idle, setIdle] = useState(false);
  const [ready, setReady] = useState(false);
  const invalidateRef = useRef<(() => void) | null>(null);

  // Probe WebGL once at mount, not on every render.
  const [webglOk] = useState(
    () => typeof document !== 'undefined' && checkWebGLSupport()
  );

  const enabled = !reducedMotion && webglOk && !isPrerender();

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
    if (!enabled) return;
    const onVisibility = () => setDocVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [enabled]);

  // Identity-stable so consumer effects (and ScrollTrigger onUpdate wiring)
  // keyed on it never tear down when `ready` flips.
  const invalidateCb = useCallback(() => invalidateRef.current?.(), []);

  // `ready` alone can go stale: reduced-motion toggled mid-session unmounts
  // the canvas with no onCreated counterpart to flip it back. Expose the
  // conjunction so consumers always fall back when the canvas is gone.
  const value = useMemo(
    () => ({
      ready: ready && enabled,
      invalidate: invalidateCb,
    }),
    [ready, enabled, invalidateCb]
  );

  return (
    <EditorialCanvasContext.Provider value={value}>
      {children}
      {enabled && idle && (
        <div className="fixed inset-0 z-20 pointer-events-none" aria-hidden="true">
          <SafeCanvas fallback={<ResetReady onMount={() => setReady(false)} />}>
            <Canvas
              frameloop={docVisible ? 'always' : 'never'}
              dpr={[1, 2]}
              gl={{ alpha: true, antialias: true }}
              onCreated={(state) => {
                invalidateRef.current = () => state.invalidate();
                state.gl.domElement.addEventListener('webglcontextlost', (e) => {
                  // preventDefault tells the browser it may restore the context;
                  // without it, webglcontextrestored never fires.
                  e.preventDefault();
                  setReady(false);
                });
                state.gl.domElement.addEventListener('webglcontextrestored', () =>
                  setReady(true)
                );
                setReady(true);
              }}
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
