/**
 * Retrieve relevant passages from the dedicated Vector Podcast Knowledge Base,
 * preserving the per-chunk metadata (videoId, startSeconds, episodeTitle) that
 * powers timestamp-deep-linked citations.
 *
 * Unlike kbRetrieve.retrieveContext (which joins chunk text into a single string
 * for the bio KB), this returns structured results so the search_podcast tool can
 * build "Play at MM:SS" citation cards.
 *
 * @param {object} agentClient - BedrockAgentRuntimeClient instance (injected).
 * @param {Function} RetrieveCommand - RetrieveCommand constructor (injected).
 * @param {string} query - User query.
 * @param {object} opts
 * @param {string} opts.knowledgeBaseId - The podcast KB id (PODCAST_KB_ID).
 * @param {string} opts.requestId
 * @param {object} opts.metrics - MetricsCollector instance.
 * @param {number} [opts.timeoutMs=4000]
 * @param {number} [opts.numberOfResults=4]
 * @returns {Promise<Array<{text:string, score:number|null, videoId:string, startSeconds:number, episodeTitle:string|null}>>}
 *          Structured chunks, or [] on empty/error (never throws).
 */
export async function retrievePodcastChunks(agentClient, RetrieveCommand, query, opts) {
  const { knowledgeBaseId, requestId, metrics, timeoutMs = 4000, numberOfResults = 4 } = opts;

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
      console.log(JSON.stringify({ requestId, event: "podcast_kb_retrieval_empty", latencyMs: elapsed }));
      return [];
    }

    const chunks = response.retrievalResults
      .map((result) => {
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
      .filter((c) => c.text && c.videoId && c.startSeconds !== null);

    metrics?.record("PodcastKBRetrievalSuccess");
    console.log(
      JSON.stringify({
        requestId,
        event: "podcast_kb_retrieval_success",
        chunks: chunks.length,
        latencyMs: elapsed,
      }),
    );
    return chunks;
  } catch (error) {
    const elapsed = Date.now() - start;
    metrics?.record("PodcastKBRetrievalLatency", elapsed, "Milliseconds");

    if (error.name === "AbortError") {
      console.error(JSON.stringify({ requestId, event: "podcast_kb_retrieval_timeout", latencyMs: elapsed }));
      metrics?.record("PodcastKBRetrievalTimeout");
    } else {
      console.error(
        JSON.stringify({
          requestId,
          event: "podcast_kb_retrieval_error",
          error: error.name,
          message: error.message,
          latencyMs: elapsed,
        }),
      );
      metrics?.record("PodcastKBRetrievalFailure");
    }
    return [];
  }
}
