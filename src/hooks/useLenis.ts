import { createContext, useContext, useEffect, useRef, useState } from 'react';
import Lenis from 'lenis';

type LenisContextValue = {
  lenis: Lenis | null;
  scrollTo: (target: string | number | HTMLElement, options?: { immediate?: boolean; offset?: number }) => void;
};

export const LenisContext = createContext<LenisContextValue>({
  lenis: null,
  scrollTo: () => {},
});

export function useLenisContext() {
  return useContext(LenisContext);
}

export function useLenisInstance() {
  const [lenis, setLenis] = useState<Lenis | null>(null);
  const rafId = useRef<number>(0);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    const instance = new Lenis({
      lerp: isTouchDevice ? 0.07 : 0.1,
      duration: 1.2,
      orientation: 'vertical',
      touchMultiplier: isTouchDevice ? 1.5 : 2,
      smoothWheel: true,
    });

    function raf(time: number) {
      instance.raf(time);
      rafId.current = requestAnimationFrame(raf);
    }
    rafId.current = requestAnimationFrame(raf);

    setLenis(instance);

    return () => {
      cancelAnimationFrame(rafId.current);
      instance.destroy();
      setLenis(null);
    };
  }, []);

  const scrollTo = (target: string | number | HTMLElement, options?: { immediate?: boolean; offset?: number }) => {
    if (lenis) {
      lenis.scrollTo(target, options);
    } else {
      if (typeof target === 'number') {
        window.scrollTo({ top: target, left: 0, behavior: 'instant' });
      }
    }
  };

  return { lenis, scrollTo };
}
