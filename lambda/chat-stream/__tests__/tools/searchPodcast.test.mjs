import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSearchPodcastTool, formatTimestamp } from "../../tools/searchPodcast.mjs";
import { EVENT_DELIM } from "../../events.mjs";

function fakeStream() {
  const chunks = [];
  return { chunks, write: (s) => chunks.push(s) };
}

function fakeMetrics() {
  const records = [];
  return {
    records,
    record: (name, value, unit) => records.push({ name, value, unit }),
  };
}

class FakeRetrieveCommand {
  constructor(input) {
    this.input = input;
  }
}

function fakeAgentClient(retrievalResults) {
  const calls = [];
  return {
    calls,
    send: async (command) => {
      calls.push(command);
      return { retrievalResults };
    },
  };
}

function throwingAgentClient(error) {
  return { send: async () => { throw error; } };
}

function result(text, videoId, startSeconds, episodeTitle, score = 0.5) {
  return {
    content: { text },
    score,
    metadata: { videoId, startSeconds, episodeTitle },
  };
}

function parseEvents(stream) {
  return stream.chunks.map((chunk) =>
    JSON.parse(chunk.slice(EVENT_DELIM.length, chunk.length - EVENT_DELIM.length)),
  );
}

function buildTool(agentClient, stream, metrics, requestId = "req-1") {
  return buildSearchPodcastTool({
    agentClient,
    RetrieveCommand: FakeRetrieveCommand,
    podcastKbId: "PODKB123",
    responseStream: stream,
    metrics,
    requestId,
  });
}

test("formatTimestamp renders MM:SS and H:MM:SS", () => {
  assert.equal(formatTimestamp(0), "0:00");
  assert.equal(formatTimestamp(65), "1:05");
  assert.equal(formatTimestamp(725), "12:05");
  assert.equal(formatTimestamp(3725), "1:02:05");
});

test("search_podcast emits podcast_citation events with timestamp deep-links", async () => {
  const stream = fakeStream();
  const metrics = fakeMetrics();
  const agentClient = fakeAgentClient([
    result("Women veterans are too often invisible after service.", "vid1", 725, "Brittinie Wick on Women Veterans"),
    result("AI in defense changes the human domain.", "vid2", 60, "Daniel Gaina on AI"),
  ]);
  const tool = buildTool(agentClient, stream, metrics);

  const res = await tool.invoke({ query: "women veterans" });

  assert.equal(res.ok, true);
  assert.equal(res.query, "women veterans");
  assert.equal(res.results.length, 2);

  const events = parseEvents(stream);
  assert.equal(events.length, 2);
  assert.equal(events[0].kind, "draft_action");
  assert.equal(events[0].action, "podcast_citation");
  assert.equal(events[0].videoId, "vid1");
  assert.equal(events[0].startSeconds, 725);
  assert.equal(events[0].timestampLabel, "12:05");
  assert.equal(events[0].url, "https://www.youtube.com/watch?v=vid1&t=725s");
  assert.equal(events[0].episodeTitle, "Brittinie Wick on Women Veterans");
  assert.ok(events[0].quote.length > 0);

  const names = metrics.records.map((r) => r.name);
  assert.ok(names.includes("ToolCall_SearchPodcast"));
  assert.ok(names.includes("ToolLatency_SearchPodcast"));
});

test("search_podcast returns empty results without events when KB has no matches", async () => {
  const stream = fakeStream();
  const metrics = fakeMetrics();
  const tool = buildTool(fakeAgentClient([]), stream, metrics);

  const res = await tool.invoke({ query: "obscure topic" });

  assert.equal(res.ok, true);
  assert.equal(res.results.length, 0);
  assert.equal(stream.chunks.length, 0, "no events emitted for zero results");
  assert.ok(metrics.records.map((r) => r.name).includes("ToolCall_SearchPodcast"));
});

test("search_podcast rejects stop-word-only queries before calling the KB", async () => {
  const stream = fakeStream();
  const metrics = fakeMetrics();
  const agentClient = fakeAgentClient([]);
  const tool = buildTool(agentClient, stream, metrics);

  const res = await tool.invoke({ query: "the and or" });

  assert.equal(res.ok, false);
  assert.match(res.error, /meaningful keyword/i);
  assert.equal(agentClient.calls.length, 0, "should not query the KB for a stop-word query");
  assert.ok(metrics.records.map((r) => r.name).includes("ToolRejection_SearchPodcast"));
});

test("search_podcast degrades to empty results when KB retrieval throws", async () => {
  const stream = fakeStream();
  const metrics = fakeMetrics();
  const tool = buildTool(throwingAgentClient(new Error("Bedrock down")), stream, metrics);

  const res = await tool.invoke({ query: "veteran transition" });

  // retrievePodcastChunks catches internally and returns [] — tool stays ok with no results.
  assert.equal(res.ok, true);
  assert.equal(res.results.length, 0);
  assert.equal(stream.chunks.length, 0);
  assert.ok(metrics.records.map((r) => r.name).includes("PodcastKBRetrievalFailure"));
});

test("search_podcast de-dupes identical episode+timestamp and caps at three", async () => {
  const stream = fakeStream();
  const metrics = fakeMetrics();
  const agentClient = fakeAgentClient([
    result("First passage.", "vid1", 100, "Ep A"),
    result("Duplicate same moment.", "vid1", 100, "Ep A"),
    result("Second passage.", "vid2", 200, "Ep B"),
    result("Third passage.", "vid3", 300, "Ep C"),
    result("Fourth passage.", "vid4", 400, "Ep D"),
  ]);
  const tool = buildTool(agentClient, stream, metrics);

  const res = await tool.invoke({ query: "purpose after service" });

  const events = parseEvents(stream);
  assert.equal(events.length, 3, "deduped + capped at three citations");
  const keys = events.map((e) => `${e.videoId}-${e.startSeconds}`);
  assert.deepEqual(keys, ["vid1-100", "vid2-200", "vid3-300"]);
  assert.equal(res.results.length, 3);
});

test("search_podcast drops results missing videoId or startSeconds", async () => {
  const stream = fakeStream();
  const metrics = fakeMetrics();
  const agentClient = fakeAgentClient([
    { content: { text: "No metadata at all." }, score: 0.9 },
    { content: { text: "Missing start." }, score: 0.8, metadata: { videoId: "vidX", episodeTitle: "X" } },
    result("Valid one.", "vidY", 42, "Y"),
  ]);
  const tool = buildTool(agentClient, stream, metrics);

  const res = await tool.invoke({ query: "leadership" });

  const events = parseEvents(stream);
  assert.equal(events.length, 1);
  assert.equal(events[0].videoId, "vidY");
  assert.equal(res.results.length, 1);
});
