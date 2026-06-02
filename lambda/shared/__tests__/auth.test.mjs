import { test } from "node:test";
import assert from "node:assert/strict";
import { validateCognitoToken } from "../auth.mjs";

// Minimal stand-in for GetUserCommand: records the input so we can assert on it.
class FakeGetUserCommand {
  constructor(input) {
    this.input = input;
  }
}

// Fake Cognito client. `attributes` is the UserAttributes array GetUser returns;
// pass `error` to simulate an invalid/expired token.
function fakeClient({ attributes = [], error = null } = {}) {
  const calls = [];
  return {
    calls,
    send: async (command) => {
      calls.push(command.input);
      if (error) throw error;
      return { UserAttributes: attributes, Username: "admin" };
    },
  };
}

const VERIFIED = (email) => [
  { Name: "email", Value: email },
  { Name: "email_verified", Value: "true" },
];

const ALLOWLIST = "christian.perez@altivum.io,christian.perez@altivum.ai";

test("returns the user for an allowlisted, verified email", async () => {
  const client = fakeClient({ attributes: VERIFIED("christian.perez@altivum.io") });
  const result = await validateCognitoToken(client, FakeGetUserCommand, "Bearer good-token", {
    allowlist: ALLOWLIST,
  });
  assert.ok(result, "expected a truthy user object");
  assert.equal(client.calls[0].AccessToken, "good-token");
});

test("matches allowlist case-insensitively and trims whitespace", async () => {
  const client = fakeClient({ attributes: VERIFIED("Christian.Perez@Altivum.AI") });
  const result = await validateCognitoToken(client, FakeGetUserCommand, "Bearer t", {
    allowlist: " christian.perez@altivum.io , christian.perez@altivum.ai ",
  });
  assert.ok(result);
});

test("denies an authenticated email that is NOT on the allowlist", async () => {
  const client = fakeClient({ attributes: VERIFIED("attacker@example.com") });
  const result = await validateCognitoToken(client, FakeGetUserCommand, "Bearer t", {
    allowlist: ALLOWLIST,
  });
  assert.equal(result, null);
});

test("denies an allowlisted email whose email_verified is not 'true'", async () => {
  const client = fakeClient({
    attributes: [
      { Name: "email", Value: "christian.perez@altivum.io" },
      { Name: "email_verified", Value: "false" },
    ],
  });
  const result = await validateCognitoToken(client, FakeGetUserCommand, "Bearer t", {
    allowlist: ALLOWLIST,
  });
  assert.equal(result, null);
});

test("denies when no email attribute is present", async () => {
  const client = fakeClient({ attributes: [{ Name: "sub", Value: "abc" }] });
  const result = await validateCognitoToken(client, FakeGetUserCommand, "Bearer t", {
    allowlist: ALLOWLIST,
  });
  assert.equal(result, null);
});

test("returns null for a missing or non-Bearer header without calling Cognito", async () => {
  const client = fakeClient({ attributes: VERIFIED("christian.perez@altivum.io") });
  assert.equal(await validateCognitoToken(client, FakeGetUserCommand, undefined, { allowlist: ALLOWLIST }), null);
  assert.equal(await validateCognitoToken(client, FakeGetUserCommand, "Basic xxx", { allowlist: ALLOWLIST }), null);
  assert.equal(client.calls.length, 0, "Cognito should not be called for a bad header");
});

test("fails closed when the allowlist is empty, even with a valid token", async () => {
  const client = fakeClient({ attributes: VERIFIED("christian.perez@altivum.io") });
  const result = await validateCognitoToken(client, FakeGetUserCommand, "Bearer good-token", {
    allowlist: "",
  });
  assert.equal(result, null);
  assert.equal(client.calls.length, 0, "should not even call Cognito when allowlist is empty");
});

test("returns null when GetUser throws (invalid/expired token)", async () => {
  const client = fakeClient({ error: Object.assign(new Error("bad"), { name: "NotAuthorizedException" }) });
  const result = await validateCognitoToken(client, FakeGetUserCommand, "Bearer expired", {
    allowlist: ALLOWLIST,
  });
  assert.equal(result, null);
});

test("reads the allowlist from process.env.ADMIN_ALLOWLIST by default", async () => {
  const prev = process.env.ADMIN_ALLOWLIST;
  process.env.ADMIN_ALLOWLIST = ALLOWLIST;
  try {
    const client = fakeClient({ attributes: VERIFIED("christian.perez@altivum.ai") });
    const result = await validateCognitoToken(client, FakeGetUserCommand, "Bearer t");
    assert.ok(result);
  } finally {
    if (prev === undefined) delete process.env.ADMIN_ALLOWLIST;
    else process.env.ADMIN_ALLOWLIST = prev;
  }
});
