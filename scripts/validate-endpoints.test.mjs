import { describe, it, expect, vi } from 'vitest';
import { checkEndpoint, run, ENDPOINT_SERVICES } from './validate-endpoints.mjs';

/** Build a fake fetch that returns a JSON /health body for one call. */
function fakeFetch(body, { ok = true, status = 200, throwErr = null } = {}) {
  return vi.fn(async () => {
    if (throwErr) throw throwErr;
    return {
      ok,
      status,
      json: async () => body,
    };
  });
}

describe('validate-endpoints', () => {
  it('maps the two Lambdas that were swapped in the incident', () => {
    expect(ENDPOINT_SERVICES.VITE_KB_BUILDER_ENDPOINT).toBe('kb-builder');
    expect(ENDPOINT_SERVICES.VITE_BLUEPRINT_ENDPOINT).toBe('blueprint');
  });

  describe('checkEndpoint', () => {
    it('returns ok when /health reports the expected service', async () => {
      const fetchImpl = fakeFetch({ service: 'kb-builder' });
      const r = await checkEndpoint('VITE_KB_BUILDER_ENDPOINT', 'https://kb.example', 'kb-builder', { fetchImpl });
      expect(r.status).toBe('ok');
      expect(r.service).toBe('kb-builder');
      // Probes the /health path with a trailing-slash-safe join.
      expect(fetchImpl).toHaveBeenCalledWith('https://kb.example/health', expect.any(Object));
    });

    it('strips a trailing slash before appending /health', async () => {
      const fetchImpl = fakeFetch({ service: 'blueprint' });
      await checkEndpoint('VITE_BLUEPRINT_ENDPOINT', 'https://bp.example/', 'blueprint', { fetchImpl });
      expect(fetchImpl).toHaveBeenCalledWith('https://bp.example/health', expect.any(Object));
    });

    it('flags a mismatch when /health reports a different service (the swap)', async () => {
      const fetchImpl = fakeFetch({ service: 'blueprint' });
      const r = await checkEndpoint('VITE_KB_BUILDER_ENDPOINT', 'https://swapped.example', 'kb-builder', { fetchImpl });
      expect(r.status).toBe('mismatch');
      expect(r.expected).toBe('kb-builder');
      expect(r.service).toBe('blueprint');
    });

    it('treats a network error as unreachable, not a mismatch', async () => {
      const fetchImpl = fakeFetch(null, { throwErr: new Error('ECONNREFUSED') });
      const r = await checkEndpoint('VITE_CHAT_ENDPOINT', 'https://down.example', 'chat-stream', { fetchImpl });
      expect(r.status).toBe('unreachable');
      expect(r.error).toContain('ECONNREFUSED');
    });

    it('treats a non-2xx response as unreachable', async () => {
      const fetchImpl = fakeFetch({}, { ok: false, status: 403 });
      const r = await checkEndpoint('VITE_CHAT_ENDPOINT', 'https://forbidden.example', 'chat-stream', { fetchImpl });
      expect(r.status).toBe('unreachable');
      expect(r.error).toContain('403');
    });

    it('accepts the `server` field (mcp-style /health)', async () => {
      const fetchImpl = fakeFetch({ server: 'alti-mcp' });
      const r = await checkEndpoint('X', 'https://mcp.example', 'alti-mcp', { fetchImpl });
      expect(r.status).toBe('ok');
    });
  });

  describe('run', () => {
    const base = {
      VITE_KB_BUILDER_ENDPOINT: 'https://kb.example',
      VITE_BLUEPRINT_ENDPOINT: 'https://bp.example',
      VITE_CHAT_ENDPOINT: 'https://chat.example',
    };
    // /health bodies keyed by host, so a fetch resolves to the right service.
    const healthByHost = {
      'kb.example': 'kb-builder',
      'bp.example': 'blueprint',
      'chat.example': 'chat-stream',
    };
    const routingFetch = () =>
      vi.fn(async (url) => {
        const host = new URL(url).host;
        return { ok: true, status: 200, json: async () => ({ service: healthByHost[host] }) };
      });

    it('returns 0 when every endpoint resolves to its own service', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});
      const code = await run(base, { fetchImpl: routingFetch() });
      expect(code).toBe(0);
    });

    it('returns 1 when two endpoints are swapped', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const swapped = {
        ...base,
        VITE_KB_BUILDER_ENDPOINT: 'https://bp.example',
        VITE_BLUEPRINT_ENDPOINT: 'https://kb.example',
      };
      const code = await run(swapped, { fetchImpl: routingFetch() });
      expect(code).toBe(1);
    });

    it('skips absent endpoints (presence is validate-env.js’s job)', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});
      const fetchImpl = routingFetch();
      const code = await run({ VITE_KB_BUILDER_ENDPOINT: 'https://kb.example' }, { fetchImpl });
      expect(code).toBe(0);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it('warns but passes (exit 0) when an endpoint is unreachable by default', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const fetchImpl = vi.fn(async () => {
        throw new Error('offline');
      });
      const code = await run({ VITE_KB_BUILDER_ENDPOINT: 'https://kb.example' }, { fetchImpl });
      expect(code).toBe(0);
    });

    it('fails (exit 1) on unreachable when STRICT_ENDPOINT_VALIDATION=true', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const fetchImpl = vi.fn(async () => {
        throw new Error('offline');
      });
      const code = await run(
        { VITE_KB_BUILDER_ENDPOINT: 'https://kb.example', STRICT_ENDPOINT_VALIDATION: 'true' },
        { fetchImpl },
      );
      expect(code).toBe(1);
    });

    it('skips entirely when SKIP_ENDPOINT_VALIDATION=true', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});
      const fetchImpl = routingFetch();
      const code = await run({ ...base, SKIP_ENDPOINT_VALIDATION: 'true' }, { fetchImpl });
      expect(code).toBe(0);
      expect(fetchImpl).not.toHaveBeenCalled();
    });
  });
});
