/**
 * Retrieve relevant context from a Bedrock Knowledge Base.
 *
 * @param {object} agentClient - BedrockAgentRuntimeClient instance (injected).
 * @param {Function} RetrieveCommand - RetrieveCommand constructor (injected).
 * @param {string} query - User query.
 * @param {object} opts
 * @param {string} opts.knowledgeBaseId
 * @param {string} opts.requestId
 * @param {object} opts.metrics - MetricsCollector instance.
 * @param {number} [opts.timeoutMs=4000]
 * @param {number} [opts.numberOfResults=5]
 * @returns {Promise<string|null>} Joined context or null on empty/error.
 */
export async function retrieveContext(agentClient, RetrieveCommand, query, opts) {
  const {
    knowledgeBaseId,
    requestId,
    metrics,
    timeoutMs = 4000,
    numberOfResults = 5,
  } = opts;

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
    metrics.record("KBRetrievalLatency", elapsed, "Milliseconds");

    if (!response.retrievalResults || response.retrievalResults.length === 0) {
      console.log(JSON.stringify({ requestId, event: "kb_retrieval_empty", latencyMs: elapsed }));
      return null;
    }

    const contextChunks = response.retrievalResults
      .filter((result) => result.content?.text)
      .map((result) => result.content.text);

    metrics.record("KBRetrievalSuccess");
    console.log(JSON.stringify({
      requestId,
      event: "kb_retrieval_success",
      chunks: contextChunks.length,
      latencyMs: elapsed,
    }));
    return contextChunks.join("\n\n---\n\n");
  } catch (error) {
    const elapsed = Date.now() - start;
    metrics.record("KBRetrievalLatency", elapsed, "Milliseconds");

    if (error.name === "AbortError") {
      console.error(JSON.stringify({ requestId, event: "kb_retrieval_timeout", latencyMs: elapsed }));
      metrics.record("KBRetrievalTimeout");
    } else {
      console.error(JSON.stringify({
        requestId,
        event: "kb_retrieval_error",
        error: error.name,
        message: error.message,
        latencyMs: elapsed,
      }));
    }
    metrics.record("KBRetrievalFailure");
    return null;
  }
}
