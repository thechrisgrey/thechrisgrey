/**
 * Structured JSON logger for the Lambda fleet.
 *
 * Every Lambda currently writes `console.log(JSON.stringify({ requestId, event,
 * ...extra }))` inline. This module centralises that pattern so:
 *
 *  - Log shape is consistent (level, timestamp, requestId, event, extra fields)
 *  - PII (emails, phone-shaped digit runs) is redacted before it hits CloudWatch
 *  - Log level is controlled by the LOG_LEVEL env var (debug|info|warn|error)
 *  - Request-scoped child loggers auto-attach requestId without repetition
 *
 * Zero dependencies — the module is imported at cold start in every handler, so
 * it must not pull in anything that adds to the bundle.
 *
 * Usage:
 *   import { createLogger } from "lambda-shared/logger";
 *   const log = createLogger(requestId, { service: "chat-stream" });
 *   log.info("request_start", { method, path });
 *   log.error("handler_error", { error: err.name, message: err.message });
 */

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

const DEFAULT_LEVEL = LEVELS[process.env.LOG_LEVEL?.toLowerCase()] ?? LEVELS.info;

// PII redaction patterns (mirrors memory.mjs sanitizeFactContent guards).
// Email: token with '@' and a dotted domain. The '.' after '@' prevents
// false-positives on bare social handles like "@thechrisgrey".
const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/g;
// Phone / long digit run: 10+ digits joined only by phone-ish separators.
const PHONE_RE = /(?:\+?\d[\s().-]*){10,}/g;

const REDACTED = "[REDACTED]";

/**
 * Deep-clone a value and redact PII in any string fields or values.
 * Non-serialisable values (functions, undefined) are dropped by JSON.stringify.
 * @param {unknown} value
 * @returns {unknown}
 */
function redact(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    return value.replace(EMAIL_RE, REDACTED).replace(PHONE_RE, REDACTED);
  }
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(redact);

  const out = {};
  for (const [key, val] of Object.entries(value)) {
    // Skip keys that commonly hold secrets regardless of value content.
    const lowerKey = key.toLowerCase();
    if (
      lowerKey === "authorization" ||
      lowerKey === "token" ||
      lowerKey === "accesstoken" ||
      lowerKey === "secret" ||
      lowerKey === "password" ||
      lowerKey === "signingkey" ||
      lowerKey === "sessiontokenkey"
    ) {
      out[key] = REDACTED;
    } else {
      out[key] = redact(val);
    }
  }
  return out;
}

/**
 * Emit a structured log line to the appropriate console method.
 * @param {number} levelNum
 * @param {string} levelName
 * @param {string|null} requestId
 * @param {object} context
 * @param {string} event
 * @param {object} [extra]
 */
function emit(levelNum, levelName, requestId, context, event, extra) {
  if (levelNum < DEFAULT_LEVEL) return;

  const payload = { ...context, requestId, level: levelName, event, ts: new Date().toISOString() };
  if (extra && typeof extra === "object" && Object.keys(extra).length > 0) {
    Object.assign(payload, redact(extra));
  }

  const line = JSON.stringify(payload);
  if (levelNum >= LEVELS.error) {
    console.error(line);
  } else if (levelNum >= LEVELS.warn) {
    console.warn(line);
  } else {
    console.log(line);
  }
}

/**
 * Create a request-scoped logger.
 *
 * @param {string|null} requestId - Correlation ID for the current invocation,
 *   or null for module-scope / startup loggers that have no request context.
 * @param {object} [context={}] - Static fields attached to every log line
 *   (e.g. `{ service: "chat-stream" }`).
 * @returns {{ debug: (event:string, extra?:object)=>void, info: (event:string, extra?:object)=>void, warn: (event:string, extra?:object)=>void, error: (event:string, extra?:object)=>void }}
 */
export function createLogger(requestId, context = {}) {
  return {
    debug(event, extra) {
      emit(LEVELS.debug, "debug", requestId, context, event, extra);
    },
    info(event, extra) {
      emit(LEVELS.info, "info", requestId, context, event, extra);
    },
    warn(event, extra) {
      emit(LEVELS.warn, "warn", requestId, context, event, extra);
    },
    error(event, extra) {
      emit(LEVELS.error, "error", requestId, context, event, extra);
    },
  };
}

export { redact, LEVELS };
