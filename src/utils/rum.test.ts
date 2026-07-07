import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

describe('rum', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('VITE_RUM_APP_MONITOR_ID', '');
    vi.stubEnv('VITE_RUM_IDENTITY_POOL_ID', '');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('is not initialized when VITE_RUM_APP_MONITOR_ID is unset', async () => {
    const { isRumInitialized } = await import('./rum');
    expect(isRumInitialized).toBe(false);
  });

  it('is not initialized in test environment even when env vars are set', async () => {
    vi.stubEnv('VITE_RUM_APP_MONITOR_ID', 'test-monitor-id');
    vi.stubEnv('VITE_RUM_IDENTITY_POOL_ID', 'us-east-1:test-pool-id');
    const { isRumInitialized } = await import('./rum');
    expect(isRumInitialized).toBe(false);
  });

  it('captureError falls back to console.error when RUM is not initialized', async () => {
    const { captureError } = await import('./rum');
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('test error');
    captureError(error, { context: 'test' });
    expect(consoleSpy).toHaveBeenCalledWith('Uncaught error:', error, { context: 'test' });
  });

  it('recordEvent is a no-op when RUM is not initialized', async () => {
    const { recordEvent } = await import('./rum');
    expect(() => recordEvent('custom_event', { data: 'test' })).not.toThrow();
  });

  it('recordPageView is a no-op when RUM is not initialized', async () => {
    const { recordPageView } = await import('./rum');
    expect(() => recordPageView('/test')).not.toThrow();
  });
});
