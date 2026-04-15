import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('chatSigning', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  describe('getSignedHeaders', () => {
    it('should return an empty object when VITE_CHAT_SIGNING_KEY is not set', async () => {
      vi.stubEnv('VITE_CHAT_SIGNING_KEY', '');
      const { getSignedHeaders } = await import('./chatSigning');

      const headers = await getSignedHeaders('{"messages":[]}');

      expect(headers).toEqual({});
    });

    it('should return both X-Chat-Timestamp and X-Chat-Signature headers when key is set', async () => {
      vi.stubEnv('VITE_CHAT_SIGNING_KEY', 'test-secret-key');
      const { getSignedHeaders } = await import('./chatSigning');

      const headers = await getSignedHeaders('{"messages":[]}');

      expect(headers).toHaveProperty('X-Chat-Timestamp');
      expect(headers).toHaveProperty('X-Chat-Signature');
    });

    it('should produce a timestamp that is a unix-seconds integer string', async () => {
      vi.stubEnv('VITE_CHAT_SIGNING_KEY', 'test-secret-key');
      const { getSignedHeaders } = await import('./chatSigning');

      const before = Math.floor(Date.now() / 1000);
      const headers = await getSignedHeaders('{"messages":[]}');
      const after = Math.floor(Date.now() / 1000);

      const ts = Number(headers['X-Chat-Timestamp']);
      expect(Number.isInteger(ts)).toBe(true);
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(after);
    });

    it('should produce a 64-character lowercase hex signature (SHA-256 = 32 bytes)', async () => {
      vi.stubEnv('VITE_CHAT_SIGNING_KEY', 'test-secret-key');
      const { getSignedHeaders } = await import('./chatSigning');

      const headers = await getSignedHeaders('{"messages":[]}');

      expect(headers['X-Chat-Signature']).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should produce the known HMAC-SHA256 signature for a fixed key/timestamp/body', async () => {
      // Lock time so the generated timestamp is deterministic
      vi.useFakeTimers();
      vi.setSystemTime(new Date(1700000000 * 1000));

      vi.stubEnv('VITE_CHAT_SIGNING_KEY', 'test-secret-key');
      const { getSignedHeaders } = await import('./chatSigning');

      const body = '{"messages":[]}';
      const headers = await getSignedHeaders(body);

      // Reference signature computed via Node crypto:
      //   HMAC-SHA256("test-secret-key", "1700000000.{\"messages\":[]}")
      expect(headers['X-Chat-Timestamp']).toBe('1700000000');
      expect(headers['X-Chat-Signature']).toBe(
        '1f230ca8ff6f73807af31ba4bd7c2d87183cecfb427738bb9993d4db7c15f2bd'
      );
    });

    it('should produce different signatures for different bodies (same key/time)', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(1700000000 * 1000));

      vi.stubEnv('VITE_CHAT_SIGNING_KEY', 'test-secret-key');
      const { getSignedHeaders } = await import('./chatSigning');

      const a = await getSignedHeaders('{"messages":[{"role":"user","content":"a"}]}');
      const b = await getSignedHeaders('{"messages":[{"role":"user","content":"b"}]}');

      expect(a['X-Chat-Signature']).not.toBe(b['X-Chat-Signature']);
      expect(a['X-Chat-Timestamp']).toBe(b['X-Chat-Timestamp']);
    });

    it('should produce different signatures for different keys (same body/time)', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(1700000000 * 1000));

      const body = '{"messages":[]}';

      vi.stubEnv('VITE_CHAT_SIGNING_KEY', 'key-one');
      const mod1 = await import('./chatSigning');
      const h1 = await mod1.getSignedHeaders(body);

      vi.resetModules();
      vi.stubEnv('VITE_CHAT_SIGNING_KEY', 'key-two');
      const mod2 = await import('./chatSigning');
      const h2 = await mod2.getSignedHeaders(body);

      expect(h1['X-Chat-Signature']).not.toBe(h2['X-Chat-Signature']);
    });

    it('should produce different signatures for different timestamps (same key/body)', async () => {
      vi.stubEnv('VITE_CHAT_SIGNING_KEY', 'test-secret-key');
      const { getSignedHeaders } = await import('./chatSigning');

      vi.useFakeTimers();
      const body = '{"messages":[]}';

      vi.setSystemTime(new Date(1700000000 * 1000));
      const h1 = await getSignedHeaders(body);

      vi.setSystemTime(new Date(1700000060 * 1000));
      const h2 = await getSignedHeaders(body);

      expect(h1['X-Chat-Signature']).not.toBe(h2['X-Chat-Signature']);
      expect(h1['X-Chat-Timestamp']).not.toBe(h2['X-Chat-Timestamp']);
    });

    it('should handle unicode body content correctly', async () => {
      vi.stubEnv('VITE_CHAT_SIGNING_KEY', 'test-secret-key');
      const { getSignedHeaders } = await import('./chatSigning');

      const headers = await getSignedHeaders('{"content":"héllo 🌮 中文"}');

      expect(headers['X-Chat-Signature']).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should handle empty-string body', async () => {
      vi.stubEnv('VITE_CHAT_SIGNING_KEY', 'test-secret-key');
      const { getSignedHeaders } = await import('./chatSigning');

      const headers = await getSignedHeaders('');

      expect(headers['X-Chat-Signature']).toMatch(/^[0-9a-f]{64}$/);
      expect(headers['X-Chat-Timestamp']).toBeDefined();
    });
  });
});
