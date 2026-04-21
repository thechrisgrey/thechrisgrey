import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRememberFactTool } from "../../tools/rememberFact.mjs";
import { EVENT_DELIM } from "../../events.mjs";

class PutCommand {
  constructor(input) { this.input = input; this.__name = "PutCommand"; }
}

function fakeStream() {
  const chunks = [];
  return { chunks, write: (s) => chunks.push(s) };
}
function fakeMetrics() {
  const records = [];
  return { records, record: (n) => records.push(n) };
}
function fakeDoc(responder) {
  const calls = [];
  return {
    calls,
    send: async (cmd) => {
      calls.push(cmd.input);
      return responder ? await responder(cmd) : {};
    },
  };
}
function parseLastEvent(stream) {
  const chunk = stream.chunks[stream.chunks.length - 1];
  return JSON.parse(chunk.slice(EVENT_DELIM.length, chunk.length - EVENT_DELIM.length));
}

test("remember_fact persists fact and emits memory_update", async () => {
  const stream = fakeStream();
  const metrics = fakeMetrics();
  const docClient = fakeDoc();
  const tool = buildRememberFactTool({
    docClient,
    PutCommand,
    deviceId: "device-abc",
    responseStream: stream,
    metrics,
  });
  const result = await tool.invoke({ fact: "Is preparing for SFAS in the fall" });
  assert.equal(result.ok, true);
  assert.equal(result.remembered, "Is preparing for SFAS in the fall");
  assert.equal(docClient.calls.length, 1);
  const item = docClient.calls[0].Item;
  assert.ok(item.deviceHash);
  assert.equal(item.content, "Is preparing for SFAS in the fall");
  assert.ok(item.ttl > Math.floor(Date.now() / 1000));
  const event = parseLastEvent(stream);
  assert.equal(event.kind, "memory_update");
  assert.equal(event.action, "remembered");
  assert.ok(metrics.records.includes("ToolCall_RememberFact"));
});

test("remember_fact rejects when deviceId missing", async () => {
  const stream = fakeStream();
  const metrics = fakeMetrics();
  const tool = buildRememberFactTool({
    docClient: fakeDoc(),
    PutCommand,
    deviceId: null,
    responseStream: stream,
    metrics,
  });
  const result = await tool.invoke({ fact: "Likes pizza" });
  assert.equal(result.ok, false);
  assert.match(result.error, /device/i);
  assert.equal(stream.chunks.length, 0);
  assert.ok(metrics.records.includes("ToolRejection_RememberFact_NoDevice"));
});

test("remember_fact handles DynamoDB errors gracefully", async () => {
  const stream = fakeStream();
  const metrics = fakeMetrics();
  const docClient = fakeDoc(async () => { throw new Error("DynamoDB unreachable"); });
  const tool = buildRememberFactTool({
    docClient,
    PutCommand,
    deviceId: "device-1",
    responseStream: stream,
    metrics,
    requestId: "req-1",
  });
  const result = await tool.invoke({ fact: "Lives in Austin" });
  assert.equal(result.ok, false);
  assert.match(result.error, /Unable to save/i);
  assert.ok(metrics.records.includes("ToolFailure_RememberFact"));
});
