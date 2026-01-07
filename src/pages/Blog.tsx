import { useState, useEffect, FormEvent } from 'react';
import { PortableText, PortableTextBlock } from '@portabletext/react';
import { SEO } from '../components/SEO';
import { typography } from '../utils/typography';
import { blogFAQs } from '../utils/schemas';
import {
  client,
  urlFor,
  portableTextComponents,
  POSTS_QUERY,
  type SanityPostPreview
} from '../sanity';

const Blog = () => {
  const [posts, setPosts] = useState<SanityPostPreview[]>([]);
  const [selectedPost, setSelectedPost] = useState<SanityPostPreview | null>(null);
  const [fullPost, setFullPost] = useState<{
    body?: PortableTextBlock[];
    pdfUrl?: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingPost, setIsLoadingPost] = useState(false);
  const [subscribeEmail, setSubscribeEmail] = useState('');
  const [subscribeStatus, setSubscribeStatus] = useState<{
    type: 'idle' | 'loading' | 'success' | 'error';
    message: string;
  }>({ type: 'idle', message: '' });
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  // Fetch all posts on mount
  useEffect(() => {
    async function fetchPosts() {
      try {
        const data = await client.fetch<SanityPostPreview[]>(POSTS_QUERY);
        setPosts(data);
      } catch (error) {
        console.error('Error fetching posts:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchPosts();
  }, []);

  // Fetch full post content when modal opens
  const handlePostClick = async (post: SanityPostPreview) => {
    setSelectedPost(post);
    setIsLoadingPost(true);

    try {
      const fullPostData = await client.fetch<{ body?: PortableTextBlock[]; pdfUrl?: string }>(
        `*[_type == "post" && _id == $id][0]{ body, pdfUrl }`,
        { id: post._id }
      );
      setFullPost(fullPostData);
    } catch (error) {
      console.error('Error fetching post content:', error);
    } finally {
      setIsLoadingPost(false);
    }
  };

  const handleCloseModal = () => {
    setSelectedPost(null);
    setFullPost(null);
  };

  const handleSubscribe = async (e: FormEvent) => {
    e.preventDefault();

    if (!emailRegex.test(subscribeEmail.trim())) {
      setSubscribeStatus({ type: 'error', message: 'Please enter a valid email address' });
      return;
    }

    setSubscribeStatus({ type: 'loading', message: 'Subscribing...' });

    try {
      const response = await fetch('https://sf5bejshafrb6t7zbbfw5knu7a0axlyp.lambda-url.us-east-2.on.aws/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: subscribeEmail.trim()
        })
      });

      const result = await response.json();

      if (response.ok) {
        setSubscribeEmail('');
        setSubscribeStatus({ type: 'idle', message: '' });
        setShowSuccessModal(true);
      } else if (response.status === 429) {
        setSubscribeStatus({
          type: 'error',
          message: 'Too many subscription attempts. Please try again later.'
        });
      } else {
        setSubscribeStatus({
          type: 'error',
          message: result.error || 'Failed to subscribe. Please try again.'
        });
      }
    } catch (error) {
      console.error('Error:', error);
      setSubscribeStatus({
        type: 'error',
        message: 'Network error. Please check your connection and try again.'
      });
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

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
      <section className="py-24 bg-altivum-dark">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-altivum-silver">Loading posts...</div>
            </div>
          ) : posts.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-altivum-silver">No posts yet. Check back soon!</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              {posts.map((post) => (
                <article
                  key={post._id}
                  className="group cursor-pointer"
                  onClick={() => handlePostClick(post)}
                >
                  <div className="relative overflow-hidden rounded-lg mb-6 aspect-video">
                    <div className="absolute inset-0 bg-altivum-navy/20 group-hover:bg-transparent transition-colors duration-300 z-10"></div>
                    {post.image?.asset ? (
                      <img
                        src={urlFor(post.image).width(600).height(340).url()}
                        alt={post.image.alt || post.title}
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
                    <div className="inline-flex items-center text-altivum-gold text-sm font-medium mt-2 group-hover:translate-x-2 transition-transform">
                      Read Article <span className="material-icons text-sm ml-1">arrow_forward</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Newsletter Section */}
      <section className="py-32 bg-gradient-to-b from-altivum-dark via-altivum-navy to-altivum-dark border-t border-white/5">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <div className="mb-8">
            <div className="inline-block px-4 py-1 bg-altivum-gold/10 border border-altivum-gold/20 rounded-full mb-6">
              <span className="text-altivum-gold text-xs uppercase tracking-widest font-medium">Newsletter</span>
            </div>
            <h2 className="text-white mb-6" style={typography.sectionHeader}>
              Stay Informed
            </h2>
            <p className="text-altivum-silver mb-12 max-w-2xl mx-auto" style={typography.bodyText}>
              Subscribe to receive new articles directly to your inbox. No spam, just valuable
              insights on leadership, technology, and growth.
            </p>
          </div>

          <form className="flex flex-col sm:flex-row gap-4 max-w-2xl mx-auto mb-8" onSubmit={handleSubscribe}>
            <div className="flex-1 relative group">
              <input
                type="email"
                placeholder="Enter your email address"
                value={subscribeEmail}
                onChange={(e) => {
                  setSubscribeEmail(e.target.value);
                  if (subscribeStatus.type === 'error') {
                    setSubscribeStatus({ type: 'idle', message: '' });
                  }
                }}
                required
                disabled={subscribeStatus.type === 'loading'}
                className="w-full px-6 py-5 bg-white/5 border-2 border-white/10 text-white placeholder-altivum-silver/50 focus:outline-none focus:border-altivum-gold focus:bg-white/10 transition-all duration-300 rounded-sm disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            <button
              type="submit"
              disabled={subscribeStatus.type === 'loading'}
              className={`group relative px-10 py-5 font-medium uppercase tracking-wider text-sm overflow-hidden transition-all duration-300 whitespace-nowrap ${
                subscribeStatus.type === 'loading'
                  ? 'bg-altivum-slate/50 text-altivum-silver cursor-not-allowed'
                  : 'bg-altivum-gold text-altivum-dark hover:bg-white hover:shadow-[0_0_30px_rgba(197,165,114,0.3)]'
              }`}
            >
              <span className="relative z-10">
                {subscribeStatus.type === 'loading' ? 'Subscribing...' : 'Subscribe'}
              </span>
              {subscribeStatus.type !== 'loading' && (
                <span className="absolute inset-0 bg-white transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></span>
              )}
            </button>
          </form>

          {/* Status Message */}
          {subscribeStatus.message && (
            <div
              className={`mt-8 p-5 rounded-sm backdrop-blur-sm max-w-2xl mx-auto transition-all duration-300 ${
                subscribeStatus.type === 'success'
                  ? 'bg-green-900/30 border-l-4 border-green-500 text-green-300'
                  : subscribeStatus.type === 'error'
                  ? 'bg-red-900/30 border-l-4 border-red-500 text-red-300'
                  : 'bg-altivum-blue/30 border-l-4 border-altivum-gold text-altivum-gold'
              }`}
              role="alert"
            >
              {subscribeStatus.message}
            </div>
          )}

          <p className="text-xs text-altivum-silver/50 mt-8 uppercase tracking-wider">
            We respect your privacy. Unsubscribe at any time.
          </p>
        </div>
      </section>

      {/* Blog Post Modal */}
      {selectedPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
            onClick={handleCloseModal}
          ></div>
          <div className="relative w-full max-w-4xl max-h-[90vh] bg-altivum-dark border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-fade-in">

            {/* Modal Header Image */}
            <div className="relative h-64 sm:h-80 flex-shrink-0">
              {selectedPost.image?.asset ? (
                <img
                  src={urlFor(selectedPost.image).width(900).height(400).url()}
                  alt={selectedPost.image.alt || selectedPost.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-altivum-navy flex items-center justify-center">
                  <span className="material-icons text-6xl text-altivum-slate">article</span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-altivum-dark via-altivum-dark/50 to-transparent"></div>
              <button
                onClick={handleCloseModal}
                className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-altivum-gold text-white rounded-full transition-colors backdrop-blur-md"
              >
                <span className="material-icons">close</span>
              </button>

              <div className="absolute bottom-0 left-0 p-8 w-full">
                <div className="flex items-center gap-4 text-xs text-altivum-gold uppercase tracking-wider font-medium mb-3">
                  <span>{selectedPost.category}</span>
                  <span>-</span>
                  <span>{formatDate(selectedPost.publishedAt)}</span>
                  {selectedPost.readingTime && (
                    <>
                      <span>-</span>
                      <span>{selectedPost.readingTime} min read</span>
                    </>
                  )}
                </div>
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-2 font-display">
                  {selectedPost.title}
                </h2>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              {isLoadingPost ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-altivum-silver">Loading content...</div>
                </div>
              ) : fullPost?.body ? (
                <div className="prose prose-invert prose-lg max-w-none">
                  <PortableText
                    value={fullPost.body}
                    components={portableTextComponents}
                  />
                </div>
              ) : (
                <p className="text-altivum-silver">{selectedPost.excerpt}</p>
              )}

              {/* Download PDF Option */}
              {fullPost?.pdfUrl && (
                <div className="mt-12 pt-8 border-t border-white/10">
                  <div className="bg-white/5 rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-6 border border-white/5 hover:border-altivum-gold/30 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-altivum-gold/10 rounded-lg flex items-center justify-center text-altivum-gold">
                        <span className="material-icons text-3xl">picture_as_pdf</span>
                      </div>
                      <div>
                        <h4 className="text-white font-medium text-lg">Download Article PDF</h4>
                        <p className="text-altivum-silver text-sm">Read the full article offline</p>
                      </div>
                    </div>
                    <a
                      href={fullPost.pdfUrl}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-6 py-3 bg-altivum-gold text-altivum-dark font-semibold rounded-lg hover:bg-white transition-colors flex items-center gap-2 whitespace-nowrap"
                    >
                      Download PDF
                      <span className="material-icons text-sm">download</span>
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowSuccessModal(false)}
          ></div>
          <div className="relative bg-gradient-to-br from-altivum-navy to-altivum-blue max-w-md w-full p-8 border-2 border-altivum-gold/30 shadow-[0_0_60px_rgba(197,165,114,0.2)]">
            <button
              onClick={() => setShowSuccessModal(false)}
              className="absolute top-4 right-4 text-altivum-silver hover:text-white transition-colors"
              aria-label="Close"
            >
              <span className="material-icons text-2xl">close</span>
            </button>

            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-altivum-gold/10 border-2 border-altivum-gold mb-6">
                <span className="material-icons text-altivum-gold text-4xl">mark_email_read</span>
              </div>

              <h3 className="text-white mb-4" style={typography.cardTitleLarge}>
                Thank You for Subscribing!
              </h3>

              <p className="text-altivum-silver mb-8" style={typography.bodyText}>
                Check your email for a confirmation message. Be sure to check your spam folder and move it to your primary inbox if needed.
              </p>

              <button
                onClick={() => setShowSuccessModal(false)}
                className="px-8 py-3 bg-altivum-gold text-altivum-dark font-medium uppercase tracking-wider text-sm hover:bg-white transition-colors duration-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Blog;
