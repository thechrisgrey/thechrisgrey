/**
 * Zod schemas for the thechrisgrey Blueprint generator.
 *
 * Single source of truth for:
 *  - Input validation (Lambda HTTP handler + future MCP tool wrapper)
 *  - Output validation (Haiku 4.5 validator pass + frontend render type)
 *  - Golden-example documents stored in Sanity
 *
 * The generation engine (engine.mjs) is transport-agnostic: it accepts an object
 * that satisfies BlueprintInputSchema and returns an object that satisfies
 * BlueprintOutputSchema. An HTTP Function URL consumes it today; a
 * `generate_blueprint` MCP tool in lambda/mcp-server wraps the same engine
 * tomorrow. Keep `.describe()` calls — they propagate into JSON Schema via
 * `z.toJsonSchema()` so MCP clients receive meaningful field docs.
 */

import { z } from "zod";

export const BLUEPRINT_CATEGORIES = [
  "ai-agent",
  "rag",
  "data-pipeline",
  "realtime-app",
  "batch-etl",
  "web-api",
  "iot-ingest",
  "ml-training",
];

export const COMPLIANCE_REGIMES = [
  "hipaa",
  "pci",
  "soc2",
  "fedramp",
  "gdpr",
  "ccpa",
];

export const PREFERRED_LANGUAGES = [
  "typescript",
  "javascript",
  "python",
  "go",
  "rust",
  "java",
];

export const IAC_TOOLS = ["cdk", "sam", "terraform"];

export const ARTIFACT_KINDS = ["skill", "slash_command", "subagent", "mcp_tool"];

export const COST_SIGNALS = ["free-tier", "low", "medium", "high"];

// ─── Input ────────────────────────────────────────────────────────────────

export const BlueprintInputSchema = z
  .object({
    goal: z
      .string()
      .min(20)
      .max(500)
      .describe("What the user wants to build, in their own words (20–500 chars)"),
    category: z
      .enum(BLUEPRINT_CATEGORIES)
      .describe(
        "Workload category. Drives golden-example selection and default service choices.",
      ),
    scale: z
      .object({
        traffic: z
          .string()
          .max(200)
          .optional()
          .describe("Expected request volume, e.g. '1k req/day'"),
        data_volume: z
          .string()
          .max(200)
          .optional()
          .describe("Data footprint, e.g. '500MB of PDFs' or '10GB of vectors'"),
        latency_budget: z
          .string()
          .max(200)
          .optional()
          .describe("User-facing latency target, e.g. 'first token <2s'"),
      })
      .optional()
      .describe("Scale hints — optional but materially improve service sizing"),
    constraints: z
      .object({
        monthly_budget_usd: z
          .number()
          .int()
          .positive()
          .max(100000)
          .optional()
          .describe("Monthly spend ceiling in USD"),
        compliance: z
          .array(z.enum(COMPLIANCE_REGIMES))
          .optional()
          .describe("Regulatory regimes the workload must satisfy"),
        region_restriction: z
          .string()
          .max(50)
          .optional()
          .describe("AWS region lock, e.g. 'us-east-1 only' or 'US regions only'"),
        team_size: z
          .number()
          .int()
          .positive()
          .max(1000)
          .optional()
          .describe("Team size operating the workload — drives operational complexity tolerance"),
      })
      .optional(),
    preferred_languages: z
      .array(z.enum(PREFERRED_LANGUAGES))
      .optional()
      .describe("Languages the team is comfortable with — affects artifact examples"),
    integrations: z
      .array(z.string().max(50))
      .max(20)
      .optional()
      .describe("Third-party systems to integrate, e.g. 'Stripe', 'Salesforce', 'OpenAI'"),
  })
  .describe(
    "Project specification supplied by the user. Validated before the engine runs.",
  );

// ─── Output ───────────────────────────────────────────────────────────────

export const ServiceEntrySchema = z.object({
  service: z
    .string()
    .min(2)
    .max(80)
    .describe("AWS (or third-party) service name, e.g. 'Amazon Bedrock', 'Lambda', 'DynamoDB'"),
  purpose: z
    .string()
    .min(10)
    .max(300)
    .describe("What this service does in the architecture"),
  rationale: z
    .string()
    .min(10)
    .max(400)
    .describe("Why this service over alternatives — be specific"),
  cost_signal: z
    .enum(COST_SIGNALS)
    .describe("Rough cost tier: free-tier, low, medium, or high"),
});

