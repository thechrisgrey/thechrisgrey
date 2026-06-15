import { lazy, useRef } from 'react';
import ViewTransitionLink from '../components/ViewTransitionLink';
import SplitReveal from '../components/SplitReveal';
import FadeReveal from '../components/FadeReveal';
import { SEO } from '../components/SEO';
const profileImage = '/profile1.jpeg';
import heroImage from '../assets/hero2.png';
import { typography } from '../utils/typography';
import { homeFAQs, buildWebPageSchema } from '../utils/schemas';
import { SOCIAL_LINKS } from '../constants/links';
import SocialIcon from '../components/SocialIcon';
import NewsletterForm from '../components/NewsletterForm';
import Testimonials from '../components/Testimonials';
import { useMediaQuery } from '../hooks/useMediaQuery';
import SafeCanvas from '../components/SafeCanvas';
import { checkWebGLSupport } from '../utils/checkWebGL';
import { isPrerender } from '../utils/prerender';

// Lazy so the WebGL hero backdrop is its own chunk that hydrates after the
// critical path. The static hero2.png is always rendered on top and stays the
// LCP element; the backdrop fades in behind it once its chunk resolves.
const HeroCanvas = lazy(() => import('../components/home/HeroCanvas'));

const Home = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const webglOk = checkWebGLSupport();

  const keyPoints = [
    { title: "Personal Biography", subtitle: "Christian Perez", link: "/about" },
    { title: "Altivum Inc", subtitle: "Founder & CEO", link: "/altivum" },
    { title: "The Altivum Foundation", subtitle: "Founder & President", link: "/foundation" },
    { title: "The Vector Podcast", subtitle: "Host", link: "/podcast" },
    { title: "Beyond the Assessment", subtitle: "Author", link: "/beyond-the-assessment" },
    { title: "Amazon Web Services", subtitle: "AWS Community Builder (AI Engineering)", link: "/aws" },
    { title: "Claude", subtitle: "Applied AI Engineer", link: "/claude" },
    { title: "thechrisgrey Blueprint", subtitle: "Architect", link: "/blueprint" }
  ];

  const renderTab = (point: typeof keyPoints[number], index: number, mirrored = false) => {
    const direction = mirrored ? 'right' as const : 'left' as const;
    const cardClass = mirrored
      ? 'border-l-4 md:border-l-0 md:border-r-4 border-altivum-gold pl-4 sm:pl-6 md:pl-0 md:pr-6 py-3 sm:py-4 md:text-right transition-all duration-300'
      : 'border-l-4 border-altivum-gold pl-4 sm:pl-6 py-3 sm:py-4 transition-all duration-300';
    const linkHover = mirrored
      ? 'block cursor-pointer group md:hover:pr-8 active:pl-6 sm:active:pl-8 touch-manipulation'
      : 'block cursor-pointer group md:hover:pl-8 active:pl-6 sm:active:pl-8 touch-manipulation';

    const startPct = 5 + index * 11;
    const endPct = startPct + 8;
    const triggerStart = `${startPct}% bottom`;
    const triggerEnd = `${endPct}% bottom`;

    const content = (
      <>
        <SplitReveal
          as="h3"
          direction={direction}
          stagger={0.04}
          className="text-white mb-1 sm:mb-2"
          style={typography.cardTitleLarge}
          triggerRef={sectionRef}
          triggerStart={triggerStart}
          triggerEnd={triggerEnd}
        >
          {point.title}
        </SplitReveal>
        <FadeReveal
          direction={direction}
          delay={0.15}
          triggerRef={sectionRef}
          triggerStart={triggerStart}
          triggerEnd={triggerEnd}
        >
          <p className="text-altivum-gold italic" style={typography.subtitle}>
            {point.subtitle}
          </p>
        </FadeReveal>
      </>
    );

    return (
      <div key={index} className="pointer-events-auto">
        {point.link ? (
          <ViewTransitionLink to={point.link} className={`${cardClass} ${linkHover}`}>
            {content}
          </ViewTransitionLink>
        ) : (
          <div className={cardClass}>
            {content}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen">
      <SEO
        title="Christian Perez"
        description="Personal website of Christian Perez, Founder & CEO of Altivum Inc., Former Green Beret, Bronze Star Recipient, and Host of The Vector Podcast."
        keywords="Christian Perez, thechrisgrey, Altivum Inc, Green Beret, The Vector Podcast, veteran entrepreneur, AI technology, cloud architecture"
        url="https://thechrisgrey.com"
        faq={homeFAQs}
        structuredData={[
          buildWebPageSchema({
            name: "Christian Perez - thechrisgrey",
            description: "Personal website of Christian Perez, Founder & CEO of Altivum Inc., Former Green Beret, and Host of The Vector Podcast.",
            url: "https://thechrisgrey.com"
          })
        ]}
      />
      {/* Hero Section with fade-in animation */}
      <section
        ref={heroRef}
        className="relative min-h-screen flex items-center justify-center overflow-hidden opacity-0 animate-fade-in"
      >
        {/* Base background gradient — also the resting look under reduced motion
            and the color shown before the WebGL backdrop hydrates. */}
        <div className="absolute inset-0 bg-linear-to-br from-altivum-dark via-altivum-navy to-altivum-blue opacity-50"></div>

        {/* Living "signal field" backdrop. Mounted only when motion is allowed,
            WebGL is supported, and we are not prerendering; its lazy chunk loads
            after the static brandmark below, so the brandmark remains the LCP
            element. isPrerender() skips it during the build-time crawl so the
            headless render reaches a stable DOM instead of a never-idle loop. */}
        {!reducedMotion && webglOk && !isPrerender() && (
          <div className="absolute inset-0" aria-hidden="true">
            {/* Static gradient behind (above) is the fallback, so null is fine. */}
            <SafeCanvas>
              <HeroCanvas heroRef={heroRef} />
            </SafeCanvas>
          </div>
        )}

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 md:py-32">
          <div className="max-w-4xl mx-auto text-center">
            <div className="mb-6 sm:mb-8">
              <img
                src={heroImage}
                alt="Leadership Forged in Service"
                className="w-full max-w-3xl mx-auto"
                width={1500}
                height={1500}
                fetchPriority="high"
              />
              <h1 className="sr-only">Christian Perez - Leadership Forged in Service</h1>
            </div>
          </div>
        </div>
      </section>

      {/* Sticky Profile Image Section with Scrolling Summary Tabs */}
      <section ref={sectionRef} className="relative h-[675vh] md:h-[840vh]">
        <div className="sticky top-0 h-screen overflow-hidden" style={{ transform: 'translate3d(0,0,0)' }}>
          <div className="absolute inset-0">
            <img
              src={profileImage}
              alt="Christian Perez"
              className="w-full h-full object-cover object-[left_30%] md:object-[center_30%]"
              style={{ transform: 'translate3d(0,0,0)', filter: 'brightness(1.05) contrast(1.1) saturate(1.1)' }}
              loading="lazy"
              decoding="async"
            />
            <div className="absolute inset-0 bg-linear-to-t from-altivum-dark/80 via-altivum-dark/40 to-transparent"></div>
          </div>

          {/* Summary Tabs — 4 on left, 4 on right (desktop); stacked (mobile) */}
          <div className="absolute inset-0 flex items-center pointer-events-none">
            <div className="w-full max-w-xl md:max-w-none px-4 sm:px-6 lg:px-12 grid grid-cols-1 md:grid-cols-2 gap-x-8 lg:gap-x-16">
              <div className="space-y-3 sm:space-y-4 md:space-y-5">
                {keyPoints.slice(0, 4).map((point, i) => renderTab(point, i))}
              </div>
              <div className="space-y-3 sm:space-y-4 md:space-y-5 mt-3 sm:mt-4 md:mt-0">
                {keyPoints.slice(4).map((point, i) => renderTab(point, i + 4, true))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social proof (renders only once real testimonials exist) */}
      <Testimonials />

      {/* CTA Section */}
      <section className="bg-linear-to-br from-altivum-navy to-altivum-blue py-16 sm:py-24 md:py-32 lg:py-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-white mb-4 sm:mb-6" style={typography.sectionHeader}>
            Let's Connect
          </h2>
          <p className="text-altivum-silver mb-8 sm:mb-10 max-w-2xl mx-auto" style={typography.subtitle}>
            Field notes on AI, cloud, and leadership — plus the occasional dispatch on what I'm building. Straight to your inbox, no noise.
          </p>

          {/* Primary: owned-audience capture */}
          <div className="mb-10 sm:mb-12">
            <NewsletterForm variant="compact" source="home" />
          </div>

          {/* Secondary: explore the work */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-10">
            <ViewTransitionLink
              to="/podcast"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 sm:py-3 bg-altivum-gold text-altivum-dark font-semibold rounded-md hover:shadow-[0_0_20px_rgba(197,165,114,0.3)] active:scale-[0.98] transition-all duration-300 touch-manipulation min-h-[48px]"
            >
              <span className="material-icons text-xl" aria-hidden="true">podcasts</span>
              Listen to the Podcast
            </ViewTransitionLink>
            <ViewTransitionLink
              to="/beyond-the-assessment"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 sm:py-3 bg-transparent border-2 border-altivum-gold text-altivum-gold font-semibold rounded-md hover:bg-altivum-gold/10 active:scale-[0.98] transition-all duration-300 touch-manipulation min-h-[48px]"
            >
              <span className="material-icons text-xl" aria-hidden="true">menu_book</span>
              Get the Book
            </ViewTransitionLink>
          </div>

          {/* Tertiary: socials, demoted */}
          <div className="flex items-center justify-center gap-6">
            <a
              href={SOCIAL_LINKS.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn"
              className="text-altivum-silver hover:text-altivum-gold transition-colors touch-manipulation"
            >
              <SocialIcon platform="linkedin" className="w-6 h-6" />
            </a>
            <a
              href={SOCIAL_LINKS.instagram}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="text-altivum-silver hover:text-altivum-gold transition-colors touch-manipulation"
            >
              <SocialIcon platform="instagram" className="w-6 h-6" />
            </a>
            <ViewTransitionLink
              to="/links"
              className="text-altivum-silver hover:text-white underline transition-colors touch-manipulation"
              style={typography.smallText}
            >
              All links
            </ViewTransitionLink>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
