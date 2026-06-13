/**
 * Bedrock wrapper for the Blueprint generator.
 *
 * Three model paths:
 *  - invokeOpus():  Blocking generation. Returns full text + usage when done.
 *                   Opus 4.6 via inference profile. Per-attempt abort budget
 *                   passed in by the caller (opusTimeoutForDeadline), capped at
 *                   OPUS_TIMEOUT_MS.
 *  - streamOpus():  Streaming generation. Emits each content_block_delta via
 *                   onChunk(text). Returns the accumulated text + usage when
 *                   the stream ends. Same caller-supplied per-attempt budget, but
 *                   the client sees tokens the whole time.
 *  - invokeHaiku(): Validation pass. Haiku 4.5 via inference profile.
 *                   Fixed 15s timeout, returns { ok, issues, raw } + token usage.
 *
 * Clients are injected so tests can stub BedrockRuntimeClient without touching
 * AWS. On timeout, we abort the underlying request and surface a typed error
 * (`BedrockTimeoutError`) the engine can treat as a retryable failure.
 */

import {
  ConverseCommand,
  ConverseStreamCommand,
  ApplyGuardrailCommand,
} from "@aws-sdk/client-bedrock-runtime";

export const OPUS_MODEL_ID =
  process.env.BEDROCK_OPUS_MODEL_ID || "us.anthropic.claude-opus-4-6-v1";
export const HAIKU_MODEL_ID =
  process.env.BEDROCK_HAIKU_MODEL_ID ||
  "us.anthropic.claude-haiku-4-5-20251001-v1:0";

// Bedrock Guardrail (the same guardrail chat-stream + mcp-server enforce).
// Applied to every model call so visitor free-text in the spec is filtered for
// PROMPT_ATTACK / HATE / INSULTS / SEXUAL / VIOLENCE / MISCONDUCT before it
// reaches Opus or Haiku. Env-overridable; defaults are the live prod guardrail
// so the guard is correct even before GUARDRAIL_ID/VERSION are set on the
// function. Requires bedrock:ApplyGuardrail in the role (iam-policy.json).
export const GUARDRAIL_ID = process.env.GUARDRAIL_ID || "5kofhp46ssob";
export const GUARDRAIL_VERSION = process.env.GUARDRAIL_VERSION || "5";

// Build the Converse `messages` array for a single user turn. Generation runs
// UNGUARDED — the guardrail is applied as a dedicated input pre-check
// (applyInputGuardrail) instead of on the model call. Guarding the generation
// itself false-blocked legitimate blueprints: the chat-tuned guardrail flagged
// our own directive system prompt as a prompt-attack and flagged generated
// IAM/architecture output as policy violations. The input pre-check blocks
// malicious specs (prompt injection, abuse) without touching the output.
function userMessages(text) {
  return [{ role: "user", content: [{ text }] }];
}

/**
 * Run the Bedrock Guardrail over user-supplied input text BEFORE generation,
 * using the dedicated ApplyGuardrail API. Returns:
 *   { intervened: true }                 — guardrail blocked the input
 *   { intervened: false }                — input is clean, proceed
 *   { intervened: false, checkFailed: true } — the guardrail check itself failed
 *
 * FAILS CLOSED: this guardrail is the ONLY input-abuse control (generation runs
 * unguarded), so a guardrail outage must not open the gate, and unscreened input
 * must not reach the most expensive model (Opus, with a cost alarm). Transient
 * blips are absorbed by retrying once; only a sustained failure declines, which
 * the handler surfaces as a retriable "temporarily unavailable" message.
 *
 * @param {object} bedrockClient - BedrockRuntimeClient (injected for tests).
 * @param {string} text - The user-supplied input to assess.
 * @param {object} [opts]
 * @param {string} [opts.requestId]
 * @param {string} [opts.guardrailId=GUARDRAIL_ID]
 * @param {string} [opts.guardrailVersion=GUARDRAIL_VERSION]
 * @param {number} [opts.maxAttempts=2] - Total attempts (1 retry).
 * @returns {Promise<{ intervened: boolean, checkFailed?: boolean }>}
 */
export async function applyInputGuardrail(bedrockClient, text, {
  requestId = null,
  guardrailId = GUARDRAIL_ID,
  guardrailVersion = GUARDRAIL_VERSION,
  maxAttempts = 2,
} = {}) {
  if (!guardrailId || !guardrailVersion || !text) return { intervened: false };
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await bedrockClient.send(new ApplyGuardrailCommand({
        guardrailIdentifier: guardrailId,
        guardrailVersion,
        source: "INPUT",
        content: [{ text: { text } }],
      }));
      const intervened = response?.action === "GUARDRAIL_INTERVENED";
      if (intervened && requestId) {
        console.warn(JSON.stringify({
          requestId, event: "blueprint_input_guardrail_intervened",
        }));
      }
      return { intervened };
    } catch (error) {
      lastError = error;
    }
  }
  // Every attempt failed — decline (fail closed) rather than wave the input
  // through to Opus unscreened.
  if (requestId) {
    console.error(JSON.stringify({
      requestId, event: "blueprint_input_guardrail_error",
      error: lastError?.name, message: lastError?.message,
    }));
  }
  return { intervened: false, checkFailed: true };
}

