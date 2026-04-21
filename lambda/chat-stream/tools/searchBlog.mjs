import { tool } from "@strands-agents/sdk";
import { z } from "zod";
import { emitEvent, EVENT_KINDS } from "../events.mjs";

const SEARCH_QUERY = `*[_type == "post" && defined(slug.current) && (
  title match $q ||
  excerpt match $q ||
  pt::text(body) match $q ||
  count(tags[@ match $q]) > 0
)] | score(
  title match $q,
  excerpt match $q,
  pt::text(body) match $q
) | order(_score desc)[0...$limit]{
  title,
  "slug": slug.current,
  excerpt,
  publishedAt
}`;

const SITE_ORIGIN = "https://thechrisgrey.com";

const STOP_ONLY = new Set([
  "the", "a", "an", "and", "or", "for", "to", "of", "in", "on", "at",
  "is", "it", "be", "by", "as", "but", "if", "so", "do", "did", "was",
]);

function normalizeQuery(raw) {
  return raw.trim().replace(/\s+/g, " ");
}

function isMeaningful(query) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return words.some((w) => !STOP_ONLY.has(w));
}

export function buildSearchBlogTool({ sanityClient, responseStream, metrics, requestId }) {
  return tool({
    name: "search_blog",
    description:
      "Search Christian's blog for posts matching a keyword or short phrase. " +
      "Use when the visitor asks what Christian has written about a topic and you do NOT already know a specific slug. " +
      "Returns up to 5 posts with title, excerpt, and slug. " +
      "After reviewing the results, call cite_blog_passage on the best match if you want to quote a specific post.",
    inputSchema: z.object({
      query: z
        .string()
        .min(2, "Query must be at least 2 characters")
        .max(120, "Query too long")
        .describe("Keyword or short phrase to search for, e.g. 'Green Beret' or 'Strands agents'"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(5)
        .default(3)
        .describe("Maximum number of results to return (1-5)"),
    }),
    callback: async ({ query, limit }) => {
      const normalized = normalizeQuery(query);
      if (!isMeaningful(normalized)) {
        metrics?.record("ToolRejection_SearchBlog");
        return { ok: false, error: "Query must contain a meaningful keyword." };
      }

      const startedAt = Date.now();
      try {
        const results = await sanityClient.fetch(SEARCH_QUERY, {
          q: normalized,
          limit,
        });
        const latencyMs = Date.now() - startedAt;
        metrics?.record("ToolCall_SearchBlog");
        metrics?.record("ToolLatency_SearchBlog", latencyMs, "Milliseconds");

        const safeResults = Array.isArray(results) ? results : [];
        const normalizedResults = safeResults
          .filter((r) => r && typeof r.slug === "string" && typeof r.title === "string")
          .map((r) => ({
            slug: r.slug,
            title: r.title,
            excerpt: typeof r.excerpt === "string" ? r.excerpt : "",
            publishedAt: typeof r.publishedAt === "string" ? r.publishedAt : "",
          }));

        if (normalizedResults.length === 0) {
          return { ok: true, query: normalized, results: [] };
        }

        emitEvent(responseStream, {
          kind: EVENT_KINDS.DRAFT_ACTION,
          action: "blog_search_results",
          query: normalized,
          results: normalizedResults.map((r) => ({
            slug: r.slug,
            title: r.title,
            excerpt: r.excerpt,
            url: `${SITE_ORIGIN}/blog/${r.slug}`,
          })),
        });

        return {
          ok: true,
          query: normalized,
          results: normalizedResults,
        };
      } catch (error) {
        metrics?.record("ToolFailure_SearchBlog");
        console.error(JSON.stringify({
          requestId,
          event: "tool_error",
          tool: "search_blog",
          error: error.name,
          message: error.message,
        }));
        return { ok: false, error: "Unable to search the blog right now." };
      }
    },
  });
}
