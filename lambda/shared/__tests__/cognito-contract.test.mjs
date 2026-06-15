/**
 * Cognito auth CONTRACT test — opt-in, against the LIVE Cognito user pool.
 *
 * The /admin gate's entire trust model rests on the SHAPE of the InitiateAuth
 * response: useAuth.ts (src/hooks/useAuth.ts) reads
 * `response.AuthenticationResult.{AccessToken,IdToken,RefreshToken,ExpiresIn}`
 * and stores a token the gate later trusts. Every React test mocks the Cognito
 * client entirely (src/__tests__/integration/Admin.integration.test.tsx), so NO
 * automated test proves the real USER_PASSWORD_AUTH flow still returns that
 * shape. A pool-config change (auth flow disabled, response shape drift) would
 * ship green and lock admins out — or worse, change the token contract silently.
 *
 * This is the "run the real thing" guard for that contract.
 *
 * GATING: skips cleanly (exit 0) unless COGNITO_CONTRACT_TESTS is set, so CI and
 * the default `node --test` run never call AWS. Enable with:
 *
 *   COGNITO_CONTRACT_TESTS=1 \
 *   COGNITO_CLIENT_ID=<VITE_COGNITO_CLIENT_ID> \
 *   COGNITO_TEST_EMAIL=<dedicated test user> \
 *   COGNITO_TEST_PASSWORD=<password> \
 *   node --test lambda/shared/__tests__/cognito-contract.test.mjs
 *
 * Optional env: AWS_REGION (default us-east-1, where the pool lives). Requires AWS
 * credentials with cognito-idp:InitiateAuth (+ the pool must allow
 * USER_PASSWORD_AUTH). The InitiateAuth call itself is unauthenticated, but the
 * SDK still needs a region; GetUser uses the returned AccessToken.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const REQUIRED = ["COGNITO_CLIENT_ID", "COGNITO_TEST_EMAIL", "COGNITO_TEST_PASSWORD"];
const missing = REQUIRED.filter((k) => !process.env[k]);

if (!process.env.COGNITO_CONTRACT_TESTS) {
  test(
    "cognito contract (skipped: set COGNITO_CONTRACT_TESTS=1 + COGNITO_CLIENT_ID/EMAIL/PASSWORD to run against live Cognito)",
    { skip: true },
    () => {},
  );
} else if (missing.length) {
  test(`cognito contract (cannot run: missing env ${missing.join(", ")})`, () => {
    assert.fail(`COGNITO_CONTRACT_TESTS is set but ${missing.join(", ")} not provided.`);
  });
} else {
  const {
    CognitoIdentityProviderClient,
    InitiateAuthCommand,
    GetUserCommand,
  } = await import("@aws-sdk/client-cognito-identity-provider");

  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";
  const ClientId = process.env.COGNITO_CLIENT_ID;
  const Username = process.env.COGNITO_TEST_EMAIL;
  const Password = process.env.COGNITO_TEST_PASSWORD;

  // Real client — every send() hits Cognito.
  const client = new CognitoIdentityProviderClient({ region });
  const LIVE_TIMEOUT_MS = 30_000;

  test(
    "LIVE InitiateAuth(USER_PASSWORD_AUTH) returns the AuthenticationResult shape useAuth depends on",
    { timeout: LIVE_TIMEOUT_MS },
    async () => {
      const res = await client.send(
        new InitiateAuthCommand({
          AuthFlow: "USER_PASSWORD_AUTH",
          ClientId,
          AuthParameters: { USERNAME: Username, PASSWORD: Password },
        }),
      );

      const result = res.AuthenticationResult;
      // THE CONTRACT — these exact fields back src/hooks/useAuth.ts:64-75.
      assert.ok(result, "InitiateAuth returned no AuthenticationResult (challenge? wrong flow?)");
      assert.equal(typeof result.AccessToken, "string", "AccessToken must be a string");
      assert.equal(typeof result.IdToken, "string", "IdToken must be a string");
      assert.equal(typeof result.RefreshToken, "string", "RefreshToken must be a string");
      assert.equal(typeof result.ExpiresIn, "number", "ExpiresIn must be a number");

      // The AccessToken must be a usable credential — prove it by calling GetUser,
      // mirroring lambda/shared/auth.mjs's validateCognitoToken GetUser flow.
      const user = await client.send(new GetUserCommand({ AccessToken: result.AccessToken }));
      assert.equal(typeof user.Username, "string", "GetUser must echo a Username for the issued token");
    },
  );

  test(
    "LIVE InitiateAuth rejects a wrong password (proves the gate isn't always-passing)",
    { timeout: LIVE_TIMEOUT_MS },
    async () => {
      await assert.rejects(
        () =>
          client.send(
            new InitiateAuthCommand({
              AuthFlow: "USER_PASSWORD_AUTH",
              ClientId,
              AuthParameters: { USERNAME: Username, PASSWORD: `${Password}-definitely-wrong` },
            }),
          ),
        (err) => {
          // NotAuthorizedException is the expected denial; accept its siblings too.
          assert.match(
            err?.name || "",
            /NotAuthorized|UserNotFound|InvalidParameter/,
            `expected an auth denial, got ${err?.name}: ${err?.message}`,
          );
          return true;
        },
      );
    },
  );
}