export const ClaudeArtifactSchema = z.object({
  kind: z
    .enum(ARTIFACT_KINDS)
    .describe("Artifact type: Claude Code skill, slash command, subagent, or MCP tool"),
  name: z
    .string()
    .min(3)
    .max(80)
    .describe("Short kebab-case name, e.g. 'deploy-to-lambda'"),
  description: z
    .string()
    .min(20)
    .max(300)
    .describe("One-sentence summary of what this artifact does"),
  body: z
    .string()
    .min(100)
    .max(8000)
    .describe(
      "Ready-to-use content — skill markdown, slash command body, subagent prompt, or MCP tool definition",
    ),
});

export const CostEstimateSchema = z.object({
  monthly_low_usd: z
    .number()
    .nonnegative()
    .max(100000)
    .describe("Steady-state monthly cost floor (USD)"),
  monthly_high_usd: z
    .number()
    .nonnegative()
    .max(100000)
    .describe("Burst / busy-month cost ceiling (USD)"),
  assumptions: z
    .array(z.string().min(10).max(400))
    .min(1)
    .max(8)
    .describe(
      "Assumptions driving the estimate — e.g. '5k invocations/day, 256MB Lambda, us-east-1'",
    ),
});

export const IacScaffoldSchema = z.object({
  tool: z.enum(IAC_TOOLS).describe("Infrastructure-as-code tool used for the snippet"),
  rationale: z
    .string()
    .min(20)
    .max(400)
    .describe("Why this IaC tool for this workload"),
  snippet: z
    .string()
    .min(50)
    .max(4000)
    .describe(
      "Real, runnable IaC that compiles with `cdk synth` / `sam build` / `terraform plan` on a fresh project",
    ),
});

export const BlueprintOutputSchema = z
  .object({
    architecture_summary: z
      .string()
      .min(100)
      .max(2000)
      .describe(
        "End-to-end architecture description. Principal-engineer whiteboard style — not a sales pitch, not a tutorial.",
      ),
    services: z
      .array(ServiceEntrySchema)
      .min(2)
      .max(15)
      .describe("Services in the architecture, ordered roughly by data-flow position"),
    diagram_mermaid: z
      .string()
      .min(50)
      .max(4000)
      .describe("Mermaid source (flowchart TD or graph LR) for the architecture diagram"),
    iac_scaffold: IacScaffoldSchema,
    iam_highlights: z
      .array(z.string().min(10).max(300))
      .min(1)
      .max(10)
      .describe(
        "Critical IAM policy notes — least-privilege scopes, risky permissions to avoid, etc.",
      ),
    cost_estimate: CostEstimateSchema,
    claude_artifacts: z
      .array(ClaudeArtifactSchema)
      .min(1)
      .max(4)
      .describe("Claude Code artifacts that help the user build the workload"),
    next_steps: z
      .array(z.string().min(10).max(300))
      .min(3)
      .max(10)
      .describe("Ordered concrete next actions — the user's to-do list"),
    caveats: z
      .array(z.string().min(10).max(300))
      .max(6)
      .describe(
        "Known limitations or assumptions — e.g. 'assumes us-east-1; add DR for prod'",
      ),
  })
  .describe(
    "Blueprint returned to the user. Validated by Haiku 4.5 before streaming to the client.",
  );

// ─── Golden Example (stored in Sanity as `architectureBlueprint`) ──────────

export const GoldenExampleSchema = z.object({
  _id: z.string(),
  title: z.string().min(3).max(120),
  slug: z.string().min(3).max(120),
  category: z.enum(BLUEPRINT_CATEGORIES),
  spec: BlueprintInputSchema,
  output: BlueprintOutputSchema,
  notes: z
    .string()
    .max(2000)
    .optional()
    .describe("Christian's authorial commentary — why this example works, variations, etc."),
  isActive: z.boolean().describe("Inactive examples are excluded from prompt injection"),
  sortOrder: z
    .number()
    .int()
    .nonnegative()
    .describe("Lower values appear earlier in the prompt"),
});

export default {
  BlueprintInputSchema,
  BlueprintOutputSchema,
  GoldenExampleSchema,
  ServiceEntrySchema,
  ClaudeArtifactSchema,
  IacScaffoldSchema,
  CostEstimateSchema,
  BLUEPRINT_CATEGORIES,
  COMPLIANCE_REGIMES,
  PREFERRED_LANGUAGES,
  IAC_TOOLS,
  ARTIFACT_KINDS,
  COST_SIGNALS,
};
