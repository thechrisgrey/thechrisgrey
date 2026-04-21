import { test } from "node:test";
import assert from "node:assert/strict";
import { retrieveContext } from "../kbRetrieve.mjs";
import { recordingMetrics } from "./harness.mjs";

class FakeRetrieveCommand {
  constructor(input) {
    this.input = input;
  }
}

function client(handler) {
  return { send: handler };
}

const OPTS = {
  knowledgeBaseId: "KB-TEST",
  requestId: "req-1",
  timeoutMs: 1000,
  numberOfResults: 3,
};

test("returns joined chunks on success", async () => {
  const metrics = recordingMetrics();
  const fake = client(async (cmd) => {
    assert.equal(cmd.input.knowledgeBaseId, "KB-TEST");
    assert.equal(cmd.input.retrievalQuery.text, "who is christian");
    assert.equal(cmd.input.retrievalConfiguration.vectorSearchConfiguration.numberOfResults, 3);
    return {
      retrievalResults: [
        { content: { text: "chunk A" } },
        { content: { text: "chunk B" } },
        { content: {} },
      ],
    };
  });
  const out = await retrieveContext(fake, FakeRetrieveCommand, "who is christian", { ...OPTS, metrics });
  assert.equal(out, "chunk A\n\n---\n\nchunk B");
  assert.ok(metrics.records.some((r) => r.name === "KBRetrievalSuccess"));
  assert.ok(metrics.records.some((r) => r.name === "KBRetrievalLatency"));
});

test("returns null on empty results", async () => {
  const metrics = recordingMetrics();
  const fake = client(async () => ({ retrievalResults: [] }));
  const out = await retrieveContext(fake, FakeRetrieveCommand, "q", { ...OPTS, metrics });
  assert.equal(out, null);
  assert.ok(metrics.records.some((r) => r.name === "KBRetrievalLatency"));
});

test("returns null when retrievalResults missing entirely", async () => {
  const metrics = recordingMetrics();
  const fake = client(async () => ({}));
  const out = await retrieveContext(fake, FakeRetrieveCommand, "q", { ...OPTS, metrics });
  assert.equal(out, null);
});

test("records timeout on AbortError", async () => {
  const metrics = recordingMetrics();
  const err = new Error("aborted");
  err.name = "AbortError";
  const fake = client(async () => { throw err; });
  const out = await retrieveContext(fake, FakeRetrieveCommand, "q", { ...OPTS, metrics });
  assert.equal(out, null);
  assert.ok(metrics.records.some((r) => r.name === "KBRetrievalTimeout"));
  assert.ok(metrics.records.some((r) => r.name === "KBRetrievalFailure"));
});

test("records failure on non-abort errors", async () => {
  const metrics = recordingMetrics();
  const err = new Error("kb down");
  err.name = "InternalServerException";
  const fake = client(async () => { throw err; });
  const out = await retrieveContext(fake, FakeRetrieveCommand, "q", { ...OPTS, metrics });
  assert.equal(out, null);
  assert.ok(metrics.records.some((r) => r.name === "KBRetrievalFailure"));
  assert.ok(!metrics.records.some((r) => r.name === "KBRetrievalTimeout"));
});
