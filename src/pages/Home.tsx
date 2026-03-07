import { Link } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { SEO } from '../components/SEO';
// Profile image served from public/ at full quality (no Vite optimization)
const profileImage = '/profile1.jpeg';
import heroImage from '../assets/hero2.png';
import { typography } from '../utils/typography';
import { homeFAQs, buildWebPageSchema } from '../utils/schemas';
import { SOCIAL_LINKS } from '../constants/links';
import SocialIcon from '../components/SocialIcon';

const Home = () => {
  const [scrollProgress, setScrollProgress] = useState(-1);
  const isMobileRef = useRef(window.innerWidth < 768);
  const [, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      isMobileRef.current = window.innerWidth < 768;
      setIsMobile(isMobileRef.current);
    };
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrollPosition = window.scrollY;
          const windowHeight = window.innerHeight;
          const scrollInterval = isMobileRef.current ? 0.5 : 0.8;
          const progress = Math.min(Math.floor((scrollPosition - windowHeight) / (windowHeight * scrollInterval)), 5);
          setScrollProgress(Math.max(-1, progress));
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const keyPoints = [
    { title: "Personal Biography", subtitle: "Christian Perez", link: "/about" },
    { title: "Altivum Inc", subtitle: "Founder & CEO", link: "/altivum" },
    { title: "The Vector Podcast", subtitle: "Host", link: "/podcast" },
    { title: "Beyond the Assessment", subtitle: "Author", link: "/beyond-the-assessment" },
    { title: "Amazon Web Services", subtitle: "AWS Community Builder (AI Engineering)", link: "/aws" }
  ];

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
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden opacity-0 animate-fade-in">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-altivum-dark via-altivum-navy to-altivum-blue opacity-50"></div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 md:py-32">
          <div className="max-w-4xl mx-auto text-center">
            <div className="mb-6 sm:mb-8">
              <img
                src={heroImage}
                alt="Leadership Forged in Service"
                className="w-full max-w-3xl mx-auto"
                fetchPriority="high"
              />
              <h1 className="sr-only">Christian Perez - Leadership Forged in Service</h1>
            </div>
          </div>
        </div>
      </section>

      {/* Sticky Profile Image Section with Scrolling Summary Tabs */}
      <section className="relative h-[525vh] md:h-[600vh]">
        <div className="sticky top-0 h-screen overflow-hidden" style={{ transform: 'translate3d(0,0,0)' }}>
          <div className="absolute inset-0">
            <img
              src={profileImage}
              alt="Christian Perez"
              className="w-full h-full object-cover object-left md:object-center"
              style={{ transform: 'translate3d(0,0,0)' }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-altivum-dark/80 via-altivum-dark/40 to-transparent"></div>
          </div>

          {/* Left-side Summary Tabs */}
          <div className="absolute left-0 top-1/2 transform -translate-y-1/2 px-4 sm:px-6 lg:px-12 space-y-4 sm:space-y-6 md:space-y-8 w-full max-w-xl md:max-w-none">
            {keyPoints.map((point, index) => (
              <div
                key={index}
                style={{ willChange: 'opacity, transform' }}
                className={`transition-all duration-700 ${index <= scrollProgress
                  ? 'opacity-100 transform translate-x-0'
                  : 'opacity-0 transform -translate-x-10'
                  }`}
              >
                {point.link ? (
                  <Link
                    to={point.link}
                    className="block border-l-4 border-altivum-gold pl-4 sm:pl-6 py-3 sm:py-4 md:hover:pl-8 transition-all duration-300 cursor-pointer group active:pl-6 sm:active:pl-8 touch-manipulation"
                  >
                    <h3 className="text-white mb-1 sm:mb-2" style={typography.cardTitleLarge}>
                      {point.title}
                    </h3>
                    <p className="text-altivum-gold italic" style={typography.subtitle}>
                      {point.subtitle}
                    </p>
                  </Link>
                ) : (
                  <div className="border-l-4 border-altivum-gold pl-4 sm:pl-6 py-3 sm:py-4">
                    <h3 className="text-white mb-1 sm:mb-2" style={typography.cardTitleLarge}>
                      {point.title}
                    </h3>
                    <p className="text-altivum-gold italic" style={typography.subtitle}>
                      {point.subtitle}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-br from-altivum-navy to-altivum-blue py-16 sm:py-24 md:py-32 lg:py-[12.5rem]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-white mb-4 sm:mb-6" style={typography.sectionHeader}>
            Let's Connect
          </h2>
          <p className="text-altivum-silver mb-6 sm:mb-8" style={typography.subtitle}>
            I'm always interested in connecting with people working at the intersection of technology, service, and innovation. Let's continue the conversation.
          </p>

          {/* Social Links - Neon Glow Style */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-6 sm:mb-8">
            <a
              href={SOCIAL_LINKS.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto flex items-center justify-center gap-3 px-6 py-3.5 sm:py-3 bg-transparent border-2 border-altivum-gold text-altivum-gold font-semibold rounded-md hover:shadow-[0_0_20px_rgba(197,165,114,0.6)] hover:bg-altivum-gold/10 active:bg-altivum-gold/20 transition-all duration-300 touch-manipulation min-h-[48px]"
            >
              <SocialIcon platform="linkedin" className="w-5 h-5 flex-shrink-0" />
              LinkedIn
            </a>
            <a
              href={SOCIAL_LINKS.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto flex items-center justify-center gap-3 px-6 py-3.5 sm:py-3 bg-transparent border-2 border-altivum-gold text-altivum-gold font-semibold rounded-md hover:shadow-[0_0_20px_rgba(197,165,114,0.6)] hover:bg-altivum-gold/10 active:bg-altivum-gold/20 transition-all duration-300 touch-manipulation min-h-[48px]"
            >
              <SocialIcon platform="instagram" className="w-5 h-5 flex-shrink-0" />
              Instagram
            </a>
          </div>

          {/* Link to all socials */}
          <Link
            to="/links"
            className="inline-block text-altivum-silver hover:text-white underline transition-colors touch-manipulation"
            style={typography.bodyText}
          >
            Check out the rest of my socials
          </Link>
        </div>
      </section>
    </div>
  );
};

export default Home;
