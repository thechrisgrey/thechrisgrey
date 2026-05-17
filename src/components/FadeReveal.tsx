import { useRef, useEffect, type ReactNode, type CSSProperties, type RefObject } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface FadeRevealProps {
  children: ReactNode;
  direction?: 'left' | 'right';
  delay?: number;
  className?: string;
  style?: CSSProperties;
  triggerRef?: RefObject<HTMLElement | null>;
  triggerStart?: string;
  triggerEnd?: string;
}

const FadeReveal = ({
  children,
  direction = 'left',
  delay = 0,
  className = '',
  style,
  triggerRef,
  triggerStart = 'top 82%',
  triggerEnd = 'top 50%',
}: FadeRevealProps) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const el = ref.current;
    if (!el) return;

    const xOffset = direction === 'right' ? 15 : -15;
    const trigger = triggerRef?.current || el;

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger,
        start: triggerStart,
        end: triggerEnd,
        scrub: true,
      },
    });

    tl.fromTo(
      el,
      { opacity: 0, x: xOffset, y: 8 },
      { opacity: 1, x: 0, y: 0, delay, ease: 'power2.out' }
    );

    return () => {
      tl.scrollTrigger?.kill();
      tl.kill();
    };
  }, [direction, delay, triggerRef, triggerStart, triggerEnd]);

  const prefersReducedMotion = typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (prefersReducedMotion) {
    return <div className={className} style={style}>{children}</div>;
  }

  return (
    <div ref={ref} className={className} style={{ opacity: 0, ...style }}>
      {children}
    </div>
  );
};

export default FadeReveal;
