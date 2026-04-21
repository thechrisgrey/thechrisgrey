import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDraftMessageTool } from "../../tools/draftMessage.mjs";
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

test("buildDraftMessageTool returns Strands tool", () => {
  const tool = buildDraftMessageTool({ responseStream: fakeStream(), metrics: fakeMetrics() });
  assert.equal(tool.name, "draft_message");
  assert.ok(tool.description.includes("contact form"));
});

test("draft_message emits contact draft_action", async () => {
  const stream = fakeStream();
  const metrics = fakeMetrics();
  const tool = buildDraftMessageTool({ responseStream: stream, metrics });
  const result = await tool.invoke({
    subject: "Podcast appearance",
    body: "The visitor would like to invite Christian onto their podcast about veteran transition to tech.",
    intent: "podcast",
  });
  assert.equal(result.ok, true);
  assert.equal(result.intent, "podcast");
  assert.match(result.note, /Draft shown/i);
  const event = parseLastEvent(stream);
  assert.equal(event.kind, "draft_action");
  assert.equal(event.action, "contact");
  assert.equal(event.subject, "Podcast appearance");
  assert.equal(event.intent, "podcast");
  assert.ok(metrics.records.includes("ToolCall_DraftMessage"));
});

test("draft_message accepts all valid intent values", async () => {
  const tool = buildDraftMessageTool({ responseStream: fakeStream(), metrics: fakeMetrics() });
  for (const intent of ["speaking", "podcast", "consulting", "collaboration", "media", "general"]) {
    const r = await tool.invoke({
      subject: "Test subject",
      body: "a".repeat(25),
      intent,
    });
    assert.equal(r.ok, true, `intent ${intent} should be accepted`);
  }
});
