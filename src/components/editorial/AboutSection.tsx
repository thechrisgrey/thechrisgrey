import SplitReveal from '../SplitReveal';
import FadeReveal from '../FadeReveal';
import Eyebrow from './Eyebrow';
import EditorialPill from './EditorialPill';
import EditorialImage from './EditorialImage';
import { editorialType, EDITORIAL_FONT_FAMILY } from '../../utils/editorialType';

/**
 * (ABOUT) — three-column editorial split: stacked display headline, graded
 * portrait as a WebGL surface, quiet copy + pill. Stacks on mobile.
 */
const AboutSection = () => (
  <section className="mx-auto max-w-7xl px-6 py-24 md:py-36 lg:px-12" aria-label="About">
    <Eyebrow>ABOUT</Eyebrow>
    <div className="mt-12 grid grid-cols-1 items-start gap-10 md:grid-cols-[1.2fr_1fr_0.9fr] md:gap-12">
      {/* SplitReveal's `as` union is 'h3' | 'p' | 'span' — so the h2 is the
          wrapper and each line is a SplitReveal span (one accessible heading). */}
      <h2 className="relative z-30" style={editorialType.displaySection}>
        <SplitReveal as="span" className="block text-altivum-porcelain">
          QUIET DISCIPLINE.
        </SplitReveal>
        <SplitReveal
          as="span"
          className="block italic text-altivum-gold"
          style={{ fontFamily: EDITORIAL_FONT_FAMILY, fontStyle: 'italic' }}
        >
          RELENTLESS
        </SplitReveal>
        <SplitReveal as="span" className="block text-altivum-porcelain">
          EXECUTION.
        </SplitReveal>
      </h2>

      <EditorialImage
        stem="portrait"
        alt="Christian Perez"
        aspect="3 / 4"
        className="rounded-sm"
        sizes="(max-width: 768px) 100vw, 33vw"
      />

      <FadeReveal direction="right" className="relative z-30 md:pt-8">
        <p className="text-sm leading-relaxed text-altivum-silver">
          Eighteen years from Special Forces medic to founder &amp; CEO. Every venture —
          Altivum, The Vector Podcast, Beyond the Assessment — runs on the same operating
          system: assess honestly, decide fast, execute completely.
        </p>
        <div className="mt-8">
          <EditorialPill to="/about">The Full Story</EditorialPill>
        </div>
      </FadeReveal>
    </div>
  </section>
);

export default AboutSection;
