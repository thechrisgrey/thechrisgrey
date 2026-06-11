// src/components/Footer.tsx
import ViewTransitionLink from './ViewTransitionLink';
import NewsletterForm from './NewsletterForm';
import Eyebrow from './editorial/Eyebrow';
import { typography } from '../utils/typography';
import { EDITORIAL_FONT_FAMILY } from '../utils/editorialType';
import { SOCIAL_LINKS } from '../constants/links';

const NAVIGATE = [
  { to: '/about', label: 'About' },
  { to: '/blog', label: 'Blog' },
  { to: '/links', label: 'Links' },
  { to: '/contact', label: 'Contact' },
];

const VENTURES = [
  { to: '/altivum', label: 'Altivum Inc.' },
  { to: '/podcast', label: 'The Vector Podcast' },
  { to: '/beyond-the-assessment', label: 'Beyond the Assessment' },
  { to: '/claude', label: 'Claude' },
];

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer data-vt-persist="footer" className="border-t border-altivum-gold/15 bg-altivum-dark">
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-12">
        {/* Editorial statement — sentence-case reprise of the CTA headline
            (spec §9); the caps displaySection version collided with the
            Home CTA, which renders the same line directly above */}
        <p
          className="max-w-2xl text-altivum-porcelain"
          style={{
            fontFamily: EDITORIAL_FONT_FAMILY,
            fontWeight: 400,
            fontSize: 'clamp(1.875rem, 3.5vw, 3rem)',
            lineHeight: 1.15,
            letterSpacing: '0.01em',
          }}
        >
          Build something{' '}
          <span className="italic text-altivum-gold">worth keeping.</span>
        </p>

        <div className="mt-12 grid grid-cols-2 gap-10 md:grid-cols-3">
          <div>
            <Eyebrow className="text-altivum-porcelain/40">NAVIGATE</Eyebrow>
            <ul className="mt-4 space-y-2">
              {NAVIGATE.map((item) => (
                <li key={item.to}>
                  <ViewTransitionLink
                    to={item.to}
                    className="link-underline text-altivum-silver transition-colors hover:text-altivum-gold"
                    style={typography.smallText}
                  >
                    {item.label}
                  </ViewTransitionLink>
                </li>
              ))}
              <li>
                <a
                  href="/rss.xml"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-underline text-altivum-silver transition-colors hover:text-altivum-gold"
                  style={typography.smallText}
                >
                  RSS Feed
                </a>
              </li>
            </ul>
          </div>

          <div>
            <Eyebrow className="text-altivum-porcelain/40">VENTURES</Eyebrow>
            <ul className="mt-4 space-y-2">
              {VENTURES.map((item) => (
                <li key={item.to}>
                  <ViewTransitionLink
                    to={item.to}
                    className="link-underline text-altivum-silver transition-colors hover:text-altivum-gold"
                    style={typography.smallText}
                  >
                    {item.label}
                  </ViewTransitionLink>
                </li>
              ))}
            </ul>
          </div>

          <div className="col-span-2 md:col-span-1">
            <Eyebrow className="text-altivum-porcelain/40">CONNECT</Eyebrow>
            <ul className="mt-4 space-y-2">
              <li>
                <a
                  href={SOCIAL_LINKS.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-underline text-altivum-silver transition-colors hover:text-altivum-gold"
                  style={typography.smallText}
                >
                  LinkedIn
                </a>
              </li>
              <li>
                <a
                  href={SOCIAL_LINKS.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-underline text-altivum-silver transition-colors hover:text-altivum-gold"
                  style={typography.smallText}
                >
                  GitHub
                </a>
              </li>
            </ul>
            <div id="newsletter" className="mt-6">
              <NewsletterForm variant="compact" />
            </div>
          </div>
        </div>

        <div className="mt-12 h-px bg-gradient-to-r from-transparent via-altivum-gold/15 to-transparent" />
        <p className="mt-6 text-center text-altivum-silver" style={typography.smallText}>
          &copy; {currentYear} Christian Perez. All rights reserved.
          <span className="mx-2">·</span>
          <ViewTransitionLink to="/privacy" className="link-underline text-altivum-silver transition-colors hover:text-altivum-gold">
            Privacy Policy
          </ViewTransitionLink>
        </p>
      </div>
    </footer>
  );
};

export default Footer;
