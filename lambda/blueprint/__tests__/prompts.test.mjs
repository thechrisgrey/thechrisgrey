import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ARCHITECTURE_PRINCIPLES,
  OUTPUT_FORMAT_INSTRUCTIONS,
  buildSystemPrompt,
  buildUserPrompt,
  selectExamples,
  formatExampleForPrompt,
  formatSpecForPrompt,
} from "../prompts.mjs";
import { BLUEPRINT_CATEGORIES } from "../schema.mjs";
import { validBlueprintInput, validBlueprintOutput } from "./harness.mjs";

function makeExample(overrides = {}) {
  return {
    _id: overrides._id ?? "ex-1",
    title: overrides.title ?? "Sample example",
    slug: overrides.slug ?? "sample",
    category: overrides.category ?? "rag",
    spec: overrides.spec ?? validBlueprintInput(),
    output: overrides.output ?? validBlueprintOutput(),
    notes: overrides.notes,
    isActive: overrides.isActive ?? true,
    sortOrder: overrides.sortOrder ?? 10,
  };
}

test("ARCHITECTURE_PRINCIPLES mentions key voice markers", () => {
  assert.match(ARCHITECTURE_PRINCIPLES, /serverless/i);
  assert.match(ARCHITECTURE_PRINCIPLES, /IaC/i);
  assert.match(ARCHITECTURE_PRINCIPLES, /observab/i);
  assert.match(ARCHITECTURE_PRINCIPLES, /Christian/i);
});

test("OUTPUT_FORMAT_INSTRUCTIONS enumerates every required field", () => {
  for (const field of [
    "architecture_summary",
    "services",
    "diagram_mermaid",
    "iac_scaffold",
    "iam_highlights",
    "cost_estimate",
    "claude_artifacts",
    "next_steps",
    "caveats",
  ]) {
    assert.ok(OUTPUT_FORMAT_INSTRUCTIONS.includes(field), `expected OUTPUT_FORMAT_INSTRUCTIONS to mention ${field}`);
  }
});

test("OUTPUT_FORMAT_INSTRUCTIONS forbids emojis", () => {
  assert.match(OUTPUT_FORMAT_INSTRUCTIONS, /No emojis/i);
});

test("buildSystemPrompt embeds principles + format by default", () => {
  const out = buildSystemPrompt();
  assert.ok(out.includes(ARCHITECTURE_PRINCIPLES));
  assert.ok(out.includes(OUTPUT_FORMAT_INSTRUCTIONS));
});

test("buildSystemPrompt lists all valid categories", () => {
  const out = buildSystemPrompt();
  for (const cat of BLUEPRINT_CATEGORIES) {
    assert.ok(out.includes(cat), `expected category ${cat} in prompt`);
  }
});

test("buildSystemPrompt injects examples when provided", () => {
  const examples = [makeExample({ title: "Budget RAG", category: "rag" })];
  const out = buildSystemPrompt({ examples });
  assert.match(out, /Budget RAG/);
  assert.match(out, /tone anchors/);
});

test("buildSystemPrompt supports principle override for tests", () => {
  const out = buildSystemPrompt({ principles: "TEST PRINCIPLES BLOCK" });
  assert.ok(out.startsWith("TEST PRINCIPLES BLOCK"));
  assert.ok(!out.includes(ARCHITECTURE_PRINCIPLES));
});

test("selectExamples prefers category matches", () => {
  const examples = [
    makeExample({ _id: "a", category: "web-api", sortOrder: 10 }),
    makeExample({ _id: "b", category: "rag", sortOrder: 30 }),
    makeExample({ _id: "c", category: "rag", sortOrder: 20 }),
    makeExample({ _id: "d", category: "iot-ingest", sortOrder: 10 }),
  ];
  const picked = selectExamples(examples, { category: "rag" }, 3);
  assert.equal(picked.length, 3);
  assert.equal(picked[0]._id, "c"); // sortOrder 20 wins
  assert.equal(picked[1]._id, "b"); // sortOrder 30
  // Third fills from other categories; lowest sortOrder wins
  assert.ok(["a", "d"].includes(picked[2]._id));
});

test("selectExamples honors the limit", () => {
  const examples = Array.from({ length: 10 }, (_, i) => makeExample({ _id: `e${i}`, category: "rag", sortOrder: i }));
  assert.equal(selectExamples(examples, { category: "rag" }, 2).length, 2);
});

test("selectExamples returns empty for no examples", () => {
  assert.deepEqual(selectExamples([], { category: "rag" }), []);
  assert.deepEqual(selectExamples(null, { category: "rag" }), []);
});

test("formatExampleForPrompt includes cost line", () => {
  const ex = makeExample({
    output: validBlueprintOutput({
      cost_estimate: { monthly_low_usd: 10, monthly_high_usd: 25, assumptions: ["1k req/day"] },
    }),
  });
  assert.match(formatExampleForPrompt(ex), /\$10–\$25\/mo/);
});

test("formatSpecForPrompt includes optional fields when present", () => {
  const out = formatSpecForPrompt({
    goal: "Valid goal meeting the length minimum for the schema.",
    category: "rag",
    scale: { traffic: "1k req/day", data_volume: "500MB" },
    constraints: { monthly_budget_usd: 30, compliance: ["soc2"] },
    preferred_languages: ["typescript"],
    integrations: ["Stripe"],
  });
  assert.match(out, /Traffic: 1k req\/day/);
  assert.match(out, /Data volume: 500MB/);
  assert.match(out, /Monthly budget: \$30/);
  assert.match(out, /Compliance: soc2/);
  assert.match(out, /Preferred languages: typescript/);
  assert.match(out, /Integrations: Stripe/);
});

test("formatSpecForPrompt omits optional fields cleanly", () => {
  const out = formatSpecForPrompt({
    goal: "Valid goal meeting the length minimum for the schema.",
    category: "web-api",
  });
  assert.ok(!out.includes("Traffic:"));
  assert.ok(!out.includes("Compliance:"));
});

test("buildUserPrompt references the system-prompt format requirement", () => {
  const out = buildUserPrompt(validBlueprintInput());
  assert.match(out, /JSON object/);
  assert.match(out, /Category: rag/);
});
