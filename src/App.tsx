import { lazy, Suspense } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Navigation from './components/Navigation';
import Footer from './components/Footer';
import ScrollToTop from './components/ScrollToTop';
import ErrorBoundary from './components/ErrorBoundary';
import { BlogErrorFallback } from './components/ErrorFallbacks';
import ChatWidget from './components/chat/ChatWidget';

// Static import — critical first-load path
import Home from './pages/Home';

// Lazy-loaded page chunks
const About = lazy(() => import('./pages/About'));
const Altivum = lazy(() => import('./pages/Altivum'));
const Podcast = lazy(() => import('./pages/Podcast'));
const BeyondTheAssessment = lazy(() => import('./pages/BeyondTheAssessment'));
const Blog = lazy(() => import('./pages/Blog'));
const BlogPost = lazy(() => import('./pages/BlogPost'));
const Links = lazy(() => import('./pages/Links'));
const Contact = lazy(() => import('./pages/Contact'));
const Chat = lazy(() => import('./pages/Chat'));
const Privacy = lazy(() => import('./pages/Privacy'));
const NotFound = lazy(() => import('./pages/NotFound'));

const PageLoadingFallback = () => (
  <div className="min-h-screen bg-altivum-dark flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-altivum-gold/30 border-t-altivum-gold rounded-full animate-spin" />
  </div>
);

function App() {
  const location = useLocation();
  const isFullscreenPage = location.pathname === '/chat';

  return (
    <div className="min-h-screen bg-altivum-dark">
      <ScrollToTop />
      <Navigation />
      <main id="main-content">
        <ErrorBoundary>
          <Suspense fallback={<PageLoadingFallback />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/about" element={<About />} />
              <Route path="/altivum" element={<Altivum />} />
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
              <Route path="/privacy" element={<Privacy />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>
      {!isFullscreenPage && <Footer />}
      {!isFullscreenPage && <ChatWidget />}
    </div>
  );
}

export default App;
