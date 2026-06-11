import '@fontsource/playfair-display/latin-400.css';
import '@fontsource/playfair-display/latin-400-italic.css';
import '@fontsource/playfair-display/latin-500.css';
import '@fontsource/playfair-display/latin-500-italic.css';
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import App from './App.tsx'
import LenisProvider from './components/LenisProvider.tsx'
import './index.css'
import { initWebVitals } from './utils/webVitals'

// Initialize Web Vitals tracking
initWebVitals()

// NOTE: The build-time prerender crawl's readiness signal
// (window.__PRERENDER_READY__) is set by a useEffect in src/components/SEO.tsx,
// which runs after each route's <head> tags commit. It is NOT set here, and NOT
// via onChangeClientState — that callback is a no-op under react-helmet-async@3
// on React 19 (it renders head tags via React 19's native hoisting and never
// fires the legacy callback), so it cannot drive the flag.

// The dist/index.html snapshot is BOTH the Home prerender AND the SPA shell
// for every other route, so qualify by the initial route — a cold load of
// /chat that later navigates Home never had a static hero paint.
// NOTE: Leading semicolon avoids ASI ambiguity with the preceding initWebVitals() call.
;(window as { __SKIP_HERO_CASCADE__?: boolean }).__SKIP_HERO_CASCADE__ =
  Boolean(document.getElementById('root')?.hasChildNodes()) &&
  window.location.pathname === '/';

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
)
