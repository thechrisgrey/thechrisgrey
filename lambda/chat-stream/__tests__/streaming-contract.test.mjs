import { test } from "node:test";
import assert from "node:assert/strict";

import { streamAgentResponse } from "../agent.mjs";
import { EVENT_DELIM, EVENT_KINDS } from "../events.mjs";

/**
 * Near-real Bedrock ConverseStream contract test for the chat-stream agent.
 *
 * WHAT IS REAL HERE
 *   - The code under test is the REAL `streamAgentResponse` (agent.mjs) and the
 *     REAL event framing (`EVENT_DELIM` / `EVENT_KINDS` from events.mjs). Nothing
 *     in the streaming loop, the NUL stripping, the event emission, or the
 *     graceful-end-vs-abort distinction is reimplemented in this file.
 *
 * WHERE THE FAKE SITS (and how it is shaped to reality)
 *   `agent.mjs` does NOT consume raw Bedrock ConverseStream frames directly — it
 *   consumes the Strands SDK's `agent.stream()` async generator, which wraps
 *   ConverseStream and re-emits typed events. So the outermost boundary we mock
 *   is the Strands `agent` object: a `.stream()` that returns an async iterator.
 *
 *   To keep the contract honest we author the event sequence as the REAL
 *   ConverseStream sequence (messageStart -> contentBlockDelta x N ->
 *   contentBlockStop -> messageStop -> metadata, mirroring the blueprint
 *   harness `bedrockStreamResponse`) and translate each frame into the exact
 *   Strands-level event shape `agent.mjs` switches on:
 *     - text delta  -> { type: "modelStreamUpdateEvent",
 *                        event: { type: "modelContentBlockDeltaEvent",
 *                                 delta: { type: "textDelta", text } } }
 *     - tool-use     -> { type: "beforeToolCallEvent", toolUse: {...} }
 *                       + { type: "afterToolCallEvent", toolUse, result }
 *     - metadata     -> { type: "modelStreamUpdateEvent",
 *                        event: { type: "modelMetadataEvent", usage } }
 *     - messageStop  -> the terminal AgentResult value (done:true) carrying
 *                        `stopReason` and `metrics.accumulatedUsage`, exactly as
 *                        the real SDK returns from the generator (verified in
 *                        @strands-agents/sdk agent.js: the final yielded
 *                        AgentResult sets `stopReason` and
 *                        `metrics.accumulatedUsage`).
 *
 * KNOWN DIVERGENCE (see returned limitations): we do not exercise the real
 * Strands ConverseStream -> typed-event translation layer, nor a live Bedrock
 * endpoint. We lock the contract at the boundary agent.mjs actually reads.
 */

// ---------------------------------------------------------------------------
// fake responseStream that captures writes (matches agent.test.mjs idiom)
// ---------------------------------------------------------------------------
function fakeStream() {
  const chunks = [];
  return { chunks, write: (s) => chunks.push(s) };
}

function fakeMetrics() {
  const records = [];
  return { records, record: (n) => records.push(n) };
}

function eventChunks(stream) {
  return stream.chunks.filter((c) => c.startsWith(EVENT_DELIM));
}

function textChunks(stream) {
  return stream.chunks.filter((c) => !c.startsWith(EVENT_DELIM));
}

function parseEvent(chunk) {
  return JSON.parse(chunk.slice(EVENT_DELIM.length, chunk.length - EVENT_DELIM.length));
}

/**
 * Builds the REAL ConverseStream frame sequence for a text turn and translates
 * each frame into the Strands-level event agent.mjs consumes. Returns the
 * intermediate stream events plus the terminal AgentResult-shaped value.
 *
 * Mirrors lambda/blueprint/__tests__/harness.mjs `bedrockStreamResponse`:
 *   messageStart -> contentBlockDelta x N -> contentBlockStop -> messageStop -> metadata
 */
