import type { PostHog } from 'posthog-js';

/**
 * Consent-gated PostHog loader.
 *
 * PostHog is OPTIONAL: if VITE_POSTHOG_KEY isn't set, every function here is a
 * no-op and posthog-js is never loaded (so the consent banner also stays hidden).
 * When configured, posthog-js is dynamically imported only AFTER consent, so its
 * weight never reaches visitors who decline or haven't chosen yet — keeping the
 * default experience cookie-free and light, exactly like before.
 */
let instance: PostHog | null = null;
let loading = false;

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const POSTHOG_HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || 'https://us.i.posthog.com';

export function isPostHogConfigured(): boolean {
  return typeof POSTHOG_KEY === 'string' && POSTHOG_KEY.length > 0;
}

/**
 * Load + initialize PostHog. Call ONLY after the visitor grants consent.
 * Idempotent and failure-safe (a network/import error must never break the app).
 */
export async function enablePostHog(): Promise<void> {
  if (instance || loading || !isPostHogConfigured()) return;
  loading = true;
  try {
    const { default: posthog } = await import('posthog-js');
    posthog.init(POSTHOG_KEY as string, {
      api_host: POSTHOG_HOST,
      capture_pageview: false, // captured manually per SPA route change (see App.tsx)
      capture_pageleave: true,
      autocapture: true,
      persistence: 'localStorage+cookie',
      // Session replay never records form-field values (newsletter/contact emails, etc.).
      session_recording: { maskAllInputs: true },
    });
    instance = posthog;
    // Capture the entry pageview (the page in view at consent/load time). Further
    // SPA navigations are captured by the route-change effect in App.tsx.
    posthog.capture('$pageview');
  } catch {
    // Swallow — analytics must never affect the user experience.
  } finally {
    loading = false;
  }
}

/** Withdraw consent: stop capturing and forget the visitor. */
export function disablePostHog(): void {
  if (!instance) return;
  try {
    instance.opt_out_capturing();
    instance.reset();
  } catch {
    // No-op.
  }
  instance = null;
}

/** Forward a named event to PostHog. No-op until enablePostHog() has run. */
export function capturePostHogEvent(event: string, props?: Record<string, unknown>): void {
  try {
    instance?.capture(event, props);
  } catch {
    // No-op.
  }
}

/** Capture an SPA pageview. No-op until enablePostHog() has run. */
export function capturePostHogPageview(): void {
  try {
    instance?.capture('$pageview');
  } catch {
    // No-op.
  }
}
