import { test } from "node:test";
import assert from "node:assert/strict";
import { generateBlueprint } from "../engine.mjs";
import {
  scriptedBedrockClient,
  fakeSanityClient,
  silentLogger,
  validBlueprintInput,
  validBlueprintOutput,
} from "./harness.mjs";

function haikuOkVerdict() {
  return {
    text: JSON.stringify({
      ok: true,
      confidence: "high",
      issues: [],
    }),
  };
}

function haikuWarnVerdict() {
  return {
    text: JSON.stringify({
      ok: false,
      confidence: "medium",
      issues: [{ field: "services", severity: "error", note: "rationale too short" }],
    }),
  };
}

function opusResponseFromOutput(overrides) {
  return { text: JSON.stringify(validBlueprintOutput(overrides)) };
}

test("generateBlueprint throws when bedrockClient missing", async () => {
  await assert.rejects(
    generateBlueprint(validBlueprintInput(), { logger: silentLogger() }),
    /requires a bedrockClient/i,
  );
});

test("generateBlueprint rejects invalid tier", async () => {
  const bedrock = scriptedBedrockClient([]);
  const res = await generateBlueprint(validBlueprintInput(), {
    tier: "enterprise",
    bedrockClient: bedrock,
    logger: silentLogger(),
  });
  assert.equal(res.ok, false);
  assert.equal(res.error, "invalid_tier");
  assert.ok(res.details.includes("free"));
  assert.equal(bedrock.calls.length, 0, "should not call Bedrock on invalid tier");
});

test("generateBlueprint returns invalid_input with field-level details", async () => {
  const bedrock = scriptedBedrockClient([]);
  const res = await generateBlueprint(
    { goal: "short", category: "web-api" }, // goal too short
    { bedrockClient: bedrock, logger: silentLogger() },
  );
  assert.equal(res.ok, false);
  assert.equal(res.error, "invalid_input");
  assert.ok(Array.isArray(res.details));
  const goalIssue = res.details.find((d) => d.field === "goal");
  assert.ok(goalIssue, `expected goal issue, got ${JSON.stringify(res.details)}`);
  assert.equal(bedrock.calls.length, 0);
});

test("generateBlueprint happy path: 1 Opus call + 1 Haiku call", async () => {
  const bedrock = scriptedBedrockClient([opusResponseFromOutput(), haikuOkVerdict()]);
  const res = await generateBlueprint(validBlueprintInput(), {
    bedrockClient: bedrock,
    sanityClient: fakeSanityClient([]),
    logger: silentLogger(),
    requestId: "req-happy",
  });
  assert.equal(res.ok, true, JSON.stringify(res));
  assert.ok(res.output.architecture_summary);
  assert.equal(res.meta.tier, "free");
  assert.equal(res.meta.attempts, 1);
  assert.equal(res.meta.examples_used, 0);
  assert.equal(res.meta.haiku_verdict.ok, true);
  assert.equal(res.meta.haiku_verdict.confidence, "high");
  assert.equal(bedrock.calls.length, 2);
});

test("generateBlueprint retries once on schema failure, succeeds on attempt 2", async () => {
  // Attempt 1: Opus returns output with empty services (schema fails)
  // Attempt 2: Opus returns a valid output
  const bedrock = scriptedBedrockClient([
    { text: JSON.stringify({ ...validBlueprintOutput(), services: [] }) },
    opusResponseFromOutput(),
    haikuOkVerdict(),
  ]);
  const res = await generateBlueprint(validBlueprintInput(), {
    bedrockClient: bedrock,
    logger: silentLogger(),
  });
  assert.equal(res.ok, true, JSON.stringify(res));
  assert.equal(res.meta.attempts, 2);
  assert.equal(bedrock.calls.length, 3, "2 Opus + 1 Haiku");
});

test("generateBlueprint reports validation_failed when both attempts fail schema", async () => {
  const bedrock = scriptedBedrockClient([
    { text: JSON.stringify({ ...validBlueprintOutput(), services: [] }) },
    { text: JSON.stringify({ ...validBlueprintOutput(), next_steps: [] }) },
  ]);
  const res = await generateBlueprint(validBlueprintInput(), {
    bedrockClient: bedrock,
    logger: silentLogger(),
  });
  assert.equal(res.ok, false);
  assert.equal(res.error, "validation_failed");
  assert.ok(Array.isArray(res.details));
  assert.ok(res.details.length >= 1);
  assert.equal(bedrock.calls.length, 2, "no Haiku call if schema failed");
  assert.ok(res.meta.opus_tokens);
  assert.equal(res.meta.attempt, 2);
});