// Opus's abort budget is anchored to a single ABSOLUTE deadline, derived once
// per request from the Lambda's remaining execution time (resolveOpusDeadlineMs)
// as handlerStart + remaining - buffer. Every Opus attempt re-derives its own
// timeout from that shared deadline (opusTimeoutForDeadline), so retries AND
// pre-Opus latency all draw from the same budget — the final attempt's internal
// AbortController fires by (deadline + at most the floor), always before the
// Lambda hard-timeout, surfacing a graceful `opus_timeout` event +
// BlueprintOpusTimeout metric, no matter how the deployed --timeout is set.
// OPUS_TIMEOUT_MS is the per-attempt upper cap and the fallback when no Lambda
// deadline is available (local runs, the MCP wrapper, tests). HAIKU_TIMEOUT_MS
// stays fixed; it has its own timer and runs only after a successful Opus pass,
// inside the buffer reserved below.
export const OPUS_TIMEOUT_MS = 110_000;
export const HAIKU_TIMEOUT_MS = 15_000;

// Time reserved between the Opus deadline and the Lambda hard-timeout for the
// post-Opus tail: the Haiku validation pass (its own 15s timer), the terminal
// NDJSON write, and metrics.flush(). Because the Opus deadline is absolute
// (anchored at handler start), this buffer is preserved regardless of how long
// pre-Opus work or a schema-retry takes.
export const OPUS_TIMEOUT_BUFFER_MS = 20_000;
// Floor so a nearly-exhausted (or already-past) deadline never yields a
// zero/negative abort delay; such a request is effectively doomed, but we still
// abort cleanly. floor < buffer keeps even the final attempt's abort before the
// hard-timeout.
export const OPUS_TIMEOUT_FLOOR_MS = 5_000;

/**
 * Anchor the absolute instant (epoch ms) by which every Opus attempt must have
 * aborted, leaving OPUS_TIMEOUT_BUFFER_MS for the post-Opus tail. Anchoring on
 * an absolute deadline — rather than a per-call duration re-armed each attempt —
 * means retries and pre-Opus latency all draw from the SAME budget, so total
 * Opus wall time can never exceed it. Self-adjusts to whatever --timeout the
 * function is deployed with, replacing the old requirement to keep
 * OPUS_TIMEOUT_MS manually below the deployed timeout.
 *
 * @param {number} [remainingMs] - context.getRemainingTimeInMillis() at the
 *   anchor instant.
 * @param {number} nowMs - Date.now() at the same instant (handler start).
 * @param {object} [opts]
 * @param {number} [opts.buffer=OPUS_TIMEOUT_BUFFER_MS]
 * @returns {number|null} epoch-ms deadline, or null when there is no Lambda
 *   window (off-Lambda: local, MCP, tests) — callers then use the static cap.
 */
export function resolveOpusDeadlineMs(remainingMs, nowMs, {
  buffer = OPUS_TIMEOUT_BUFFER_MS,
} = {}) {
  if (typeof remainingMs !== "number" || !Number.isFinite(remainingMs)) return null;
  if (typeof nowMs !== "number" || !Number.isFinite(nowMs)) return null;
  return nowMs + remainingMs - buffer;
}

/**
 * Per-attempt Opus abort budget: time from `nowMs` until the shared deadline,
 * clamped to [floor, cap]. Recomputed before EACH Opus attempt so a retry that
 * starts later automatically gets a smaller budget and the final attempt still
 * aborts by (deadline + at most floor). A null deadline (off-Lambda) yields the
 * static cap, so off-Lambda behavior is unchanged.
 *
 * @param {number|null} [deadlineMs] - from resolveOpusDeadlineMs.
 * @param {number} nowMs - Date.now() at the start of this attempt.
 * @param {object} [opts]
 * @param {number} [opts.floor=OPUS_TIMEOUT_FLOOR_MS]
 * @param {number} [opts.cap=OPUS_TIMEOUT_MS]
 * @returns {number} timeout in ms, clamped to [floor, cap].
 */
export function opusTimeoutForDeadline(deadlineMs, nowMs, {
  floor = OPUS_TIMEOUT_FLOOR_MS,
  cap = OPUS_TIMEOUT_MS,
} = {}) {
  if (deadlineMs == null || !Number.isFinite(deadlineMs) || !Number.isFinite(nowMs)) {
    return cap;
  }
  return Math.max(floor, Math.min(cap, Math.round(deadlineMs - nowMs)));
}

