import { useRef, useLayoutEffect } from 'react';
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

  // useLayoutEffect so the GSAP from-state (clipped) is applied before first
  // paint — useEffect would let the label flash fully visible, then clip and
  // wipe, a perceptible blink above the fold on slow devices.
  useLayoutEffect(() => {
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
