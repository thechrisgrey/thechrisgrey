import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { SEO } from '../components/SEO';
import NewsletterForm from '../components/NewsletterForm';
import { typography } from '../utils/typography';
import { formatDate } from '../utils/dateFormatter';
import { blogFAQs } from '../utils/schemas';
import {
  client,
  urlFor,
  POSTS_QUERY,
  type SanityPostPreview
} from '../sanity';

const Blog = () => {
  const [posts, setPosts] = useState<SanityPostPreview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  // Read filter values from URL
  const activeCategory = searchParams.get('category') || 'All';
  const activeTag = searchParams.get('tag') || null;
  const searchQuery = searchParams.get('q') || '';

  const fetchPosts = async () => {
    setIsLoading(true);
    setFetchError(false);
    try {
      const data = await client.fetch<SanityPostPreview[]>(POSTS_QUERY);
      setPosts(data);
    } catch (error) {
      console.error('Error fetching posts:', error);
      setFetchError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  // Filter helper function
  const setCategory = (category: string) => {
    const params = new URLSearchParams(searchParams);
    if (category === 'All') {
      params.delete('category');
    } else {
      params.set('category', category);
    }
    // Clear tag when changing category for cleaner UX
    params.delete('tag');
    setSearchParams(params);
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchParams({});
  };

  // Client-side filtering logic
  const filteredPosts = useMemo(() => {
    return posts.filter(post => {
      // Category filter
      if (activeCategory !== 'All' && post.category !== activeCategory) {
        return false;
      }

      // Tag filter
      if (activeTag && !post.tags?.some(tag => tag.slug.current === activeTag)) {
        return false;
      }

      // Search filter (title + excerpt)
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = post.title.toLowerCase().includes(query);
        const matchesExcerpt = post.excerpt.toLowerCase().includes(query);
        if (!matchesTitle && !matchesExcerpt) {
          return false;
        }
      }

      return true;
    });
  }, [posts, activeCategory, activeTag, searchQuery]);

  const categories = ['All', 'Technology', 'Leadership', 'Veterans', 'Business'];

  return (
    <div className="min-h-screen bg-altivum-dark">
      <SEO
        title="Blog"
        description="Essays and long-form writing from Christian Perez on leadership, technology, philosophy, history, and lessons from a life of service."
        keywords="Christian Perez blog, essays, leadership, technology, philosophy, history, veteran, long-form writing"
        url="https://thechrisgrey.com/blog"
        type="article"
        faq={blogFAQs}
        breadcrumbs={[
          { name: "Home", url: "https://thechrisgrey.com" },
          { name: "Blog", url: "https://thechrisgrey.com/blog" }
        ]}
        structuredData={[
          {
            "@type": "Blog",
            "@id": "https://thechrisgrey.com/blog/#blog",
            "name": "Christian Perez Blog",
            "url": "https://thechrisgrey.com/blog",
            "description": "Essays and long-form writing on leadership, technology, philosophy, history, and lessons from a life of service",
            "inLanguage": "en-US",
            "author": {
              "@id": "https://thechrisgrey.com/#person"
            },
            "publisher": {
              "@id": "https://altivum.ai/#organization"
            }
          }
        ]}
      />

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
              Essays & Reflections
            </h1>
            <div className="h-px w-24 bg-altivum-gold mb-8"></div>

            <p className="text-altivum-silver" style={typography.subtitle}>
              Long-form writing on leadership, technology, philosophy, history, and lessons
              from a life of service.
            </p>
          </div>
        </div>
      </section>

      {/* Search and Categories */}
      <section className="py-8 bg-altivum-dark border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            {/* Search Input */}
            <div className="relative w-full md:max-w-xs">
              <input
                type="text"
                placeholder="Search articles..."
                value={searchQuery}
                onChange={(e) => {
                  const params = new URLSearchParams(searchParams);
                  if (e.target.value) {
                    params.set('q', e.target.value);
                  } else {
                    params.delete('q');
                  }
                  setSearchParams(params, { replace: true });
                }}
                className="w-full px-4 py-2 pl-10 bg-white/5 border border-white/10 rounded-full text-white placeholder-white/70 focus:outline-none focus:border-altivum-gold transition-colors"
              />
              <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-altivum-silver/50 text-lg">
                search
              </span>
              {searchQuery && (
                <button
                  onClick={() => {
                    const params = new URLSearchParams(searchParams);
                    params.delete('q');
                    setSearchParams(params, { replace: true });
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-altivum-silver/50 hover:text-white transition-colors"
                  aria-label="Clear search"
                >
                  <span className="material-icons text-lg" aria-hidden="true">close</span>
                </button>
              )}
            </div>

            {/* Category Buttons */}
            <div className="flex flex-wrap gap-3">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setCategory(category)}
                  className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                    activeCategory === category
                      ? 'bg-white text-altivum-dark'
                      : 'bg-transparent text-altivum-silver border border-white/10 hover:border-altivum-gold hover:text-altivum-gold'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Blog Posts */}
      <section className="py-24 bg-altivum-dark">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          {/* Active Filters Display */}
          {(activeCategory !== 'All' || activeTag || searchQuery) && (
            <div className="flex flex-wrap items-center gap-2 mb-8">
              <span className="text-altivum-silver text-sm">Active filters:</span>

              {activeCategory !== 'All' && (
                <button
                  onClick={() => setCategory('All')}
                  className="flex items-center gap-1 px-3 py-1 bg-altivum-gold/20 text-altivum-gold rounded-full text-sm hover:bg-altivum-gold/30 transition-colors"
                >
                  {activeCategory}
                  <span className="material-icons text-xs">close</span>
                </button>
              )}

              {activeTag && (
                <button
                  onClick={() => {
                    const params = new URLSearchParams(searchParams);
                    params.delete('tag');
                    setSearchParams(params);
                  }}
                  className="flex items-center gap-1 px-3 py-1 bg-altivum-gold/20 text-altivum-gold rounded-full text-sm hover:bg-altivum-gold/30 transition-colors"
                >
                  #{activeTag}
                  <span className="material-icons text-xs">close</span>
                </button>
              )}

              {searchQuery && (
                <button
                  onClick={() => {
                    const params = new URLSearchParams(searchParams);
                    params.delete('q');
                    setSearchParams(params);
                  }}
                  className="flex items-center gap-1 px-3 py-1 bg-altivum-gold/20 text-altivum-gold rounded-full text-sm hover:bg-altivum-gold/30 transition-colors"
                >
                  "{searchQuery}"
                  <span className="material-icons text-xs">close</span>
                </button>
              )}

              <button
                onClick={clearFilters}
                className="text-altivum-silver/70 text-sm hover:text-white underline ml-2"
              >
                Clear all
              </button>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-altivum-silver">Loading posts...</div>
            </div>
          ) : fetchError ? (
            <div className="text-center py-20">
              <span className="material-icons text-5xl text-altivum-slate mb-4 block">cloud_off</span>
              <p className="text-white mb-2" style={typography.cardTitleSmall}>
                Unable to load posts
              </p>
              <p className="text-altivum-silver mb-6" style={typography.bodyText}>
                Something went wrong while loading blog posts. Please try again.
              </p>
              <button
                onClick={fetchPosts}
                className="inline-flex items-center px-6 py-3 bg-altivum-gold text-altivum-dark font-medium uppercase tracking-wider text-sm hover:bg-white transition-colors duration-300"
              >
                <span className="material-icons mr-2 text-sm">refresh</span>
                Try Again
              </button>
            </div>
          ) : posts.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-altivum-silver">No posts yet. Check back soon!</div>
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="text-center py-20">
              <span className="material-icons text-5xl text-altivum-slate mb-4 block">search_off</span>
              <p className="text-altivum-silver mb-4">No posts match your filters.</p>
              <button
                onClick={clearFilters}
                className="text-altivum-gold hover:underline"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              {filteredPosts.map((post) => (
                <article key={post._id} className="group">
                  <Link to={`/blog/${post.slug.current}`} className="block">
                    <div className="relative overflow-hidden rounded-lg mb-6 aspect-video">
                      <div className="absolute inset-0 bg-altivum-navy/20 group-hover:bg-transparent transition-colors duration-300 z-10"></div>
                      {post.image?.asset ? (
                        <img
                          src={urlFor(post.image).width(600).height(340).auto('format').quality(80).url()}
                          alt={post.image.alt || post.title}
                          loading="lazy"
                          className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full bg-altivum-navy flex items-center justify-center">
                          <span className="material-icons text-4xl text-altivum-slate">article</span>
                        </div>
                      )}
                      {post.isFeatured && (
                        <div className="absolute top-4 left-4 z-20 px-3 py-1 bg-altivum-gold text-altivum-dark text-xs font-semibold uppercase tracking-wider rounded">
                          Featured
                        </div>
                      )}
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-4 text-xs text-altivum-gold uppercase tracking-wider font-medium">
                        <span>{post.category}</span>
                        <span>-</span>
                        <span>{formatDate(post.publishedAt)}</span>
                        {post.readingTime && (
                          <>
                            <span>-</span>
                            <span>{post.readingTime} min read</span>
                          </>
                        )}
                      </div>
                      <h3 className="text-white group-hover:text-altivum-gold transition-colors" style={typography.cardTitleLarge}>
                        {post.title}
                      </h3>
                      <p className="text-altivum-silver line-clamp-3" style={typography.bodyText}>
                        {post.excerpt}
                      </p>
                    </div>
                  </Link>
                  {/* Tags */}
                  {post.tags && post.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-4">
                      {post.tags.slice(0, 3).map(tag => (
                        <Link
                          key={tag._id}
                          to={`/blog?tag=${tag.slug.current}`}
                          className="px-2 py-1 text-xs bg-altivum-gold/10 text-altivum-gold rounded hover:bg-altivum-gold/20 transition-colors"
                        >
                          {tag.title}
                        </Link>
                      ))}
                    </div>
                  )}
                  <Link
                    to={`/blog/${post.slug.current}`}
                    className="inline-flex items-center text-altivum-gold text-sm font-medium mt-3 group-hover:translate-x-2 transition-transform"
                  >
                    Read Article <span className="material-icons text-sm ml-1">arrow_forward</span>
                  </Link>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <NewsletterForm variant="full" />
    </div>
  );
};

export default Blog;
