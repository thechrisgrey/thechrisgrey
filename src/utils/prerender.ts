/**
 * True when the page is being rendered by the build-time prerender crawl
 * (a future Puppeteer pass — see Recommendation 3 Part B). The crawl opens
 * every route with ?prerender=1. Heavy WebGL / GSAP-ScrollTrigger work is
 * skipped under this flag so the headless render reaches a stable DOM instead
 * of spinning on a never-idle render loop.
 */
export function isPrerender(): boolean {
  if (
    typeof window !== 'undefined' &&
    (window as unknown as { __PRERENDER__?: boolean }).__PRERENDER__
  ) {
    return true;
  }
  if (typeof location !== 'undefined' && location.search) {
    return new URLSearchParams(location.search).has('prerender');
  }
  return false;
}
