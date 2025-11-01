import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import profileImage from '../assets/profile1.jpeg';
import heroImage from '../assets/hero2.png';

const Home = () => {
  const [scrollProgress, setScrollProgress] = useState(-1);

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      const windowHeight = window.innerHeight;
      // Calculate which key points should be visible (-1 to 3, where -1 means none visible)
      // Points are evenly distributed across the 200vh summary section (every 50vh)
      const progress = Math.min(Math.floor((scrollPosition - windowHeight) / (windowHeight * 0.5)), 3);
      setScrollProgress(Math.max(-1, progress));
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const keyPoints = [
    { title: "Founder & CEO", subtitle: "Altivum Inc", link: "/altivum" },
    { title: "Host", subtitle: "The Vector Podcast", link: "/podcast" },
    { title: "Author", subtitle: "Beyond the Assessment", link: null },
    { title: "Former Green Beret", subtitle: "18D", link: null }
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section with fade-in animation */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden opacity-0 animate-fade-in">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-altivum-dark via-altivum-navy to-altivum-blue opacity-50"></div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 py-32">
          <div className="max-w-4xl mx-auto text-center">
            <div className="mb-8">
              <img
                src={heroImage}
                alt="Leadership Forged in Service"
                className="w-full max-w-3xl mx-auto"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Sticky Profile Image Section with Scrolling Summary Tabs */}
      <section className="relative h-[300vh]">
        <div className="sticky top-0 h-screen overflow-hidden">
          <div className="absolute inset-0">
            <img
              src={profileImage}
              alt="Christian Perez"
              className="w-full h-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-altivum-dark/80 via-altivum-dark/40 to-transparent"></div>
          </div>

          {/* Left-side Summary Tabs */}
          <div className="absolute left-0 top-1/2 transform -translate-y-1/2 px-6 lg:px-12 space-y-8">
            {keyPoints.map((point, index) => (
              <div
                key={index}
                className={`transition-all duration-700 ${
                  index <= scrollProgress
                    ? 'opacity-100 transform translate-x-0'
                    : 'opacity-0 transform -translate-x-10'
                }`}
              >
                {point.link ? (
                  <Link
                    to={point.link}
                    className="block border-l-4 border-altivum-gold pl-6 py-4 hover:pl-8 transition-all duration-300 cursor-pointer group"
                  >
                    <h3 className="text-2xl md:text-3xl font-serif font-bold text-white mb-2">
                      {point.title}
                    </h3>
                    <p className="text-lg md:text-xl text-altivum-gold font-medium">
                      {point.subtitle}
                    </p>
                  </Link>
                ) : (
                  <div className="border-l-4 border-altivum-gold pl-6 py-4">
                    <h3 className="text-2xl md:text-3xl font-serif font-bold text-white mb-2">
                      {point.title}
                    </h3>
                    <p className="text-lg md:text-xl text-altivum-gold font-medium">
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
      <section className="bg-gradient-to-br from-altivum-navy to-altivum-blue py-[12.5rem]">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-4xl md:text-5xl font-serif font-bold text-white mb-6">
            Let's Connect
          </h2>
          <p className="text-xl text-altivum-silver mb-8">
            I'm always interested in connecting with people working at the intersection of technology, service, and innovation. Let's continue the conversation.
          </p>

          {/* Social Links */}
          <div className="flex items-center justify-center gap-4 mb-6">
            {/* LinkedIn */}
            <a
              href="https://linkedin.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-6 py-3 bg-altivum-gold text-altivum-dark font-semibold rounded-md hover:bg-altivum-gold/90 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
              LinkedIn
            </a>

            {/* Instagram */}
            <a
              href="https://www.instagram.com/thechrisgrey/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-6 py-3 bg-altivum-gold text-altivum-dark font-semibold rounded-md hover:bg-altivum-gold/90 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z"/>
              </svg>
              Instagram
            </a>
          </div>

          {/* Link to all socials */}
          <Link
            to="/links"
            className="inline-block text-sm text-altivum-silver hover:text-white underline transition-colors"
          >
            Check out the rest of my socials
          </Link>
        </div>
      </section>
    </div>
  );
};

export default Home;
