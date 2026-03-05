import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import ReadingProgressBar from './ReadingProgressBar';

describe('ReadingProgressBar', () => {
  let rafCallback: FrameRequestCallback | null = null;

  beforeEach(() => {
    rafCallback = null;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      rafCallback = cb;
      return 1;
    });

    // Default: page is at top with some scrollable height
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      value: 2000,
      configurable: true,
    });
    Object.defineProperty(window, 'innerHeight', {
      value: 800,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(window, 'scrollY', {
      value: 0,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render a progressbar element', () => {
    render(<ReadingProgressBar />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('should have correct aria attributes', () => {
    render(<ReadingProgressBar />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
    expect(bar).toHaveAttribute('aria-label', 'Reading progress');
  });

  it('should start at 0% progress when at top of page', () => {
    render(<ReadingProgressBar />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '0');
    expect(bar.style.width).toBe('0%');
  });

  it('should update progress on scroll', () => {
    render(<ReadingProgressBar />);

    // Simulate scrolling halfway
    Object.defineProperty(window, 'scrollY', { value: 600, configurable: true });

    act(() => {
      window.dispatchEvent(new Event('scroll'));
      if (rafCallback) rafCallback(0);
    });

    const bar = screen.getByRole('progressbar');
    // 600 / (2000 - 800) = 50%
    expect(bar).toHaveAttribute('aria-valuenow', '50');
  });

  it('should handle zero scrollable height without errors', () => {
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      value: 800,
      configurable: true,
    });
    // scrollHeight equals innerHeight, so docHeight = 0

    render(<ReadingProgressBar />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '0');
  });

  it('should clamp progress to 100', () => {
    render(<ReadingProgressBar />);

    // Scroll beyond the document height
    Object.defineProperty(window, 'scrollY', { value: 2000, configurable: true });

    act(() => {
      window.dispatchEvent(new Event('scroll'));
      if (rafCallback) rafCallback(0);
    });

    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '100');
  });

  it('should clean up event listeners on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = render(<ReadingProgressBar />);

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('scroll', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function));
  });
});
