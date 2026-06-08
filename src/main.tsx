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
// (window.__PRERENDER_READY__) is now set by the content-bearing <Helmet> in
// src/components/SEO.tsx via its onChangeClientState callback. An empty sibling
// Helmet here would NOT fire on the route's content-Helmet flush in
// react-helmet-async@3, leaving the flag undefined and timing out the crawl.

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
