/**
 * Bedrock wrapper for the Blueprint generator.
 *
 * Three model paths:
 *  - invokeOpus():  Blocking generation. Returns full text + usage when done.
 *                   110s timeout, Opus 4.6 via inference profile.
 *  - streamOpus():  Streaming generation. Emits each content_block_delta via
 *                   onChunk(text). Returns the accumulated text + usage when
 *                   the stream ends. Same 110s cap but the client sees tokens
 *                   the whole time.
 *  - invokeHaiku(): Validation pass. Haiku 4.5 via inference profile.
 *                   15s timeout, returns { ok, issues, raw } + token usage.
 *
 * Clients are injected so tests can stub BedrockRuntimeClient without touching
 * AWS. On timeout, we abort the underlying request and surface a typed error
 * (`BedrockTimeoutError`) the engine can treat as a retryable failure.
 */

import {
  InvokeModelCommand,
  InvokeModelWithResponseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";

export const OPUS_MODEL_ID =
  process.env.BEDROCK_OPUS_MODEL_ID || "us.anthropic.claude-opus-4-6-v1";
export const HAIKU_MODEL_ID =
  process.env.BEDROCK_HAIKU_MODEL_ID ||
  "us.anthropic.claude-haiku-4-5-20251001-v1:0";

// MUST stay below the deployed blueprint Lambda timeout (currently 150s) so the internal
// AbortController fires first and the engine surfaces a graceful `opus_timeout` event +
// BlueprintOpusTimeout metric. Keep the runbook's --timeout in sync (phase-5-deployment-runbook.md).
export const OPUS_TIMEOUT_MS = 110_000;
export const HAIKU_TIMEOUT_MS = 15_000;

export const OPUS_MAX_TOKENS = 6000;
export const HAIKU_MAX_TOKENS = 1200;

export const DEFAULT_ANTHROPIC_VERSION = "bedrock-2023-05-31";

export class BedrockTimeoutError extends Error {
  constructor(modelId, timeoutMs) {
    super(`Bedrock invocation timed out after ${timeoutMs}ms (${modelId})`);
    this.name = "BedrockTimeoutError";
    this.modelId = modelId;
    this.timeoutMs = timeoutMs;
  }
}

export class BedrockInvocationError extends Error {
  constructor(modelId, cause) {
    super(`Bedrock invocation failed (${modelId}): ${cause?.message || cause}`);
    this.name = "BedrockInvocationError";
    this.modelId = modelId;
    this.cause = cause;
  }
}

/**
 * Parse the Anthropic-on-Bedrock response envelope and pull out the assistant
 * text + token usage.
 *
 * @param {Uint8Array} bodyBytes
 * @returns {{ text: string, usage: { input_tokens: number, output_tokens: number } }}
 */
export function parseBedrockResponse(bodyBytes) {
  const raw = new TextDecoder().decode(bodyBytes);
  const payload = JSON.parse(raw);
  const text = payload.content
    ?.filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("") ?? "";
  const usage = {
    input_tokens: payload.usage?.input_tokens ?? 0,
    output_tokens: payload.usage?.output_tokens ?? 0,
  };
  return { text, usage };
}

/**
 * Invoke a Claude model with a single user turn and a system prompt.
 *
 * @param {object} bedrockClient - BedrockRuntimeClient (injected for tests).
 * @param {object} opts
 * @param {string} opts.modelId
 * @param {string} opts.system
 * @param {string} opts.user
 * @param {number} opts.maxTokens
 * @param {number} opts.temperature
 * @param {number} opts.timeoutMs
 * @param {string} [opts.requestId]
 * @returns {Promise<{ text: string, usage: object, latencyMs: number }>}
 */
export async function invokeClaude(bedrockClient, {
  modelId,
  system,
  user,
  maxTokens,
  temperature,
  timeoutMs,
  requestId = null,
}) {
  const start = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const body = {
    anthropic_version: DEFAULT_ANTHROPIC_VERSION,
    max_tokens: maxTokens,
    temperature,
    system,
    messages: [{ role: "user", content: user }],
  };

  try {
    const response = await bedrockClient.send(
      new InvokeModelCommand({
        modelId,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify(body),
      }),
      { abortSignal: controller.signal },
    );
    clearTimeout(timeoutId);
    const { text, usage } = parseBedrockResponse(response.body);
    return { text, usage, latencyMs: Date.now() - start };
  } catch (error) {
    clearTimeout(timeoutId);
    const latencyMs = Date.now() - start;
    if (error?.name === "AbortError") {
      if (requestId) {
        console.error(JSON.stringify({
          requestId, event: "bedrock_timeout", modelId, latencyMs, timeoutMs,
        }));
      }
      throw new BedrockTimeoutError(modelId, timeoutMs);
    }
    if (requestId) {
      console.error(JSON.stringify({
        requestId, event: "bedrock_error", modelId, latencyMs,
        error: error?.name, message: error?.message,
      }));
    }
    throw new BedrockInvocationError(modelId, error);
  }
}

/**
 * Invoke Opus for generation. Temperature 0.3 for moderate creativity
 * with high schema fidelity. Blocking — callers waiting on full output
 * use this path; callers that want streaming feedback use streamOpus().
 */
export async function invokeOpus(bedrockClient, { system, user, requestId = null }) {
  return invokeClaude(bedrockClient, {
    modelId: OPUS_MODEL_ID,
    system,
    user,
    maxTokens: OPUS_MAX_TOKENS,
    temperature: 0.3,
    timeoutMs: OPUS_TIMEOUT_MS,
    requestId,
  });
}

/**
 * Stream Opus generation. For each `content_block_delta` chunk, the assistant
 * text is accumulated AND (if onChunk is provided) forwarded to the caller so
 * it can be relayed to the client as progress.
 *
 * @param {object} bedrockClient
 * @param {object} opts
 * @param {string} opts.system
 * @param {string} opts.user
 * @param {(text: string) => void} [opts.onChunk]
 * @param {string} [opts.requestId]
 * @returns {Promise<{ text: string, usage: object, latencyMs: number, stop_reason?: string }>}
 */
export async function streamOpus(bedrockClient, {
  system,
  user,
  onChunk,
  requestId = null,
}) {
  const start = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OPUS_TIMEOUT_MS);

  const body = {
    anthropic_version: DEFAULT_ANTHROPIC_VERSION,
    max_tokens: OPUS_MAX_TOKENS,
    temperature: 0.3,
    system,
    messages: [{ role: "user", content: user }],
  };

  let accumulated = "";
  let inputTokens = 0;
  let outputTokens = 0;
  let stopReason = null;

  try {
    const response = await bedrockClient.send(
      new InvokeModelWithResponseStreamCommand({
        modelId: OPUS_MODEL_ID,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify(body),
      }),
      { abortSignal: controller.signal },
    );

    for await (const event of response.body) {
      if (!event?.chunk?.bytes) continue;
      let chunk;
      try {
        chunk = JSON.parse(new TextDecoder().decode(event.chunk.bytes));
      } catch {
        continue;
      }
      switch (chunk.type) {
        case "message_start":
          inputTokens = chunk.message?.usage?.input_tokens ?? inputTokens;
          outputTokens = chunk.message?.usage?.output_tokens ?? outputTokens;
          break;
        case "content_block_delta": {
          const text = chunk.delta?.text;
          if (typeof text === "string" && text.length > 0) {
            accumulated += text;
            try {
              onChunk?.(text);
            } catch {
              // Downstream stream errors must not abort the Bedrock read.
            }
          }
          break;
        }
        case "message_delta":
          stopReason = chunk.delta?.stop_reason ?? stopReason;
          if (chunk.usage?.output_tokens) {
            outputTokens = chunk.usage.output_tokens;
          }
          break;
        case "message_stop":
          break;
        default:
          break;
      }
    }

    clearTimeout(timeoutId);
    return {
      text: accumulated,
      usage: { input_tokens: inputTokens, output_tokens: outputTokens },
      latencyMs: Date.now() - start,
      stop_reason: stopReason,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    const latencyMs = Date.now() - start;
    if (error?.name === "AbortError") {
      if (requestId) {
        console.error(JSON.stringify({
          requestId,
          event: "bedrock_stream_timeout",
          modelId: OPUS_MODEL_ID,
          latencyMs,
          timeoutMs: OPUS_TIMEOUT_MS,
          partialChars: accumulated.length,
        }));
      }
      throw new BedrockTimeoutError(OPUS_MODEL_ID, OPUS_TIMEOUT_MS);
    }
    if (requestId) {
      console.error(JSON.stringify({
        requestId,
        event: "bedrock_stream_error",
        modelId: OPUS_MODEL_ID,
        latencyMs,
        error: error?.name,
        message: error?.message,
      }));
    }
    throw new BedrockInvocationError(OPUS_MODEL_ID, error);
  }
}

/**
 * Invoke Haiku 4.5 for validation. Temperature 0.0 — we want consistent
 * classifications, not creative critiques.
 */
export async function invokeHaiku(bedrockClient, { system, user, requestId = null }) {
  return invokeClaude(bedrockClient, {
    modelId: HAIKU_MODEL_ID,
    system,
    user,
    maxTokens: HAIKU_MAX_TOKENS,
    temperature: 0.0,
    timeoutMs: HAIKU_TIMEOUT_MS,
    requestId,
  });
}

export default {
  invokeOpus,
  streamOpus,
  invokeHaiku,
  invokeClaude,
  parseBedrockResponse,
  OPUS_MODEL_ID,
  HAIKU_MODEL_ID,
  OPUS_TIMEOUT_MS,
  HAIKU_TIMEOUT_MS,
  BedrockTimeoutError,
  BedrockInvocationError,
};
