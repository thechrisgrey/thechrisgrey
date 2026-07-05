import { describe, it, expect } from 'vitest';
import { isPostHogConfigured, capturePostHogEvent, capturePostHogPageview, disablePostHog } from './posthog';

describe('posthog (consent-gated)', () => {
  it('isPostHogConfigured reports a boolean based on env config', () => {
    expect(typeof isPostHogConfigured()).toBe('boolean');
  });

  it('capture/disable are safe no-ops before PostHog is initialized', () => {
    // Without enablePostHog() (no consent), these must never throw — analytics
    // can never break the page.
    expect(() => capturePostHogEvent('Some Event', { source: 'home' })).not.toThrow();
    expect(() => capturePostHogPageview()).not.toThrow();
    expect(() => disablePostHog()).not.toThrow();
  });
});
