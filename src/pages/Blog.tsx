import { SEO } from '../components/SEO';
import { typography } from '../utils/typography';

const Blog = () => {
  const posts = [
    {
      id: 1,
      title: 'The Parallels Between Special Operations and Cloud Architecture',
      excerpt: 'Exploring how military planning principles inform robust, scalable cloud infrastructure design.',
      date: 'Coming Soon',
      category: 'Technology',
      readTime: '8 min read',
    },
    {
      id: 2,
      title: 'Veteran Transition: Beyond the Resume',
      excerpt: 'Why traditional career advice often misses the mark for transitioning service members, and what actually works.',
      date: 'Coming Soon',
      category: 'Leadership',
      readTime: '6 min read',
    },
    {
      id: 3,
      title: 'AI Integration for Small Businesses: A Practical Guide',
      excerpt: 'Demystifying artificial intelligence and providing actionable steps for small business owners.',
      date: 'Coming Soon',
      category: 'Technology',
      readTime: '10 min read',
    },
    {
      id: 4,
      title: 'Building High-Performance Teams in the Tech Sector',
      excerpt: 'Lessons from Special Forces on creating cohesive, mission-focused technology teams.',
      date: 'Coming Soon',
      category: 'Leadership',
      readTime: '7 min read',
    },
  ];

  const categories = ['All', 'Technology', 'Leadership', 'Veterans', 'Business'];

  return (
    <div className="min-h-screen pt-20">
      <SEO
        title="Blog & Insights"
        description="Insights from Christian Perez on cloud architecture, AI integration, military leadership, and entrepreneurship."
        keywords="Christian Perez blog, Altivum insights, cloud architecture blog, AI technology articles, leadership thoughts"
        url="https://thechrisgrey.com/blog"
        type="article"
      />
      {/* Hero Section */}
      {/* Hero Section */}
      <section className="py-32 bg-altivum-dark">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="max-w-4xl">
            <div className="inline-block px-4 py-2 bg-altivum-gold/10 rounded-md mb-6">
              <span className="text-altivum-gold font-semibold text-sm uppercase tracking-wider">
                Blog
              </span>
            </div>

            <h1 className="text-white mb-6" style={typography.heroHeader}>
              Insights & Perspectives
            </h1>
            <div className="h-px w-24 bg-altivum-gold mb-8"></div>

            <p className="text-altivum-silver" style={typography.subtitle}>
              Thoughts on leadership, technology, veteran transition, and building organizations
              that make a difference.
            </p>
          </div>
        </div>
      </section>

      {/* Categories */}
      {/* Categories */}
      <section className="py-8 bg-altivum-dark border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex flex-wrap gap-3">
            {categories.map((category) => (
              <button
                key={category}
                className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-200 ${category === 'All'
                  ? 'bg-white text-altivum-dark'
                  : 'bg-transparent text-altivum-silver border border-white/10 hover:border-altivum-gold hover:text-altivum-gold'
                  }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Blog Posts */}
      {/* Blog Posts */}
      <section className="py-24 bg-altivum-dark">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {posts.map((post) => (
              <article
                key={post.id}
                className="group cursor-pointer"
              >
                {/* Featured Image Placeholder */}
                <div className="h-64 bg-altivum-navy/30 relative overflow-hidden mb-6 transition-opacity duration-300 group-hover:opacity-80">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <svg className="w-12 h-12 text-altivum-silver/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>

                <div>
                  {/* Meta */}
                  <div className="flex items-center gap-4 mb-3 text-xs tracking-wider uppercase text-altivum-silver/60">
                    <span className="text-altivum-gold">
                      {post.category}
                    </span>
                    <span>•</span>
                    <span>
                      {post.readTime}
                    </span>
                  </div>

                  {/* Title */}
                  <h2 className="text-white mb-3 group-hover:text-altivum-gold transition-colors" style={typography.cardTitleLarge}>
                    {post.title}
                  </h2>

                  {/* Excerpt */}
                  <p className="text-altivum-silver mb-4" style={typography.bodyText}>
                    {post.excerpt}
                  </p>

                  {/* Footer */}
                  <div className="flex items-center text-sm text-altivum-silver/60">
                    <span>
                      {post.date}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter Section */}
      {/* Newsletter Section */}
      <section className="py-24 bg-altivum-dark border-t border-white/5">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-white mb-6" style={typography.sectionHeader}>
            Stay Informed
          </h2>
          <p className="text-altivum-silver mb-10" style={typography.bodyText}>
            Subscribe to receive new articles directly to your inbox. No spam, just valuable
            insights on leadership, technology, and growth.
          </p>
          <form className="flex flex-col sm:flex-row gap-4 max-w-xl mx-auto">
            <input
              type="email"
              placeholder="Enter your email"
              className="flex-1 px-6 py-4 bg-transparent border-b border-white/20 text-white placeholder-altivum-silver/50 focus:outline-none focus:border-altivum-gold transition-colors rounded-none"
            />
            <button
              type="submit"
              className="px-8 py-4 bg-white text-altivum-dark font-medium hover:bg-altivum-gold transition-colors duration-200"
            >
              Subscribe
            </button>
          </form>
          <p className="text-xs text-altivum-silver/40 mt-6">
            We respect your privacy. Unsubscribe at any time.
          </p>
        </div>
      </section>
    </div>
  );
};

export default Blog;
