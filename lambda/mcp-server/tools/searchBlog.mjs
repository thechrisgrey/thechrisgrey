import { BLOG_SEARCH_QUERY, SITE_ORIGIN, normalizeQuery, isMeaningful } from "lambda-shared/sanityQueries";

const INPUT_SCHEMA = {
  type: "object",
  properties: {
    query: {
      type: "string",
      minLength: 2,
      maxLength: 120,
      description: "Keyword or short phrase to search for, e.g. 'Green Beret' or 'Strands agents'",
    },
    limit: {
      type: "integer",
      minimum: 1,
      maximum: 5,
      default: 3,
      description: "Maximum number of results to return (1-5)",
    },
  },
  required: ["query"],
  additionalProperties: false,
};

function coerceLimit(raw) {
  const n = Number.isFinite(raw) ? Math.floor(raw) : 3;
  return Math.max(1, Math.min(5, n));
}

function formatResult(normalized, results) {
  if (results.length === 0) {
    return `No posts matching "${normalized}".`;
  }
  const header = `Found ${results.length} post${results.length === 1 ? "" : "s"} matching "${normalized}":`;
  const lines = results.map((r, idx) => {
    const excerpt = r.excerpt ? ` — ${r.excerpt}` : "";
    const url = `${SITE_ORIGIN}/blog/${r.slug}`;
    return `${idx + 1}. ${r.title}${excerpt}\n   ${url}`;
  });
  return [header, "", ...lines].join("\n");
}

export function buildSearchBlogMcpTool({ sanityClient, metrics, requestId }) {
  return {
    name: "search_blog",
    description:
      "Search Christian Perez's blog on thechrisgrey.com for posts matching a keyword or short phrase. " +
      "Returns up to 5 matching posts ordered by relevance with title, excerpt, and URL. " +
      "Use get_blog_post afterward to fetch the full body of a specific post by slug.",
    inputSchema: INPUT_SCHEMA,
    handler: async ({ arguments: args }) => {
      const rawQuery = typeof args?.query === "string" ? args.query : "";
      const normalized = normalizeQuery(rawQuery);
      const limit = coerceLimit(args?.limit);

      if (normalized.length < 2 || normalized.length > 120) {
        return {
          isError: true,
          content: [{ type: "text", text: "Query must be 2-120 characters long." }],
        };
      }
      if (!isMeaningful(normalized)) {
        metrics?.record("McpRejection_SearchBlog");
        return {
          isError: true,
          content: [{ type: "text", text: "Query must contain at least one meaningful keyword." }],
        };
      }

      const startedAt = Date.now();
      try {
        const raw = await sanityClient.fetch(BLOG_SEARCH_QUERY, { q: normalized, limit });
        const latencyMs = Date.now() - startedAt;
        metrics?.record("McpCall_SearchBlog");
        metrics?.record("McpLatency_SearchBlog", latencyMs, "Milliseconds");

        const safe = Array.isArray(raw) ? raw : [];
        const results = safe
          .filter((r) => r && typeof r.slug === "string" && typeof r.title === "string")
          .map((r) => ({
            slug: r.slug,
            title: r.title,
            excerpt: typeof r.excerpt === "string" ? r.excerpt : "",
            publishedAt: typeof r.publishedAt === "string" ? r.publishedAt : "",
          }));

        return {
          content: [{ type: "text", text: formatResult(normalized, results) }],
        };
      } catch (error) {
        metrics?.record("McpFailure_SearchBlog");
        console.error(
          JSON.stringify({
            requestId,
            event: "mcp_tool_error",
            tool: "search_blog",
            error: error?.name,
            message: error?.message,
          }),
        );
        return {
          isError: true,
          content: [{ type: "text", text: "Unable to search the blog right now. Try again shortly." }],
        };
      }
    },
  };
}
