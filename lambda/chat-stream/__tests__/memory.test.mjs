import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MEMORY_TABLE,
  MEMORY_TTL_SECONDS,
  MAX_FACTS_RETURNED,
  MAX_FACT_LENGTH,
  hashDeviceId,
  getFacts,
  putFact,
  forgetDevice,
} from "../memory.mjs";

class QueryCommand {
  constructor(input) { this.input = input; this.__name = "QueryCommand"; }
}
class PutCommand {
  constructor(input) { this.input = input; this.__name = "PutCommand"; }
}
class BatchWriteCommand {
  constructor(input) { this.input = input; this.__name = "BatchWriteCommand"; }
}

function fakeClient(responder) {
  const calls = [];
  return {
    calls,
    send: async (cmd) => {
      calls.push({ name: cmd.__name, input: cmd.input });
      return responder ? await responder(cmd) : {};
    },
  };
}

test("constants have expected values", () => {
  assert.equal(MEMORY_TABLE, process.env.CHAT_MEMORY_TABLE || "thechrisgrey-chat-memory");
  assert.equal(MEMORY_TTL_SECONDS, 90 * 24 * 60 * 60);
  assert.equal(MAX_FACTS_RETURNED, 20);
  assert.equal(MAX_FACT_LENGTH, 240);
});

test("hashDeviceId returns a 64-char hex digest", () => {
  const hash = hashDeviceId("device-abc");
  assert.match(hash, /^[0-9a-f]{64}$/);
});

test("hashDeviceId is deterministic", () => {
  assert.equal(hashDeviceId("foo"), hashDeviceId("foo"));
  assert.notEqual(hashDeviceId("foo"), hashDeviceId("bar"));
});

test("hashDeviceId throws on empty input", () => {
  assert.throws(() => hashDeviceId(""), /non-empty string/);
  assert.throws(() => hashDeviceId(null), /non-empty string/);
});

test("getFacts returns empty array when deviceId missing", async () => {
  const client = fakeClient();
  const facts = await getFacts(client, QueryCommand, null);
  assert.deepEqual(facts, []);
  assert.equal(client.calls.length, 0);
});

test("getFacts queries table with hashed deviceId", async () => {
  const client = fakeClient(async () => ({
    Items: [
      { factId: "f1", content: "loves coffee", createdAt: 100 },
      { factId: "f2", content: "works at NASA", createdAt: 200 },
    ],
  }));
  const facts = await getFacts(client, QueryCommand, "device-xyz");
  assert.equal(client.calls.length, 1);
  const call = client.calls[0];
  assert.equal(call.name, "QueryCommand");
  assert.equal(call.input.TableName, MEMORY_TABLE);
  assert.equal(call.input.ScanIndexForward, false);
  assert.equal(call.input.Limit, MAX_FACTS_RETURNED);
  assert.equal(call.input.ExpressionAttributeValues[":d"], hashDeviceId("device-xyz"));
  assert.equal(facts.length, 2);
  assert.equal(facts[0].content, "loves coffee");
});

test("getFacts honors custom limit", async () => {
  const client = fakeClient(async () => ({ Items: [] }));
  await getFacts(client, QueryCommand, "d", { limit: 5 });
  assert.equal(client.calls[0].input.Limit, 5);
});

test("putFact writes item with ttl and returns record", async () => {
  const client = fakeClient();
  const res = await putFact(client, PutCommand, "device-1", "  lives in Austin  ");
  assert.equal(client.calls.length, 1);
  const item = client.calls[0].input.Item;
  assert.equal(item.deviceHash, hashDeviceId("device-1"));
  assert.equal(item.content, "lives in Austin");
  assert.match(item.factId, /^[0-9a-f-]{36}$/);
  assert.ok(item.ttl > Math.floor(Date.now() / 1000));
  assert.ok(item.ttl <= Math.floor(Date.now() / 1000) + MEMORY_TTL_SECONDS + 1);
  assert.equal(res.content, "lives in Austin");
});