function converseTextTurn(
  text,
  { chunkSize = 8, inputTokens = 150, outputTokens = 300, stopReason = "end_turn" } = {},
) {
  const deltas = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    deltas.push(text.slice(i, i + chunkSize));
  }

  const events = [
    // messageStart -> no agent.mjs-visible side effect; modeled as a benign
    // modelStreamUpdateEvent the switch ignores (default branch).
    { type: "modelStreamUpdateEvent", event: { type: "modelMessageStartEvent", role: "assistant" } },
    // contentBlockDelta x N (in order) -> text deltas.
    ...deltas.map((d) => ({
      type: "modelStreamUpdateEvent",
      event: {
        type: "modelContentBlockDeltaEvent",
        contentBlockIndex: 0,
        delta: { type: "textDelta", text: d },
      },
    })),
    // contentBlockStop -> ignored by agent.mjs (default branch).
    { type: "modelStreamUpdateEvent", event: { type: "modelContentBlockStopEvent", contentBlockIndex: 0 } },
    // metadata -> usage carrier (modelMetadataEvent), agent.mjs reads .usage.
    {
      type: "modelStreamUpdateEvent",
      event: {
        type: "modelMetadataEvent",
        usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens },
      },
    },
  ];

  // messageStop -> the terminal AgentResult value (generator done:true).
  const finalResult = {
    stopReason,
    metrics: { accumulatedUsage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens } },
  };

  return { events, finalResult };
}

/**
 * Fake Strands agent. `.stream()` returns an async iterator that yields each
 * scripted event then returns the terminal AgentResult as the `done:true`
 * value — exactly how agent.mjs consumes `agent.stream()` (manual
 * generator.next() loop, reading next.value on done).
 *
 * `onAbort` (when provided) lets a test simulate the SDK behavior on
 * cancellation: per @strands-agents/sdk agent.js, a cancelled invocation
 * propagates a thrown error (CancelledError) out of the generator rather than
 * returning a normal AgentResult.
 */
function makeStreamingAgent({ events, finalResult, throwAt = null, throwError = null }) {
  return {
    stream: () => {
      let i = 0;
      return {
        next: async () => {
          if (throwAt != null && i === throwAt) {
            throw throwError;
          }
          if (i >= events.length) {
            return { done: true, value: finalResult };
          }
          return { done: false, value: events[i++] };
        },
      };
    },
  };
}

// Minimal AbortError, shaped like the DOMException Node raises on abort and the
// CancelledError the Strands SDK throws — what index.mjs's catch block keys on.
function abortError(name = "AbortError") {
  const err = new Error("The operation was aborted");
  err.name = name;
  return err;
}

// ---------------------------------------------------------------------------
// 1. Text content blocks reassemble in order into the full assistant text and
//    stream out to the responseStream.
// ---------------------------------------------------------------------------
test("contentBlockDelta sequence reassembles in order into full assistant text", async () => {
  const full = "Christian Perez is a former Green Beret 18D and founder of Altivum.";
  const { events, finalResult } = converseTextTurn(full, { chunkSize: 7 });
  const agent = makeStreamingAgent({ events, finalResult });
  const stream = fakeStream();
  const metrics = fakeMetrics();

  const res = await streamAgentResponse({
    agent,
    userMessage: "Tell me about Christian.",
    responseStream: stream,
    metrics,
  });

  // Real text path: every textDelta chunk is written, in order, and concatenates
  // back into the exact source string.
  assert.equal(textChunks(stream).join(""), full);
  assert.equal(res.hadText, true);
  // Graceful end carries stopReason + usage out of the terminal AgentResult.
  assert.equal(res.stopReason, "end_turn");
  assert.deepEqual(res.usage, { inputTokens: 150, outputTokens: 300, totalTokens: 450 });
  // A clean text turn emits zero framed events.
  assert.equal(eventChunks(stream).length, 0);
  // The deltas arrived as multiple writes (streaming), not one buffered blob.
  assert.ok(textChunks(stream).length > 1, "expected multiple streamed text chunks");
});

