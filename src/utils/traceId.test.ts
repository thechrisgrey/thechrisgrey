import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

// Mock rum and sentry to verify trace context propagation
vi.mock('./rum', () => ({
  addBreadcrumb: vi.fn(),
  isRumInitialized: false,
}));

vi.mock('./sentry', () => ({
  addSentryBreadcrumb: vi.fn(),
  isSentryInitialized: vi.fn(() => false),
}));

import { withTraceId, generateTraceId } from './traceId';
import { addBreadcrumb } from './rum';
import { addSentryBreadcrumb, isSentryInitialized } from './sentry';

describe('withTraceId', () => {
  afterEach(() => vi.restoreAllMocks());
  beforeEach(() => vi.clearAllMocks());

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
    const result = withTraceId({ method: 'GET' } as RequestInit);
    expect((result.headers as Record<string, string>)['X-Request-Id']).toBe(uuid);
  });

  it('falls back to a timestamp-based ID when crypto.randomUUID is unavailable', () => {
    vi.stubGlobal('crypto', {});
    const result = withTraceId({ method: 'GET' } as RequestInit);
    const traceId = (result.headers as Record<string, string>)['X-Request-Id'];
    expect(traceId).toMatch(/^trace-\d+-\w+$/);
  });

  it('generates a unique ID on each call', () => {
    vi.stubGlobal('crypto', { randomUUID: () => '12345678-1234-1234-1234-123456789012' });
    const a = withTraceId({ method: 'GET' } as RequestInit);
    const b = withTraceId({ method: 'GET' } as RequestInit);
    const aId = (a.headers as Record<string, string>)['X-Request-Id'];
    const bId = (b.headers as Record<string, string>)['X-Request-Id'];
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

  it('sets trace context as a RUM breadcrumb', () => {
    const uuid = 'trace-test-uuid';
    vi.stubGlobal('crypto', { randomUUID: () => uuid });
    withTraceId({ method: 'GET' } as RequestInit);

    expect(addBreadcrumb).toHaveBeenCalledWith('custom', `trace_id: ${uuid}`, { traceId: uuid });
  });

  it('does not call Sentry breadcrumb when Sentry is not initialized', () => {
    vi.mocked(isSentryInitialized).mockReturnValue(false);
    const uuid = 'trace-test-uuid-2';
    vi.stubGlobal('crypto', { randomUUID: () => uuid });
    withTraceId({ method: 'GET' } as RequestInit);

    expect(addSentryBreadcrumb).not.toHaveBeenCalled();
  });
});

describe('generateTraceId', () => {
  afterEach(() => vi.restoreAllMocks());

  it('generates a UUID when crypto.randomUUID is available', () => {
    const uuid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    vi.stubGlobal('crypto', { randomUUID: () => uuid });
    expect(generateTraceId()).toBe(uuid);
  });

  it('falls back to a timestamp-based ID when crypto.randomUUID is unavailable', () => {
    vi.stubGlobal('crypto', {});
    const traceId = generateTraceId();
    expect(traceId).toMatch(/^trace-\d+-\w+$/);
  });

  it('is exported and callable standalone', () => {
    expect(typeof generateTraceId).toBe('function');
    const traceId = generateTraceId();
    expect(typeof traceId).toBe('string');
    expect(traceId.length).toBeGreaterThan(0);
  });
});
