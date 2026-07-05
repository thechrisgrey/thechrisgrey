import { tool } from "@strands-agents/sdk";
import { z } from "zod";
import { normalizeQuery, isMeaningful } from "lambda-shared/sanityQueries";
import { emitEvent, EVENT_KINDS } from "../events.mjs";
import { retrievePodcastChunks } from "../podcastRetrieve.mjs";

const MAX_CITATIONS = 3;

/**
 * Format a second-offset as a YouTube-style timestamp label (MM:SS or H:MM:SS).
 */
export function formatTimestamp(totalSeconds) {
  const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

function trimQuote(text, max = 240) {
  const clean = String(text).replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

/**
 * search_podcast — Strands tool that searches the Vector Podcast KB and emits one
 * `podcast_citation` draft action per top result, each deep-linking to the exact
 * YouTube timestamp. Mirrors the searchBlog tool's structure and metrics.
 */
export function buildSearchPodcastTool({
  agentClient,
  RetrieveCommand,
  podcastKbId,
  responseStream,
  metrics,
  requestId,
}) {
  return tool({
    name: "search_podcast",
    description:
      "Search The Vector Podcast for what a guest or Christian actually said about a topic. " +
      "Use when the visitor asks what was discussed or said on the podcast, or which episode covers a topic. " +
      "Returns short quoted passages, each tied to its episode and a timestamp. " +
      "After it runs, summarize the answer in one or two sentences and let the citation cards carry the links. " +
      "Call at most twice per turn.",
    inputSchema: z.object({
      query: z
        .string()
        .min(2, "Query must be at least 2 characters")
        .max(120, "Query too long")
        .describe("Topic, phrase, or question to search the podcast for, e.g. 'women veterans' or 'AI in defense'"),
    }),
    callback: async ({ query }) => {
      const normalized = normalizeQuery(query);
      if (!isMeaningful(normalized)) {
        metrics?.record("ToolRejection_SearchPodcast");
        return { ok: false, error: "Query must contain a meaningful keyword." };
      }

      const startedAt = Date.now();
      try {
        const chunks = await retrievePodcastChunks(agentClient, RetrieveCommand, normalized, {
          knowledgeBaseId: podcastKbId,
          requestId,
          metrics,
          numberOfResults: 4,
          timeoutMs: 4000,
        });

        metrics?.record("ToolCall_SearchPodcast");
        metrics?.record("ToolLatency_SearchPodcast", Date.now() - startedAt, "Milliseconds");

        if (chunks.length === 0) {
          return { ok: true, query: normalized, results: [] };
        }

        // De-dupe by episode + timestamp; keep the top MAX_CITATIONS.
        const seen = new Set();
        const top = [];
        for (const c of chunks) {
          const key = `${c.videoId}-${c.startSeconds}`;
          if (seen.has(key)) continue;
          seen.add(key);
          top.push(c);
          if (top.length >= MAX_CITATIONS) break;
        }

        for (const c of top) {
          emitEvent(responseStream, {
            kind: EVENT_KINDS.DRAFT_ACTION,
            action: "podcast_citation",
            videoId: c.videoId,
            startSeconds: c.startSeconds,
            episodeTitle: c.episodeTitle || "The Vector Podcast",
            quote: trimQuote(c.text),
            timestampLabel: formatTimestamp(c.startSeconds),
            url: `https://www.youtube.com/watch?v=${c.videoId}&t=${c.startSeconds}s`,
          });
        }

        return {
          ok: true,
          query: normalized,
          results: top.map((c) => ({
            episodeTitle: c.episodeTitle || "The Vector Podcast",
            timestampLabel: formatTimestamp(c.startSeconds),
            quote: trimQuote(c.text, 320),
          })),
        };
      } catch (error) {
        metrics?.record("ToolFailure_SearchPodcast");
        console.error(
          JSON.stringify({
            requestId,
            event: "tool_error",
            tool: "search_podcast",
            error: error.name,
            message: error.message,
          }),
        );
        return { ok: false, error: "Unable to search the podcast right now." };
      }
    },
  });
}
