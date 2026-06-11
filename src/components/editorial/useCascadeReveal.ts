import { useLayoutEffect, type RefObject } from 'react';
import gsap from 'gsap';
import { isPrerender } from '../../utils/prerender';

/**
 * Once-on-mount staggered tile cascade: every child carrying [data-cascade]
 * rises 12px and fades in, 45ms apart. gsap.fromTo sets the initial hidden
 * state inside useLayoutEffect (before paint), so content is never hidden for
 * reduced-motion / prerender / no-JS readers.
 *
 * Deliberately replays on every mount — client-side nav back to Home gets the
 * cascade again; it is a hero entrance, not a one-per-session reveal.
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
      {
        opacity: 1,
        y: 0,
        duration: 0.6,
        stagger: 0.045,
        ease: 'power3.out',
        // GSAP otherwise leaves inline `transform: translate(0,0)` on every
        // tile after the tween: a permanent stacking context (which would trap
        // tile content below the z-20 fixed canvas) AND an inline override of
        // the Tailwind hover:-translate-y-0.5 class, killing the lift
        // micro-interaction.
        clearProps: 'transform',
      }
    );
    return () => {
      tween.kill();
    };
  }, [containerRef]);
}
