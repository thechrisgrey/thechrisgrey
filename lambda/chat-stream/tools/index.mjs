import { buildNavigateTool } from "./navigate.mjs";
import { buildDraftMessageTool } from "./draftMessage.mjs";
import { buildDraftNewsletterTool } from "./draftNewsletter.mjs";
import { buildCitePassageTool } from "./citePassage.mjs";
import { buildSearchBlogTool } from "./searchBlog.mjs";
import { buildRenderUiTool } from "./renderUi.mjs";
import { buildRememberFactTool } from "./rememberFact.mjs";

/**
 * Build the tool list for an agent invocation.
 *
 * @param {{
 *   responseStream: { write: (s: string) => void },
 *   metrics?: { record: (n: string, v?: number, u?: string) => void },
 *   sanityClient?: { fetch: (q: string, p?: object) => Promise<unknown> },
 *   docClient?: { send: (cmd: unknown) => Promise<unknown> },
 *   PutCommand?: new (input: unknown) => unknown,
 *   deviceId?: string | null,
 *   surface?: 'page' | 'widget',
 *   requestId?: string,
 * }} deps
 */
export function buildTools(deps) {
  const tools = [
    buildNavigateTool(deps),
    buildDraftMessageTool(deps),
    buildDraftNewsletterTool(deps),
  ];

  if (deps.sanityClient) {
    tools.push(buildCitePassageTool(deps));
    tools.push(buildSearchBlogTool(deps));
  }

  // Generative UI is offered ONLY on the dedicated /chat page — never the widget.
  if (deps.surface === "page") {
    tools.push(buildRenderUiTool(deps));
  }

  if (deps.docClient && deps.PutCommand && deps.deviceId) {
    tools.push(buildRememberFactTool(deps));
  }

  return tools;
}

export {
  buildNavigateTool,
  buildDraftMessageTool,
  buildDraftNewsletterTool,
  buildCitePassageTool,
  buildSearchBlogTool,
  buildRenderUiTool,
  buildRememberFactTool,
};
