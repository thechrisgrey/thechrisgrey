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
