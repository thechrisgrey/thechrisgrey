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
 * @param {import("@aws-sdk/client-cognito-identity-provider").CognitoIdentityProviderClient} cognitoClient
 * @param {import("@aws-sdk/client-cognito-identity-provider").GetUserCommand} GetUserCommand
 * @param {string|undefined} authHeader - The `Authorization` header value (e.g. "Bearer xxx").
 * @param {{ allowlist?: string }} [options] - Override the allowlist source (defaults to ADMIN_ALLOWLIST env).
 * @returns {Promise<object|null>} The GetUser response if authenticated AND authorized, else null.
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
    console.error("ADMIN_ALLOWLIST is empty — denying admin access (fail closed).");
    return null;
  }

  try {
    const command = new GetUserCommand({ AccessToken: authHeader.slice(7) });
    const response = await cognitoClient.send(command);

    const attrs = response.UserAttributes || [];
    const email = attrs
      .find((a) => a.Name === "email")
      ?.Value?.trim()
      .toLowerCase();
    const emailVerified = attrs.find((a) => a.Name === "email_verified")?.Value === "true";

    if (!email || !emailVerified || !allowed.includes(email)) {
      console.error("Cognito user not authorized for admin:", email || "(no email)");
      return null;
    }

    return response;
  } catch (error) {
    console.error("Token validation failed:", error.name);
    return null;
  }
}
