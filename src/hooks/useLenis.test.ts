import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useLenisInstance, useLenisContext } from './useLenis';

// Shared Lenis instance so we can assert teardown wiring. Hoisted so it exists
// before vi.mock's factory runs. The instance now also exposes on/off, which the
// GSAP ScrollTrigger bridge in useLenis depends on.
const { lenisInstance } = vi.hoisted(() => ({
  lenisInstance: {
    destroy: vi.fn(),
    raf: vi.fn(),
    scrollTo: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  },
}));

// vitest 4 no longer treats `vi.fn(() => obj)` as a constructable function
// when used with `new` (arrow-function impls have no [[Construct]] slot).
// Use a class whose constructor explicitly returns the hoisted instance so
// `new Lenis(...)` in useLenis.ts produces the same shared object the tests
// inspect for destroy()/off() calls.
vi.mock('lenis', () => ({
  default: class MockLenis {
    constructor() {
      return lenisInstance;
    }
  },
}));

describe('useLenisInstance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    let called = false;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => {
      if (!called) {
        called = true;
      }
      return 1;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes Lenis when reduced motion is not preferred', () => {
    const { result } = renderHook(() => useLenisInstance());
    expect(result.current.lenis).not.toBeNull();
  });

  it('does not initialize Lenis when prefers-reduced-motion is active', () => {
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

    const { result } = renderHook(() => useLenisInstance());
    expect(result.current.lenis).toBeNull();
  });

  it('scrollTo falls back to window.scrollTo when lenis is null', () => {
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

    const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const { result } = renderHook(() => useLenisInstance());
    result.current.scrollTo(100);
    expect(scrollToSpy).toHaveBeenCalledWith({ top: 100, left: 0, behavior: 'instant' });
  });

  it('cleans up on unmount (removes the scroll listener and destroys Lenis)', () => {
    const { unmount } = renderHook(() => useLenisInstance());
    unmount();
    expect(lenisInstance.off).toHaveBeenCalledWith('scroll', expect.any(Function));
    expect(lenisInstance.destroy).toHaveBeenCalled();
  });
});

describe('useLenisContext', () => {
  it('returns default context value when not wrapped in provider', () => {
    const { result } = renderHook(() => useLenisContext());
    expect(result.current.lenis).toBeNull();
    expect(typeof result.current.scrollTo).toBe('function');
  });
});
