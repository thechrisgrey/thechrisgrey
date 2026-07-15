/**
 * Blueprint output validation — two passes.
 *
 *  1. Schema pass (synchronous): parse with Zod's BlueprintOutputSchema.
 *     Any failure is a hard error — Opus missed a required field or violated
 *     a bound. The engine retries once on schema failure before giving up.
 *
 *  2. Haiku pass (LLM-based, optional): Haiku 4.5 grades the parsed output
 *     for softer quality signals the schema can't catch — vague rationales,
 *     placeholder IaC, Mermaid syntax issues, artifact bodies that are just
 *     descriptions rather than ready-to-use content. Returns a structured
 *     verdict the engine uses to decide whether to retry.
 *
 * Haiku's verdict is a soft signal: if it flags issues but the schema passed,
 * the engine returns the output with a `validation` meta field so the
 * frontend can show a "generated but review recommended" badge.
 */

import { BlueprintOutputSchema } from "./schema.mjs";
import { invokeHaiku } from "./bedrock.mjs";

const HAIKU_SYSTEM_PROMPT = `You are a senior AWS architect reviewing a generated architecture blueprint for quality.

Grade the blueprint against these criteria:
1. architecture_summary — is it principal-engineer prose or marketing fluff?
2. services — do rationales explain "why this over alternatives", or are they generic?
3. diagram_mermaid — does the Mermaid source parse (flowchart TD or graph LR only)?
   Flag any sequenceDiagram, gantt, classDiagram, or malformed node syntax.
4. iac_scaffold.snippet — is this runnable IaC, or does it contain "..." elisions,
   TODO comments, or pseudo-code in critical paths?
5. claude_artifacts — is each body ready-to-use? A skill should be valid SKILL.md.
   A slash command should be complete. An MCP tool should include a concrete
   inputSchema. Flag bodies that just describe what an artifact "would" do.
6. cost_estimate — are the assumptions concrete (req/day, GB, instance sizes)
   or are they hand-wavy ("moderate usage")?
7. iam_highlights — do they name specific actions/resources, or are they generic
   ("use least privilege")?

Return ONE JSON object, no prose, no code fences:
{
  "ok": boolean,              // true if the blueprint is fit to return as-is
  "confidence": "high"|"medium"|"low",
  "issues": [ { "field": string, "severity": "error"|"warn", "note": string } ]
}

"ok" must be false if ANY issue has severity "error". Warnings alone can still
be ok=true — the user sees them as recommendations.`;

/**
 * Try to parse a string that ought to be a JSON object. Tolerates a single
 * leading code fence (```json) since Opus occasionally adds one despite the
 * prompt instruction.
 *
 * @param {string} text
 * @returns {{ ok: true, data: any } | { ok: false, error: string }}
 */
export function tryParseJson(text) {
  if (typeof text !== "string" || text.trim().length === 0) {
    return { ok: false, error: "empty_response" };
  }

  const stripped = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    const data = JSON.parse(stripped);
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      return { ok: false, error: "not_an_object" };
    }
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: `json_parse_error: ${error instanceof Error ? error.message : String(error)}` };
  }
}

/**
 * Run the synchronous Zod schema pass.
 *
 * @param {object} data
 * @returns {{ ok: true, output: object } | { ok: false, issues: Array<object> }}
 */
export function validateSchema(data) {
  const result = BlueprintOutputSchema.safeParse(data);
  if (result.success) {
    return { ok: true, output: result.data };
  }
  const issues = result.error.issues.map((issue) => ({
    field: issue.path.join("."),
    severity: "error",
    note: issue.message,
  }));
  return { ok: false, issues };
}

/**
 * Run the Haiku quality pass. The output is a soft signal.
 *
 * @param {{ send: any }} bedrockClient
 * @param {object} output - Schema-valid BlueprintOutput.
 * @param {object} [opts]
 * @param {string|null} [opts.requestId]
 * @returns {Promise<{ ok: boolean, confidence: string, issues: Array<object>, usage: object }>}
 */
export async function validateWithHaiku(bedrockClient, output, opts = {}) {
  const userPrompt = `Review this blueprint:\n\n${JSON.stringify(output, null, 2)}`;
  const { text, usage } = await invokeHaiku(bedrockClient, {
    system: HAIKU_SYSTEM_PROMPT,
    user: userPrompt,
    requestId: opts.requestId,
  });

  const parsed = tryParseJson(text);
  if (!parsed.ok) {
    return {
      ok: true,
      confidence: "low",
      issues: [
        {
          field: "_meta",
          severity: "warn",
          note: `Haiku validator response was not parseable: ${parsed.error}`,
        },
      ],
      usage,
    };
  }

  const { data } = parsed;
  const issues = Array.isArray(data.issues) ? data.issues : [];
  const hasError = issues.some((/** @type {any} */ i) => i?.severity === "error");
  return {
    ok: typeof data.ok === "boolean" ? data.ok && !hasError : !hasError,
    confidence: ["high", "medium", "low"].includes(data.confidence) ? data.confidence : "medium",
    issues,
    usage,
  };
}

export default {
  tryParseJson,
  validateSchema,
  validateWithHaiku,
  HAIKU_SYSTEM_PROMPT,
};
