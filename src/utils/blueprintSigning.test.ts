import { describe, it, expect, vi, afterEach } from 'vitest';
import { createHmac } from 'crypto';

// blueprintSigning reads VITE_BLUEPRINT_SIGNING_KEY into a module-level const at import
// time, so each test stubs the env, resets the module registry, and dynamically imports.
async function loadSigner(key?: string) {
  vi.resetModules();
  if (key === undefined) vi.stubEnv('VITE_BLUEPRINT_SIGNING_KEY', '');
  else vi.stubEnv('VITE_BLUEPRINT_SIGNING_KEY', key);
  return import('./blueprintSigning');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('getSignedHeaders', () => {
  it('returns no headers when the signing key is not configured', async () => {
    const { getSignedHeaders } = await loadSigner('');
    const headers = await getSignedHeaders('{"spec":{}}');
    expect(headers).toEqual({});
  });

  it('returns timestamp + signature headers when a key is configured', async () => {
    const { getSignedHeaders } = await loadSigner('test-signing-key');
    const headers = await getSignedHeaders('{"spec":{"goal":"x"}}');
    expect(headers).toHaveProperty('x-blueprint-timestamp');
    expect(headers).toHaveProperty('x-blueprint-signature');
    // SHA-256 HMAC hex digest is 64 chars.
    expect(headers['x-blueprint-signature']).toMatch(/^[0-9a-f]{64}$/);
    expect(headers['x-blueprint-timestamp']).toMatch(/^\d+$/);
  });

  it('produces an HMAC-SHA256 signature over `${timestamp}.${body}` matching Node crypto', async () => {
    const KEY = 'verifiable-key-123';
    const BODY = '{"spec":{"goal":"build a rag system"}}';
    // Freeze time so we can recompute the exact expected signature.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-30T00:00:00Z'));
    const ts = Math.floor(Date.now() / 1000);

    const { getSignedHeaders } = await loadSigner(KEY);
    const headers = await getSignedHeaders(BODY);

    const expected = createHmac('sha256', KEY).update(`${ts}.${BODY}`).digest('hex');
    expect(headers['x-blueprint-timestamp']).toBe(String(ts));
    expect(headers['x-blueprint-signature']).toBe(expected);
  });

  it('is body-sensitive — different bodies yield different signatures', async () => {
    const { getSignedHeaders } = await loadSigner('k');
    const a = await getSignedHeaders('{"a":1}');
    const b = await getSignedHeaders('{"a":2}');
    expect(a['x-blueprint-signature']).not.toBe(b['x-blueprint-signature']);
  });
});
