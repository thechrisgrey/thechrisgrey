import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import EditorialImage from './EditorialImage';
import { editorialType } from '../../utils/editorialType';
import { isPrerender } from '../../utils/prerender';

gsap.registerPlugin(ScrollTrigger);

/**
 * Full-bleed graded architectural image at 0.85x parallax with one italic
 * porcelain pull-quote crossing it — the breath between ventures and the ask.
 */
const ImageBreak = () => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isPrerender()) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const wrap = wrapRef.current;
    const image = imageRef.current;
    if (!wrap || !image) return;

    // 0.85x: the image lags the scroll by 15% of the section height.
    const tween = gsap.fromTo(
      image,
      { y: '-7.5%' },
      {
        y: '7.5%',
        ease: 'none',
        scrollTrigger: { trigger: wrap, start: 'top bottom', end: 'bottom top', scrub: true },
      }
    );
    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
      gsap.set(image, { clearProps: 'transform' });
    };
  }, []);

  return (
    // Deviation: section element instead of div so aria-label is valid
    // (divs need an explicit role for aria-label to be meaningful to AT).
    <section ref={wrapRef} className="relative overflow-hidden" aria-label="Interlude">
      <div ref={imageRef} className="scale-110">
        {/*
         * surface={false}: the parallax y-transform on imageRef creates a
         * stacking context (transform + will-change), which would place the
         * z-20 canvas OVER the dark overlay sibling — the overlay stops
         * applying to the WebGL surface, visibly brightening the image when
         * it goes live. Disabling the surface keeps the picture/img path
         * correct regardless of stacking.
         */}
        <EditorialImage
          stem="break-interior"
          alt=""
          aspect="21 / 9"
          sizes="100vw"
          className="w-full"
          surface={false}
        />
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-altivum-dark/35">
        <p className="relative z-30 max-w-3xl px-6 text-center text-altivum-porcelain" style={editorialType.pullQuote}>
          The standard is the standard — in the field, in the company, on the page.
        </p>
      </div>
    </section>
  );
};

export default ImageBreak;
