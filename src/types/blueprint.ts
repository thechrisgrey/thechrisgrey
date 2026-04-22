/**
 * Blueprint TypeScript types — the frontend twin of lambda/blueprint/schema.mjs.
 *
 * These are *structural* aliases, not derived from Zod. The Lambda owns runtime
 * validation; the frontend only needs to shape form state and render output.
 * If the Zod schema changes, bump the matching fields here.
 */

export const BLUEPRINT_CATEGORIES = [
  'ai-agent',
  'rag',
  'data-pipeline',
  'realtime-app',
  'batch-etl',
  'web-api',
  'iot-ingest',
  'ml-training',
] as const;

export const COMPLIANCE_REGIMES = [
  'hipaa',
  'pci',
  'soc2',
  'fedramp',
  'gdpr',
  'ccpa',
] as const;

export const PREFERRED_LANGUAGES = [
  'typescript',
  'javascript',
  'python',
  'go',
  'rust',
  'java',
] as const;

export const IAC_TOOLS = ['cdk', 'sam', 'terraform'] as const;
export const ARTIFACT_KINDS = [
  'skill',
  'slash_command',
  'subagent',
  'mcp_tool',
] as const;
export const COST_SIGNALS = ['free-tier', 'low', 'medium', 'high'] as const;

export type BlueprintCategory = (typeof BLUEPRINT_CATEGORIES)[number];
export type ComplianceRegime = (typeof COMPLIANCE_REGIMES)[number];
export type PreferredLanguage = (typeof PREFERRED_LANGUAGES)[number];
export type IacTool = (typeof IAC_TOOLS)[number];
export type ArtifactKind = (typeof ARTIFACT_KINDS)[number];
export type CostSignal = (typeof COST_SIGNALS)[number];

export const CATEGORY_LABELS: Record<BlueprintCategory, string> = {
  'ai-agent': 'AI Agent',
  rag: 'RAG (Retrieval-Augmented Generation)',
  'data-pipeline': 'Data Pipeline',
  'realtime-app': 'Real-time App',
  'batch-etl': 'Batch ETL',
  'web-api': 'Web API',
  'iot-ingest': 'IoT Ingest',
  'ml-training': 'ML Training',
};

export const ARTIFACT_LABELS: Record<ArtifactKind, string> = {
  skill: 'Claude Code Skill',
  slash_command: 'Slash Command',
  subagent: 'Subagent',
  mcp_tool: 'MCP Tool',
};

export const COST_SIGNAL_LABELS: Record<CostSignal, string> = {
  'free-tier': 'Free tier',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

// ─── Input ────────────────────────────────────────────────────────────────

export interface BlueprintInputScale {
  traffic?: string;
  data_volume?: string;
  latency_budget?: string;
}

export interface BlueprintInputConstraints {
  monthly_budget_usd?: number;
  compliance?: ComplianceRegime[];
  region_restriction?: string;
  team_size?: number;
}

export interface BlueprintInput {
  goal: string;
  category: BlueprintCategory;
  scale?: BlueprintInputScale;
  constraints?: BlueprintInputConstraints;
  preferred_languages?: PreferredLanguage[];
  integrations?: string[];
}

// ─── Output ───────────────────────────────────────────────────────────────

export interface ServiceEntry {
  service: string;
  purpose: string;
  rationale: string;
  cost_signal: CostSignal;
}

export interface ClaudeArtifact {
  kind: ArtifactKind;
  name: string;
  description: string;
  body: string;
}

export interface CostEstimate {
  monthly_low_usd: number;
  monthly_high_usd: number;
  assumptions: string[];
}

export interface IacScaffold {
  tool: IacTool;
  rationale: string;
  snippet: string;
}

export interface BlueprintOutput {
  architecture_summary: string;
  services: ServiceEntry[];
  diagram_mermaid: string;
  iac_scaffold: IacScaffold;
  iam_highlights: string[];
  cost_estimate: CostEstimate;
  claude_artifacts: ClaudeArtifact[];
  next_steps: string[];
  caveats: string[];
}

export interface BlueprintSuccessResponse {
  ok: true;
  output: BlueprintOutput;
  meta: {
    requestId?: string;
    tier?: 'free' | 'pro';
    latency_ms?: number;
    examples_used?: number;
    haiku_verdict?: {
      ok: boolean;
      confidence: 'high' | 'medium' | 'low';
      issues: Array<{ field: string; severity: 'error' | 'warn'; note: string }>;
    };
  };
}

export interface BlueprintErrorResponse {
  ok?: false;
  error: string;
  message?: string;
  details?: unknown;
}

export type BlueprintResponse = BlueprintSuccessResponse | BlueprintErrorResponse;
