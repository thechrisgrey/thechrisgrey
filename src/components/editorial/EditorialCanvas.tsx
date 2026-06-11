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

// eslint-disable-next-line react-refresh/only-export-components
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
      const id = (window as Window & typeof globalThis).requestIdleCallback(
        () => setIdle(true),
        { timeout: 2000 }
      );
      return () => (window as Window & typeof globalThis).cancelIdleCallback(id);
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
