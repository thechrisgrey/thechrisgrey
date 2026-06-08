import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { HelmetProvider, Helmet } from 'react-helmet-async'
import App from './App.tsx'
import LenisProvider from './components/LenisProvider.tsx'
import './index.css'
import { initWebVitals } from './utils/webVitals'

// Initialize Web Vitals tracking
initWebVitals()

// Signal to the build-time prerender crawl (Recommendation 3 Part B) that
// react-helmet-async has flushed the per-route <head> tags. The crawl polls
// window.__PRERENDER_READY__ instead of network idle, because the WebGL/GSAP
// work never lets the page reach a true idle state. onChangeClientState fires
// after every Helmet flush to the DOM, so the latest route's <title>/<meta>/
// JSON-LD are present in <head> by the time the flag is set.
const markPrerenderReady = () => {
  window.__PRERENDER_READY__ = true
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LenisProvider>
      <BrowserRouter>
        <HelmetProvider>
          <Helmet onChangeClientState={markPrerenderReady} />
          <App />
        </HelmetProvider>
      </BrowserRouter>
    </LenisProvider>
  </React.StrictMode>,
)
