import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSiteHealth } from './useSiteHealth';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useSiteHealth', () => {
  const mockGetAccessToken = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAccessToken.mockResolvedValue('test-token');
  });

  it('should initialize with null data and no loading state', () => {
    const { result } = renderHook(() => useSiteHealth(mockGetAccessToken, false));

    expect(result.current.data).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should not fetch when disabled', () => {
    renderHook(() => useSiteHealth(mockGetAccessToken, false));

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should not fetch when access token is null', async () => {
    mockGetAccessToken.mockResolvedValue(null);

    renderHook(() => useSiteHealth(mockGetAccessToken, true));

    // Wait for the effect to resolve
    await waitFor(() => {
      expect(mockGetAccessToken).toHaveBeenCalled();
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should fetch health data when enabled', async () => {
    const healthData = {
      vitals: {
        lcp: { average: 2500, count: 10 },
        cls: { average: 0.1, count: 10 },
        inp: { average: 200, count: 10 },
        fcp: { average: 1800, count: 10 },
        ttfb: { average: 800, count: 10 },
      },
      chat: {
        kbSuccessRate: '95%',
        kbFailures: 1,
        kbSuccesses: 19,
        guardrailInterventions: 0,
        rateLimitRejections: 2,
      },
      security: { cspViolations: 0 },
      periodHours: 24,
      timestamp: '2026-01-01T00:00:00Z',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(healthData),
    });

    const { result } = renderHook(() => useSiteHealth(mockGetAccessToken, true));

    await waitFor(() => {
      expect(result.current.data).toEqual(healthData);
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should set error when fetch fails with HTTP error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const { result } = renderHook(() => useSiteHealth(mockGetAccessToken, true));

    await waitFor(() => {
      expect(result.current.error).toBe('Failed to load health data');
    });
  });

  it('should set error when fetch throws a network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useSiteHealth(mockGetAccessToken, true));

    await waitFor(() => {
      expect(result.current.error).toBe('Failed to load health data');
    });
  });

  it('should expose a refresh function', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          vitals: {},
          chat: {},
          security: {},
          periodHours: 24,
          timestamp: '',
        }),
    });

    const { result } = renderHook(() => useSiteHealth(mockGetAccessToken, true));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    expect(typeof result.current.refresh).toBe('function');

    // Call refresh manually
    await act(async () => {
      await result.current.refresh();
    });

    expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