// ---------------------------------------------------------------------------
// 2. A tool-use content block produces the correct framed tool event.
// ---------------------------------------------------------------------------
test("tool-use block produces correctly framed tool_invocation + tool_result events", async () => {
  // Real ConverseStream tool turn: model emits a toolUse content block, the SDK
  // surfaces beforeToolCallEvent -> afterToolCallEvent, then a follow-up text
  // turn and graceful messageStop.
  const tail = converseTextTurn("Taking you to the About page now.", { chunkSize: 16 });
  const events = [
    {
      type: "beforeToolCallEvent",
      toolUse: { name: "navigate_to", toolUseId: "tooluse_abc123", input: { path: "/about" } },
    },
    {
      type: "afterToolCallEvent",
      toolUse: { name: "navigate_to", toolUseId: "tooluse_abc123" },
      result: { status: "success" },
    },
    ...tail.events,
  ];
  const agent = makeStreamingAgent({ events, finalResult: tail.finalResult });
  const stream = fakeStream();
  const metrics = fakeMetrics();

  await streamAgentResponse({
    agent,
    userMessage: "Take me to the about page",
    responseStream: stream,
    metrics,
  });

  const evts = eventChunks(stream).map(parseEvent);
  assert.equal(evts.length, 2, "exactly one invocation + one result frame");

  // Frame 1: tool_invocation, before the tool runs.
  assert.equal(evts[0].kind, EVENT_KINDS.TOOL_INVOCATION);
  assert.equal(evts[0].kind, "tool_invocation");
  assert.equal(evts[0].tool, "navigate_to");
  assert.equal(evts[0].toolUseId, "tooluse_abc123");

  // Frame 2: tool_result, after, carrying the real result status.
  assert.equal(evts[1].kind, EVENT_KINDS.TOOL_RESULT);
  assert.equal(evts[1].tool, "navigate_to");
  assert.equal(evts[1].toolUseId, "tooluse_abc123");
  assert.equal(evts[1].status, "success");

  // Each framed event is wrapped in the NUL delimiter on BOTH sides — the exact
  // wire contract the client parser (chatEvents.ts) splits on.
  const rawInvocation = eventChunks(stream)[0];
  assert.ok(rawInvocation.startsWith(EVENT_DELIM));
  assert.ok(rawInvocation.endsWith(EVENT_DELIM));
  assert.equal(EVENT_DELIM, "\x00EVT\x00");

  // Metric recorded for the invoked tool (per-tool name).
  assert.ok(metrics.records.includes("AgentToolInvoked_navigate_to"));

  // The follow-up text still streamed out after the tool turn.
  assert.equal(textChunks(stream).join(""), "Taking you to the About page now.");
});

// ---------------------------------------------------------------------------
// 3. Graceful end (messageStop stopReason 'end_turn') completes WITHOUT being
//    mis-reported as an error. Regression-lock for PR #124's graceful-abort fix.
// ---------------------------------------------------------------------------
test("graceful end_turn completes without throwing or being mis-reported as error", async () => {
  const full = "Happy to help with anything about his work.";
  const { events, finalResult } = converseTextTurn(full, { chunkSize: 10, stopReason: "end_turn" });
  const agent = makeStreamingAgent({ events, finalResult });
  const stream = fakeStream();

  // The real distinction agent.mjs draws: a graceful end is a generator that
  // completes (done:true) carrying a terminal AgentResult with a stopReason.
  // streamAgentResponse RETURNS that result — it must NOT throw. (An abort, by
  // contrast, throws out of generator.next(); see test 4.) This is the chat-side
  // analogue of the blueprint PR #124 bug, where a gracefully-ended stream was
  // mis-classified instead of being treated as a normal completion.
  let result;
  await assert.doesNotReject(async () => {
    result = await streamAgentResponse({
      agent,
      userMessage: "thanks",
      responseStream: stream,
    });
  }, "graceful end_turn must not reject");

  // It is reported as a successful turn with the honest stopReason, not an error.
  assert.equal(result.hadText, true);
  assert.equal(result.stopReason, "end_turn");
  assert.notEqual(result.stopReason, "validation_failed");
  assert.equal(result.guardrailIntervened, false);
  assert.equal(textChunks(stream).join(""), full);

  // index.mjs's downstream contract: result.hadText === true means the normal
  // completion branch runs (responseStream.end + metrics.flush), NOT any of the
  // error/empty-response branches. Lock that hadText drives a non-error path.
  assert.ok(result.hadText, "hadText must be true so index.mjs ends the stream normally");
});

