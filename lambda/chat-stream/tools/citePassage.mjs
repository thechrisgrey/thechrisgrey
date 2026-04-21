import { tool } from "@strands-agents/sdk";
import { z } from "zod";
import { BLOG_CITE_QUERY, SITE_ORIGIN } from "lambda-shared/sanityQueries";
import { emitEvent, EVENT_KINDS } from "../events.mjs";

export function buildCitePassageTool({ sanityClient, responseStream, metrics, requestId }) {
  return tool({
    name: "cite_blog_passage",
    description:
      "Retrieve a short citation for a specific blog post so the reply can include an authoritative reference with a link. " +
      "Use when the visitor asks about a topic covered in a specific blog post that you can identify by slug. " +
      "Returns the post title, excerpt, and canonical URL.",
    inputSchema: z.object({
      slug: z
        .string()
        .regex(/^[a-z0-9][a-z0-9-]*$/, "Slug must be lowercase alphanumeric with hyphens")
        .min(1)
        .max(120)
        .describe("The blog post slug, e.g. 'building-agentic-alti'"),
    }),
    callback: async ({ slug }) => {
      const startedAt = Date.now();
      try {
        const post = await sanityClient.fetch(BLOG_CITE_QUERY, { slug });
        const latencyMs = Date.now() - startedAt;
        metrics?.record("ToolCall_CitePassage");
        metrics?.record("ToolLatency_CitePassage", latencyMs, "Milliseconds");

        if (!post) {
          return { ok: false, error: `No blog post found for slug '${slug}'.` };
        }

        const url = `${SITE_ORIGIN}/blog/${post.slug}`;
        emitEvent(responseStream, {
          kind: EVENT_KINDS.DRAFT_ACTION,
          action: "citation",
          slug: post.slug,
          title: post.title,
          excerpt: post.excerpt || "",
          url,
        });

        return {
          ok: true,
          title: post.title,
          excerpt: post.excerpt || "",
          url,
          slug: post.slug,
        };
      } catch (error) {
        metrics?.record("ToolFailure_CitePassage");
        console.error(JSON.stringify({
          requestId,
          event: "tool_error",
          tool: "cite_blog_passage",
          error: error.name,
          message: error.message,
        }));
        return { ok: false, error: "Unable to fetch citation right now." };
      }
    },
  });
}
