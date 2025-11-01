const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-altivum-navy border-t border-altivum-slate/30">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Brand */}
          <div>
            <h3 className="text-lg font-display font-bold text-white mb-2">
              Christian Perez
            </h3>
            <p className="text-altivum-silver text-sm leading-relaxed">
              Founder & CEO of Altivum Inc., Former Green Beret, Bronze Star Recipient,
              Host of The Vector Podcast, Author of Beyond the Assessment
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-2">
              Quick Links
            </h4>
            <ul className="space-y-2">
              <li>
                <a href="/about" className="text-altivum-silver hover:text-altivum-gold transition-colors">
                  About
                </a>
              </li>
              <li>
                <a href="/altivum" className="text-altivum-silver hover:text-altivum-gold transition-colors">
                  Altivum Inc.
                </a>
              </li>
              <li>
                <a href="/podcast" className="text-altivum-silver hover:text-altivum-gold transition-colors">
                  The Vector Podcast
                </a>
              </li>
              <li>
                <a href="/blog" className="text-altivum-silver hover:text-altivum-gold transition-colors">
                  Blog
                </a>
              </li>
            </ul>
          </div>

          {/* Connect */}
          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-2">
              Connect
            </h4>
            <ul className="space-y-2">
              <li>
                <a href="/contact" className="text-altivum-silver hover:text-altivum-gold transition-colors">
                  Get in Touch
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/AltivumInc-Admin"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-altivum-silver hover:text-altivum-gold transition-colors"
                >
                  GitHub
                </a>
              </li>
              <li>
                <a
                  href="https://linkedin.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-altivum-silver hover:text-altivum-gold transition-colors"
                >
                  LinkedIn
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-altivum-slate/30">
          <p className="text-center text-altivum-silver text-sm">
            &copy; {currentYear} Christian Perez. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
