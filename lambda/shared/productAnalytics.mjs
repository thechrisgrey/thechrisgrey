/**
 * Server-side product analytics for the Lambda fleet.
 *
 * Wraps PostHog (`posthog-node`) to emit product events from Lambda handlers,
 * unifying frontend and backend product analytics in a single dashboard. Events
 * track feature usage (which endpoints are called, outcomes, latency) so agents
 * can measure the impact of their changes on user behavior.
 *
 * Opt-in: only active when `POSTHOG_KEY` is set. All functions are no-ops
 * otherwise, so Lambdas without PostHog configured behave identically to
 * before (zero network calls, zero event capture, zero cold-start overhead
 * beyond the static import).
 *
 * PII-safe: only anonymous event names and non-PII properties are sent
 * (feature name, outcome, latency, tool name). No user messages, emails, or
 * device IDs are forwarded. The `distinctId` is a hashed anonymous identifier,
 * never a raw device ID or email.
 *
 * Integration points (per Lambda handler):
 *   - captureProductEvent(event, properties) at key product moments
 *   - flushProductAnalytics() in finally blocks (ensures events ship before freeze)
 *
 * Usage:
 *   import { captureProductEvent, flushProductAnalytics } from "lambda-shared/productAnalytics";
 *   captureProductEvent("ChatMessageSent", { outcome: "success", latencyMs: 1200 });
 *   await flushProductAnalytics();
 */

import { createLogger } from "./logger.mjs";
import { PostHog } from "posthog-node";

const log = createLogger(null, { service: "product-analytics" });

const POSTHOG_KEY = process.env.POSTHOG_KEY || "";
const POSTHOG_HOST = process.env.POSTHOG_HOST || "https://us.i.posthog.com";

const initialized = POSTHOG_KEY.length > 0;
/** @type {import("posthog-node").PostHog | null} */
let client = null;

if (initialized) {
  try {
    client = new PostHog(POSTHOG_KEY, { host: POSTHOG_HOST });
    log.info("posthog_initialized", { host: POSTHOG_HOST });
  } catch (err) {
    log.warn("posthog_init_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Check if product analytics is initialized and active.
 * @returns {boolean}
 */
export function isProductAnalyticsInitialized() {
  return initialized;
}

/**
 * Capture a product event. When PostHog is not configured, this is a no-op.
 *
 * @param {string} event - Event name (e.g. "ChatMessageSent", "BlueprintGenerated")
 * @param {Record<string, unknown>} [properties={}] - Non-PII properties (outcome, latency, tool name)
 * @param {string} [distinctId="anonymous"] - Anonymous user identifier (hashed, never raw PII)
 */
export function captureProductEvent(event, properties = {}, distinctId = "anonymous") {
  if (!initialized || !client) return;

  try {
    client.capture({
      distinctId,
      event,
      properties: {
        ...properties,
        source: "lambda",
        service: process.env.AWS_LAMBDA_FUNCTION_NAME || "unknown",
        region: process.env.AWS_REGION || "unknown",
      },
    });
  } catch (err) {
    log.warn("posthog_capture_failed", {
      event,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Flush the PostHog event buffer. Must be called before the Lambda returns
 * (typically in a finally block) to ensure events are sent before the
 * execution environment freezes. No-op when PostHog is not configured.
 *
 * @param {number} [timeout=2000] - Maximum time to wait for flush (ms)
 * @returns {Promise<void>}
 */
export async function flushProductAnalytics(timeout = 2000) {
  if (!initialized || !client) return;
  try {
    await client.shutdown(timeout);
  } catch {
    // Swallow — analytics flush failure must not break the handler.
  }
}

export { initialized as isPostHogActive };
