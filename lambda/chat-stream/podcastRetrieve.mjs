import { createLogger } from "lambda-shared/logger";

/**
 * Retrieve relevant passages from the dedicated Vector Podcast Knowledge Base,
 * preserving the per-chunk metadata (videoId, startSeconds, episodeTitle) that
 * powers timestamp-deep-linked citations.
 *
 * Unlike kbRetrieve.retrieveContext (which joins chunk text into a single string
 * for the bio KB), this returns structured results so the search_podcast tool can
 * build "Play at MM:SS" citation cards.
 *
 * @param {{ send: any }} agentClient - BedrockAgentRuntimeClient instance (injected).
 * @param {any} RetrieveCommand - RetrieveCommand constructor (injected).
 * @param {string} query - User query.
 * @param {object} opts
 * @param {string} opts.knowledgeBaseId - The podcast KB id (PODCAST_KB_ID).
 * @param {string} opts.requestId
 * @param {{ record: any }} opts.metrics - MetricsCollector instance.
 * @param {number} [opts.timeoutMs=4000]
 * @param {number} [opts.numberOfResults=4]
 * @returns {Promise<Array<{text:string, score:number|null, videoId:string, startSeconds:number, episodeTitle:string|null}>>}
 *          Structured chunks, or [] on empty/error (never throws).
 */
export async function retrievePodcastChunks(agentClient, RetrieveCommand, query, opts) {
  const { knowledgeBaseId, requestId, metrics, timeoutMs = 4000, numberOfResults = 4 } = opts;
  const log = createLogger(requestId, { service: "chat-stream" });

  if (!knowledgeBaseId) {
    return [];
  }

  const start = Date.now();
  try {
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

    const command = new RetrieveCommand({
      knowledgeBaseId,
      retrievalQuery: { text: query },
      retrievalConfiguration: {
        vectorSearchConfiguration: {
          numberOfResults,
        },
      },
    });

    const response = await agentClient.send(command, {
      abortSignal: abortController.signal,
    });

    clearTimeout(timeoutId);
    const elapsed = Date.now() - start;
    metrics?.record("PodcastKBRetrievalLatency", elapsed, "Milliseconds");

    if (!response.retrievalResults || response.retrievalResults.length === 0) {
      log.info("podcast_kb_retrieval_empty", { latencyMs: elapsed });
      return [];
    }

    const chunks = response.retrievalResults
      .map((/** @type {any} */ result) => {
        const meta = result.metadata || {};
        const startSecondsRaw = Number(meta.startSeconds);
        return {
          text: result.content?.text || "",
          score: typeof result.score === "number" ? result.score : null,
          videoId: typeof meta.videoId === "string" ? meta.videoId : null,
          startSeconds: Number.isFinite(startSecondsRaw) ? Math.max(0, Math.floor(startSecondsRaw)) : null,
          episodeTitle: typeof meta.episodeTitle === "string" ? meta.episodeTitle : null,
        };
      })
      .filter((/** @type {any} */ c) => c.text && c.videoId && c.startSeconds !== null);

    metrics?.record("PodcastKBRetrievalSuccess");
    log.info("podcast_kb_retrieval_success", { chunks: chunks.length, latencyMs: elapsed });
    return chunks;
  } catch (error) {
    const elapsed = Date.now() - start;
    const errName = error instanceof Error ? error.name : String(error);
    metrics?.record("PodcastKBRetrievalLatency", elapsed, "Milliseconds");

    if (errName === "AbortError") {
      log.error("podcast_kb_retrieval_timeout", { latencyMs: elapsed });
      metrics?.record("PodcastKBRetrievalTimeout");
    } else {
      log.error("podcast_kb_retrieval_error", {
        error: errName,
        message: error instanceof Error ? error.message : "",
        latencyMs: elapsed,
      });
      metrics?.record("PodcastKBRetrievalFailure");
    }
    return [];
  }
}