// 8000 (raised from 6000): a complex blueprint — multi-item claude_artifacts
// (bodies up to 8000 chars each), a 4000-char IaC snippet, services, cost, etc.
// — can exceed 6000 output tokens and truncate mid-JSON, surfacing as
// validation_failed. 8000 gives headroom for typical blueprints + their retry.
export const OPUS_MAX_TOKENS = 8000;
export const HAIKU_MAX_TOKENS = 1200;

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
 * Parse a Converse response envelope into assistant text + token usage +
 * stopReason. A guardrail intervention sets stopReason to "guardrail_intervened"
 * and replaces output.message.content with the guardrail's blocked message.
 *
 * @param {object} response - Converse API response.
 * @returns {{ text: string, usage: { input_tokens: number, output_tokens: number }, stop_reason: string|null }}
 */
export function parseConverseResponse(response) {
  const blocks = response?.output?.message?.content ?? [];
  const text = blocks
    .filter((block) => typeof block.text === "string")
    .map((block) => block.text)
    .join("");
  const usage = {
    input_tokens: response?.usage?.inputTokens ?? 0,
    output_tokens: response?.usage?.outputTokens ?? 0,
  };
  return { text, usage, stop_reason: response?.stopReason ?? null };
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

  try {
    const response = await bedrockClient.send(
      new ConverseCommand({
        modelId,
        system: [{ text: system }],
        messages: userMessages(user),
        inferenceConfig: { maxTokens, temperature },
      }),
      { abortSignal: controller.signal },
    );
    clearTimeout(timeoutId);
    const { text, usage } = parseConverseResponse(response);
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
export async function invokeOpus(bedrockClient, {
  system,
  user,
  requestId = null,
  timeoutMs = OPUS_TIMEOUT_MS,
}) {
  return invokeClaude(bedrockClient, {
    modelId: OPUS_MODEL_ID,
    system,
    user,
    maxTokens: OPUS_MAX_TOKENS,
    temperature: 0.3,
    timeoutMs,
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
  timeoutMs = OPUS_TIMEOUT_MS,
}) {
  const start = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let accumulated = "";
  let inputTokens = 0;
  let outputTokens = 0;
  let stopReason = null;

  try {
    const response = await bedrockClient.send(
      new ConverseStreamCommand({
        modelId: OPUS_MODEL_ID,
        system: [{ text: system }],
        messages: userMessages(user),
        inferenceConfig: { maxTokens: OPUS_MAX_TOKENS, temperature: 0.3 },
      }),
      { abortSignal: controller.signal },
    );

    for await (const event of response.stream) {
      const delta = event.contentBlockDelta?.delta?.text;
      if (typeof delta === "string" && delta.length > 0) {
        accumulated += delta;
        try {
          onChunk?.(delta);
        } catch {
          // Downstream stream errors must not abort the Bedrock read.
        }
      } else if (event.messageStop) {
        stopReason = event.messageStop.stopReason ?? stopReason;
      } else if (event.metadata?.usage) {
        inputTokens = event.metadata.usage.inputTokens ?? inputTokens;
        outputTokens = event.metadata.usage.outputTokens ?? outputTokens;
      }
    }

    clearTimeout(timeoutId);
    // ConverseStream ends the async iterator GRACEFULLY when the request is
    // aborted (the abortSignal cancels it without rejecting the iteration), so
    // an abort would otherwise return as a completed-but-truncated generation —
    // the engine would then try to parse partial JSON and surface a misleading
    // validation_failed instead of a timeout. Detect the abort explicitly and
    // surface it as a timeout, matching the blocking path.
    if (controller.signal.aborted) {
      if (requestId) {
        console.error(JSON.stringify({
          requestId, event: "bedrock_stream_timeout", modelId: OPUS_MODEL_ID,
          latencyMs: Date.now() - start, timeoutMs, partialChars: accumulated.length,
        }));
      }
      throw new BedrockTimeoutError(OPUS_MODEL_ID, timeoutMs);
    }
    return {
      text: accumulated,
      usage: { input_tokens: inputTokens, output_tokens: outputTokens },
      latencyMs: Date.now() - start,
      stop_reason: stopReason,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    const latencyMs = Date.now() - start;
    // Re-throw a timeout raised after the loop (graceful-abort detection) so it
    // is not re-wrapped as a generic invocation error.
    if (error instanceof BedrockTimeoutError) throw error;
    if (error?.name === "AbortError") {
      if (requestId) {
        console.error(JSON.stringify({
          requestId,
          event: "bedrock_stream_timeout",
          modelId: OPUS_MODEL_ID,
          latencyMs,
          timeoutMs,
          partialChars: accumulated.length,
        }));
      }
      throw new BedrockTimeoutError(OPUS_MODEL_ID, timeoutMs);
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
  parseConverseResponse,
  applyInputGuardrail,
  OPUS_MODEL_ID,
  HAIKU_MODEL_ID,
  OPUS_TIMEOUT_MS,
  HAIKU_TIMEOUT_MS,
  GUARDRAIL_ID,
  GUARDRAIL_VERSION,
  BedrockTimeoutError,
  BedrockInvocationError,
};
