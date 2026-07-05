import { test } from "node:test";
import assert from "node:assert/strict";

// --- Isolate from AWS BEFORE importing the handler -------------------------
// The handler builds module-level SDK clients at import time. Force credential
// and IMDS resolution to fail fast (no network) as a defense-in-depth measure;
// the prototype stubs below are what actually intercept every `send`.
delete process.env.AWS_ACCESS_KEY_ID;
delete process.env.AWS_SECRET_ACCESS_KEY;
delete process.env.AWS_SESSION_TOKEN;
delete process.env.AWS_PROFILE;
process.env.AWS_SHARED_CREDENTIALS_FILE = "/dev/null";
process.env.AWS_CONFIG_FILE = "/dev/null";
process.env.AWS_EC2_METADATA_DISABLED = "true";
process.env.AWS_REGION = "us-east-1";

const { DynamoDBDocumentClient } = await import("@aws-sdk/lib-dynamodb");
const { CloudWatchClient } = await import("@aws-sdk/client-cloudwatch");

// The handler's module-level `docClient` is built via
// `DynamoDBDocumentClient.from(...)`, so overriding the prototype's `send`
// intercepts the exact client the real handler uses for rate limiting.
// We throw a NON-conditional error: that drives checkRateLimit down its
// error-logging branch (where requestId is consumed) and makes it fail OPEN
// (allowed: true), so the request proceeds past the rate-limit gate.
DynamoDBDocumentClient.prototype.send = async function rateLimitStub() {
  const err = new Error("simulated DynamoDB outage");
  err.name = "ProvisionedThroughputExceededException";
  throw err;
};

// Swallow CloudWatch PutMetricData so handleVitals/handleCspReport never hit
// the network after the rate-limit gate is passed.
CloudWatchClient.prototype.send = async function cloudwatchStub() {
  return {};
};

const { handler } = await import("../index.mjs");

function makeEvent({ method, path, body = "{}" }) {
  return {
    body,
    headers: {},
    rawPath: path,
    requestContext: { http: { method, sourceIp: "1.2.3.4", path } },
  };
}

// Run `fn` while capturing every console.error call's arguments.
async function captureErrors(fn) {
  const original = console.error;
  const calls = [];
  console.error = (...args) => calls.push(args);
  try {
    await fn();
  } finally {
    console.error = original;
  }
  return calls;
}

// Extract the structured rate_limit_error log emitted by checkRateLimit and
// return the requestId it carried, or null if no such structured log exists.
function rateLimitErrorRequestId(calls) {
  for (const args of calls) {
    if (args.length !== 1 || typeof args[0] !== "string") continue;
    let parsed;
    try {
      parsed = JSON.parse(args[0]);
    } catch {
      continue;
    }
    if (parsed && parsed.event === "rate_limit_error") {
      return parsed.requestId ?? null;
    }
  }
  return null;
}

// True if checkRateLimit fell back to its NON-structured log, which only
// happens when requestId was falsy (undefined / not forwarded).
function usedFallbackLog(calls) {
  return calls.some((args) => typeof args[0] === "string" && args[0].startsWith("Rate limit error:"));
}

test("/vitals rate-limit check forwards a real requestId to checkRateLimit", async () => {
  let response;
  const calls = await captureErrors(async () => {
    response = await handler(
      makeEvent({
        method: "POST",
        path: "/vitals",
        body: JSON.stringify({ name: "LCP", value: 1234, rating: "good" }),
      }),
    );
  });

  // Fail-open: the simulated DynamoDB outage must not 429 the request.
  assert.notEqual(response.statusCode, 429, "rate limiter must fail open on a DynamoDB error");

  // checkRateLimit only emits the STRUCTURED log when it actually received a
  // requestId. A non-empty UUID-shaped value here proves the handler forwarded
  // its `requestId` rather than passing undefined / a misnamed variable.
  const requestId = rateLimitErrorRequestId(calls);
  assert.ok(
    typeof requestId === "string" && requestId.length > 0,
    `expected a forwarded requestId in the rate_limit_error log; got ${JSON.stringify(requestId)}`,
  );
  assert.match(
    requestId,
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    "forwarded requestId must be the handler's randomUUID()",
  );
  // If requestId were undefined, checkRateLimit would have used the fallback log.
  assert.equal(usedFallbackLog(calls), false, "checkRateLimit must not fall back to the unstructured log");
});

test("/csp-report rate-limit check forwards a real requestId to checkRateLimit", async () => {
  let response;
  const calls = await captureErrors(async () => {
    response = await handler(
      makeEvent({
        method: "POST",
        path: "/csp-report",
        body: JSON.stringify({ "csp-report": { "blocked-uri": "inline" } }),
      }),
    );
  });

  assert.notEqual(response.statusCode, 429, "rate limiter must fail open on a DynamoDB error");

  const requestId = rateLimitErrorRequestId(calls);
  assert.ok(
    typeof requestId === "string" && requestId.length > 0,
    `expected a forwarded requestId in the rate_limit_error log; got ${JSON.stringify(requestId)}`,
  );
  assert.match(
    requestId,
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    "forwarded requestId must be the handler's randomUUID()",
  );
  assert.equal(usedFallbackLog(calls), false, "checkRateLimit must not fall back to the unstructured log");
});
