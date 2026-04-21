import { tool } from "@strands-agents/sdk";
import { z } from "zod";
import { putFact, MAX_FACT_LENGTH } from "../memory.mjs";
import { emitEvent, EVENT_KINDS } from "../events.mjs";

export function buildRememberFactTool({ docClient, PutCommand, deviceId, responseStream, metrics, requestId }) {
  return tool({
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
        .describe("Third-person fact about the visitor, e.g. 'Is preparing for SFAS' or 'Runs a fintech startup in Dallas'"),
    }),
    callback: async ({ fact }) => {
      if (!deviceId) {
        metrics?.record("ToolRejection_RememberFact_NoDevice");
        return { ok: false, error: "No visitor device identified; cannot persist memory." };
      }
      try {
        const saved = await putFact(docClient, PutCommand, deviceId, fact);
        metrics?.record("ToolCall_RememberFact");
        emitEvent(responseStream, {
          kind: EVENT_KINDS.MEMORY_UPDATE,
          action: "remembered",
          content: saved.content,
          factId: saved.factId,
        });
        return { ok: true, remembered: saved.content };
      } catch (error) {
        metrics?.record("ToolFailure_RememberFact");
        console.error(JSON.stringify({
          requestId,
          event: "tool_error",
          tool: "remember_fact",
          error: error.name,
          message: error.message,
        }));
        return { ok: false, error: "Unable to save that right now." };
      }
    },
  });
}
