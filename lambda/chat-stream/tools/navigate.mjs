import { tool } from "@strands-agents/sdk";
import { z } from "zod";
import { isValidPath } from "../validation.mjs";
import { emitEvent, EVENT_KINDS } from "../events.mjs";

const _tool = /** @type {any} */ (tool);

export function buildNavigateTool({ responseStream, metrics }) {
  return _tool({
    name: "navigate_to",
    description:
      "Suggest that the visitor navigate to a specific page on thechrisgrey.com. " +
      "Use when a dedicated page would answer the visitor's question better than a prose reply. " +
      "Allowed paths: /, /about, /altivum, /foundation, /podcast, /beyond-the-assessment, /aws, /claude, " +
      "/blog, /blog/<slug>, /contact, /links, /blueprint, /privacy. " +
      "Do NOT use for /admin or /chat.",
    inputSchema: z.object({
      path: z.string().describe("The route path, e.g. /about or /blog/post-slug"),
      reason: z.string().min(4).max(240).describe("One sentence explaining why this page helps the visitor"),
    }),
    callback: async ({ path, reason }) => {
      if (path === "/admin" || path === "/chat") {
        metrics?.record("ToolRejection_NavigateTo");
        return { ok: false, error: "Path is restricted." };
      }
      if (!isValidPath(path)) {
        metrics?.record("ToolRejection_NavigateTo");
        return { ok: false, error: `Path ${path} is not a known route on the site.` };
      }
      metrics?.record("ToolCall_NavigateTo");
      emitEvent(responseStream, {
        kind: EVENT_KINDS.DRAFT_ACTION,
        action: "navigate",
        path,
        reason,
      });
      return { ok: true, path, reason };
    },
  });
}
