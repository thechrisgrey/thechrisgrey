import { typography } from '../utils/typography';
import { SEO } from '../components/SEO';
import tvpLogo from '../assets/tvp.png';

const Podcast = () => {
  const episodes = [
    {
      number: 1,
      title: 'Leadership in Crisis',
      description: 'Exploring how military leadership principles apply to business challenges and crisis management.',
      duration: '45 min',
      date: 'Coming Soon',
    },
    {
      number: 2,
      title: 'The Future of Cloud Technology',
      description: 'A deep dive into cloud migration strategies and the role of AI in modern infrastructure.',
      duration: '52 min',
      date: 'Coming Soon',
    },
    {
      number: 3,
      title: 'Veteran Entrepreneurship',
      description: 'Success stories and challenges of veterans transitioning into the business world.',
      duration: '48 min',
      date: 'Coming Soon',
    },
  ];

  return (
    <div className="min-h-screen">
      <SEO
        title="The Vector Podcast"
        description="The Vector Podcast, hosted by Christian Perez, explores the intersection of technology, business, and military leadership. Conversations on AI, defense, and innovation."
        keywords="The Vector Podcast, Christian Perez podcast, AI podcast, defense technology, veteran entrepreneurship"
        url="https://thechrisgrey.com/podcast"
      />
      {/* Hero Section */}
      {/* Hero Section */}
      <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden opacity-0 animate-fade-in">
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 md:py-32">
          <div className="max-w-4xl mx-auto text-center">
            <div className="mb-6 sm:mb-8">
              <img
                src={tvpLogo}
                alt="The Vector Podcast"
                className="w-full max-w-3xl mx-auto opacity-90"
              />
            </div>
          </div>
        </div>
      </section>

      {/* About the Podcast */}
      {/* About the Podcast */}
      <section className="py-24 bg-altivum-dark">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <div>
                <h2 className="text-white mb-6" style={typography.sectionHeader}>
                  What to Expect
                </h2>
                <div className="h-px w-16 bg-altivum-gold mb-8"></div>

                <p className="text-altivum-silver" style={typography.bodyText}>
                  The Vector Podcast is designed for small business owners, defense professionals, veterans,
                  and anyone interested in leveraging AI to drive innovation and operational excellence.
                </p>
              </div>

              <div className="space-y-8">
                <div className="flex items-start gap-6">
                  <div className="w-12 h-12 flex items-center justify-center text-altivum-gold/50">
                    <span className="material-icons text-3xl">groups</span>
                  </div>
                  <div>
                    <h3 className="text-white mb-2" style={typography.cardTitleSmall}>Diverse Perspectives</h3>
                    <p className="text-altivum-silver text-sm">
                      Guests from military, business, technology, and entrepreneurship backgrounds
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-6">
                  <div className="w-12 h-12 flex items-center justify-center text-altivum-gold/50">
                    <span className="material-icons text-3xl">lightbulb</span>
                  </div>
                  <div>
                    <h3 className="text-white mb-2" style={typography.cardTitleSmall}>Actionable Insights</h3>
                    <p className="text-altivum-silver text-sm">
                      Practical strategies and lessons you can apply immediately
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-6">
                  <div className="w-12 h-12 flex items-center justify-center text-altivum-gold/50">
                    <span className="material-icons text-3xl">chat</span>
                  </div>
                  <div>
                    <h3 className="text-white mb-2" style={typography.cardTitleSmall}>Authentic Conversations</h3>
                    <p className="text-altivum-silver text-sm">
                      Honest discussions about successes, failures, and lessons learned
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-8 rounded-lg border border-white/10 bg-white/5">
              <h3 className="text-white mb-6" style={typography.cardTitleLarge}>
                Topics We Cover
              </h3>
              <ul className="space-y-4">
                <li className="flex items-center text-altivum-silver text-sm">
                  <span className="text-altivum-gold mr-4 text-xs">●</span>
                  AI applications in defense technology
                </li>
                <li className="flex items-center text-altivum-silver text-sm">
                  <span className="text-altivum-gold mr-4 text-xs">●</span>
                  Machine learning for small businesses
                </li>
                <li className="flex items-center text-altivum-silver text-sm">
                  <span className="text-altivum-gold mr-4 text-xs">●</span>
                  Cloud infrastructure and AI integration
                </li>
                <li className="flex items-center text-altivum-silver text-sm">
                  <span className="text-altivum-gold mr-4 text-xs">●</span>
                  Veteran entrepreneurship in tech
                </li>
                <li className="flex items-center text-altivum-silver text-sm">
                  <span className="text-altivum-gold mr-4 text-xs">●</span>
                  Military innovation and commercial application
                </li>
                <li className="flex items-center text-altivum-silver text-sm">
                  <span className="text-altivum-gold mr-4 text-xs">●</span>
                  AI-powered business automation
                </li>
                <li className="flex items-center text-altivum-silver text-sm">
                  <span className="text-altivum-gold mr-4 text-xs">●</span>
                  Defense contracting and technology
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Episodes */}
      {/* Episodes */}
      <section className="py-24 bg-altivum-dark border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-white mb-4" style={typography.sectionHeader}>
              Episodes
            </h2>
            <div className="h-px w-24 bg-altivum-gold mx-auto mb-6"></div>
            <p className="text-altivum-silver" style={typography.bodyText}>
              New episodes coming soon
            </p>
          </div>

          <div className="space-y-6">
            {episodes.map((episode) => (
              <div
                key={episode.number}
                className="p-8 rounded-lg border border-white/10 hover:border-altivum-gold/50 transition-all duration-300 group"
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 flex items-center justify-center flex-shrink-0 border border-white/10 rounded-full">
                      <span className="text-xl font-light text-altivum-gold">
                        #{episode.number}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-white group-hover:text-altivum-gold transition-colors" style={typography.cardTitleLarge}>
                        {episode.title}
                      </h3>
                      <div className="flex items-center gap-6 mt-2 text-xs text-altivum-silver/60 uppercase tracking-wider">
                        <span className="flex items-center">
                          <span className="material-icons text-sm mr-2">schedule</span>
                          {episode.duration}
                        </span>
                        <span className="flex items-center">
                          <span className="material-icons text-sm mr-2">event</span>
                          {episode.date}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-altivum-silver pl-22 md:pl-22" style={typography.bodyText}>
                  {episode.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Subscribe Section */}
      {/* Subscribe Section */}
      <section className="py-24 bg-altivum-dark border-t border-white/5">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-white mb-6" style={typography.sectionHeader}>
            Stay Updated
          </h2>
          <p className="text-altivum-silver mb-10" style={typography.bodyText}>
            Be the first to know when new episodes are released. Subscribe to get notified
            about upcoming guests and episode topics.
          </p>
          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <a
              href="#"
              className="inline-flex items-center justify-center px-10 py-4 bg-white text-altivum-dark font-medium hover:bg-altivum-gold transition-all duration-200"
            >
              <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
              </svg>
              Spotify
            </a>
            <a
              href="#"
              className="inline-flex items-center justify-center px-10 py-4 bg-transparent border border-white/20 text-white font-medium hover:border-altivum-gold hover:text-altivum-gold transition-all duration-200"
            >
              <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 22C6.486 22 2 17.514 2 12S6.486 2 12 2s10 4.486 10 10-4.486 10-10 10zm-1-16.5v9l7-4.5-7-4.5z" />
              </svg>
              Apple Podcasts
            </a>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Podcast;