test("generateBlueprint retries on malformed JSON before giving up", async () => {
  const bedrock = scriptedBedrockClient([
    { text: "Here's the blueprint: not json at all" },
    opusResponseFromOutput(),
    haikuOkVerdict(),
  ]);
  const res = await generateBlueprint(validBlueprintInput(), {
    bedrockClient: bedrock,
    logger: silentLogger(),
  });
  assert.equal(res.ok, true);
  assert.equal(res.meta.attempts, 2);
});

test("generateBlueprint surfaces opus_timeout when Opus aborts", async () => {
  // The bedrock wrapper converts AbortError → BedrockTimeoutError.
  // Simulate what the AWS SDK throws when abortSignal fires.
  const abortError = new Error("The operation was aborted");
  abortError.name = "AbortError";
  const bedrock = scriptedBedrockClient([abortError]);
  const res = await generateBlueprint(validBlueprintInput(), {
    bedrockClient: bedrock,
    logger: silentLogger(),
  });
  assert.equal(res.ok, false);
  assert.equal(res.error, "opus_timeout");
  assert.equal(bedrock.calls.length, 1, "should not retry timeouts");
});

test("generateBlueprint surfaces opus_error on non-timeout errors", async () => {
  const bedrock = scriptedBedrockClient([new Error("network blew up")]);
  const res = await generateBlueprint(validBlueprintInput(), {
    bedrockClient: bedrock,
    logger: silentLogger(),
  });
  assert.equal(res.ok, false);
  assert.equal(res.error, "opus_error");
});

test("generateBlueprint survives Sanity failure (no examples)", async () => {
  const brokenSanity = {
    async fetch() {
      throw new Error("Sanity is down");
    },
  };
  const bedrock = scriptedBedrockClient([opusResponseFromOutput(), haikuOkVerdict()]);
  const res = await generateBlueprint(validBlueprintInput(), {
    bedrockClient: bedrock,
    sanityClient: brokenSanity,
    logger: silentLogger(),
  });
  assert.equal(res.ok, true, "engine must degrade gracefully without examples");
  assert.equal(res.meta.examples_used, 0);
});

test("generateBlueprint passes golden examples through when fetcher returns them", async () => {
  const example = {
    _id: "ex-budget-rag",
    title: "Budget RAG",
    slug: "budget-rag",
    category: "rag",
    spec: validBlueprintInput(),
    output: validBlueprintOutput(),
    isActive: true,
    sortOrder: 10,
  };
  const bedrock = scriptedBedrockClient([opusResponseFromOutput(), haikuOkVerdict()]);
  const res = await generateBlueprint(validBlueprintInput(), {
    bedrockClient: bedrock,
    sanityClient: fakeSanityClient([example]),
    logger: silentLogger(),
  });
  assert.equal(res.ok, true);
  assert.equal(res.meta.examples_used, 1);
  // Verify the system prompt received the example title
  const firstCall = bedrock.calls[0];
  const systemText = firstCall.command.input.system.map((s) => s.text).join("");
  assert.match(systemText, /Budget RAG/);
});

test("generateBlueprint still returns ok=true when Haiku flags issues (soft signal)", async () => {
  const bedrock = scriptedBedrockClient([opusResponseFromOutput(), haikuWarnVerdict()]);
  const res = await generateBlueprint(validBlueprintInput(), {
    bedrockClient: bedrock,
    logger: silentLogger(),
  });
  assert.equal(res.ok, true);
  assert.equal(res.meta.haiku_verdict.ok, false);
  assert.ok(res.meta.haiku_verdict.issues.length >= 1);
});

test("generateBlueprint tolerates Haiku validator throwing", async () => {
  const bedrock = scriptedBedrockClient([opusResponseFromOutput(), new Error("Haiku exploded")]);
  const res = await generateBlueprint(validBlueprintInput(), {
    bedrockClient: bedrock,
    logger: silentLogger(),
  });
  assert.equal(res.ok, true, "Haiku failures should not fail the request");
  assert.equal(res.meta.haiku_verdict.ok, true);
  assert.equal(res.meta.haiku_verdict.confidence, "low");
});

test("generateBlueprint meta aggregates Opus tokens across retries", async () => {
  const bedrock = scriptedBedrockClient([
    {
      text: JSON.stringify({ ...validBlueprintOutput(), services: [] }),
      usage: { inputTokens: 500, outputTokens: 100 },
    },
    {
      text: JSON.stringify(validBlueprintOutput()),
      usage: { inputTokens: 600, outputTokens: 400 },
    },
    haikuOkVerdict(),
  ]);
  const res = await generateBlueprint(validBlueprintInput(), {
    bedrockClient: bedrock,
    logger: silentLogger(),
  });
  assert.equal(res.ok, true);
  assert.equal(res.meta.opus_tokens.input_tokens, 1100);
  assert.equal(res.meta.opus_tokens.output_tokens, 500);
});

