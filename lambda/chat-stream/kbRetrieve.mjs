import { createLogger } from "lambda-shared/logger";

/**
 * Retrieve relevant context from a Bedrock Knowledge Base.
 *
 * @param {{ send: any }} agentClient - BedrockAgentRuntimeClient instance (injected).
 * @param {any} RetrieveCommand - RetrieveCommand constructor (injected).
 * @param {string} query - User query.
 * @param {object} opts
 * @param {string} opts.knowledgeBaseId
 * @param {string} opts.requestId
 * @param {{ record: any }} opts.metrics - MetricsCollector instance.
 * @param {number} [opts.timeoutMs=4000]
 * @param {number} [opts.numberOfResults=5]
 * @returns {Promise<string|null>} Joined context or null on empty/error.
 */
export async function retrieveContext(agentClient, RetrieveCommand, query, opts) {
  const { knowledgeBaseId, requestId, metrics, timeoutMs = 4000, numberOfResults = 5 } = opts;
  const log = createLogger(requestId, { service: "chat-stream" });

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
      log.info("kb_retrieval_empty", { latencyMs: elapsed });
      return null;
    }

    const contextChunks = response.retrievalResults
      .filter((/** @type {any} */ result) => result.content?.text)
      .map((/** @type {any} */ result) => result.content.text);

    metrics.record("KBRetrievalSuccess");
    log.info("kb_retrieval_success", { chunks: contextChunks.length, latencyMs: elapsed });
    return contextChunks.join("\n\n---\n\n");
  } catch (error) {
    const elapsed = Date.now() - start;
    const errName = error instanceof Error ? error.name : String(error);
    metrics.record("KBRetrievalLatency", elapsed, "Milliseconds");

    if (errName === "AbortError") {
      log.error("kb_retrieval_timeout", { latencyMs: elapsed });
      metrics.record("KBRetrievalTimeout");
    } else {
      log.error("kb_retrieval_error", {
        error: errName,
        message: error instanceof Error ? error.message : "",
        latencyMs: elapsed,
      });
    }
    metrics.record("KBRetrievalFailure");
    return null;
  }
}
