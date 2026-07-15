import { verifySignature } from "./hmac.mjs";
import { verifySessionToken } from "./sessionToken.mjs";

/**
 * Authenticate an incoming request, accepting EITHER a server-issued session
 * token (the new model) OR the legacy request-body HMAC signature (transition
 * window). Encapsulates the precedence so chat-stream and blueprint share one
 * source of truth for auth.
 *
 * Precedence:
 *   1. If an `Authorization: Bearer <token>` header is present AND a session
 *      signing key is configured, the token path governs — a present-but-invalid
 *      token is REJECTED (it does not silently fall through to legacy).
 *   2. Otherwise, fall back to the legacy HMAC signature (verifySignature),
 *      which itself no-ops when `legacyKey` is empty.
 *
 * After the transition window, callers drop the legacy branch and require a token.
 *
 * @param {{ headers?: Record<string, string> }} event - Lambda Function URL event
 * @param {object} [opts] - Auth options
 * @param {string} [opts.sessionKey] - server-only session-token signing key ("" disables the token path)
 * @param {string} [opts.scope] - required token scope ("chat" | "blueprint")
 * @param {string} [opts.legacyKey] - legacy shared HMAC key ("" disables legacy verification)
 * @param {{signatureHeader?:string,timestampHeader?:string}} [opts.legacySigOptions]
 * @returns {{valid:true, method:"token"|"legacy", deviceHash?:string} | {valid:false, method:"token"|"legacy", error:string}}
 */
export function authenticateRequest(event, { sessionKey, scope, legacyKey, legacySigOptions } = {}) {
  const authHeader = event.headers?.authorization || event.headers?.Authorization || "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

  if (bearer && sessionKey) {
    const r = verifySessionToken(bearer, sessionKey, { scope });
    return r.valid
      ? { valid: true, method: "token", deviceHash: r.deviceHash }
      : { valid: false, method: "token", error: r.error };
  }

  const sig = verifySignature(event, legacyKey, legacySigOptions);
  return sig.valid ? { valid: true, method: "legacy" } : { valid: false, method: "legacy", error: sig.error };
}
