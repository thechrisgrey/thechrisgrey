import { test } from "node:test";
import assert from "node:assert/strict";
import { tryParseJson, validateSchema, validateWithHaiku } from "../validation.mjs";
import { scriptedBedrockClient, validBlueprintOutput } from "./harness.mjs";

test("tryParseJson returns empty_response for blank input", () => {
  assert.deepEqual(tryParseJson(""), { ok: false, error: "empty_response" });
  assert.deepEqual(tryParseJson("   "), { ok: false, error: "empty_response" });
  assert.deepEqual(tryParseJson(null), { ok: false, error: "empty_response" });
});

test("tryParseJson accepts a plain JSON object", () => {
  const res = tryParseJson('{"foo":1,"bar":[2,3]}');
  assert.equal(res.ok, true);
  assert.deepEqual(res.data, { foo: 1, bar: [2, 3] });
});

test("tryParseJson strips ```json fences", () => {
  const text = '```json\n{"a":1}\n```';
  const res = tryParseJson(text);
  assert.equal(res.ok, true);
  assert.deepEqual(res.data, { a: 1 });
});

test("tryParseJson strips bare ``` fences", () => {
  const text = '```\n{"a":1}\n```';
  const res = tryParseJson(text);
  assert.equal(res.ok, true);
  assert.deepEqual(res.data, { a: 1 });
});

test("tryParseJson rejects non-objects (arrays, scalars)", () => {
  assert.equal(tryParseJson("[1,2,3]").ok, false);
  assert.equal(tryParseJson("42").ok, false);
  assert.equal(tryParseJson('"string"').ok, false);
  assert.equal(tryParseJson("null").ok, false);
});

test("tryParseJson surfaces json_parse_error on malformed JSON", () => {
  const res = tryParseJson("{not json}");
  assert.equal(res.ok, false);
  assert.match(res.error, /json_parse_error/);
});

test("validateSchema accepts a valid output fixture", () => {
  const res = validateSchema(validBlueprintOutput());
  assert.equal(res.ok, true);
  assert.ok(res.output);
});

test("validateSchema returns structured issues on failure", () => {
  const bad = validBlueprintOutput({ services: [] });
  const res = validateSchema(bad);
  assert.equal(res.ok, false);
  assert.ok(Array.isArray(res.issues));
  assert.ok(res.issues.length >= 1);
  for (const issue of res.issues) {
    assert.equal(issue.severity, "error");
    assert.ok(typeof issue.field === "string");
    assert.ok(typeof issue.note === "string");
  }
});

test("validateSchema reports field path for nested errors", () => {
  const bad = validBlueprintOutput({
    cost_estimate: {
      monthly_low_usd: -1, // invalid
      monthly_high_usd: 100,
      assumptions: ["ok"],
    },
  });
  const res = validateSchema(bad);
  assert.equal(res.ok, false);
  const hasNestedField = res.issues.some((i) => i.field.includes("cost_estimate"));
  assert.ok(hasNestedField, `expected cost_estimate issue, got ${JSON.stringify(res.issues)}`);
});

test("validateWithHaiku parses a well-formed verdict", async () => {
  const bedrock = scriptedBedrockClient([
    {
      text: JSON.stringify({
        ok: true,
        confidence: "high",
        issues: [],
      }),
    },
  ]);
  const res = await validateWithHaiku(bedrock, validBlueprintOutput());
  assert.equal(res.ok, true);
  assert.equal(res.confidence, "high");
  assert.deepEqual(res.issues, []);
  assert.ok(res.usage);
});

test("validateWithHaiku respects severity=error in issues (forces ok=false)", async () => {
  const bedrock = scriptedBedrockClient([
    {
      text: JSON.stringify({
        ok: true,
        confidence: "medium",
        issues: [{ field: "iac_scaffold.snippet", severity: "error", note: "contains TODO" }],
      }),
    },
  ]);
  const res = await validateWithHaiku(bedrock, validBlueprintOutput());
  assert.equal(res.ok, false, "any error-severity issue must force ok=false");
  assert.equal(res.confidence, "medium");
  assert.equal(res.issues.length, 1);
});

test("validateWithHaiku treats warnings alone as ok=true", async () => {
  const bedrock = scriptedBedrockClient([
    {
      text: JSON.stringify({
        ok: true,
        confidence: "high",
        issues: [{ field: "services", severity: "warn", note: "rationales could be tighter" }],
      }),
    },
  ]);
  const res = await validateWithHaiku(bedrock, validBlueprintOutput());
  assert.equal(res.ok, true);
  assert.equal(res.issues.length, 1);
});

test("validateWithHaiku handles non-JSON response gracefully", async () => {
  const bedrock = scriptedBedrockClient([{ text: "I think this looks pretty good!" }]);
  const res = await validateWithHaiku(bedrock, validBlueprintOutput());
  assert.equal(res.ok, true, "malformed Haiku responses default to ok=true (soft signal)");
  assert.equal(res.confidence, "low");
  assert.equal(res.issues.length, 1);
  assert.equal(res.issues[0].severity, "warn");
  assert.match(res.issues[0].note, /not parseable/);
});

test("validateWithHaiku normalizes unknown confidence values", async () => {
  const bedrock = scriptedBedrockClient([
    {
      text: JSON.stringify({
        ok: true,
        confidence: "uncertain", // not in the enum
        issues: [],
      }),
    },
  ]);
  const res = await validateWithHaiku(bedrock, validBlueprintOutput());
  assert.equal(res.confidence, "medium");
});

test("validateWithHaiku tolerates missing ok field (derives from issues)", async () => {
  const bedrock = scriptedBedrockClient([
    {
      text: JSON.stringify({
        confidence: "high",
        issues: [],
      }),
    },
  ]);
  const res = await validateWithHaiku(bedrock, validBlueprintOutput());
  assert.equal(res.ok, true);
});