test("generateBlueprint streams token deltas + status events when onProgress is provided", async () => {
  const outputJson = JSON.stringify(validBlueprintOutput());
  const bedrock = scriptedBedrockClient([{ streamText: outputJson, chunkSize: 128 }, haikuOkVerdict()]);
  const events = [];
  const res = await generateBlueprint(validBlueprintInput(), {
    bedrockClient: bedrock,
    logger: silentLogger(),
    onProgress: (ev) => events.push(ev),
  });
  assert.equal(res.ok, true, JSON.stringify(res));

  const phases = events.filter((e) => e.type === "status").map((e) => e.phase);
  assert.deepEqual(phases, ["validating_input", "fetching_examples", "generating", "validating_output", "done"]);

  const tokenEvents = events.filter((e) => e.type === "token");
  assert.ok(tokenEvents.length > 1, "expected multiple token deltas");
  const streamed = tokenEvents.map((e) => e.text).join("");
  assert.equal(streamed, outputJson, "token deltas must recompose into the full payload");

  // The Opus call went through InvokeModelWithResponseStreamCommand, not
  // the blocking variant.
  const firstCall = bedrock.calls[0];
  const cmdName = firstCall.command?.constructor?.name ?? "";
  assert.match(cmdName, /Stream/i, `expected streaming command, got ${cmdName}`);
});

test("generateBlueprint never throws from a broken onProgress callback", async () => {
  const bedrock = scriptedBedrockClient([{ streamText: JSON.stringify(validBlueprintOutput()) }, haikuOkVerdict()]);
  const res = await generateBlueprint(validBlueprintInput(), {
    bedrockClient: bedrock,
    logger: silentLogger(),
    onProgress: () => {
      throw new Error("downstream stream torn down");
    },
  });
  assert.equal(res.ok, true, "engine must shrug off callback errors");
});

test("generateBlueprint stamps tier in meta", async () => {
  const bedrock = scriptedBedrockClient([opusResponseFromOutput(), haikuOkVerdict()]);
  const res = await generateBlueprint(validBlueprintInput(), {
    tier: "pro",
    bedrockClient: bedrock,
    logger: silentLogger(),
  });
  assert.equal(res.ok, true);
  assert.equal(res.meta.tier, "pro");
});

test("generateBlueprint blocks malicious input via the guardrail pre-check (no generation)", async () => {
  // The ApplyGuardrail input pre-check intervenes; the engine returns the
  // terminal guardrail_intervened code WITHOUT invoking Opus/Haiku.
  const bedrock = scriptedBedrockClient([], { guardrailAction: "GUARDRAIL_INTERVENED" });
  const res = await generateBlueprint(validBlueprintInput(), {
    bedrockClient: bedrock,
    logger: silentLogger(),
  });
  assert.equal(res.ok, false);
  assert.equal(res.error, "guardrail_intervened");
  assert.equal(bedrock.calls.length, 0, "must not call Opus/Haiku when the input is blocked");
  assert.equal(bedrock.guardrailCalls.length, 1, "the input pre-check ran");
});

test("generateBlueprint fails closed (guardrail_unavailable) when the input guardrail check fails", async () => {
  // The ApplyGuardrail pre-check errors on every attempt — the engine must
  // decline rather than send unscreened input to Opus.
  const bedrock = scriptedBedrockClient([], { guardrailError: new Error("guardrail down") });
  const res = await generateBlueprint(validBlueprintInput(), {
    bedrockClient: bedrock,
    logger: silentLogger(),
  });
  assert.equal(res.ok, false);
  assert.equal(res.error, "guardrail_unavailable");
  assert.equal(bedrock.calls.length, 0, "must not call Opus/Haiku when the guardrail check fails");
  assert.equal(bedrock.guardrailCalls.length, 2, "the pre-check retried once before declining");
});

test("generateBlueprint proceeds to generation when the input guardrail passes", async () => {
  // Default guardrailAction is NONE, so the pre-check passes and generation runs.
  const bedrock = scriptedBedrockClient([opusResponseFromOutput(), haikuOkVerdict()]);
  const res = await generateBlueprint(validBlueprintInput(), {
    bedrockClient: bedrock,
    logger: silentLogger(),
  });
  assert.equal(res.ok, true);
  assert.equal(bedrock.guardrailCalls.length, 1, "the input pre-check ran");
  assert.equal(bedrock.calls.length, 2, "Opus + Haiku ran after the pre-check passed");
});
