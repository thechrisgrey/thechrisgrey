import { tool } from "@strands-agents/sdk";
import { z } from "zod";
import { putFact, MAX_FACT_LENGTH } from "../memory.mjs";
import { emitEvent, EVENT_KINDS } from "../events.mjs";
import { createLogger } from "lambda-shared/logger";

const _tool = /** @type {any} */ (tool);

/**
 * @param {{ docClient: any, PutCommand: any, deviceId: string, responseStream: any, metrics: any, requestId: string, timeoutMs: number }} deps
 */
export function buildRememberFactTool({
  docClient,
  PutCommand,
  deviceId,
  responseStream,
  metrics,
  requestId,
  timeoutMs,
}) {
  const log = createLogger(requestId, { service: "chat-stream" });
  return _tool({
    name: "remember_fact",
    description:
      "Save a short, voluntarily-shared fact about the visitor so you can recall it in future conversations. " +
      "Use ONLY when the visitor explicitly volunteers a detail they want remembered " +
      "(e.g. 'I'm a platform engineer at X', 'I'm interviewing for SOF selection', 'call me Pat'). " +
      "Never store sensitive PII — no full email addresses, phone numbers, home addresses, or health details. " +
      "Keep each fact under 240 characters and phrase it in the third person.",
    inputSchema: z.object({
      fact: z
        .string()
        .min(4)
        .max(MAX_FACT_LENGTH)
        .describe(
          "Third-person fact about the visitor, e.g. 'Is preparing for SFAS' or 'Runs a fintech startup in Dallas'",
        ),
    }),
    callback: async (/** @type {{ fact: string }} */ { fact }) => {
      if (!deviceId) {
        metrics?.record("ToolRejection_RememberFact_NoDevice");
        return { ok: false, error: "No visitor device identified; cannot persist memory." };
      }
      const startedAt = Date.now();
      try {
        const saved = await putFact(docClient, PutCommand, deviceId, fact, { timeoutMs });
        metrics?.record("ToolCall_RememberFact");
        metrics?.record("ToolLatency_RememberFact", Date.now() - startedAt, "Milliseconds");
        emitEvent(responseStream, {
          kind: EVENT_KINDS.MEMORY_UPDATE,
          action: "remembered",
          content: saved.content,
          factId: saved.factId,
        });
        return { ok: true, remembered: saved.content };
      } catch (error) {
        const errName = error instanceof Error ? error.name : String(error);
        // Distinguish a hung-write timeout from a genuine DynamoDB failure so the
        // two are separable in CloudWatch and the visitor gets accurate copy.
        const timedOut = errName === "TimeoutError";
        metrics?.record(timedOut ? "ToolTimeout_RememberFact" : "ToolFailure_RememberFact");
        log.error("tool_error", {
          tool: "remember_fact",
          error: errName,
          message: error instanceof Error ? error.message : "",
        });
        return {
          ok: false,
          error: timedOut ? "Unable to save that right now — it timed out." : "Unable to save that right now.",
        };
      }
    },
  });
}
