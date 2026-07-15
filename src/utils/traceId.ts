/**
 * Per-request trace ID generation for distributed tracing.
 *
 * Each API call from the frontend gets a unique trace ID (UUID v4) sent as the
 * `X-Request-Id` header. Lambda handlers read this header and use it as the
 * requestId in structured log lines, creating end-to-end traceability from
 * browser to CloudWatch logs.
 *
 * The trace ID is also set as a Sentry tag and RUM breadcrumb so that frontend
 * errors can be correlated with backend logs by searching for the same ID in
 * both Sentry and CloudWatch.
 *
 * Usage:
 *   import { withTraceId } from '../utils/traceId';
 *   const response = await fetch(url, withTraceId({ method: 'POST', headers: {...} }));
 *
 * For sendBeacon (which cannot set headers), include the trace ID in the body:
 *   import { generateTraceId } from '../utils/traceId';
 *   const traceId = generateTraceId();
 *   navigator.sendBeacon(url, JSON.stringify({ ...body, traceId }));
 */

import { addBreadcrumb } from './rum';
import { addSentryBreadcrumb, isSentryInitialized } from './sentry';

/**
 * Generate a UUID v4 trace ID (falls back to timestamp-based if crypto.randomUUID
 * is unavailable).
 */
export function generateTraceId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `trace-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Set trace context in Sentry and RUM so errors captured during this request
 * carry the trace ID for cross-service correlation.
 */
function setTraceContext(traceId: string): void {
  addBreadcrumb('custom', `trace_id: ${traceId}`, { traceId });
  if (isSentryInitialized()) {
    addSentryBreadcrumb('trace', `request_trace_id: ${traceId}`, { traceId });
  }
}

/**
 * Wrap a fetch init/options object with an X-Request-Id header and set trace
 * context in Sentry/RUM. Does not mutate the original object.
 */
export function withTraceId<T extends RequestInit>(init: T): T {
  const traceId = generateTraceId();
  setTraceContext(traceId);
  return {
    ...init,
    headers: {
      ...init.headers,
      'X-Request-Id': traceId,
    },
  };
}
