/**
 * Validate a Cognito access token via the GetUser API.
 *
 * @param {import("@aws-sdk/client-cognito-identity-provider").CognitoIdentityProviderClient} cognitoClient
 * @param {import("@aws-sdk/client-cognito-identity-provider").GetUserCommand} GetUserCommand
 * @param {string|undefined} authHeader - The `Authorization` header value (e.g. "Bearer xxx").
 * @returns {Promise<object|null>} The GetUser response, or null if invalid/missing.
 */
export async function validateCognitoToken(cognitoClient, GetUserCommand, authHeader) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;

  try {
    const command = new GetUserCommand({ AccessToken: authHeader.slice(7) });
    const response = await cognitoClient.send(command);
    return response;
  } catch (error) {
    console.error("Token validation failed:", error.name);
    return null;
  }
}
