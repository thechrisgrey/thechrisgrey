import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDraftNewsletterTool } from "../../tools/draftNewsletter.mjs";
import { EVENT_DELIM } from "../../events.mjs";

function fakeStream() {
  const chunks = [];
  return { chunks, write: (s) => chunks.push(s) };
}
function fakeMetrics() {
  const records = [];
  return { records, record: (n) => records.push(n) };
}
function parseLastEvent(stream) {
  const chunk = stream.chunks[stream.chunks.length - 1];
  return JSON.parse(chunk.slice(EVENT_DELIM.length, chunk.length - EVENT_DELIM.length));
}

test("buildDraftNewsletterTool returns Strands tool", () => {
  const tool = buildDraftNewsletterTool({ responseStream: fakeStream(), metrics: fakeMetrics() });
  assert.equal(tool.name, "draft_newsletter_subscription");
});

test("draft_newsletter emits newsletter draft_action", async () => {
  const stream = fakeStream();
  const metrics = fakeMetrics();
  const tool = buildDraftNewsletterTool({ responseStream: stream, metrics });
  const result = await tool.invoke({ pitch: "Get new essays on AI, leadership, and career pivots when they drop." });
  assert.equal(result.ok, true);
  assert.equal(result.drafted, true);
  const event = parseLastEvent(stream);
  assert.equal(event.action, "newsletter");
  assert.equal(event.pitch, "Get new essays on AI, leadership, and career pivots when they drop.");
  assert.ok(metrics.records.includes("ToolCall_DraftNewsletter"));
});
