import { BLOG_FULL_POST_QUERY, SITE_ORIGIN } from "lambda-shared/sanityQueries";
import { createLogger } from "lambda-shared/logger";

const INPUT_SCHEMA = {
  type: "object",
  properties: {
    slug: {
      type: "string",
      minLength: 1,
      maxLength: 120,
      pattern: "^[a-z0-9][a-z0-9-]*$",
      description: "The blog post slug (lowercase, hyphen-separated), e.g. 'building-agentic-alti'",
    },
  },
  required: ["slug"],
  additionalProperties: false,
};

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const MAX_BODY_CHARS = 8000;

/** @param {any} text */
function truncate(text) {
  if (!text || text.length <= MAX_BODY_CHARS) return text ?? "";
  return `${text.slice(0, MAX_BODY_CHARS)}\n\n[Post truncated at ${MAX_BODY_CHARS} characters — read the full version at the URL above.]`;
}

/** @param {any} post */
function formatPost(post) {
  const url = `${SITE_ORIGIN}/blog/${post.slug}`;
  const published = post.publishedAt ? `Published: ${String(post.publishedAt).slice(0, 10)}` : "";
  const tags =
    Array.isArray(post.tags) && post.tags.length > 0
      ? `Tags: ${post.tags.filter((/** @type {any} */ t) => typeof t === "string").join(", ")}`
      : "";
  const series = post.series?.title ? `Series: ${post.series.title}` : "";
  const excerpt = post.excerpt ? `\nExcerpt: ${post.excerpt}\n` : "";
  const meta = [published, tags, series].filter(Boolean).join("\n");
  const body = truncate(post.body);
  return [`# ${post.title}`, url, meta, excerpt, "", body]
    .filter((chunk) => chunk !== undefined && chunk !== null)
    .join("\n");
}

/**
 * @param {{ sanityClient: any, metrics: any, requestId: string }} deps
 */
export function buildGetBlogPostMcpTool({ sanityClient, metrics, requestId }) {
  const log = createLogger(requestId, { service: "mcp-server" });
  return {
    name: "get_blog_post",
    description:
      "Retrieve the full text of a single Christian Perez blog post by slug. " +
      "Returns title, publication date, tags, series, excerpt, and the full post body as plain text. " +
      "Use search_blog first if you don't already know the slug.",
    inputSchema: INPUT_SCHEMA,
    handler: async (/** @type {{ arguments: any }} */ { arguments: args }) => {
      const slug = typeof args?.slug === "string" ? args.slug.trim() : "";

      if (!SLUG_PATTERN.test(slug) || slug.length > 120) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: "Slug must be lowercase alphanumeric with hyphens (e.g. 'building-agentic-alti').",
            },
          ],
        };
      }

      const startedAt = Date.now();
      try {
        const post = await sanityClient.fetch(BLOG_FULL_POST_QUERY, { slug });
        const latencyMs = Date.now() - startedAt;
        metrics?.record("McpCall_GetBlogPost");
        metrics?.record("McpLatency_GetBlogPost", latencyMs, "Milliseconds");

        if (!post) {
          return {
            isError: true,
            content: [{ type: "text", text: `No blog post found for slug '${slug}'.` }],
          };
        }

        return {
          content: [{ type: "text", text: formatPost(post) }],
        };
      } catch (error) {
        metrics?.record("McpFailure_GetBlogPost");
        log.error("mcp_tool_error", {
          tool: "get_blog_post",
          error: error instanceof Error ? error.name : String(error),
          message: error instanceof Error ? error.message : "",
        });
        return {
          isError: true,
          content: [{ type: "text", text: "Unable to fetch that post right now. Try again shortly." }],
        };
      }
    },
  };
}