test("putFact truncates content to MAX_FACT_LENGTH", async () => {
  const client = fakeClient();
  const long = "a".repeat(MAX_FACT_LENGTH + 50);
  const res = await putFact(client, PutCommand, "d", long);
  assert.equal(res.content.length, MAX_FACT_LENGTH);
});

test("putFact throws on empty content", async () => {
  const client = fakeClient();
  await assert.rejects(() => putFact(client, PutCommand, "d", ""), /non-empty string/);
  await assert.rejects(() => putFact(client, PutCommand, "d", "    "), /empty after trim/);
});

test("putFact throws on missing deviceId", async () => {
  const client = fakeClient();
  await assert.rejects(() => putFact(client, PutCommand, null, "x"), /deviceId is required/);
});

test("forgetDevice returns 0 when no items", async () => {
  const client = fakeClient(async () => ({ Items: [] }));
  const res = await forgetDevice(client, QueryCommand, BatchWriteCommand, "device-1");
  assert.equal(res.deleted, 0);
});

test("forgetDevice batch-deletes all items in one page", async () => {
  let callIndex = 0;
  const client = fakeClient(async (cmd) => {
    if (cmd.__name === "QueryCommand") {
      if (callIndex++ === 0) {
        return {
          Items: [
            { deviceHash: "h", factId: "f1" },
            { deviceHash: "h", factId: "f2" },
          ],
        };
      }
      return { Items: [] };
    }
    return {};
  });
  const res = await forgetDevice(client, QueryCommand, BatchWriteCommand, "device-1");
  assert.equal(res.deleted, 2);
  const batchCall = client.calls.find((c) => c.name === "BatchWriteCommand");
  assert.ok(batchCall, "BatchWriteCommand not issued");
  const requests = batchCall.input.RequestItems[MEMORY_TABLE];
  assert.equal(requests.length, 2);
  assert.deepEqual(requests[0].DeleteRequest.Key, { deviceHash: "h", factId: "f1" });
});

test("forgetDevice paginates when LastEvaluatedKey returned", async () => {
  let callIndex = 0;
  const client = fakeClient(async (cmd) => {
    if (cmd.__name === "QueryCommand") {
      if (callIndex === 0) {
        callIndex++;
        return {
          Items: [{ deviceHash: "h", factId: "f1" }],
          LastEvaluatedKey: { deviceHash: "h", factId: "f1" },
        };
      }
      callIndex++;
      return { Items: [{ deviceHash: "h", factId: "f2" }] };
    }
    return {};
  });
  const res = await forgetDevice(client, QueryCommand, BatchWriteCommand, "device-1");
  assert.equal(res.deleted, 2);
  const queryCalls = client.calls.filter((c) => c.name === "QueryCommand");
  assert.equal(queryCalls.length, 2);
  assert.deepEqual(queryCalls[1].input.ExclusiveStartKey, { deviceHash: "h", factId: "f1" });
});

test("forgetDevice splits large pages into batches of 25", async () => {
  const items = Array.from({ length: 60 }, (_, i) => ({ deviceHash: "h", factId: `f${i}` }));
  let callIndex = 0;
  const client = fakeClient(async (cmd) => {
    if (cmd.__name === "QueryCommand") {
      if (callIndex++ === 0) return { Items: items.slice(0, 100) };
      return { Items: [] };
    }
    return {};
  });
  await forgetDevice(client, QueryCommand, BatchWriteCommand, "device-1");
  const batchCalls = client.calls.filter((c) => c.name === "BatchWriteCommand");
  assert.equal(batchCalls.length, 3);
  assert.equal(batchCalls[0].input.RequestItems[MEMORY_TABLE].length, 25);
  assert.equal(batchCalls[1].input.RequestItems[MEMORY_TABLE].length, 25);
  assert.equal(batchCalls[2].input.RequestItems[MEMORY_TABLE].length, 10);
});

test("forgetDevice throws on missing deviceId", async () => {
  const client = fakeClient();
  await assert.rejects(() => forgetDevice(client, QueryCommand, BatchWriteCommand, null), /deviceId is required/);
});
