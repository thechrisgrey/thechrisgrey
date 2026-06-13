/**
 * Dynamic Opus timeout: the abort budget is anchored to a single ABSOLUTE
 * deadline derived once per request from the Lambda's remaining execution time
 * (handlerStart + remaining - buffer), and SHARED across retry attempts. Each
 * Opus attempt re-derives its own per-attempt timeout from that deadline, so two
 * attempts can never consume 2x the budget and overrun the Lambda hard-timeout —
 * the failure mode a per-call duration (re-armed every attempt) would allow.
 * These tests pin the pure deadline logic and verify the per-attempt budget is
 * threaded down through streamOpus / invokeOpus / generateBlueprint (both the
 * streaming and the blocking Opus paths).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  resolveOpusDeadlineMs,
  opusTimeoutForDeadline,
  OPUS_TIMEOUT_MS,
  OPUS_TIMEOUT_BUFFER_MS,
  OPUS_TIMEOUT_FLOOR_MS,
  streamOpus,
  invokeOpus,
  BedrockTimeoutError,
} from "../bedrock.mjs";
import { generateBlueprint } from "../engine.mjs";
import { silentLogger, validBlueprintInput } from "./harness.mjs";

// ── resolveOpusDeadlineMs (pure) ───────────────────────────────────────────

test("resolveOpusDeadlineMs anchors the deadline at now + remaining - buffer", () => {
  assert.equal(
    resolveOpusDeadlineMs(150_000, 1_000_000),
    1_000_000 + 150_000 - OPUS_TIMEOUT_BUFFER_MS,
  );
  assert.equal(
    resolveOpusDeadlineMs(40_000, 5_000),
    5_000 + 40_000 - OPUS_TIMEOUT_BUFFER_MS,
  );
});

test("resolveOpusDeadlineMs returns null when there is no Lambda window", () => {
  // Off-Lambda (local / MCP / tests): no remaining-time signal → no deadline,
  // and callers fall back to the static per-attempt cap.
  assert.equal(resolveOpusDeadlineMs(undefined, 1_000_000), null);
  assert.equal(resolveOpusDeadlineMs(null, 1_000_000), null);
  assert.equal(resolveOpusDeadlineMs(NaN, 1_000_000), null);
  assert.equal(resolveOpusDeadlineMs(Infinity, 1_000_000), null);
  // A non-finite anchor is equally unusable.
  assert.equal(resolveOpusDeadlineMs(150_000, NaN), null);
});

// ── opusTimeoutForDeadline (pure) ──────────────────────────────────────────

test("opusTimeoutForDeadline caps at OPUS_TIMEOUT_MS when the deadline is far off", () => {
  const deadline = 1_000_000;
  assert.equal(opusTimeoutForDeadline(deadline, deadline - 200_000), OPUS_TIMEOUT_MS);
  // Exact cap boundary: deadline - now === cap.
  assert.equal(opusTimeoutForDeadline(deadline, deadline - OPUS_TIMEOUT_MS), OPUS_TIMEOUT_MS);
  // Just inside the cap pins the inflection point.
  assert.equal(
    opusTimeoutForDeadline(deadline, deadline - (OPUS_TIMEOUT_MS - 1_000)),
    OPUS_TIMEOUT_MS - 1_000,
  );
});

test("opusTimeoutForDeadline scales down as now approaches the shared deadline", () => {
  const deadline = 1_000_000;
  assert.equal(opusTimeoutForDeadline(deadline, deadline - 80_000), 80_000);
  assert.equal(opusTimeoutForDeadline(deadline, deadline - 30_000), 30_000);
});

test("opusTimeoutForDeadline floors at OPUS_TIMEOUT_FLOOR_MS at or past the deadline", () => {
  const deadline = 1_000_000;
  // Exact floor boundary: deadline - now === floor.
  assert.equal(
    opusTimeoutForDeadline(deadline, deadline - OPUS_TIMEOUT_FLOOR_MS),
    OPUS_TIMEOUT_FLOOR_MS,
  );
  assert.equal(opusTimeoutForDeadline(deadline, deadline), OPUS_TIMEOUT_FLOOR_MS);
  assert.equal(opusTimeoutForDeadline(deadline, deadline + 50_000), OPUS_TIMEOUT_FLOOR_MS);
});

test("opusTimeoutForDeadline shares one deadline across retries — a later attempt gets less time", () => {
  // Core regression guard for the critical bug: the budget must NOT be re-armed
  // at full value per attempt. With a shared deadline, attempt 2 (which starts
  // later) can never get as much as attempt 1, so two attempts cannot exceed the
  // request's Opus window.
  const deadline = 1_000_000;
  const attempt1Start = deadline - 100_000;
  const t1 = opusTimeoutForDeadline(deadline, attempt1Start);
  // Worst case: attempt 1 runs to its full budget, so attempt 2 starts later.
  const attempt2Start = attempt1Start + t1;
  const t2 = opusTimeoutForDeadline(deadline, attempt2Start);
  assert.ok(t2 < t1, `attempt 2 budget (${t2}) must be smaller than attempt 1 (${t1})`);
  // Both attempts together abort by (deadline + floor) — never 2x the budget.
  assert.ok(
    attempt2Start + t2 <= deadline + OPUS_TIMEOUT_FLOOR_MS,
    `combined abort (${attempt2Start + t2}) must not exceed deadline + floor (${deadline + OPUS_TIMEOUT_FLOOR_MS})`,
  );
});

test("opusTimeoutForDeadline returns the static cap when there is no deadline (off-Lambda)", () => {
  assert.equal(opusTimeoutForDeadline(null, 1_000_000), OPUS_TIMEOUT_MS);
  assert.equal(opusTimeoutForDeadline(undefined, 1_000_000), OPUS_TIMEOUT_MS);
});

// ── per-call timeout threading (streamOpus / invokeOpus) ───────────────────

/**
 * A Bedrock client whose send() never resolves on its own — it only rejects
 * with an AbortError when the injected abortSignal fires. This lets a small
 * timeoutMs drive a fast, deterministic abort exactly like the real SDK does.
 */
