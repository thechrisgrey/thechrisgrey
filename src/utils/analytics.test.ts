import { describe, it, expect, vi, afterEach } from 'vitest';
import { trackEvent } from './analytics';

describe('trackEvent', () => {
  afterEach(() => {
    delete (window as unknown as { plausible?: unknown }).plausible;
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
});
