// src/pages/Home.tsx
import { Helmet } from 'react-helmet-async';
import { SEO } from '../components/SEO';
import { homeFAQs, buildWebPageSchema } from '../utils/schemas';
// Preload the two critical display faces (spec §3/§10) — `?url` resolves the
// hashed asset paths Vite gives the fontsource woff2 files.
import playfair400 from '@fontsource/playfair-display/files/playfair-display-latin-400-normal.woff2?url';
import playfair500 from '@fontsource/playfair-display/files/playfair-display-latin-500-normal.woff2?url';
import { EditorialCanvasProvider } from '../components/editorial/EditorialCanvas';
import CommandGridHero from '../components/editorial/CommandGridHero';
import AboutSection from '../components/editorial/AboutSection';
import RecordSection from '../components/editorial/RecordSection';
import VenturesSection from '../components/editorial/VenturesSection';
import ImageBreak from '../components/editorial/ImageBreak';
import CtaSection from '../components/editorial/CtaSection';

/**
 * Editorial Home — six sections per the 2026-06-11 redesign spec:
 * Command Grid bento hero -> (ABOUT) -> (THE RECORD) -> (VENTURES) ->
 * image break -> porcelain CTA. All WebGL lives on the shared editorial
 * canvas; static fallbacks are the first paint and the reduced-motion path.
 *
 * Layering contract: do NOT add transform/opacity/z-index to these section
 * wrappers — content that must read above the canvas uses `relative z-30`
 * inside the editorial components.
 */
const Home = () => (
  <div className="min-h-screen bg-altivum-dark">
    <Helmet>
      <link rel="preload" as="font" type="font/woff2" href={playfair400} crossOrigin="anonymous" />
      <link rel="preload" as="font" type="font/woff2" href={playfair500} crossOrigin="anonymous" />
    </Helmet>
    <SEO
      title="Christian Perez"
      description="Personal website of Christian Perez, Founder & CEO of Altivum Inc., Former Green Beret, Bronze Star Recipient, and Host of The Vector Podcast."
      keywords="Christian Perez, thechrisgrey, Altivum Inc, Green Beret, The Vector Podcast, veteran entrepreneur, AI technology, cloud architecture"
      url="https://thechrisgrey.com"
      faq={homeFAQs}
      structuredData={[
        buildWebPageSchema({
          name: 'Christian Perez - thechrisgrey',
          description:
            'Personal website of Christian Perez, Founder & CEO of Altivum Inc., Former Green Beret, and Host of The Vector Podcast.',
          url: 'https://thechrisgrey.com',
        }),
      ]}
    />
    <EditorialCanvasProvider>
      <CommandGridHero />
      <AboutSection />
      <RecordSection />
      <VenturesSection />
      <ImageBreak />
      <CtaSection />
    </EditorialCanvasProvider>
  </div>
);

export default Home;
