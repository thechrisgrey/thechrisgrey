import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { editorialType } from '../../utils/editorialType';
import { isPrerender } from '../../utils/prerender';

gsap.registerPlugin(ScrollTrigger);

interface CountUpProps {
  /** Final numeric value the numeral rolls up to. */
  value: number;
  /** Italic gold suffix rendered beside the numeral, e.g. "D", "+", "x". */
  suffix?: string;
  /** Small uppercase caption under the numeral. */
  caption: string;
  className?: string;
}

/**
 * The reference design's signature animated serif stat. The final value is in
 * the DOM from first paint; GSAP only animates the displayed text transiently
 * (reduced motion / prerender / no-JS all read correct values by default).
 */
const CountUp = ({ value, suffix = '', caption, className = '' }: CountUpProps) => {
  const numeralRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (isPrerender()) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const el = numeralRef.current;
    if (!el) return;

    const counter = { n: 0 };
    const tween = gsap.fromTo(
      counter,
      { n: 0 },
      {
        n: value,
        duration: 1.6,
        ease: 'power3.out',
        snap: { n: 1 },
        onUpdate: () => {
          el.textContent = String(Math.round(counter.n));
        },
        scrollTrigger: { trigger: el, start: 'top 85%', toggleActions: 'play none none none' },
      }
    );

    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
      el.textContent = String(value);
    };
  }, [value]);

  return (
    <div className={`relative z-30 ${className}`} aria-label={`${value}${suffix} — ${caption}`}>
      <span aria-hidden="true">
        <span ref={numeralRef} className="text-altivum-porcelain" style={editorialType.statNumeral}>
          {value}
        </span>
        {suffix && (
          <span className="text-altivum-gold" style={editorialType.statSuffix}>
            {suffix}
          </span>
        )}
      </span>
      <p
        aria-hidden="true"
        className="mt-2 max-w-[10rem] text-[0.625rem] uppercase tracking-[0.12em] leading-relaxed text-altivum-silver"
      >
        {caption}
      </p>
    </div>
  );
};

export default CountUp;
