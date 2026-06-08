/// <reference types="vite/client" />

declare global {
  interface Window {
    /**
     * Set to true by src/main.tsx once react-helmet-async has flushed the
     * per-route <head> tags. The build-time prerender crawl (Recommendation 3
     * Part B) polls this flag instead of network idle, because the WebGL/GSAP
     * work never lets the page reach a true idle state.
     */
    __PRERENDER_READY__?: boolean;
  }
}

export {};
