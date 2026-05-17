import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useViewTransitionNavigate } from './useViewTransitionNavigate';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
);

describe('useViewTransitionNavigate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls navigate directly when startViewTransition is not supported', () => {
    const originalSVT = (document as { startViewTransition?: unknown }).startViewTransition;
    delete (document as { startViewTransition?: unknown }).startViewTransition;

    const { result } = renderHook(() => useViewTransitionNavigate(), { wrapper });
    act(() => {
      result.current('/about');
    });

    (document as { startViewTransition?: unknown }).startViewTransition = originalSVT;
  });

  it('calls navigate directly when prefers-reduced-motion is active', () => {
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

    const { result } = renderHook(() => useViewTransitionNavigate(), { wrapper });
    act(() => {
      result.current('/about');
    });

    vi.restoreAllMocks();
  });

  it('wraps navigate in startViewTransition when supported and no reduced motion', () => {
    const mockStartViewTransition = vi.fn((cb: () => void) => { cb(); });
    (document as { startViewTransition?: unknown }).startViewTransition = mockStartViewTransition;

    const { result } = renderHook(() => useViewTransitionNavigate(), { wrapper });
    act(() => {
      result.current('/contact');
    });

    expect(mockStartViewTransition).toHaveBeenCalledWith(expect.any(Function));
    delete (document as { startViewTransition?: unknown }).startViewTransition;
  });

  it('returns a stable function reference', () => {
    const { result, rerender } = renderHook(() => useViewTransitionNavigate(), { wrapper });
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
