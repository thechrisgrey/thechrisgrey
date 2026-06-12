/**
 * Blueprint generation engine — transport-agnostic.
 *
 * This module owns nothing about HTTP, CORS, HMAC, rate limiting, or
 * streaming. It accepts a validated-or-to-be-validated spec object plus
 * injected dependencies, and returns a plain JS result. An HTTP Function URL
 * handler wraps it today; a `generate_blueprint` MCP tool will wrap it
 * tomorrow.
 *
 * Contract:
 *   generateBlueprint(spec, { tier, sanityClient, bedrockClient, logger,
 *                              examplesFetcher, now })
 *   → { ok: true, output, meta } | { ok: false, error, details?, meta }
 *
 * `tier` is accepted but not yet gated. V1 always passes "free". V2 adds
 * "pro" — the handler layer resolves tier from Cognito; the engine just
 * stamps the returned meta so callers can log/telemeter spend.
 */

import { BlueprintInputSchema } from "./schema.mjs";
import {
  buildSystemPrompt,
  buildUserPrompt,
  selectExamples,
} from "./prompts.mjs";
import {
  invokeOpus,
  streamOpus,
  opusTimeoutForDeadline,
  BedrockTimeoutError,
} from "./bedrock.mjs";
import {
  tryParseJson,
  validateSchema,
  validateWithHaiku,
} from "./validation.mjs";
import { createGoldenExamplesFetcher } from "./goldenExamples.mjs";

export const VALID_TIERS = new Set(["free", "pro"]);
export const DEFAULT_EXAMPLE_LIMIT = 3;

const SILENT_LOGGER = {
  info: () => {},
  warn: () => {},
  error: () => {},
};

/**
 * Safe progress emitter — swallows callback errors so a broken downstream stream
 * never aborts generation. Phase/event shapes are:
 *   { type: "status", phase: "validating_input" | "fetching_examples" |
 *                              "generating" | "validating_output" | "done",
 *     attempt?: number, examplesUsed?: number }
 *   { type: "token", text: string }  (streaming only)
 */
function emit(onProgress, event) {
  if (!onProgress) return;
  try {
    onProgress(event);
  } catch {
    // Downstream stream errors must not interrupt generation.
  }
}

/**
 * Generate an AWS architecture blueprint for a given spec.
 *
 * @param {object} rawSpec - Unvalidated spec from the caller.
 * @param {object} deps
 * @param {"free"|"pro"} [deps.tier="free"]
 * @param {object|null} [deps.sanityClient] - For fetching golden examples.
 * @param {object} deps.bedrockClient       - BedrockRuntimeClient (required).
 * @param {object} [deps.logger]            - { info, warn, error }.
 * @param {object} [deps.examplesFetcher]   - Pre-built fetcher (preferred for
 *                                            reuse across requests); otherwise
 *                                            created from sanityClient.
 * @param {string} [deps.requestId]
 * @param {number|null} [deps.opusDeadlineMs] - Absolute epoch-ms deadline by
 *        which every Opus attempt must abort, shared across the schema-retry. The
 *        handler derives it from the Lambda's remaining time via
 *        resolveOpusDeadlineMs; each attempt re-derives its own timeout via
 *        opusTimeoutForDeadline, so retries can't exceed the request's Opus
 *        window. When null (off-Lambda: MCP, local, tests) each attempt uses the
 *        static OPUS_TIMEOUT_MS cap.
 * @param {(event: object) => void} [deps.onProgress] - Optional progress
 *        callback. When provided, the engine uses streamOpus and relays each
 *        token delta as `{type:"token", text}`. Also emits lifecycle
 *        `{type:"status", phase}` events even when omitted.
 * @returns {Promise<object>}
 */
