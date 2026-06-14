/**
 * Visitor consent for cookie-based analytics (PostHog).
 *
 * Plausible is cookieless and runs for everyone without consent. PostHog uses
 * cookies/localStorage and session replay, so it ONLY initializes after an
 * explicit opt-in. The choice is stored in localStorage so it persists across
 * visits; until a choice is made, getConsent() returns null and the banner shows.
 */
const CONSENT_KEY = 'tcg-analytics-consent';

export type ConsentValue = 'granted' | 'denied';

export function getConsent(): ConsentValue | null {
  try {
    const value = localStorage.getItem(CONSENT_KEY);
    return value === 'granted' || value === 'denied' ? value : null;
  } catch {
    // localStorage can throw in private mode / when storage is disabled.
    return null;
  }
}

export function setConsent(value: ConsentValue): void {
  try {
    localStorage.setItem(CONSENT_KEY, value);
  } catch {
    // No-op: failing to persist consent must never break the page.
  }
}

/** Clear the stored choice so the banner shows again (e.g. a "cookie settings" link). */
export function clearConsent(): void {
  try {
    localStorage.removeItem(CONSENT_KEY);
  } catch {
    // No-op.
  }
}