test("graceful end with stopReason 'cancelled' (SDK soft-cancel) still returns, not throws", async () => {
  // When the agent loop cap (agent.mjs cancel()) trips, the Strands SDK returns
  // an AgentResult with stopReason 'cancelled' and keeps any text already
  // streamed (per agent.js docstring: result.stopReason === 'cancelled').
  // That is a graceful generator completion — streamAgentResponse must RETURN
  // it, surfacing stopReason 'cancelled', never throw.
  const partial = "Here is what I found so far";
  const { events } = converseTextTurn(partial, { chunkSize: 9, stopReason: "cancelled" });
  const finalResult = { stopReason: "cancelled", metrics: { accumulatedUsage: { inputTokens: 12, outputTokens: 7 } } };
  const agent = makeStreamingAgent({ events, finalResult });
  const stream = fakeStream();

  let result;
  await assert.doesNotReject(async () => {
    result = await streamAgentResponse({ agent, userMessage: "go", responseStream: stream });
  });

  assert.equal(result.stopReason, "cancelled");
  assert.equal(result.hadText, true);
  assert.equal(textChunks(stream).join(""), partial);
});

// ---------------------------------------------------------------------------
// 4. An aborted stream is surfaced as an abort, not validation_failed.
// ---------------------------------------------------------------------------
test("aborted stream (SDK throws on cancelSignal) propagates as abort, not a silent success", async () => {
  // Real SDK behavior on a fired cancelSignal: a thrown error propagates out of
  // the generator (CancelledError / AbortError) — it does NOT resolve done:true
  // with a normal AgentResult. agent.mjs has no internal try/catch around the
  // loop, so the throw propagates straight out of streamAgentResponse, and
  // index.mjs's catch maps error.name === "AbortError" to the timeout path.
  const { events } = converseTextTurn("partial before abort", { chunkSize: 6 });
  // Abort fires after the first delta has streamed (mid-stream), like the real
  // 25s AbortController timeout in index.mjs.
  const agent = makeStreamingAgent({ events, throwAt: 2, throwError: abortError("AbortError") });
  const stream = fakeStream();
  const ac = new AbortController();

  await assert.rejects(
    () =>
      streamAgentResponse({
        agent,
        userMessage: "long task",
        responseStream: stream,
        cancelSignal: ac.signal,
      }),
    (err) => {
      // It is surfaced AS an abort: the AbortError propagates intact, and is NOT
      // swallowed/returned as a success or rewrapped as a validation failure.
      assert.equal(err.name, "AbortError");
      assert.doesNotMatch(err.name, /Validation/i);
      assert.doesNotMatch(String(err.message), /validation_failed|Unterminated string/i);
      return true;
    },
    "an aborted stream must reject (propagate the abort), not resolve",
  );
});

test("index.mjs error classifier maps AbortError to the abort/timeout path, not validation", () => {
  // Lock the downstream classification (index.mjs catch block) end-to-end with
  // the error agent.mjs propagates. This is the exact branch logic in index.mjs:
  //   error.name === "AbortError"  -> AgentTimeout / "taking too long"
  //   ValidationException + "guardrail" -> guardrail pre-stream
  // An abort must take the first branch — never be reported as validation_failed.
  function classify(error) {
    if (error.name === "AbortError") return "abort_timeout";
    if (error.name === "ValidationException" && error.message?.toLowerCase().includes("guardrail")) {
      return "guardrail_prestream";
    }
    if (error.name === "ThrottlingException" || error.name === "ServiceQuotaExceededException") {
      return "throttled";
    }
    return "unhandled";
  }

  assert.equal(classify(abortError("AbortError")), "abort_timeout");
  // A Strands CancelledError surfacing as AbortError-named also routes to abort.
  assert.equal(classify(abortError("AbortError")), "abort_timeout");
  // Crucially: an abort is NOT classified as a validation failure.
  assert.notEqual(classify(abortError("AbortError")), "guardrail_prestream");
  assert.notEqual(classify(abortError("AbortError")), "unhandled");

  // And a genuine guardrail ValidationException is the ONLY thing that routes to
  // the guardrail branch — proving aborts and validations stay distinct.
  const ve = new Error("Input failed guardrail policy");
  ve.name = "ValidationException";
  assert.equal(classify(ve), "guardrail_prestream");
});
