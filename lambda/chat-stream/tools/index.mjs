import { buildNavigateTool } from "./navigate.mjs";
import { buildDraftMessageTool } from "./draftMessage.mjs";
import { buildDraftNewsletterTool } from "./draftNewsletter.mjs";
import { buildCitePassageTool } from "./citePassage.mjs";
import { buildSearchBlogTool } from "./searchBlog.mjs";
import { buildSearchPodcastTool } from "./searchPodcast.mjs";
import { buildRenderUiTool } from "./renderUi.mjs";
import { buildRememberFactTool } from "./rememberFact.mjs";

/**
 * Build the tool list for an agent invocation.
 *
 * @param {any} deps - Shared dependencies (responseStream, metrics, clients, etc.)
 * @returns {any[]}
 */
export function buildTools(deps) {
  const tools = [buildNavigateTool(deps), buildDraftMessageTool(deps), buildDraftNewsletterTool(deps)];

  if (deps.sanityClient) {
    tools.push(buildCitePassageTool(deps));
    tools.push(buildSearchBlogTool(deps));
  }

  if (deps.agentClient && deps.RetrieveCommand && deps.podcastKbId) {
    tools.push(buildSearchPodcastTool(deps));
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
  buildSearchPodcastTool,
  buildRenderUiTool,
  buildRememberFactTool,
};
