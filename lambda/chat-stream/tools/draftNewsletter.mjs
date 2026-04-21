import { tool } from "@strands-agents/sdk";
import { z } from "zod";
import { emitEvent, EVENT_KINDS } from "../events.mjs";

export function buildDraftNewsletterTool({ responseStream, metrics }) {
  return tool({
    name: "draft_newsletter_subscription",
    description:
      "Prompt the visitor to subscribe to Christian's newsletter. " +
      "Use only when the visitor asks about updates, announcements, new blog posts, or newsletter access. " +
      "A confirmation card is shown; the visitor must enter their email and click subscribe.",
    inputSchema: z.object({
      pitch: z
        .string()
        .min(8)
        .max(200)
        .describe("A short, genuine reason the visitor might want to subscribe (1 sentence)"),
    }),
    callback: async ({ pitch }) => {
      metrics?.record("ToolCall_DraftNewsletter");
      emitEvent(responseStream, {
        kind: EVENT_KINDS.DRAFT_ACTION,
        action: "newsletter",
        pitch,
      });
      return {
        ok: true,
        drafted: true,
        pitch,
        note: "Subscription card shown. Visitor supplies email and confirms.",
      };
    },
  });
}
