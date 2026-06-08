import { describe, it, expect, afterEach, vi } from 'vitest';
import { isPrerender } from './prerender';

describe('isPrerender', () => {
  afterEach(() => {
    // PRC-3e: never leave a stubbed global behind — it poisons jsdom for
    // later test files. Restore everything after each case.
    vi.unstubAllGlobals();
  });

  it('returns true when ?prerender=1 is present', () => {
    // Stub only location.search, not the whole window object.
    vi.stubGlobal('location', { search: '?prerender=1' } as Location);
    expect(isPrerender()).toBe(true);
  });

  it('returns true when window.__PRERENDER__ is set', () => {
    vi.stubGlobal('location', { search: '' } as Location);
    vi.stubGlobal('window', { __PRERENDER__: true } as unknown as Window);
    expect(isPrerender()).toBe(true);
  });

  it('returns false in a normal browser session', () => {
    vi.stubGlobal('location', { search: '?utm_source=x' } as Location);
    expect(isPrerender()).toBe(false);
  });
});
