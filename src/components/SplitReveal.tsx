import { useRef, useEffect, type CSSProperties, type RefObject } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface SplitRevealProps {
  children: string;
  direction?: 'left' | 'right';
  stagger?: number;
  className?: string;
  style?: CSSProperties;
  as?: 'h3' | 'p' | 'span';
  triggerRef?: RefObject<HTMLElement | null>;
  triggerStart?: string;
  triggerEnd?: string;
}

const SplitReveal = ({
  children,
  direction = 'left',
  stagger = 0.04,
  className = '',
  style,
  as: Tag = 'span',
  triggerRef,
  triggerStart = 'top 82%',
  triggerEnd = 'top 50%',
}: SplitRevealProps) => {
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const container = containerRef.current;
    if (!container) return;

    const words = container.querySelectorAll<HTMLElement>('.split-word-inner');
    if (!words.length) return;

    const xOffset = direction === 'right' ? 20 : -20;
    const trigger = triggerRef?.current || container;

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger,
        start: triggerStart,
        end: triggerEnd,
        scrub: true,
      },
    });

    tl.fromTo(
      words,
      { y: '100%', x: xOffset, opacity: 0 },
      { y: 0, x: 0, opacity: 1, stagger, ease: 'power2.out' }
    );

    return () => {
      tl.scrollTrigger?.kill();
      tl.kill();
    };
  }, [children, direction, stagger, triggerRef, triggerStart, triggerEnd]);

  const prefersReducedMotion = typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (prefersReducedMotion) {
    return <Tag className={className} style={style}>{children}</Tag>;
  }

  const words = children.split(/\s+/);

  return (
    <Tag ref={containerRef as never} className={className} style={style}>
      {words.map((word, i) => (
        <span key={i} className="inline-block overflow-hidden">
          <span className="split-word-inner inline-block">{word}</span>
          {i < words.length - 1 && <span className="inline-block w-[0.25em]">{' '}</span>}
        </span>
      ))}
    </Tag>
  );
};

export default SplitReveal;
