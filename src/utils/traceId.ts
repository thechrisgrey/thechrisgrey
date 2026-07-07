/**
 * Per-request trace ID generation for distributed tracing.
 *
 * Each API call from the frontend gets a unique trace ID (UUID v4) sent as the
 * `X-Request-Id` header. Lambda handlers read this header and use it as the
 * requestId in structured log lines, creating end-to-end traceability from
 * browser to CloudWatch logs.
 *
 * Usage:
 *   import { withTraceId } from '../utils/traceId';
 *   const response = await fetch(url, withTraceId({ method: 'POST', headers: {...} }));
 */

function generateTraceId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `trace-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Wrap a fetch init/options object with an X-Request-Id header.
 * Does not mutate the original object.
 */
export function withTraceId<T extends RequestInit>(init: T): T {
  return {
    ...init,
    headers: {
      ...init.headers,
      'X-Request-Id': generateTraceId(),
    },
  };
}
