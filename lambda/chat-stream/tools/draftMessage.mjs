import { tool } from "@strands-agents/sdk";
import { z } from "zod";
import { emitEvent, EVENT_KINDS } from "../events.mjs";

/** @param {{ responseStream: any, metrics: any }} deps */
export function buildDraftMessageTool({ responseStream, metrics }) {
  return tool({
    name: "draft_message",
    description:
      "Draft a message to Christian via the contact form on the visitor's behalf. " +
      "Use only when the visitor explicitly wants to reach out (speaking, podcast, consulting, collaboration). " +
      "The draft is shown to the visitor for review and approval before anything is sent. " +
      "NEVER fabricate the visitor's name, email, or company — leave those fields blank for the visitor to fill in.",
    inputSchema: z.object({
      subject: z.string().min(4).max(120).describe("A short subject line for the message"),
      body: z
        .string()
        .min(20)
        .max(1500)
        .describe("Drafted message body — reference the visitor's intent; do not invent identity details"),
      intent: z
        .enum(["speaking", "podcast", "consulting", "collaboration", "media", "general"])
        .describe("The category of outreach"),
    }),
    callback: async ({ subject, body, intent }) => {
      metrics?.record("ToolCall_DraftMessage");
      emitEvent(responseStream, {
        kind: EVENT_KINDS.DRAFT_ACTION,
        action: "contact",
        subject,
        body,
        intent,
      });
      return {
        ok: true,
        drafted: true,
        subject,
        intent,
        note: "Draft shown to visitor for review. They must confirm and supply their name/email before anything is sent.",
      };
    },
  });
}
