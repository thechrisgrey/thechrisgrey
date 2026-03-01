import { Link } from 'react-router-dom';
import { SEO } from '../components/SEO';
import { typography } from '../utils/typography';

const NotFound = () => {
  return (
    <div className="min-h-screen pt-20 flex items-center justify-center bg-altivum-dark">
      <SEO
        title="Page Not Found"
        description="The page you're looking for doesn't exist."
        url="https://thechrisgrey.com/404"
        noindex={true}
      />

      <div className="max-w-2xl mx-auto px-6 text-center">
        {/* 404 Number */}
        <div className="mb-8">
          <span
            className="text-altivum-gold opacity-20"
            style={{
              fontSize: 'clamp(120px, 25vw, 200px)',
              fontWeight: 200,
              lineHeight: 1,
              fontFamily: typography.heroHeader.fontFamily
            }}
          >
            404
          </span>
        </div>

        {/* Message */}
        <h1 className="text-white mb-4" style={typography.sectionHeader}>
          Page Not Found
        </h1>
        <p className="text-altivum-silver mb-12" style={typography.bodyText}>
          Looks like this page went off the grid. Let's get you back on track.
        </p>

        {/* Navigation Links */}
        <div className="flex flex-wrap justify-center gap-4 mb-12">
          <Link
            to="/"
            className="px-6 py-3 bg-altivum-gold text-altivum-dark font-medium rounded-lg hover:bg-altivum-gold/90 transition-colors"
            style={typography.bodyText}
          >
            Go Home
          </Link>
          <Link
            to="/blog"
            className="px-6 py-3 border border-altivum-gold text-altivum-gold rounded-lg hover:bg-altivum-gold/10 transition-colors"
            style={typography.bodyText}
          >
            Read the Blog
          </Link>
          <Link
            to="/contact"
            className="px-6 py-3 border border-white/20 text-white rounded-lg hover:bg-white/5 transition-colors"
            style={typography.bodyText}
          >
            Get in Touch
          </Link>
        </div>

        {/* Quick Links */}
        <div className="pt-8 border-t border-white/10">
          <p className="text-altivum-silver mb-4" style={typography.smallText}>
            Or check out these pages:
          </p>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            <Link to="/about" className="text-altivum-silver hover:text-altivum-gold transition-colors" style={typography.smallText}>
              About
            </Link>
            <Link to="/altivum" className="text-altivum-silver hover:text-altivum-gold transition-colors" style={typography.smallText}>
              Altivum Inc.
            </Link>
            <Link to="/podcast" className="text-altivum-silver hover:text-altivum-gold transition-colors" style={typography.smallText}>
              Podcast
            </Link>
            <Link to="/beyond-the-assessment" className="text-altivum-silver hover:text-altivum-gold transition-colors" style={typography.smallText}>
              Book
            </Link>
            <Link to="/chat" className="text-altivum-silver hover:text-altivum-gold transition-colors" style={typography.smallText}>
              AI Chat
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