export async function generateBlueprint(rawSpec, deps) {
  const start = Date.now();
  const {
    tier = "free",
    sanityClient = null,
    bedrockClient,
    logger = SILENT_LOGGER,
    examplesFetcher: injectedFetcher,
    requestId = null,
    onProgress = null,
    opusDeadlineMs = null,
  } = deps || {};

  if (!bedrockClient) {
    throw new Error("generateBlueprint requires a bedrockClient");
  }
  if (!VALID_TIERS.has(tier)) {
    return {
      ok: false,
      error: "invalid_tier",
      details: `tier must be one of: ${[...VALID_TIERS].join(", ")}`,
      meta: { tier, total_ms: Date.now() - start },
    };
  }

  // 1. Validate input
  emit(onProgress, { type: "status", phase: "validating_input" });
  const parsed = BlueprintInputSchema.safeParse(rawSpec);
  if (!parsed.success) {
    return {
      ok: false,
      error: "invalid_input",
      details: parsed.error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      })),
      meta: { tier, total_ms: Date.now() - start },
    };
  }
  const spec = parsed.data;

  // 2. Resolve golden-example fetcher and load examples
  emit(onProgress, { type: "status", phase: "fetching_examples" });
  const fetcher = injectedFetcher
    || (sanityClient ? createGoldenExamplesFetcher(sanityClient) : null);

  let allExamples = [];
  if (fetcher) {
    try {
      allExamples = await fetcher.getExamples();
    } catch (error) {
      logger.warn?.("golden_examples_load_error", {
        requestId, error: error?.name, message: error?.message,
      });
      allExamples = [];
    }
  }
  const examples = selectExamples(allExamples, spec, DEFAULT_EXAMPLE_LIMIT);

  // 3. Compose prompts
  const system = buildSystemPrompt({ examples });
  const user = buildUserPrompt(spec);

  // 4. Call Opus + parse + schema-validate, with one retry on schema failure.
  //    When onProgress is provided we use streamOpus so the caller can relay
  //    token deltas to the client while Opus is still working; otherwise we
  //    stay on the blocking invokeOpus path.
  let attempt = 0;
  let opusUsage = { input_tokens: 0, output_tokens: 0 };
  let opusLatencyMs = 0;
  let output = null;
  let lastSchemaIssues = null;

  while (attempt < 2) {
    attempt++;
    emit(onProgress, {
      type: "status",
      phase: "generating",
      attempt,
      examplesUsed: examples.length,
    });
    const retryNote = attempt > 1
      ? `\n\nNOTE: A previous attempt failed schema validation with these issues:\n${JSON.stringify(lastSchemaIssues).slice(0, 600)}\nReturn a corrected JSON object that satisfies every constraint.`
      : "";

    // Re-derive this attempt's abort budget from the shared deadline so a retry
    // that starts later gets less time — two attempts can never exceed the
    // request's Opus window. Off-Lambda (null deadline) → the static cap.
    const timeoutMs = opusTimeoutForDeadline(opusDeadlineMs, Date.now());

    let opusResult;
    try {
      if (onProgress) {
        opusResult = await streamOpus(bedrockClient, {
          system,
          user: user + retryNote,
          requestId,
          timeoutMs,
          onChunk: (text) => emit(onProgress, { type: "token", text }),
        });
      } else {
        opusResult = await invokeOpus(bedrockClient, {
          system,
          user: user + retryNote,
          requestId,
          timeoutMs,
        });
      }
    } catch (error) {
      const code = error instanceof BedrockTimeoutError ? "opus_timeout" : "opus_error";
      logger.error?.(code, {
        requestId, error: error?.name, message: error?.message, attempt,
      });
      return {
        ok: false,
        error: code,
        details: error?.message,
        meta: {
          tier,
          total_ms: Date.now() - start,
          opus_tokens: opusUsage,
          attempt,
          examples_used: examples.length,
        },
      };
    }

    opusUsage = {
      input_tokens: opusUsage.input_tokens + opusResult.usage.input_tokens,
      output_tokens: opusUsage.output_tokens + opusResult.usage.output_tokens,
    };
    opusLatencyMs += opusResult.latencyMs;

    const jsonParse = tryParseJson(opusResult.text);
    if (!jsonParse.ok) {
      lastSchemaIssues = [{ field: "_root", severity: "error", note: jsonParse.error }];
      logger.warn?.("opus_response_parse_error", {
        requestId, error: jsonParse.error, attempt,
      });
      continue;
    }

    const schemaResult = validateSchema(jsonParse.data);
    if (!schemaResult.ok) {
      lastSchemaIssues = schemaResult.issues;
      logger.warn?.("opus_schema_validation_failed", {
        requestId, issues: schemaResult.issues.slice(0, 5), attempt,
      });
      continue;
    }

    output = schemaResult.output;
    break;
  }

  if (!output) {
    return {
      ok: false,
      error: "validation_failed",
      details: lastSchemaIssues,
      meta: {
        tier,
        total_ms: Date.now() - start,
        opus_tokens: opusUsage,
        opus_latency_ms: opusLatencyMs,
        attempt,
        examples_used: examples.length,
      },
    };
  }

  // 5. Haiku quality pass (soft signal)
  emit(onProgress, { type: "status", phase: "validating_output" });
  let haikuVerdict;
  let haikuUsage = { input_tokens: 0, output_tokens: 0 };
  let haikuLatencyMs = 0;
  try {
    const haikuStart = Date.now();
    const verdict = await validateWithHaiku(bedrockClient, output, { requestId });
    haikuLatencyMs = Date.now() - haikuStart;
    haikuUsage = verdict.usage;
    haikuVerdict = {
      ok: verdict.ok,
      confidence: verdict.confidence,
      issues: verdict.issues,
    };
    if (!verdict.ok) {
      logger.warn?.("haiku_flagged_quality_issues", {
        requestId, issues: verdict.issues.slice(0, 5),
      });
    }
  } catch (error) {
    logger.warn?.("haiku_validator_error", {
      requestId, error: error?.name, message: error?.message,
    });
    haikuVerdict = { ok: true, confidence: "low", issues: [] };
  }

  emit(onProgress, { type: "status", phase: "done" });
  return {
    ok: true,
    output,
    meta: {
      tier,
      total_ms: Date.now() - start,
      opus_tokens: opusUsage,
      opus_latency_ms: opusLatencyMs,
      haiku_tokens: haikuUsage,
      haiku_latency_ms: haikuLatencyMs,
      haiku_verdict: haikuVerdict,
      attempts: attempt,
      examples_used: examples.length,
    },
  };
}

export default { generateBlueprint };
