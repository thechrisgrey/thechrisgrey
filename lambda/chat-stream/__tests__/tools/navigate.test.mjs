import { test } from "node:test";
import assert from "node:assert/strict";
import { buildNavigateTool } from "../../tools/navigate.mjs";
import { EVENT_DELIM } from "../../events.mjs";

function fakeStream() {
  const chunks = [];
  return { chunks, write: (s) => chunks.push(s) };
}

function fakeMetrics() {
  const records = [];
  return { records, record: (name) => records.push(name) };
}

function parseLastEvent(stream) {
  assert.ok(stream.chunks.length > 0, "no chunks written");
  const chunk = stream.chunks[stream.chunks.length - 1];
  assert.ok(chunk.startsWith(EVENT_DELIM));
  return JSON.parse(chunk.slice(EVENT_DELIM.length, chunk.length - EVENT_DELIM.length));
}

test("buildNavigateTool returns a Strands tool with correct name", () => {
  const tool = buildNavigateTool({ responseStream: fakeStream(), metrics: fakeMetrics() });
  assert.equal(tool.name, "navigate_to");
  assert.ok(tool.description.length > 0);
  assert.ok(tool.toolSpec);
});

test("navigate_to description advertises /foundation and /blueprint", () => {
  // Guards the second (LLM-facing) copy of the path allowlist baked into the
  // tool description. The drift test guards the VALID_PATHS Set; this guards
  // the prose the model reads. Both must stay in sync with src/routes.ts.
  const tool = buildNavigateTool({ responseStream: fakeStream(), metrics: fakeMetrics() });
  assert.match(tool.description, /\/foundation/);
  assert.match(tool.description, /\/blueprint/);
});

test("navigate_to emits draft_action for a valid static path", async () => {
  const stream = fakeStream();
  const metrics = fakeMetrics();
  const tool = buildNavigateTool({ responseStream: stream, metrics });
  const result = await tool.invoke({ path: "/about", reason: "The about page has his personal bio." });
  assert.equal(result.ok, true);
  assert.equal(result.path, "/about");
  const event = parseLastEvent(stream);
  assert.equal(event.action, "navigate");
  assert.equal(event.path, "/about");
  assert.equal(event.reason, "The about page has his personal bio.");
  assert.ok(metrics.records.includes("ToolCall_NavigateTo"));
});

test("navigate_to emits for a valid blog slug path", async () => {
  const stream = fakeStream();
  const tool = buildNavigateTool({ responseStream: stream, metrics: fakeMetrics() });
  const result = await tool.invoke({ path: "/blog/some-post", reason: "This post covers the topic in depth." });
  assert.equal(result.ok, true);
  const event = parseLastEvent(stream);
  assert.equal(event.path, "/blog/some-post");
});

test("navigate_to rejects /admin path", async () => {
  const stream = fakeStream();
  const metrics = fakeMetrics();
  const tool = buildNavigateTool({ responseStream: stream, metrics });
  const result = await tool.invoke({ path: "/admin", reason: "Admin page" });
  assert.equal(result.ok, false);
  assert.match(result.error, /restricted/i);
  assert.equal(stream.chunks.length, 0);
  assert.ok(metrics.records.includes("ToolRejection_NavigateTo"));
});

test("navigate_to rejects /chat path", async () => {
  const stream = fakeStream();
  const tool = buildNavigateTool({ responseStream: stream, metrics: fakeMetrics() });
  const result = await tool.invoke({ path: "/chat", reason: "Chat page" });
  assert.equal(result.ok, false);
  assert.equal(stream.chunks.length, 0);
});

test("navigate_to rejects unknown path", async () => {
  const stream = fakeStream();
  const tool = buildNavigateTool({ responseStream: stream, metrics: fakeMetrics() });
  const result = await tool.invoke({ path: "/not-a-real-page", reason: "Test" });
  assert.equal(result.ok, false);
  assert.match(result.error, /not a known route/i);
  assert.equal(stream.chunks.length, 0);
});

test("navigate_to rejects malformed blog slug", async () => {
  const stream = fakeStream();
  const tool = buildNavigateTool({ responseStream: stream, metrics: fakeMetrics() });
  const result = await tool.invoke({ path: "/blog/Bad Slug", reason: "Test" });
  assert.equal(result.ok, false);
  assert.equal(stream.chunks.length, 0);
});
