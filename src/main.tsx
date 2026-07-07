import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import App from './App.tsx';
import LenisProvider from './components/LenisProvider.tsx';
import './index.css';
import { initWebVitals } from './utils/webVitals';
import './utils/sentry';

// Initialize Web Vitals tracking
initWebVitals();

// NOTE: The build-time prerender crawl's readiness signal
// (window.__PRERENDER_READY__) is set by a useEffect in src/components/SEO.tsx,
// which runs after each route's <head> tags commit. It is NOT set here, and NOT
// via onChangeClientState — that callback is a no-op under react-helmet-async@3
// on React 19 (it renders head tags via React 19's native hoisting and never
// fires the legacy callback), so it cannot drive the flag.

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LenisProvider>
      <BrowserRouter>
        <HelmetProvider>
          <App />
        </HelmetProvider>
      </BrowserRouter>
    </LenisProvider>
  </React.StrictMode>,
);
