import { lazy, Suspense, useEffect, useRef } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Navigation from './components/Navigation';
import Footer from './components/Footer';
import ScrollToTop from './components/ScrollToTop';
import ErrorBoundary from './components/ErrorBoundary';
import { BlogErrorFallback } from './components/ErrorFallbacks';
import ChatWidget from './components/chat/ChatWidget';
import ConsentBanner from './components/ConsentBanner';
import { getConsent } from './utils/consent';
import { enablePostHog, capturePostHogPageview } from './utils/posthog';

// Static import — critical first-load path
import Home from './pages/Home';

// Lazy-loaded page chunks
const About = lazy(() => import('./pages/About'));
const Altivum = lazy(() => import('./pages/Altivum'));
const Foundation = lazy(() => import('./pages/Foundation'));
const Podcast = lazy(() => import('./pages/Podcast'));
const BeyondTheAssessment = lazy(() => import('./pages/BeyondTheAssessment'));
const Blog = lazy(() => import('./pages/Blog'));
const BlogPost = lazy(() => import('./pages/BlogPost'));
const Links = lazy(() => import('./pages/Links'));
const Contact = lazy(() => import('./pages/Contact'));
const Chat = lazy(() => import('./pages/Chat'));
const Privacy = lazy(() => import('./pages/Privacy'));
const AWS = lazy(() => import('./pages/AWS'));
const Claude = lazy(() => import('./pages/Claude'));
const Admin = lazy(() => import('./pages/Admin'));
const Blueprint = lazy(() => import('./pages/Blueprint'));
const NotFound = lazy(() => import('./pages/NotFound'));

const PageLoadingFallback = () => (
  <div
    className="min-h-screen bg-altivum-dark flex items-center justify-center"
    role="status"
    aria-label="Loading page"
  >
    <div
      className="w-8 h-8 border-2 border-altivum-gold/30 border-t-altivum-gold rounded-full animate-spin"
      aria-hidden="true"
    />
  </div>
);

function App() {
  const location = useLocation();
  const isFullscreenPage = location.pathname === '/chat' || location.pathname === '/admin';

  // Re-enable PostHog on load for visitors who already consented (no-op if PostHog
  // isn't configured or consent wasn't granted). enablePostHog() captures the entry
  // pageview itself; the effect below captures subsequent SPA navigations.
  useEffect(() => {
    if (getConsent() === 'granted') void enablePostHog();
  }, []);

  // SPA pageview tracking. Skip the first run (the entry pageview is captured by
  // enablePostHog) and capture on each subsequent route change. No-op until/unless
  // PostHog is enabled.
  const isFirstNavigation = useRef(true);
  useEffect(() => {
    if (isFirstNavigation.current) {
      isFirstNavigation.current = false;
      return;
    }
    capturePostHogPageview();
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-altivum-dark">
      <ScrollToTop />
      <Navigation />
      <main id="main-content">
        {/* Keyed by pathname so a render-time throw (e.g. a stale lazy chunk)
            clears on client-side navigation instead of trapping the user until
            a full reload. React remounts a fresh boundary per path. */}
        <ErrorBoundary key={location.pathname}>
          <Suspense fallback={<PageLoadingFallback />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/about" element={<About />} />
              <Route path="/altivum" element={<Altivum />} />
              <Route path="/foundation" element={<Foundation />} />
              <Route path="/podcast" element={<Podcast />} />
              <Route path="/beyond-the-assessment" element={<BeyondTheAssessment />} />
              <Route
                path="/blog"
                element={
                  <ErrorBoundary fallback={<BlogErrorFallback />} pageName="Blog">
                    <Blog />
                  </ErrorBoundary>
                }
              />
              <Route
                path="/blog/:slug"
                element={
                  <ErrorBoundary fallback={<BlogErrorFallback />} pageName="Blog Post">
                    <BlogPost />
                  </ErrorBoundary>
                }
              />
              <Route path="/links" element={<Links />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/aws" element={<AWS />} />
              <Route path="/claude" element={<Claude />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/blueprint" element={<Blueprint />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>
      {!isFullscreenPage && <Footer />}
      {!isFullscreenPage && <ChatWidget />}
      <ConsentBanner />
    </div>
  );
}

export default App;
