import { isPrerender } from './prerender';

/**
 * True when motion-heavy effects (GSAP ScrollTrigger, R3F frameloops, scrub
 * animations) should be skipped and components should render their final
 * post-animation state instead.
 *
 * Two reasons motion gets disabled:
 *
 * 1. `prefers-reduced-motion: reduce` — visitor opted in via OS/browser
 *    accessibility settings.
 * 2. `isPrerender()` — the build-time Puppeteer crawl is rendering the
 *    page. If components render their opacity:0 placeholder markup during
 *    prerender, the resulting static HTML hides its own content from AI
 *    crawlers and search-engine bots that don't execute JS, undoing the
 *    SEO/AI-discoverability work PR #104 did.
 *
 * Order of checks: prerender first (always defined when set), then
 * `typeof window` SSR safety, then the media query (the only call that
 * actually needs a DOM).
 */
export function isMotionDisabled(): boolean {
  if (isPrerender()) return true;
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
