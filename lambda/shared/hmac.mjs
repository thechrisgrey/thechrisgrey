import { createHmac, timingSafeEqual } from "crypto";

export const SIGNATURE_MAX_AGE_SECONDS = 300;

/**
 * Verify an HMAC signature on an incoming Lambda Function URL event.
 *
 * Header names are parameterized so multiple services can share this one
 * implementation: chat-stream uses x-chat-* (the defaults), blueprint passes
 * its x-blueprint-* pair via `options`.
 *
 * @param {{ headers?: Record<string, string>, body?: string }} event - The Lambda event (Function URL shape).
 * @param {string|undefined} signingKey - Shared secret. Empty string disables verification.
 * @param {{ signatureHeader?: string, timestampHeader?: string }} [options]
 * @returns {{ valid: true } | { valid: false, error: string }}
 */
export function verifySignature(
  event,
  signingKey,
  { signatureHeader = "x-chat-signature", timestampHeader = "x-chat-timestamp" } = {},
) {
  if (!signingKey) {
    return { valid: true };
  }

  const headers = event.headers || {};
  const timestamp = headers[timestampHeader];
  const signature = headers[signatureHeader];

  if (!timestamp || !signature) {
    return { valid: false, error: "missing_headers" };
  }

  const ts = parseInt(timestamp, 10);
  if (isNaN(ts)) {
    return { valid: false, error: "invalid_timestamp" };
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > SIGNATURE_MAX_AGE_SECONDS) {
    return { valid: false, error: "expired_timestamp" };
  }

  const expected = createHmac("sha256", signingKey)
    .update(`${timestamp}.${event.body || ""}`)
    .digest("hex");

  try {
    const sigBuf = Buffer.from(signature, "hex");
    const expBuf = Buffer.from(expected, "hex");
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      return { valid: false, error: "invalid_signature" };
    }
  } catch {
    return { valid: false, error: "invalid_signature" };
  }

  return { valid: true };
}
