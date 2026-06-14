import { describe, it, expect, vi, afterEach } from 'vitest';
import { trackEvent } from './analytics';
import { capturePostHogEvent } from './posthog';

// trackEvent also forwards to PostHog; mock it so we can assert the hand-off
// without loading posthog-js or requiring consent.
vi.mock('./posthog', () => ({ capturePostHogEvent: vi.fn() }));

describe('trackEvent', () => {
  afterEach(() => {
    delete (window as unknown as { plausible?: unknown }).plausible;
    vi.mocked(capturePostHogEvent).mockClear();
    vi.restoreAllMocks();
  });

  it('forwards the event name with props wrapped in { props }', () => {
    const spy = vi.fn();
    window.plausible = spy;
    trackEvent('Newsletter Subscribe', { source: 'home' });
    expect(spy).toHaveBeenCalledWith('Newsletter Subscribe', { props: { source: 'home' } });
  });

  it('omits the options object entirely when no props are given', () => {
    const spy = vi.fn();
    window.plausible = spy;
    trackEvent('Chat Opened');
    expect(spy).toHaveBeenCalledWith('Chat Opened', undefined);
  });

  it('does nothing (and does not throw) when window.plausible is absent', () => {
    delete (window as unknown as { plausible?: unknown }).plausible;
    expect(() => trackEvent('Contact Submit')).not.toThrow();
  });

  it('swallows errors thrown by window.plausible', () => {
    window.plausible = vi.fn(() => {
      throw new Error('plausible blew up');
    });
    expect(() => trackEvent('Book Amazon Click')).not.toThrow();
  });

  it('also forwards the event (with props) to PostHog', () => {
    trackEvent('Newsletter Subscribe', { source: 'home' });
    expect(capturePostHogEvent).toHaveBeenCalledWith('Newsletter Subscribe', { source: 'home' });
  });

  it('forwards to PostHog even when window.plausible is absent', () => {
    delete (window as unknown as { plausible?: unknown }).plausible;
    trackEvent('Chat Opened');
    expect(capturePostHogEvent).toHaveBeenCalledWith('Chat Opened', undefined);
  });
});
