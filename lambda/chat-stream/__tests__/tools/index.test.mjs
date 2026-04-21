import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTools } from "../../tools/index.mjs";

class PutCommand {
  constructor(input) { this.input = input; }
}
function fakeStream() { return { write: () => {} }; }
function fakeMetrics() { return { record: () => {} }; }
function fakeDoc() { return { send: async () => ({}) }; }
function fakeSanity() { return { fetch: async () => null }; }

test("buildTools returns three tools by default (no sanity, no memory)", () => {
  const tools = buildTools({ responseStream: fakeStream(), metrics: fakeMetrics() });
  assert.equal(tools.length, 3);
  const names = tools.map((t) => t.name).sort();
  assert.deepEqual(names, ["draft_message", "draft_newsletter_subscription", "navigate_to"]);
});

test("buildTools includes cite_blog_passage and search_blog when sanityClient provided", () => {
  const tools = buildTools({
    responseStream: fakeStream(),
    metrics: fakeMetrics(),
    sanityClient: fakeSanity(),
  });
  assert.equal(tools.length, 5);
  assert.ok(tools.some((t) => t.name === "cite_blog_passage"));
  assert.ok(tools.some((t) => t.name === "search_blog"));
});

test("buildTools includes remember_fact when docClient + deviceId provided", () => {
  const tools = buildTools({
    responseStream: fakeStream(),
    metrics: fakeMetrics(),
    docClient: fakeDoc(),
    PutCommand,
    deviceId: "device-1",
  });
  assert.equal(tools.length, 4);
  assert.ok(tools.some((t) => t.name === "remember_fact"));
});

test("buildTools omits remember_fact when deviceId is missing", () => {
  const tools = buildTools({
    responseStream: fakeStream(),
    metrics: fakeMetrics(),
    docClient: fakeDoc(),
    PutCommand,
    deviceId: null,
  });
  assert.equal(tools.length, 3);
  assert.ok(!tools.some((t) => t.name === "remember_fact"));
});

test("buildTools returns all six tools when every dep present", () => {
  const tools = buildTools({
    responseStream: fakeStream(),
    metrics: fakeMetrics(),
    sanityClient: fakeSanity(),
    docClient: fakeDoc(),
    PutCommand,
    deviceId: "device-1",
  });
  assert.equal(tools.length, 6);
  const names = tools.map((t) => t.name).sort();
  assert.deepEqual(names, [
    "cite_blog_passage",
    "draft_message",
    "draft_newsletter_subscription",
    "navigate_to",
    "remember_fact",
    "search_blog",
  ]);
});
