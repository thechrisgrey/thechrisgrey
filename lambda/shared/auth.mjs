import { createLogger } from "./logger.mjs";

const log = createLogger(null, { service: "auth" });

/**
 * Validate a Cognito access token via the GetUser API AND authorize the caller
 * against an explicit admin allowlist.
 *
 * Authenticating against the pool is not sufficient: any identity that exists in
 * the pool would otherwise gain full admin access (KB CRUD + S3 publish of the
 * public Alti agent's corpus). This helper additionally requires the caller's
 * verified email to be present in the `ADMIN_ALLOWLIST` env var (comma-separated).
 *
 * Fails closed: if the allowlist is empty/unset, NO caller is authorized.
 *
 * @param {{ send: any }} cognitoClient - Injected CognitoIdentityProviderClient (duck-typed: must have .send)
 * @param {{ new (input: any): any }} GetUserCommand - Injected GetUserCommand constructor
 * @param {string|undefined} authHeader - The `Authorization` header value (e.g. "Bearer xxx").
 * @param {{ allowlist?: string }} [options] - Override the allowlist source (defaults to ADMIN_ALLOWLIST env).
 * @returns {Promise<any>} The GetUser response if authenticated AND authorized, else null.
 */
export async function validateCognitoToken(
  cognitoClient,
  GetUserCommand,
  authHeader,
  { allowlist = process.env.ADMIN_ALLOWLIST } = {},
) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;

  const allowed = (allowlist || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (allowed.length === 0) {
    log.error("allowlist_empty", { message: "ADMIN_ALLOWLIST is empty — denying admin access (fail closed)" });
    return null;
  }

  try {
    const command = new GetUserCommand({ AccessToken: authHeader.slice(7) });
    const response = await cognitoClient.send(command);

    const attrs = /** @type {{ Name: string, Value?: string }[]} */ (response.UserAttributes || []);
    const email = attrs
      .find((a) => a.Name === "email")
      ?.Value?.trim()
      .toLowerCase();
    const emailVerified = attrs.find((a) => a.Name === "email_verified")?.Value === "true";

    if (!email || !emailVerified || !allowed.includes(email)) {
      log.warn("user_not_authorized", { email: email || "(no email)" });
      return null;
    }

    return response;
  } catch (error) {
    log.error("token_validation_failed", { error: error instanceof Error ? error.name : "Unknown" });
    return null;
  }
}
