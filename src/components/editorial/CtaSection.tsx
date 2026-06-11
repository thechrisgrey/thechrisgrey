import Eyebrow from './Eyebrow';
import EditorialPill from './EditorialPill';
import { editorialType, EDITORIAL_FONT_FAMILY } from '../../utils/editorialType';
import { useLenisContext } from '../../hooks/useLenis';

/**
 * (NEXT) — the single porcelain section on the page; the palette inversion is
 * the punctuation mark for the whole scroll (the 20% of 60/20/10/10).
 */
const CtaSection = () => {
  const { lenis, scrollTo } = useLenisContext();

  const handleNewsletterClick = () => {
    // Always call scrollTo (harmless when lenis is null, satisfies tests).
    scrollTo('#newsletter', { offset: -120 });
    // Deviation: when lenis is null (reduced-motion or pre-init), scrollTo
    // silently no-ops on string targets. Provide a direct DOM fallback so
    // the button still works for reduced-motion users.
    if (!lenis) {
      document.getElementById('newsletter')?.scrollIntoView({ behavior: 'auto', block: 'center' });
    }
  };

  return (
    <section className="bg-altivum-porcelain px-6 py-24 text-center md:py-36" aria-label="Get in touch">
      <Eyebrow className="text-altivum-dark/50">NEXT</Eyebrow>
      <h2 className="mt-8 text-altivum-dark" style={editorialType.displaySection}>
        BUILD SOMETHING
        <br />
        <span className="italic text-altivum-gold" style={{ fontFamily: EDITORIAL_FONT_FAMILY }}>
          WORTH KEEPING.
        </span>
      </h2>
      <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
        <EditorialPill to="/contact" variant="dark-solid">
          Start a conversation
        </EditorialPill>
        <EditorialPill onClick={handleNewsletterClick} variant="dark-outline">
          Newsletter
        </EditorialPill>
      </div>
    </section>
  );
};

export default CtaSection;
