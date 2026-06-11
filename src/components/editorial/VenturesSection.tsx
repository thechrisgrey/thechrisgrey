import { useRef, useEffect, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import ViewTransitionLink from '../ViewTransitionLink';
import Eyebrow from './Eyebrow';
import EditorialImage from './EditorialImage';
import { useEditorialCanvas } from './EditorialCanvas';
import { editorialType, EDITORIAL_FONT_FAMILY } from '../../utils/editorialType';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { isPrerender } from '../../utils/prerender';

gsap.registerPlugin(ScrollTrigger);

const VENTURES = [
  {
    title: 'Altivum',
    italic: 'Inc.',
    desc: 'AI-native consultancy. Bedrock, agents, production systems.',
    to: '/altivum',
    stem: 'venture-altivum',
  },
  {
    title: 'The Vector',
    italic: 'Podcast',
    desc: 'Conversations on service, technology, and what comes next.',
    to: '/podcast',
    stem: 'venture-podcast',
  },
  {
    title: 'Beyond the',
    italic: 'Assessment',
    desc: 'The book — what selection actually selects for.',
    to: '/beyond-the-assessment',
    stem: 'venture-book',
  },
  {
    title: 'Cloud & AI',
    italic: 'Engineering',
    desc: 'AWS Community Builder. Applied AI engineering with Claude.',
    to: '/aws',
    stem: 'venture-aws',
  },
];

/**
 * (VENTURES) — pinned section where vertical scroll drives horizontal travel
 * through four full-bleed panels (desktop fine-pointer only). Touch, reduced
 * motion, and prerender all get a native horizontal snap scroller instead.
 *
 * Stacking note: the GSAP x-translation creates a new stacking context at
 * z-auto in the root, which paints in step 8. The shared canvas is fixed at
 * z-20 and paints in step 9 — OVER everything inside the translated track,
 * including z-30 text. To prevent panel titles from being buried under the
 * WebGL surface during pinned scroll, EditorialImage is rendered with
 * surface={false} so no View is mounted for venture panels. The images are
 * plain graded pictures; the gradient overlay and text always win.
 */
const VenturesSection = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const { invalidate } = useEditorialCanvas();
  const finePointer = useMediaQuery('(pointer: fine)');
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const pinned = finePointer && !reducedMotion && !isPrerender();

  useEffect(() => {
    if (!pinned) return;
    const section = sectionRef.current;
    const track = trackRef.current;
    if (!section || !track) return;

    const distance = () => track.scrollWidth - window.innerWidth;
    const tween = gsap.to(track, {
      x: () => -distance(),
      ease: 'none',
      // Consumer contract rule 4: the scrub tail outlives scroll events, and the
      // tween-level onUpdate ticks through it (ScrollTrigger's config onUpdate
      // only fires on actual scroll-position change) — so canvas frames track
      // the moving panels if surfaces ever return.
      onUpdate: invalidate,
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: () => `+=${distance()}`,
        scrub: 1,
        pin: true,
        invalidateOnRefresh: true,
        onUpdate: (self) => setActive(Math.min(3, Math.round(self.progress * 3))),
      },
    });

    // Keyboard operability: when a panel link receives focus, drive the scrub
    // position to reveal it instead of letting the browser scroll the
    // overflow-hidden section (which would double-offset against the GSAP
    // transform).
    const links = Array.from(track.querySelectorAll<HTMLAnchorElement>('a'));
    const onFocusIn = (e: FocusEvent) => {
      const idx = links.indexOf(e.target as HTMLAnchorElement);
      if (idx < 0) return;
      // Browsers scroll overflow-hidden ancestors to reveal focus — undo that...
      section.scrollLeft = 0;
      // ...and drive the real scrub position to the focused panel instead.
      const st = tween.scrollTrigger;
      if (st) window.scrollTo({ top: st.start + (idx / 3) * (st.end - st.start) });
    };
    track.addEventListener('focusin', onFocusIn);
    const onSectionScroll = () => {
      section.scrollLeft = 0;
    };
    section.addEventListener('scroll', onSectionScroll);

    return () => {
      track.removeEventListener('focusin', onFocusIn);
      section.removeEventListener('scroll', onSectionScroll);
      tween.scrollTrigger?.kill();
      tween.kill();
      // useMediaQuery is live: toggling OS reduced-motion mid-pin would
      // otherwise leave the track translated (up to the full travel distance)
      // under the snap-scroller classes — clear the inline transform.
      gsap.set(track, { clearProps: 'transform' });
    };
  }, [pinned, invalidate]);

  // Fallback indicator: the native snap scroller derives the active panel
  // from the track's horizontal scroll position.
  useEffect(() => {
    if (pinned) return;
    const track = trackRef.current;
    if (!track) return;
    const onScroll = () => {
      setActive(
        Math.min(
          3,
          Math.round((track.scrollLeft / (track.scrollWidth - track.clientWidth || 1)) * 3)
        )
      );
    };
    track.addEventListener('scroll', onScroll, { passive: true });
    return () => track.removeEventListener('scroll', onScroll);
  }, [pinned]);

  return (
    <section ref={sectionRef} className="overflow-hidden py-24 md:py-0" aria-label="Ventures">
      <div className="flex items-center justify-between px-6 pb-10 md:pt-28 lg:px-12">
        <Eyebrow>VENTURES</Eyebrow>
        <div
          className="relative z-30 flex gap-3 text-[0.625rem] tracking-[0.2em] text-altivum-silver"
          aria-hidden="true"
        >
          {VENTURES.map((v, i) => (
            <span key={v.to} className={i === active ? 'text-altivum-gold' : ''}>
              ({i + 1})
            </span>
          ))}
        </div>
      </div>

      <div
        ref={trackRef}
        data-ventures-track
        className={
          pinned
            ? 'flex gap-4 px-6 will-change-transform lg:px-12'
            : 'flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-6 lg:px-12'
        }
      >
        {VENTURES.map((venture) => (
          <ViewTransitionLink
            key={venture.to}
            to={venture.to}
            className="group relative min-w-[82vw] snap-start overflow-hidden rounded-md md:min-w-[60vw]"
          >
            {/*
             * surface={false}: the GSAP x-transform on the track creates a
             * z-auto stacking context that the fixed z-20 canvas paints over.
             * Mounting Views here would bury panel text behind the WebGL layer.
             * Plain picture/img ensures gradient overlay and titles always show.
             */}
            <EditorialImage
              stem={venture.stem}
              alt=""
              aspect="16 / 9"
              sizes="(max-width: 768px) 82vw, 60vw"
              surface={false}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-altivum-dark/85 via-altivum-dark/20 to-transparent" />
            <div className="absolute bottom-8 left-8 z-30">
              <h3 className="text-altivum-porcelain" style={editorialType.displaySection}>
                {venture.title}{' '}
                <span
                  className="italic text-altivum-gold"
                  style={{ fontFamily: EDITORIAL_FONT_FAMILY }}
                >
                  {venture.italic}
                </span>
              </h3>
              <p className="mt-3 max-w-xs text-xs uppercase tracking-[0.12em] text-altivum-silver">
                {venture.desc}
              </p>
            </div>
            <span
              className="absolute right-8 top-8 z-30 text-altivum-gold opacity-0 transition-all duration-300 group-hover:translate-x-1 group-hover:opacity-100"
              aria-hidden="true"
            >
              →
            </span>
          </ViewTransitionLink>
        ))}
      </div>
    </section>
  );
};

export default VenturesSection;
