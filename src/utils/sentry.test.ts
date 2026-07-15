import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

describe('sentry', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('VITE_SENTRY_DSN', '');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('is not initialized when VITE_SENTRY_DSN is unset', async () => {
    const { isSentryInitialized } = await import('./sentry');
    expect(isSentryInitialized()).toBe(false);
  });

  it('is not initialized in test environment even when DSN is set', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://example@sentry.io/123');
    const { isSentryInitialized } = await import('./sentry');
    expect(isSentryInitialized()).toBe(false);
  });

  it('captureSentryError is a no-op when Sentry is not initialized', async () => {
    const { captureSentryError } = await import('./sentry');
    expect(() => captureSentryError(new Error('test'), { context: 'test' })).not.toThrow();
  });

  it('setSentryUserContext is a no-op when Sentry is not initialized', async () => {
    const { setSentryUserContext } = await import('./sentry');
    expect(() => setSentryUserContext({ deviceId: 'test-hash' })).not.toThrow();
  });

  it('addSentryBreadcrumb is a no-op when Sentry is not initialized', async () => {
    const { addSentryBreadcrumb } = await import('./sentry');
    expect(() => addSentryBreadcrumb('navigation', 'test breadcrumb')).not.toThrow();
  });

  it('enableSentry stays dormant in the test environment even when a DSN is set', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://example@sentry.io/123');
    const { enableSentry, isSentryInitialized } = await import('./sentry');
    // isTestEnv makes isConfigured false, so init is short-circuited before the
    // consent check — Sentry never starts (and thus never records) under test.
    enableSentry();
    expect(isSentryInitialized()).toBe(false);
  });

  it('enableSentry is a no-op (no throw) when unconfigured', async () => {
    const { enableSentry, isSentryInitialized } = await import('./sentry');
    expect(() => enableSentry()).not.toThrow();
    expect(isSentryInitialized()).toBe(false);
  });

  it('disableSentry is a no-op (no throw) when not active', async () => {
    const { disableSentry } = await import('./sentry');
    expect(() => disableSentry()).not.toThrow();
  });
});
