/**
 * Thin, safe wrapper around Plausible custom events (goal conversions).
 *
 * Plausible is loaded cookie-free in index.html; public/plausible-init.js defines
 * `window.plausible` as a queue stub, so events fired before the script finishes
 * loading are buffered and flushed — callers never need to check readiness.
 *
 * Analytics must NEVER affect the user experience, so every call is fully guarded:
 * a missing or throwing `window.plausible` is swallowed silently.
 *
 * Event names are Title Case and configured as goals in the Plausible dashboard.
 * `props` are optional custom dimensions (e.g. which surface drove a signup).
 */
import { capturePostHogEvent } from './posthog';

export type PlausibleProps = Record<string, string | number | boolean>;

declare global {
  interface Window {
    plausible?: (event: string, options?: { props?: PlausibleProps; callback?: () => void }) => void;
  }
}

/**
 * Record a conversion goal. Sent to BOTH:
 *  - Plausible — cookieless, fires for every visitor.
 *  - PostHog — funnels/replay, but only for visitors who granted consent
 *    (capturePostHogEvent is a no-op until PostHog is initialized).
 */
export function trackEvent(event: string, props?: PlausibleProps): void {
  try {
    if (typeof window !== 'undefined' && typeof window.plausible === 'function') {
      window.plausible(event, props ? { props } : undefined);
    }
  } catch {
    // Intentionally swallowed — a broken analytics call must never break the UI.
  }
  capturePostHogEvent(event, props);
}
