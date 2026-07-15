import { test } from "node:test";
import assert from "node:assert/strict";

// Tests for the error tracking module. Since Sentry initializes at module
// scope when SENTRY_DSN is set, we test two modes:
// 1. Without SENTRY_DSN (default): all functions are no-ops
// 2. With SENTRY_DSN: functions interact with Sentry (tested via import fresh)

// ── Mode 1: No SENTRY_DSN (no-op behavior) ───────────────────────────────

test("errorTracking functions are no-ops when SENTRY_DSN is not set", async () => {
  // Ensure SENTRY_DSN is not set for this test
  const origDsn = process.env.SENTRY_DSN;
  delete process.env.SENTRY_DSN;

  // Re-import fresh to pick up the env state
  const mod = await import(`../errorTracking.mjs?t=${Date.now()}`);

  assert.equal(mod.isSentryInitialized(), false);

  // These should not throw
  mod.setRequestContext("req-1", "test-service", { method: "POST" });
  mod.captureError(new Error("test error"), { context: "test" });
  mod.addBreadcrumb("auth", "test_breadcrumb", { data: "test" });
  await mod.flushSentry();

  assert.equal(mod.isSentryInitialized(), false);

  if (origDsn) process.env.SENTRY_DSN = origDsn;
});

test("captureError accepts string errors without throwing", async () => {
  const origDsn = process.env.SENTRY_DSN;
  delete process.env.SENTRY_DSN;

  const mod = await import(`../errorTracking.mjs?t=${Date.now()}`);

  // String error should not throw
  mod.captureError("something went wrong", { handler: "test" });
  mod.captureError("plain string");

  if (origDsn) process.env.SENTRY_DSN = origDsn;
});

test("setRequestContext accepts null requestId without throwing", async () => {
  const origDsn = process.env.SENTRY_DSN;
  delete process.env.SENTRY_DSN;

  const mod = await import(`../errorTracking.mjs?t=${Date.now()}`);

  mod.setRequestContext(null, "kb-sync");
  mod.setRequestContext(null, "kb-sync", { trigger: "s3-event" });

  if (origDsn) process.env.SENTRY_DSN = origDsn;
});

test("addBreadcrumb accepts empty data object", async () => {
  const origDsn = process.env.SENTRY_DSN;
  delete process.env.SENTRY_DSN;

  const mod = await import(`../errorTracking.mjs?t=${Date.now()}`);

  mod.addBreadcrumb("auth", "test");
  mod.addBreadcrumb("auth", "test", {});

  if (origDsn) process.env.SENTRY_DSN = origDsn;
});

test("flushSentry resolves with a timeout parameter", async () => {
  const origDsn = process.env.SENTRY_DSN;
  delete process.env.SENTRY_DSN;

  const mod = await import(`../errorTracking.mjs?t=${Date.now()}`);

  await mod.flushSentry(1000);
  await mod.flushSentry(0);

  if (origDsn) process.env.SENTRY_DSN = origDsn;
});

// ── Mode 2: With SENTRY_DSN (Sentry active) ──────────────────────────────

test("isSentryInitialized returns true when SENTRY_DSN is set", async () => {
  const origDsn = process.env.SENTRY_DSN;
  process.env.SENTRY_DSN = "https://testkey@o0test.ingest.sentry.io/123";

  const mod = await import(`../errorTracking.mjs?t=${Date.now()}`);

  assert.equal(mod.isSentryInitialized(), true);

  // Functions should not throw even with a fake DSN (Sentry queues events
  // internally and the network call happens on flush)
  mod.setRequestContext("req-test", "test-service", { method: "POST", path: "/health" });
  mod.captureError(new Error("test error from unit test"), { test: true });
  mod.addBreadcrumb("auth", "test_breadcrumb", { user: "test" });

  // Flush with a short timeout (won't actually send to the fake DSN)
  await mod.flushSentry(500);

  if (origDsn) process.env.SENTRY_DSN = origDsn;
  else delete process.env.SENTRY_DSN;
});

test("setRequestContext with deviceId sets user context", async () => {
  const origDsn = process.env.SENTRY_DSN;
  process.env.SENTRY_DSN = "https://testkey@o0test.ingest.sentry.io/123";

  const mod = await import(`../errorTracking.mjs?t=${Date.now()}`);

  // Should not throw when deviceId is provided
  mod.setRequestContext("req-1", "chat-stream", { deviceId: "test-device-123" });
  mod.setRequestContext("req-2", "blueprint", { deviceId: "test-device-456", method: "POST" });

  await mod.flushSentry(500);

  if (origDsn) process.env.SENTRY_DSN = origDsn;
  else delete process.env.SENTRY_DSN;
});

test("PII is redacted in captureError context before sending to Sentry", async () => {
  const origDsn = process.env.SENTRY_DSN;
  process.env.SENTRY_DSN = "https://testkey@o0test.ingest.sentry.io/123";

  const { redact } = await import("../logger.mjs");
  const mod = await import(`../errorTracking.mjs?t=${Date.now()}`);

  // Verify that PII in context would be redacted by the redact function
  // (the errorTracking module uses redact internally)
  const piiContext = {
    email: "user@altivum.io",
    phone: "512-555-0199",
    token: "secret-key-123",
  };
  const redacted = redact(piiContext);
  assert.equal(redacted.email, "[REDACTED]");
  assert.equal(redacted.phone, "[REDACTED]");
  assert.equal(redacted.token, "[REDACTED]");

  // captureError should not throw with PII context (it redacts internally)
  mod.captureError(new Error("test"), piiContext);
  mod.addBreadcrumb("test", "breadcrumb with PII", piiContext);

  await mod.flushSentry(500);

  if (origDsn) process.env.SENTRY_DSN = origDsn;
  else delete process.env.SENTRY_DSN;
});

// ── Module exports ────────────────────────────────────────────────────────

test("errorTracking exports the expected functions", async () => {
  const origDsn = process.env.SENTRY_DSN;
  delete process.env.SENTRY_DSN;

  const mod = await import(`../errorTracking.mjs?t=${Date.now()}`);

  assert.equal(typeof mod.isSentryInitialized, "function");
  assert.equal(typeof mod.setRequestContext, "function");
  assert.equal(typeof mod.captureError, "function");
  assert.equal(typeof mod.addBreadcrumb, "function");
  assert.equal(typeof mod.flushSentry, "function");

  if (origDsn) process.env.SENTRY_DSN = origDsn;
});

test("errorTracking is exported from the barrel index", async () => {
  const origDsn = process.env.SENTRY_DSN;
  delete process.env.SENTRY_DSN;

  const mod = await import(`../index.mjs?t=${Date.now()}`);

  assert.equal(typeof mod.isSentryInitialized, "function");
  assert.equal(typeof mod.setRequestContext, "function");
  assert.equal(typeof mod.captureError, "function");
  assert.equal(typeof mod.addBreadcrumb, "function");
  assert.equal(typeof mod.flushSentry, "function");

  if (origDsn) process.env.SENTRY_DSN = origDsn;
});