function abortingBedrockClient() {
  return {
    calls: [],
    async send(command, options) {
      // The input guardrail pre-check resolves immediately (passes) so the test
      // reaches the generation call it actually exercises.
      if (command?.constructor?.name === "ApplyGuardrailCommand") {
        return { action: "NONE" };
      }
      this.calls.push({ command, options });
      return await new Promise((_resolve, reject) => {
        const signal = options?.abortSignal;
        const fail = () => {
          const err = new Error("The operation was aborted");
          err.name = "AbortError";
          reject(err);
        };
        if (signal?.aborted) return fail();
        signal?.addEventListener?.("abort", fail, { once: true });
      });
    },
  };
}

test("streamOpus honors a passed timeoutMs and reports it on abort", { timeout: 2000 }, async () => {
  const bedrock = abortingBedrockClient();
  await assert.rejects(
    streamOpus(bedrock, { system: "s", user: "u", timeoutMs: 60, onChunk: () => {} }),
    (err) => {
      assert.ok(err instanceof BedrockTimeoutError, `expected BedrockTimeoutError, got ${err?.name}`);
      assert.equal(err.timeoutMs, 60, "BedrockTimeoutError must carry the actual timeout used");
      return true;
    },
  );
});

test("invokeOpus honors a passed timeoutMs and reports it on abort", { timeout: 2000 }, async () => {
  const bedrock = abortingBedrockClient();
  await assert.rejects(
    invokeOpus(bedrock, { system: "s", user: "u", timeoutMs: 60 }),
    (err) => {
      assert.ok(err instanceof BedrockTimeoutError, `expected BedrockTimeoutError, got ${err?.name}`);
      assert.equal(err.timeoutMs, 60);
      return true;
    },
  );
});

// ── deadline threading through generateBlueprint (both Opus paths) ──────────
//
// A deadline already in the past makes each attempt's budget clamp to the floor
// (~5s), so Opus aborts gracefully instead of hanging to the 110s cap. With an
// 8s test timeout: if the deadline is threaded, the abort fires at ~floor and we
// see opus_timeout; if a regression drops it, the call falls back to the 110s
// default and the test times out — exactly the failure these guard against.

test("generateBlueprint threads the deadline into the STREAMING Opus call", { timeout: 8000 }, async () => {
  const bedrock = abortingBedrockClient();
  const res = await generateBlueprint(validBlueprintInput(), {
    bedrockClient: bedrock,
    logger: silentLogger(),
    opusDeadlineMs: Date.now() - 1,
    onProgress: () => {}, // truthy onProgress forces the streamOpus path
  });
  assert.equal(res.ok, false);
  assert.equal(res.error, "opus_timeout", "a past deadline must abort Opus, not hang to the 110s cap");
});

test("generateBlueprint threads the deadline into the BLOCKING Opus call (no onProgress)", { timeout: 8000 }, async () => {
  const bedrock = abortingBedrockClient();
  const res = await generateBlueprint(validBlueprintInput(), {
    bedrockClient: bedrock,
    logger: silentLogger(),
    opusDeadlineMs: Date.now() - 1,
    // no onProgress → blocking invokeOpus branch (the path the MCP wrapper uses)
  });
  assert.equal(res.ok, false);
  assert.equal(res.error, "opus_timeout", "the blocking path must also honor the deadline, not fall back to 110s");
});
