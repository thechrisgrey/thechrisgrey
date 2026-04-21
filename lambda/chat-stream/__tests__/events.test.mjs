import { test } from "node:test";
import assert from "node:assert/strict";
import { EVENT_DELIM, EVENT_KINDS, emitEvent } from "../events.mjs";

function fakeStream() {
  const chunks = [];
  return {
    chunks,
    write: (s) => chunks.push(s),
  };
}

test("EVENT_DELIM is the expected sentinel", () => {
  assert.equal(EVENT_DELIM, "\x00EVT\x00");
});

test("EVENT_KINDS contains all expected kinds", () => {
  assert.equal(EVENT_KINDS.TOOL_INVOCATION, "tool_invocation");
  assert.equal(EVENT_KINDS.TOOL_RESULT, "tool_result");
  assert.equal(EVENT_KINDS.DRAFT_ACTION, "draft_action");
  assert.equal(EVENT_KINDS.MEMORY_UPDATE, "memory_update");
  assert.equal(EVENT_KINDS.GUARDRAIL, "guardrail");
});

test("EVENT_KINDS is frozen", () => {
  assert.ok(Object.isFrozen(EVENT_KINDS));
});

test("emitEvent wraps JSON in delimiters", () => {
  const stream = fakeStream();
  emitEvent(stream, { kind: "tool_invocation", tool: "navigate_to", input: { path: "/about" } });
  assert.equal(stream.chunks.length, 1);
  const chunk = stream.chunks[0];
  assert.ok(chunk.startsWith(EVENT_DELIM));
  assert.ok(chunk.endsWith(EVENT_DELIM));
  const json = chunk.slice(EVENT_DELIM.length, chunk.length - EVENT_DELIM.length);
  const parsed = JSON.parse(json);
  assert.equal(parsed.kind, "tool_invocation");
  assert.equal(parsed.tool, "navigate_to");
  assert.equal(parsed.input.path, "/about");
});

test("emitEvent throws when stream.write is not a function", () => {
  assert.throws(() => emitEvent({}, { kind: "tool_invocation" }), /responseStream\.write/);
});

test("emitEvent throws when event.kind is missing", () => {
  const stream = fakeStream();
  assert.throws(() => emitEvent(stream, {}), /event\.kind/);
});

test("emitEvent handles multiple consecutive events", () => {
  const stream = fakeStream();
  emitEvent(stream, { kind: "tool_invocation", tool: "a" });
  emitEvent(stream, { kind: "tool_result", toolUseId: "abc" });
  assert.equal(stream.chunks.length, 2);
  for (const chunk of stream.chunks) {
    assert.ok(chunk.startsWith(EVENT_DELIM));
    assert.ok(chunk.endsWith(EVENT_DELIM));
  }
});
