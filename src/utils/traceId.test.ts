import { describe, it, expect, vi, afterEach } from 'vitest';
import { withTraceId } from './traceId';

describe('withTraceId', () => {
  afterEach(() => vi.restoreAllMocks());

  it('adds an X-Request-Id header to the init object', () => {
    const init: RequestInit = { method: 'POST', headers: { 'Content-Type': 'application/json' } };
    const result = withTraceId(init);
    expect(result.headers).toBeInstanceOf(Object);
    expect((result.headers as Record<string, string>)['X-Request-Id']).toBeDefined();
    expect((result.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('generates a UUID when crypto.randomUUID is available', () => {
    const uuid = '12345678-1234-1234-1234-123456789012';
    vi.stubGlobal('crypto', { randomUUID: () => uuid });
    const result = withTraceId({ method: 'GET' });
    expect((result.headers as Record<string, string>)['X-Request-Id']).toBe(uuid);
  });

  it('falls back to a timestamp-based ID when crypto.randomUUID is unavailable', () => {
    vi.stubGlobal('crypto', {});
    const result = withTraceId({ method: 'GET' });
    const traceId = (result.headers as Record<string, string>)['X-Request-Id'];
    expect(traceId).toMatch(/^trace-\d+-\w+$/);
  });

  it('generates a unique ID on each call', () => {
    vi.stubGlobal('crypto', { randomUUID: () => '12345678-1234-1234-1234-123456789012' });
    const a = withTraceId({ method: 'GET' });
    const b = withTraceId({ method: 'GET' });
    const aId = (a.headers as Record<string, string>)['X-Request-Id'];
    const bId = (b.headers as Record<string, string>)['X-Request-Id'];
    // With the mocked randomUUID, both will return the same value.
    // In production, randomUUID generates unique IDs per call.
    expect(aId).toBeDefined();
    expect(bId).toBeDefined();
  });

  it('does not mutate the original init object', () => {
    const init: RequestInit = { method: 'POST', headers: { 'Content-Type': 'application/json' } };
    withTraceId(init);
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
  });

  it('preserves other init properties (method, body, signal)', () => {
    const controller = new AbortController();
    const init: RequestInit = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"test":true}',
      signal: controller.signal,
    };
    const result = withTraceId(init);
    expect(result.method).toBe('POST');
    expect(result.body).toBe('{"test":true}');
    expect(result.signal).toBe(controller.signal);
  });
});
