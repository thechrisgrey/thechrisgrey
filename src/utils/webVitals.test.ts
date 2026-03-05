import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the web-vitals module
const mockOnCLS = vi.fn();
const mockOnINP = vi.fn();
const mockOnFCP = vi.fn();
const mockOnLCP = vi.fn();
const mockOnTTFB = vi.fn();

vi.mock('web-vitals', () => ({
  onCLS: mockOnCLS,
  onINP: mockOnINP,
  onFCP: mockOnFCP,
  onLCP: mockOnLCP,
  onTTFB: mockOnTTFB,
}));

describe('webVitals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('initWebVitals', () => {
    it('should register callbacks for all five web vital metrics', async () => {
      const { initWebVitals } = await import('./webVitals');
      initWebVitals();

      expect(mockOnCLS).toHaveBeenCalledOnce();
      expect(mockOnINP).toHaveBeenCalledOnce();
      expect(mockOnFCP).toHaveBeenCalledOnce();
      expect(mockOnLCP).toHaveBeenCalledOnce();
      expect(mockOnTTFB).toHaveBeenCalledOnce();
    });

    it('should pass a function callback to each metric', async () => {
      const { initWebVitals } = await import('./webVitals');
      initWebVitals();

      expect(typeof mockOnCLS.mock.calls[0][0]).toBe('function');
      expect(typeof mockOnINP.mock.calls[0][0]).toBe('function');
      expect(typeof mockOnFCP.mock.calls[0][0]).toBe('function');
      expect(typeof mockOnLCP.mock.calls[0][0]).toBe('function');
      expect(typeof mockOnTTFB.mock.calls[0][0]).toBe('function');
    });

    it('should log to console in dev mode when a metric callback is invoked', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { initWebVitals } = await import('./webVitals');
      initWebVitals();

      // Get the callback passed to onCLS and invoke it
      const clsCallback = mockOnCLS.mock.calls[0][0];
      clsCallback({
        name: 'CLS',
        value: 0.05,
        rating: 'good',
        delta: 0.05,
        id: 'test-id',
        navigationType: 'navigate',
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Web Vitals] CLS: 0.05')
      );

      consoleSpy.mockRestore();
    });
  });
});
