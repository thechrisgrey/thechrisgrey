import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSessionTokenManager } from './sessionToken';

const ISSUER_RESPONSE = {
  chatToken: 'v1.9999999999.chat.abc.sig',
  blueprintToken: 'v1.9999999999.blueprint.abc.sig',
  chatExpiresIn: 1800,
  blueprintExpiresIn: 600,
};

function makeFetch(response = ISSUER_RESPONSE, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    json: vi.fn().mockResolvedValue(response),
  });
}

function makeDeps(overrides: Partial<Parameters<typeof createSessionTokenManager>[0]> = {}) {
  return {
    endpoint: 'https://session.example/',
    fetchImpl: makeFetch(),
    getTurnstileToken: vi.fn().mockResolvedValue('turnstile-tok'),
    getDeviceId: vi.fn().mockReturnValue('device-abc-123'),
    now: () => 1_000_000_000_000, // fixed ms
    ...overrides,
  };
}

describe('createSessionTokenManager', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns an empty string and makes no network call when the endpoint is unset', async () => {
    const deps = makeDeps({ endpoint: '' });
    const mgr = createSessionTokenManager(deps);
    expect(await mgr.getToken('chat')).toBe('');
    expect(deps.fetchImpl).not.toHaveBeenCalled();
    expect(deps.getTurnstileToken).not.toHaveBeenCalled();
  });

  it('mints tokens via Turnstile + the issuer and returns the scoped token', async () => {
    const deps = makeDeps();
    const mgr = createSessionTokenManager(deps);

    expect(await mgr.getToken('chat')).toBe(ISSUER_RESPONSE.chatToken);
    expect(await mgr.getToken('blueprint')).toBe(ISSUER_RESPONSE.blueprintToken);

    // Turnstile ran, and exactly one issuance fetch served both scopes (cached).
    expect(deps.getTurnstileToken).toHaveBeenCalledTimes(1);
    expect(deps.fetchImpl).toHaveBeenCalledTimes(1);

    const [url, init] = (deps.fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://session.example/');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toEqual({ deviceId: 'device-abc-123', turnstileToken: 'turnstile-tok' });
  });

  it('refreshes once the cached token is within 30s of expiry', async () => {
    let nowMs = 1_000_000_000_000;
    const deps = makeDeps({ now: () => nowMs });
    const mgr = createSessionTokenManager(deps);

    await mgr.getToken('chat'); // mints, chat exp = now + 1800s
    expect(deps.fetchImpl).toHaveBeenCalledTimes(1);

    nowMs += 1771 * 1000; // 1771s later → 29s of life left (< 30s threshold)
    await mgr.getToken('chat');
    expect(deps.fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('dedupes concurrent issuance into a single fetch', async () => {
    const deps = makeDeps();
    const mgr = createSessionTokenManager(deps);
    const [a, b] = await Promise.all([mgr.getToken('chat'), mgr.getToken('blueprint')]);
    expect(a).toBe(ISSUER_RESPONSE.chatToken);
    expect(b).toBe(ISSUER_RESPONSE.blueprintToken);
    expect(deps.fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('returns an empty string (graceful) when issuance fails', async () => {
    const deps = makeDeps({ fetchImpl: makeFetch(ISSUER_RESPONSE, false) });
    const mgr = createSessionTokenManager(deps);
    expect(await mgr.getToken('chat')).toBe('');
  });

  it('returns an empty string when Turnstile throws', async () => {
    const deps = makeDeps({ getTurnstileToken: vi.fn().mockRejectedValue(new Error('turnstile down')) });
    const mgr = createSessionTokenManager(deps);
    expect(await mgr.getToken('chat')).toBe('');
  });

  it('resets inflight after a failure so a later call retries (not stuck on the first failure)', async () => {
    // First issuance fails; a subsequent call must attempt a FRESH issuance rather
    // than inheriting the dead inflight promise. Guards the dedup reset in finally().
    const getTurnstileToken = vi
      .fn()
      .mockRejectedValueOnce(new Error('transient turnstile error'))
      .mockResolvedValueOnce('turnstile-tok');
    const deps = makeDeps({ getTurnstileToken });
    const mgr = createSessionTokenManager(deps);

    expect(await mgr.getToken('chat')).toBe(''); // first attempt fails gracefully
    expect(await mgr.getToken('chat')).toBe(ISSUER_RESPONSE.chatToken); // retry succeeds
    expect(getTurnstileToken).toHaveBeenCalledTimes(2);
  });
});
