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
    // Structured logger outputs [ERROR][RUM] uncaught_error { error, context }
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[ERROR][RUM] uncaught_error'),
      expect.objectContaining({ error: 'test error', context: 'test' }),
    );
  });

  it('recordEvent is a no-op when RUM is not initialized', async () => {
    const { recordEvent } = await import('./rum');
    expect(() => recordEvent('custom_event', { data: 'test' })).not.toThrow();
  });

  it('recordPageView is a no-op when RUM is not initialized', async () => {
    const { recordPageView } = await import('./rum');
    expect(() => recordPageView('/test')).not.toThrow();
  });

  describe('breadcrumbs', () => {
    it('addBreadcrumb stores breadcrumbs in the buffer', async () => {
      const { addBreadcrumb, getBreadcrumbs } = await import('./rum');
      addBreadcrumb('navigation', 'Navigated to /about');
      addBreadcrumb('click', 'Clicked submit button');
      const crumbs = getBreadcrumbs();
      expect(crumbs.length).toBeGreaterThanOrEqual(2);
      expect(crumbs.some((c) => c.message === 'Navigated to /about')).toBe(true);
      expect(crumbs.some((c) => c.message === 'Clicked submit button')).toBe(true);
    });

    it('breadcrumbs have ISO timestamps and correct types', async () => {
      const { addBreadcrumb, getBreadcrumbs } = await import('./rum');
      addBreadcrumb('custom', 'test breadcrumb', { key: 'value' });
      const crumbs = getBreadcrumbs();
      const last = crumbs[crumbs.length - 1];
      expect(last.type).toBe('custom');
      expect(last.message).toBe('test breadcrumb');
      expect(last.data).toEqual({ key: 'value' });
      expect(typeof last.timestamp).toBe('string');
      expect(last.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('breadcrumb buffer caps at 20 entries', async () => {
      const { addBreadcrumb, getBreadcrumbs } = await import('./rum');
      for (let i = 0; i < 25; i++) {
        addBreadcrumb('custom', `breadcrumb-${i}`);
      }
      const crumbs = getBreadcrumbs();
      expect(crumbs.length).toBeLessThanOrEqual(20);
      // The oldest breadcrumbs should be dropped
      expect(crumbs[0].message).not.toBe('breadcrumb-0');
      // The newest should be retained
      expect(crumbs[crumbs.length - 1].message).toBe('breadcrumb-24');
    });

    it('captureError adds an error breadcrumb', async () => {
      const { captureError, getBreadcrumbs } = await import('./rum');
      vi.spyOn(console, 'error').mockImplementation(() => {});
      captureError(new Error('test breadcrumb error'));
      const crumbs = getBreadcrumbs();
      expect(crumbs.some((c) => c.type === 'error' && c.message === 'test breadcrumb error')).toBe(true);
    });

    it('recordPageView adds a navigation breadcrumb', async () => {
      const { recordPageView, getBreadcrumbs } = await import('./rum');
      recordPageView('/blog');
      const crumbs = getBreadcrumbs();
      expect(crumbs.some((c) => c.type === 'navigation' && c.message === '/blog')).toBe(true);
    });
  });

  describe('user context', () => {
    it('setUserContext stores context without throwing', async () => {
      const { setUserContext } = await import('./rum');
      expect(() => setUserContext({ deviceId: 'test-device-hash' })).not.toThrow();
    });

    it('setUserContext is a no-op when RUM is not initialized (no throw)', async () => {
      const { setUserContext } = await import('./rum');
      expect(() => setUserContext({ deviceId: 'test-device-hash' })).not.toThrow();
    });
  });

  describe('cookie consent controls', () => {
    it('grantRumCookies is a no-op when RUM is not initialized', async () => {
      const { grantRumCookies } = await import('./rum');
      expect(() => grantRumCookies()).not.toThrow();
    });

    it('revokeRumCookies is a no-op when RUM is not initialized', async () => {
      const { revokeRumCookies } = await import('./rum');
      expect(() => revokeRumCookies()).not.toThrow();
    });
  });
});
