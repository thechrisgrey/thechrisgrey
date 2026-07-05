import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BlueprintInputSchema,
  BlueprintOutputSchema,
  GoldenExampleSchema,
  BLUEPRINT_CATEGORIES,
  COMPLIANCE_REGIMES,
  PREFERRED_LANGUAGES,
  IAC_TOOLS,
  ARTIFACT_KINDS,
  COST_SIGNALS,
} from "../schema.mjs";
import { validBlueprintInput, validBlueprintOutput } from "./harness.mjs";

test("BlueprintInputSchema accepts a minimal valid input", () => {
  const result = BlueprintInputSchema.safeParse({
    goal: "Build a boring CRUD API for a side project I'm hacking on this weekend",
    category: "web-api",
  });
  assert.equal(result.success, true);
});

test("BlueprintInputSchema rejects too-short goals", () => {
  const result = BlueprintInputSchema.safeParse({ goal: "too short", category: "web-api" });
  assert.equal(result.success, false);
});

test("BlueprintInputSchema rejects unknown categories", () => {
  const result = BlueprintInputSchema.safeParse({
    goal: "A perfectly valid goal that meets the 20-char minimum",
    category: "quantum-compute",
  });
  assert.equal(result.success, false);
});

test("BlueprintInputSchema exposes all 8 expected categories", () => {
  const expected = [
    "ai-agent",
    "rag",
    "data-pipeline",
    "realtime-app",
    "batch-etl",
    "web-api",
    "iot-ingest",
    "ml-training",
  ];
  assert.deepEqual([...BLUEPRINT_CATEGORIES].sort(), [...expected].sort());
});

test("BlueprintInputSchema enforces monthly_budget_usd upper bound", () => {
  const result = BlueprintInputSchema.safeParse({
    goal: "A goal of sufficient length to pass schema validation",
    category: "web-api",
    constraints: { monthly_budget_usd: 9_999_999 },
  });
  assert.equal(result.success, false);
});

test("BlueprintInputSchema enforces max integration count", () => {
  const result = BlueprintInputSchema.safeParse({
    goal: "A goal of sufficient length to pass schema validation",
    category: "web-api",
    integrations: Array.from({ length: 25 }, (_, i) => `svc-${i}`),
  });
  assert.equal(result.success, false);
});

test("BlueprintOutputSchema accepts the valid-fixture payload", () => {
  const result = BlueprintOutputSchema.safeParse(validBlueprintOutput());
  assert.equal(result.success, true);
});

test("BlueprintOutputSchema rejects empty services array", () => {
  const result = BlueprintOutputSchema.safeParse(validBlueprintOutput({ services: [] }));
  assert.equal(result.success, false);
});

test("BlueprintOutputSchema rejects single-service (min is 2)", () => {
  const result = BlueprintOutputSchema.safeParse(
    validBlueprintOutput({
      services: [validBlueprintOutput().services[0]],
    }),
  );
  assert.equal(result.success, false);
});

test("BlueprintOutputSchema rejects cost estimate above 100k", () => {
  const result = BlueprintOutputSchema.safeParse(
    validBlueprintOutput({
      cost_estimate: {
        monthly_low_usd: 0,
        monthly_high_usd: 200_000,
        assumptions: ["This is way more expensive than we allow."],
      },
    }),
  );
  assert.equal(result.success, false);
});

test("BlueprintOutputSchema rejects an empty next_steps array", () => {
  const result = BlueprintOutputSchema.safeParse(validBlueprintOutput({ next_steps: [] }));
  assert.equal(result.success, false);
});

test("BlueprintOutputSchema rejects an unknown artifact kind", () => {
  const result = BlueprintOutputSchema.safeParse(
    validBlueprintOutput({
      claude_artifacts: [
        {
          kind: "plugin",
          name: "nope",
          description: "Unknown kind that should not validate",
          body: "x".repeat(150),
        },
      ],
    }),
  );
  assert.equal(result.success, false);
});

test("BlueprintOutputSchema rejects an unknown IaC tool", () => {
  const result = BlueprintOutputSchema.safeParse(
    validBlueprintOutput({
      iac_scaffold: {
        tool: "pulumi",
        rationale: "Pulumi is lovely but not in our allowlist yet",
        snippet: "const foo = 'bar';\nconst baz = 'qux';\nconsole.log(foo, baz);",
      },
    }),
  );
  assert.equal(result.success, false);
});

test("GoldenExampleSchema round-trips a complete example", () => {
  const example = {
    _id: "example-123",
    title: "Serverless RAG on a $50 budget",
    slug: "serverless-rag-50",
    category: "rag",
    spec: validBlueprintInput(),
    output: validBlueprintOutput(),
    notes: "Used in the early demos — budget-friendly.",
    isActive: true,
    sortOrder: 10,
  };
  const result = GoldenExampleSchema.safeParse(example);
  if (!result.success) {
    console.error(result.error.issues);
  }
  assert.equal(result.success, true);
});

test("constants export the documented enum values", () => {
  assert.ok(COMPLIANCE_REGIMES.includes("soc2"));
  assert.ok(PREFERRED_LANGUAGES.includes("typescript"));
  assert.ok(IAC_TOOLS.includes("cdk"));
  assert.ok(ARTIFACT_KINDS.includes("skill"));
  assert.ok(COST_SIGNALS.includes("low"));
});
