import { describe, it, expect, vi, afterEach } from 'vitest';
import { isMotionDisabled } from './motion';

describe('isMotionDisabled', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete (window as unknown as { __PRERENDER__?: boolean }).__PRERENDER__;
  });

  it('returns false in a normal browser context with no reduced-motion preference', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }));
    expect(isMotionDisabled()).toBe(false);
  });

  it('returns true when prefers-reduced-motion: reduce matches', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }));
    expect(isMotionDisabled()).toBe(true);
  });

  it('returns true when the build-time prerender flag is set, even with motion otherwise allowed', () => {
    // Critical SEO/AI-crawler invariant: prerender wins over the media query so
    // reveal components ship their final state into the static HTML.
    (window as unknown as { __PRERENDER__: boolean }).__PRERENDER__ = true;
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }));
    expect(isMotionDisabled()).toBe(true);
  });

  it('returns true when the URL has ?prerender (matches isPrerender behavior)', () => {
    // The crawl falls back to a ?prerender URL param when it cannot set the
    // __PRERENDER__ global before navigation. isMotionDisabled inherits that
    // behavior through isPrerender().
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { search: '?prerender=1' },
    });
    try {
      expect(isMotionDisabled()).toBe(true);
    } finally {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: originalLocation,
      });
    }
  });
});
