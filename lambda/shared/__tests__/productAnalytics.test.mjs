import { test } from "node:test";
import assert from "node:assert/strict";

// Ensure POSTHOG_KEY is not set during tests so the module is in no-op mode.
delete process.env.POSTHOG_KEY;

const { isProductAnalyticsInitialized, captureProductEvent, flushProductAnalytics } =
  await import("../productAnalytics.mjs");

test("isProductAnalyticsInitialized returns false when POSTHOG_KEY is not set", () => {
  assert.equal(isProductAnalyticsInitialized(), false);
});

test("captureProductEvent is a no-op without POSTHOG_KEY (does not throw)", () => {
  assert.doesNotThrow(() => {
    captureProductEvent("TestEvent", { foo: "bar" });
  });
});

test("captureProductEvent accepts optional distinctId without throwing", () => {
  assert.doesNotThrow(() => {
    captureProductEvent("TestEvent", { prop: "value" }, "user-hash-123");
  });
});

test("captureProductEvent accepts no properties without throwing", () => {
  assert.doesNotThrow(() => {
    captureProductEvent("TestEvent");
  });
});

test("flushProductAnalytics is a no-op without POSTHOG_KEY (does not reject)", async () => {
  await assert.doesNotReject(() => flushProductAnalytics());
});

test("captureProductEvent does not call any external API when not configured", () => {
  // If the module tried to make a network call without POSTHOG_KEY,
  // it would throw or hang. This test verifies it returns immediately.
  const start = Date.now();
  captureProductEvent("PerformanceTest", { data: "test" });
  const elapsed = Date.now() - start;
  assert.ok(elapsed < 100, "captureProductEvent should return immediately when not configured");
});
