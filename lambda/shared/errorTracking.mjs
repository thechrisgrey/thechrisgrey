/**
 * Sentry error tracking for the Lambda fleet.
 *
 * Provides contextualized error capture with request-scoped tags, breadcrumbs,
 * and user context. Complements the structured logger (logger.mjs) by forwarding
 * unhandled errors to Sentry for aggregation, grouping, and stack trace
 * resolution across all Lambda services.
 *
 * Opt-in: only active when SENTRY_DSN is set. All functions are no-ops
 * otherwise, so Lambdas without Sentry configured behave identically to
 * before (zero network calls, zero event capture, zero cold-start overhead
 * beyond the static import).
 *
 * PII redaction: all context and breadcrumb data passes through the logger's
 * redact() function before being sent to Sentry, ensuring emails, phone-shaped
 * digit runs, and sensitive keys never leave the Lambda.
 *
 * Integration points (per Lambda handler):
 *   - setRequestContext(requestId, service, extra) at request start
 *   - addBreadcrumb(category, message, data) at key operation boundaries
 *   - captureError(error, context) in top-level catch blocks
 *   - flushSentry() in finally blocks (ensures events ship before freeze)
 *
 * Usage:
 *   import { setRequestContext, captureError, addBreadcrumb, flushSentry } from "lambda-shared/errorTracking";
 *   setRequestContext(requestId, "chat-stream", { method, path });
 *   addBreadcrumb("auth", "request_authenticated", { method: auth.method });
 *   // ... on error ...
 *   captureError(error, { handler: "stream", path });
 *   // ... in finally ...
 *   await flushSentry();
 */

import * as Sentry from "@sentry/node";
import { redact } from "./logger.mjs";

const DSN = process.env.SENTRY_DSN || "";
const ENVIRONMENT = process.env.ENVIRONMENT || process.env.AWS_LAMBDA_FUNCTION_NAME || "production";
const RELEASE = process.env.SENTRY_RELEASE || "";

const initialized = DSN.length > 0;

if (initialized) {
  Sentry.init({
    dsn: DSN,
    environment: ENVIRONMENT,
    release: RELEASE || undefined,
    tracesSampleRate: 0,
    // Disable auto-installed integrations that hook global handlers — we
    // capture errors manually in each handler's catch block for precise
    // context control and to avoid double-reporting with the structured logger.
    integrations: [],
  });
}

/**
 * Check if Sentry is initialized and active.
 * @returns {boolean}
 */
export function isSentryInitialized() {
  return initialized;
}

/**
 * Set request-scoped context for Sentry. Call at the start of each Lambda
 * invocation so all subsequent errors and breadcrumbs carry the correlation ID
 * and service name.
 *
 * @param {string|null} requestId - Correlation ID for the current invocation
 * @param {string} service - Service name (e.g. "chat-stream", "blueprint")
 * @param {Record<string, unknown>} [extra={}] - Additional context (deviceId, method, path, etc.)
 */
export function setRequestContext(requestId, service, extra = {}) {
  if (!initialized) return;

  Sentry.setTags({
    requestId: requestId || "unknown",
    service,
    function_name: process.env.AWS_LAMBDA_FUNCTION_NAME || "unknown",
    aws_region: process.env.AWS_REGION || "unknown",
  });

  const deviceId = /** @type {string|undefined} */ (extra.deviceId);
  if (deviceId) {
    Sentry.setUser({ id: deviceId });
  }

  Sentry.setContext("lambda", /** @type {Record<string, unknown>} */ (redact({ requestId, service, ...extra })));
}

/**
 * Capture an exception with optional context. PII in the context is redacted
 * before being sent to Sentry. When Sentry is not configured, this is a no-op.
 *
 * @param {unknown} error - The error to capture (Error, string, or unknown catch variable)
 * @param {Record<string, unknown>} [context={}] - Additional context attached to the event
 */
export function captureError(error, context = {}) {
  if (!initialized) return;

  const extra = /** @type {Record<string, unknown>} */ (redact(context));
  if (error instanceof Error) {
    Sentry.captureException(error, { extra });
  } else {
    Sentry.captureMessage(String(error), { level: "error", extra });
  }
}

/**
 * Add a breadcrumb to Sentry's ring buffer. Breadcrumbs trace the request flow
 * leading up to an error, making it possible to reconstruct what happened.
 *
 * @param {string} category - Breadcrumb category (e.g. "auth", "ratelimit", "bedrock")
 * @param {string} message - Human-readable description
 * @param {Record<string, unknown>} [data={}] - Structured data attached to the breadcrumb
 */
export function addBreadcrumb(category, message, data = {}) {
  if (!initialized) return;

  Sentry.addBreadcrumb({
    category,
    message,
    data: /** @type {Record<string, unknown>} */ (redact(data)),
    level: category === "error" ? "error" : "info",
  });
}

/**
 * Flush the Sentry event buffer. Must be called before the Lambda returns
 * (typically in a finally block) to ensure events are sent before the
 * execution environment freezes. No-op when Sentry is not configured.
 *
 * @param {number} [timeout=2000] - Maximum time to wait for flush (ms)
 * @returns {Promise<void>}
 */
export async function flushSentry(timeout = 2000) {
  if (!initialized) return;
  await Sentry.flush(timeout);
}
