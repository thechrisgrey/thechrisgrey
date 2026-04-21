import { createHmac, timingSafeEqual } from "crypto";

export const SIGNATURE_MAX_AGE_SECONDS = 300;

/**
 * Verify HMAC signature on an incoming Lambda Function URL event.
 *
 * @param {object} event - The Lambda event.
 * @param {string} signingKey - Shared secret. Empty string disables verification.
 * @returns {{ valid: true } | { valid: false, error: string }}
 */
export function verifySignature(event, signingKey) {
  if (!signingKey) {
    return { valid: true };
  }

  const timestamp = event.headers?.["x-chat-timestamp"];
  const signature = event.headers?.["x-chat-signature"];

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
