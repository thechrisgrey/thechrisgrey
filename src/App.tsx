import { Routes, Route, useLocation } from 'react-router-dom';
import Navigation from './components/Navigation';
import Footer from './components/Footer';
import ScrollToTop from './components/ScrollToTop';
import ErrorBoundary from './components/ErrorBoundary';
import { BlogErrorFallback } from './components/ErrorFallbacks';
import Home from './pages/Home';
import About from './pages/About';
import Altivum from './pages/Altivum';
import Podcast from './pages/Podcast';
import Blog from './pages/Blog';
import BlogPost from './pages/BlogPost';
import Links from './pages/Links';
import Contact from './pages/Contact';
import BeyondTheAssessment from './pages/BeyondTheAssessment';
import Chat from './pages/Chat';
import Privacy from './pages/Privacy';
import NotFound from './pages/NotFound';
import ChatWidget from './components/chat/ChatWidget';

function App() {
  const location = useLocation();
  const isFullscreenPage = location.pathname === '/chat';

  return (
    <div className="min-h-screen bg-altivum-dark">
      <ScrollToTop />
      <Navigation />
      <main id="main-content">
        <ErrorBoundary>
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
        </ErrorBoundary>
      </main>
      {!isFullscreenPage && <Footer />}
      {!isFullscreenPage && <ChatWidget />}
    </div>
  );
}

export default App;
