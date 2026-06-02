import { test } from "node:test";
import assert from "node:assert/strict";
import { MetricsCollector, MAX_METRICS_PER_CALL } from "../metrics.mjs";

function fakeClient() {
  const calls = [];
  return {
    calls,
    send: async (cmd) => {
      calls.push(cmd.input);
      return {};
    },
  };
}

function rejectingClient(error) {
  return {
    send: async () => {
      throw error;
    },
  };
}

const SITE = "TheChrisGrey/SiteMetrics";
const BLUEPRINT = "TheChrisGrey/Blueprint";

test("constructor throws when client missing", () => {
  assert.throws(() => new MetricsCollector(undefined, SITE), /cloudwatchClient/);
});

test("constructor throws when namespace missing", () => {
  assert.throws(() => new MetricsCollector(fakeClient()), /namespace/);
});

test("flush no-ops on empty buffer", async () => {
  const client = fakeClient();
  const m = new MetricsCollector(client, SITE);
  await m.flush();
  assert.equal(client.calls.length, 0);
});

test("records and flushes under batch size, tagging the SiteMetrics namespace", async () => {
  const client = fakeClient();
  const m = new MetricsCollector(client, SITE);
  m.record("Foo");
  m.record("Bar", 42, "Milliseconds");
  await m.flush();
  assert.equal(client.calls.length, 1);
  assert.equal(client.calls[0].Namespace, SITE);
  assert.equal(client.calls[0].MetricData.length, 2);
  assert.equal(client.calls[0].MetricData[0].MetricName, "Foo");
  assert.equal(client.calls[0].MetricData[0].Value, 1);
  assert.equal(client.calls[0].MetricData[0].Unit, "Count");
  assert.equal(client.calls[0].MetricData[1].Value, 42);
  assert.equal(client.calls[0].MetricData[1].Unit, "Milliseconds");
});

test("uses the per-instance namespace (Blueprint) independently", async () => {
  const client = fakeClient();
  const m = new MetricsCollector(client, BLUEPRINT);
  m.record("BlueprintOpusTimeout");
  await m.flush();
  assert.equal(client.calls[0].Namespace, BLUEPRINT);
});

test("splits into batches of 20", async () => {
  const client = fakeClient();
  const m = new MetricsCollector(client, SITE);
  for (let i = 0; i < 21; i++) m.record(`M${i}`);
  await m.flush();
  assert.equal(client.calls.length, 2);
  assert.equal(client.calls[0].MetricData.length, MAX_METRICS_PER_CALL);
  assert.equal(client.calls[1].MetricData.length, 1);
});

test("flush swallows send errors", async () => {
  const client = rejectingClient(Object.assign(new Error("boom"), { name: "ServiceError" }));
  const m = new MetricsCollector(client, SITE);
  m.record("Foo");
  await assert.doesNotReject(m.flush());
});
