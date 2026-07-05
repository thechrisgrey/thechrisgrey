/**
 * Generative UI — the EXPLICIT, deterministic visual-answer path.
 *
 * When a visitor types the "gen-ui" command (e.g. "use gen-ui to compare his
 * military and tech careers"), they are telling us they WANT a visual answer.
 * We do not leave that to the conversational model's discretion: this path calls
 * Bedrock Converse with toolChoice FORCING the render_ui tool, so a block is
 * guaranteed, and runs on Opus (richer composition than the chat's Haiku).
 *
 * Normal conversational turns never reach here — they stay on the Strands+Haiku
 * agent in index.mjs. Only an explicit gen-ui request is routed here.
 */

import { z } from "zod";
import { createLogger } from "lambda-shared/logger";
import { RenderUiInputSchema } from "./uiBlocks.mjs";
import { emitEvent, EVENT_KINDS } from "./events.mjs";

// Opus for visual composition (matches the blueprint Lambda's model). Overridable.
export const GENUI_OPUS_MODEL_ID = process.env.BEDROCK_OPUS_MODEL_ID || "us.anthropic.claude-opus-4-6-v1";

// The trigger is the literal "gen-ui" / "gen ui" / "genui" command — an explicit,
// unambiguous signal that the visitor wants a visual answer. \b guards against
// matching inside unrelated words (e.g. "genuine").
const GENUI_PATTERN = /\bgen[\s_-]?ui\b/i;

export function detectGenUiIntent(text) {
  return typeof text === "string" && GENUI_PATTERN.test(text);
}

// Convert the shared Zod block vocabulary into a Bedrock-compatible JSON Schema.
// Memoized; computed lazily so a conversion issue surfaces as a handled error
// rather than a module-load crash.
let _toolSpec = null;
function renderUiToolSpec() {
  if (_toolSpec) return _toolSpec;
  const json = z.toJSONSchema(RenderUiInputSchema);
  delete json.$schema; // Bedrock toolSpec.inputSchema.json rejects the meta-schema key
  _toolSpec = {
    toolSpec: {
      name: "render_ui",
      description:
        "Compose 1–3 visual blocks that directly answer the visitor's request. " +
        "Pick the type that fits: comparison (A-vs-B), timeline (a sequence), " +
        "stat_row (figures), profile_mini (who-is), explainer (how-it-works), or " +
        "link_grid (where-to-go). Ground every value in the provided context — never invent facts.",
      inputSchema: { json },
    },
  };
  return _toolSpec;
}

function genUiSystem(retrievedContext) {
  return [
    'You are Alti\'s visual composer for thechrisgrey.com. The visitor explicitly asked for a visual answer (a "gen-ui" request), so you MUST call render_ui.',
    "Choose the block type(s) that best answer their request and fill them concisely.",
    'Ground every value strictly in the CONTEXT below plus what is broadly known about Christian Perez — Founder & CEO of Altivum Inc., former Green Beret (18D), host of The Vector Podcast, author of "Beyond the Assessment." Never fabricate specifics, dates, or numbers.',
    retrievedContext ? `\nCONTEXT:\n${retrievedContext}` : "",
  ].join("\n");
}

/**
 * Force-render a generative-UI answer. Emits a short text lead-in followed by the
 * validated block(s) as framed ui_block events. Returns { ok, blockCount } or
 * { ok:false, error } — callers fall back to a normal answer on failure.
 */
export async function renderGenUi({
  bedrockClient,
  ConverseCommand,
  modelId = GENUI_OPUS_MODEL_ID,
  userMessage,
  history = [],
  retrievedContext = "",
  responseStream,
  metrics,
  requestId,
  abortSignal,
}) {
  const messages = [...history, { role: "user", content: [{ text: userMessage }] }];
  const log = createLogger(requestId, { service: "chat-stream" });

  try {
    const command = new ConverseCommand({
      modelId,
      system: [{ text: genUiSystem(retrievedContext) }],
      messages,
      toolConfig: {
        tools: [renderUiToolSpec()],
        toolChoice: { tool: { name: "render_ui" } }, // FORCE the block — non-negotiable
      },
      inferenceConfig: { maxTokens: 1500, temperature: 0.4 },
    });
    const resp = await bedrockClient.send(command, abortSignal ? { abortSignal } : undefined);

    const content = resp?.output?.message?.content || [];
    const leadIn = content
      .map((c) => c.text)
      .filter(Boolean)
      .join(" ")
      .trim();
    const toolUse = content.find((c) => c.toolUse)?.toolUse;

    if (!toolUse) {
      metrics?.record("GenUiNoTool");
      log.error("genui_no_tool");
      return { ok: false, error: "no_tool_use" };
    }

    let parsed;
    try {
      parsed = RenderUiInputSchema.parse(toolUse.input);
    } catch (e) {
      metrics?.record("GenUiInvalidBlocks");
      log.error("genui_invalid_blocks", { message: e?.message });
      return { ok: false, error: "invalid_blocks" };
    }

    // Forced toolChoice usually suppresses conversational text, so emit a short
    // lead-in ourselves when the model returns none. The blocks carry the content.
    responseStream.write(leadIn || "Here's that, laid out:");
    for (const block of parsed.blocks) {
      emitEvent(responseStream, { kind: EVENT_KINDS.UI_BLOCK, block });
    }

    metrics?.record("GenUiRendered");
    metrics?.record("GenUiBlocks", parsed.blocks.length);
    if (resp?.usage) {
      metrics?.record("GenUiOpusInputTokens", resp.usage.inputTokens || 0);
      metrics?.record("GenUiOpusOutputTokens", resp.usage.outputTokens || 0);
    }
    return { ok: true, blockCount: parsed.blocks.length };
  } catch (error) {
    metrics?.record("GenUiError");
    log.error("genui_error", { error: error?.name, message: error?.message });
    return { ok: false, error: "genui_failed" };
  }
}
