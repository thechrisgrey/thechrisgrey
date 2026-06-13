import { test } from "node:test";
import assert from "node:assert/strict";
import {
  invokeOpus,
  streamOpus,
  guardrailParams,
  GUARDRAIL_ID,
  GUARDRAIL_VERSION,
  BedrockGuardrailError,
} from "../bedrock.mjs";
import { scriptedBedrockClient, silentLogger } from "./harness.mjs";

test("guardrailParams returns the identifier + version when both are set", () => {
  assert.deepEqual(guardrailParams(), {
    guardrailIdentifier: GUARDRAIL_ID,
    guardrailVersion: GUARDRAIL_VERSION,
  });
  assert.deepEqual(guardrailParams("gid", "7"), {
    guardrailIdentifier: "gid",
    guardrailVersion: "7",
  });
});

test("guardrailParams returns {} when either value is empty", () => {
  assert.deepEqual(guardrailParams("", "5"), {});
  assert.deepEqual(guardrailParams("gid", ""), {});
  assert.deepEqual(guardrailParams("", ""), {});
});

test("streamOpus attaches the guardrail to the streaming command", async () => {
  const bedrock = scriptedBedrockClient([{ streamText: "ok output" }]);
  await streamOpus(bedrock, { system: "s", user: "u", requestId: "r" });
  const input = bedrock.calls[0].command.input;
  assert.equal(input.guardrailIdentifier, GUARDRAIL_ID);
  assert.equal(input.guardrailVersion, GUARDRAIL_VERSION);
});

test("streamOpus throws BedrockGuardrailError on a guardrail stop_reason", async () => {
  const bedrock = scriptedBedrockClient([
    { streamText: "partial", stopReason: "guardrail_intervened" },
  ]);
  await assert.rejects(
    () => streamOpus(bedrock, { system: "s", user: "u" }),
    (err) => err instanceof BedrockGuardrailError,
  );
});

test("invokeOpus attaches the guardrail to the blocking command", async () => {
  const bedrock = scriptedBedrockClient([{ text: "{}" }]);
  await invokeOpus(bedrock, { system: "s", user: "u" });
  const input = bedrock.calls[0].command.input;
  assert.equal(input.guardrailIdentifier, GUARDRAIL_ID);
  assert.equal(input.guardrailVersion, GUARDRAIL_VERSION);
});

test("invokeOpus throws BedrockGuardrailError on a blocking guardrail stop_reason", async () => {
  const bedrock = scriptedBedrockClient([
    { text: "blocked", stopReason: "guardrail_intervened" },
  ]);
  await assert.rejects(
    () => invokeOpus(bedrock, { system: "s", user: "u" }),
    (err) => err instanceof BedrockGuardrailError,
  );
});

test("invokeOpus maps a guardrail ValidationException to BedrockGuardrailError", async () => {
  const validationError = Object.assign(
    new Error("Input length exceeds guardrail policy or content was blocked by the guardrail"),
    { name: "ValidationException" },
  );
  const bedrock = scriptedBedrockClient([validationError]);
  await assert.rejects(
    () => invokeOpus(bedrock, { system: "s", user: "u", logger: silentLogger() }),
    (err) => err instanceof BedrockGuardrailError,
  );
});
