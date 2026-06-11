import { useRef } from 'react';
import ViewTransitionLink from '../ViewTransitionLink';
import Eyebrow from './Eyebrow';
import EditorialPill from './EditorialPill';
import RidgeFallback from './RidgeFallback';
import RidgeView from './RidgeView';
import AtmosphereView from './AtmosphereView';
import { useEditorialCanvas } from './EditorialCanvas';
import { useCascadeReveal } from './useCascadeReveal';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { editorialType, EDITORIAL_FONT_FAMILY } from '../../utils/editorialType';

const TILE_BASE =
  'relative overflow-hidden rounded-md border border-altivum-porcelain/[0.07] bg-[#0D1322] ' +
  'transition-all duration-300 hover:border-altivum-gold/40 hover:-translate-y-0.5';

const WAYFINDING = [
  { eyebrow: 'PODCAST', title: 'The Vector', italic: 'Podcast', to: '/podcast', label: 'The Vector Podcast' },
  { eyebrow: 'BOOK', title: 'Beyond the', italic: 'Assessment', to: '/beyond-the-assessment', label: 'Beyond the Assessment' },
  { eyebrow: 'VENTURE', title: 'Altivum', italic: 'Inc.', to: '/altivum', label: 'Altivum Inc.' },
];

/**
 * The Command Grid bento hero: one dominant live-ridge scene tile with the
 * name set inside it, a disciplined satellite rail (intro / stat / contact),
 * and a wayfinding strip. 100svh on desktop; collapses to a stacked 2-col
 * grid on mobile with the scene tile first.
 */
const CommandGridHero = () => {
  const gridRef = useRef<HTMLDivElement>(null);
  const { ready } = useEditorialCanvas();
  const coarse = useMediaQuery('(pointer: coarse)');
  useCascadeReveal(gridRef);

  return (
    <section className="min-h-[100svh] px-3 pt-24 pb-3 md:px-4 md:pb-4" aria-label="Introduction">
      <div
        ref={gridRef}
        className="grid h-full min-h-[calc(100svh-7rem)] grid-cols-2 gap-2 md:grid-cols-12 md:grid-rows-8 md:gap-2.5"
      >
        {/* Scene tile — the eye-catcher */}
        <div
          data-cascade
          className={`${TILE_BASE} col-span-2 min-h-[22rem] md:col-span-8 md:col-start-1 md:row-span-6 md:row-start-1`}
        >
          <RidgeFallback hidden={ready} />
          {ready && <RidgeView />}
          {ready && <AtmosphereView mobile={coarse} />}
          <div className="absolute left-5 top-5 md:left-6 md:top-6">
            <Eyebrow>FOUNDER &amp; CEO — ALTIVUM INC.</Eyebrow>
          </div>
          <div className="absolute bottom-5 left-5 z-30 md:bottom-6 md:left-6">
            <h1 className="text-altivum-porcelain" style={editorialType.displayHero}>
              Christian{' '}
              <span className="italic text-altivum-gold" style={{ fontFamily: EDITORIAL_FONT_FAMILY }}>
                Perez
              </span>
            </h1>
            <p className="mt-3 text-[0.625rem] uppercase tracking-[0.18em] text-altivum-silver">
              Green Beret · Founder · Author · Host
            </p>
          </div>
        </div>

        {/* Intro tile */}
        <div data-cascade className={`${TILE_BASE} col-span-2 p-5 md:col-span-4 md:row-span-2`}>
          <p className="relative z-30 text-sm leading-relaxed text-altivum-silver">
            Special Forces medic turned founder. Building AI-native systems at Altivum,
            asking better questions on The Vector Podcast.
          </p>
        </div>

        {/* Stat tile — sr-only real-text label (aria-label is prohibited on
            generic roles; see CountUp's Task 6 review) */}
        <div data-cascade className={`${TILE_BASE} col-span-1 bg-altivum-umber p-5 md:col-span-4 md:row-span-2`}>
          <span className="sr-only">18D — Special Forces Medical Sergeant</span>
          <span aria-hidden="true">
            <span className="text-altivum-porcelain" style={editorialType.statNumeral}>
              18
            </span>
            <span className="text-altivum-gold" style={editorialType.statSuffix}>
              D
            </span>
          </span>
          <p aria-hidden="true" className="mt-2 text-[0.625rem] uppercase tracking-[0.12em] text-altivum-silver">
            SF Medical Sergeant
          </p>
        </div>

        {/* Contact tile */}
        <div
          data-cascade
          className={`${TILE_BASE} col-span-1 flex flex-col items-start justify-between gap-3 p-5 md:col-span-4 md:row-span-2 md:flex-row md:items-center`}
        >
          <span className="relative z-30 text-[0.625rem] uppercase tracking-[0.15em] text-altivum-porcelain">
            Start a<br />conversation
          </span>
          <EditorialPill to="/contact" className="!px-5 !py-2.5 !min-h-0 text-[0.625rem]">
            <span className="sr-only">Start a conversation — </span>Contact
          </EditorialPill>
        </div>

        {/* Wayfinding strip */}
        {WAYFINDING.map((item) => (
          <ViewTransitionLink
            key={item.to}
            to={item.to}
            data-cascade
            aria-label={item.label}
            className={`${TILE_BASE} group col-span-1 block p-5 md:col-span-3 md:row-span-2`}
          >
            <Eyebrow className="text-altivum-porcelain/40">{item.eyebrow}</Eyebrow>
            <p className="relative z-30 mt-2 text-altivum-porcelain" style={{ fontFamily: EDITORIAL_FONT_FAMILY, fontSize: '1rem' }}>
              {item.title}{' '}
              <span className="italic text-altivum-gold group-hover:underline">{item.italic}</span>
            </p>
          </ViewTransitionLink>
        ))}

        {/* Scroll cue tile */}
        <div
          data-cascade
          className={`${TILE_BASE} col-span-1 flex items-center justify-center p-5 md:col-span-3 md:row-span-2`}
          aria-hidden="true"
        >
          <span className="text-[0.625rem] uppercase tracking-[0.25em] text-altivum-porcelain/50">
            Scroll
          </span>
        </div>
      </div>
    </section>
  );
};

export default CommandGridHero;
