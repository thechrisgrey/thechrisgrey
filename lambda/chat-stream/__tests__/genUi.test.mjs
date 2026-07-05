import { test } from "node:test";
import assert from "node:assert/strict";
import { detectGenUiIntent, renderGenUi, GENUI_OPUS_MODEL_ID } from "../genUi.mjs";
import { EVENT_DELIM } from "../events.mjs";

// ── intent detection ─────────────────────────────────────────────────────────

test("detectGenUiIntent: fires on the explicit gen-ui command (hyphen/space/none)", () => {
  assert.equal(detectGenUiIntent("use gen-ui to compare his military and tech careers"), true);
  assert.equal(detectGenUiIntent("gen ui timeline of his career"), true);
  assert.equal(detectGenUiIntent("GenUI: stats on Altivum"), true);
  assert.equal(detectGenUiIntent("Gen-UI a comparison please"), true);
});

test("detectGenUiIntent: does NOT fire on ordinary messages (even with visual verbs)", () => {
  assert.equal(detectGenUiIntent("compare his military and tech careers"), false);
  assert.equal(detectGenUiIntent("show me a timeline of his career"), false);
  assert.equal(detectGenUiIntent("tell me about Altivum"), false);
  assert.equal(detectGenUiIntent("what is the genuine story here"), false); // 'genui' not a substring of 'genuine' boundary
});

// ── forced render path ───────────────────────────────────────────────────────

function makeStream() {
  return {
    chunks: [],
    ended: false,
    write(c) {
      this.chunks.push(String(c));
    },
    end() {
      this.ended = true;
    },
    get output() {
      return this.chunks.join("");
    },
  };
}

// Scripted Bedrock client that captures the ConverseCommand and returns a canned
// tool_use response (shaped like the real Converse output for a forced tool call).
function scriptedConverse(blocks, { text = "" } = {}) {
  const content = [];
  if (text) content.push({ text });
  content.push({ toolUse: { name: "render_ui", toolUseId: "tu_1", input: { blocks } } });
  return {
    calls: [],
    async send(command) {
      this.calls.push(command);
      return {
        output: { message: { role: "assistant", content } },
        stopReason: "tool_use",
        usage: { inputTokens: 200, outputTokens: 120, totalTokens: 320 },
      };
    },
  };
}
class FakeConverseCommand {
  constructor(input) {
    this.input = input;
  }
}

const VALID_COMPARISON = {
  type: "comparison",
  title: "Military vs Tech",
  left: { heading: "Green Beret (18D)", points: ["Special Forces medic", "3rd SFG"] },
  right: { heading: "Tech founder", points: ["Founder & CEO of Altivum", "AWS Community Builder"] },
};

test("renderGenUi: forces toolChoice=render_ui on the Opus model and emits the blocks", async () => {
  const stream = makeStream();
  const client = scriptedConverse([VALID_COMPARISON], { text: "Here's that comparison:" });
  const result = await renderGenUi({
    bedrockClient: client,
    ConverseCommand: FakeConverseCommand,
    userMessage: "use gen-ui to compare his military and tech careers",
    history: [],
    retrievedContext: "Christian was an 18D in 3rd SFG; now Founder/CEO of Altivum.",
    responseStream: stream,
    requestId: "req-1",
  });

  // forced the render_ui tool on Opus
  const cmd = client.calls[0].input;
  assert.equal(cmd.modelId, GENUI_OPUS_MODEL_ID);
  assert.deepEqual(cmd.toolConfig.toolChoice, { tool: { name: "render_ui" } });
  assert.equal(cmd.toolConfig.tools[0].toolSpec.name, "render_ui");
  assert.ok(cmd.toolConfig.tools[0].toolSpec.inputSchema.json, "tool inputSchema must be JSON Schema");

  // emitted a ui_block event for the comparison + a lead-in text
  assert.ok(result.ok);
  assert.equal(result.blockCount, 1);
  assert.match(stream.output, /comparison/);
  assert.ok(stream.output.includes(EVENT_DELIM), "block must be emitted as a framed event");
  assert.match(stream.output, /Here's that comparison/);
});

test("renderGenUi: validates blocks and rejects a malformed block (no event emitted)", async () => {
  const stream = makeStream();
  const client = scriptedConverse([{ type: "comparison" /* missing required columns */ }]);
  const result = await renderGenUi({
    bedrockClient: client,
    ConverseCommand: FakeConverseCommand,
    userMessage: "gen-ui compare things",
    history: [],
    retrievedContext: "",
    responseStream: stream,
    requestId: "req-2",
  });
  assert.equal(result.ok, false);
  assert.ok(!stream.output.includes(EVENT_DELIM), "no malformed block should reach the client");
});
