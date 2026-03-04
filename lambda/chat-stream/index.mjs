import {
  BedrockRuntimeClient,
  ConverseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";
import {
  BedrockAgentRuntimeClient,
  RetrieveCommand,
} from "@aws-sdk/client-bedrock-agent-runtime";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { CloudWatchClient, PutMetricDataCommand } from "@aws-sdk/client-cloudwatch";
import { createHash, randomUUID } from "crypto";

const bedrockClient = new BedrockRuntimeClient({ region: "us-east-1" });
const agentClient = new BedrockAgentRuntimeClient({ region: "us-east-1" });
const dynamoClient = new DynamoDBClient({ region: "us-east-1" });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const cloudwatchClient = new CloudWatchClient({ region: "us-east-1" });

const NAMESPACE = "TheChrisGrey/SiteMetrics";
const MAX_METRICS_PER_CALL = 20;

/**
 * Batched metrics collector — accumulates metrics during a request
 * and flushes them in a single PutMetricDataCommand call at the end.
 */
class MetricsCollector {
  constructor() {
    this.buffer = [];
  }

  record(metricName, value = 1, unit = "Count") {
    this.buffer.push({
      MetricName: metricName,
      Value: value,
      Unit: unit,
      Timestamp: new Date(),
    });
  }

  async flush() {
    if (this.buffer.length === 0) return;

    const batches = [];
    for (let i = 0; i < this.buffer.length; i += MAX_METRICS_PER_CALL) {
      batches.push(this.buffer.slice(i, i + MAX_METRICS_PER_CALL));
    }

    await Promise.all(
      batches.map((batch) =>
        cloudwatchClient
          .send(new PutMetricDataCommand({ Namespace: NAMESPACE, MetricData: batch }))
          .catch(() => {})
      )
    );
  }
}

const MODEL_ID = "us.anthropic.claude-haiku-4-5-20251001-v1:0";
const KNOWLEDGE_BASE_ID = "ARFYABW8HP";
const GUARDRAIL_ID = "5kofhp46ssob";
const GUARDRAIL_VERSION = "1";
const RATE_LIMIT_TABLE = "thechrisgrey-chat-ratelimit";
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW = 3600; // 1 hour in seconds
const SYSTEM_MESSAGE_PREFIX = "\x00SYS\x00";

function writeSystemMessage(responseStream, message) {
  responseStream.write(SYSTEM_MESSAGE_PREFIX + message);
  responseStream.end();
}

// Base system prompt defining the AI persona
const BASE_SYSTEM_PROMPT = `You are Christian Perez's AI assistant. Help visitors learn about him in a natural, conversational way.

HOW TO RESPOND:
- Talk like a professional colleague who knows Christian well - warm but polished
- Answer the question directly, then stop - don't volunteer extra information unless asked
- Pick the most interesting or relevant detail, not every detail you know
- Sound knowledgeable and approachable, not like a Wikipedia article or a bar conversation
- It's okay to be brief - if they want more, they'll ask follow-up questions

FORMATTING:
- Plain text only, no markdown formatting
- No bullet points or lists in your responses
- Write naturally, not in structured paragraphs

WHAT TO AVOID:
- Don't over-explain or pad your responses
- Don't use phrases like "What makes this meaningful is..." or "Beyond the technical work..."
- Don't include multiple topic areas in one response unless directly asked
- Never fabricate specifics about Christian

You can use your general knowledge to explain concepts (like what an AWS User Group is) while keeping Christian-specific details accurate to the context provided.`;

/**
 * Check rate limit for an IP address
 * Returns { allowed: boolean, remaining: number }
 */
async function checkRateLimit(ip, requestId) {
  const ipHash = createHash('sha256').update(ip || 'unknown').digest('hex');
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - (now % RATE_LIMIT_WINDOW);

  try {
    const result = await docClient.send(new UpdateCommand({
      TableName: RATE_LIMIT_TABLE,
      Key: { pk: ipHash },
      UpdateExpression: 'ADD requestCount :inc SET #ttl = :ttl, windowStart = if_not_exists(windowStart, :ws)',
      ConditionExpression: 'attribute_not_exists(pk) OR windowStart = :ws',
      ExpressionAttributeNames: { '#ttl': 'ttl' },
      ExpressionAttributeValues: {
        ':inc': 1,
        ':ws': windowStart,
        ':ttl': windowStart + RATE_LIMIT_WINDOW + 3600,
      },
      ReturnValues: 'ALL_NEW',
    }));

    const count = result.Attributes?.requestCount ?? 1;
    if (count > RATE_LIMIT_MAX) {
      return { allowed: false, remaining: 0 };
    }
    return { allowed: true, remaining: RATE_LIMIT_MAX - count };
  } catch (error) {
    // ConditionalCheckFailedException = stale window, safe to reset
    if (error.name === 'ConditionalCheckFailedException') {
      try {
        await docClient.send(new UpdateCommand({
          TableName: RATE_LIMIT_TABLE,
          Key: { pk: ipHash },
          UpdateExpression: 'SET requestCount = :one, windowStart = :ws, #ttl = :ttl',
          ExpressionAttributeNames: { '#ttl': 'ttl' },
          ExpressionAttributeValues: {
            ':one': 1,
            ':ws': windowStart,
            ':ttl': windowStart + RATE_LIMIT_WINDOW + 3600,
          },
        }));
        return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
      } catch {
        return { allowed: true, remaining: -1 };
      }
    }
    console.error(JSON.stringify({ requestId, event: "rate_limit_error", error: error.name }));
    return { allowed: true, remaining: -1 };
  }
}

/**
 * Validate input messages
 * Returns { valid: boolean, error?: string }
 */
const VALID_ROLES = new Set(['user', 'assistant']);
const MAX_MESSAGE_LENGTH = 4000;
const MAX_MESSAGE_COUNT = 50;

function validateInput(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return { valid: false, error: "Please send a message to start our conversation." };
  }
  if (messages.length > MAX_MESSAGE_COUNT) {
    return { valid: false, error: "Conversation history is too long. Please start a new conversation." };
  }
  for (const msg of messages) {
    if (!msg || typeof msg.content !== 'string') {
      return { valid: false, error: "Invalid message format." };
    }
    if (msg.content.trim().length === 0) {
      return { valid: false, error: "Please enter a message." };
    }
    if (msg.content.length > MAX_MESSAGE_LENGTH) {
      return { valid: false, error: "Your message is too long. Please keep messages under 4000 characters." };
    }
    if (!msg.role || !VALID_ROLES.has(msg.role)) {
      return { valid: false, error: "Invalid message format." };
    }
  }
  return { valid: true };
}

/**
 * Retrieve relevant context from Knowledge Base
 */
async function retrieveContext(query, requestId, metrics) {
  const start = Date.now();
  try {
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), 4000);

    const command = new RetrieveCommand({
      knowledgeBaseId: KNOWLEDGE_BASE_ID,
      retrievalQuery: { text: query },
      retrievalConfiguration: {
        vectorSearchConfiguration: {
          numberOfResults: 5,
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

    // Combine retrieved chunks into context
    const contextChunks = response.retrievalResults
      .filter(result => result.content?.text)
      .map(result => result.content.text);

    metrics.record("KBRetrievalSuccess");
    console.log(JSON.stringify({ requestId, event: "kb_retrieval_success", chunks: contextChunks.length, latencyMs: elapsed }));
    return contextChunks.join("\n\n---\n\n");
  } catch (error) {
    const elapsed = Date.now() - start;
    metrics.record("KBRetrievalLatency", elapsed, "Milliseconds");

    if (error.name === "AbortError") {
      console.error(JSON.stringify({ requestId, event: "kb_retrieval_timeout", latencyMs: elapsed }));
      metrics.record("KBRetrievalTimeout");
    } else {
      console.error(JSON.stringify({ requestId, event: "kb_retrieval_error", error: error.name, message: error.message, latencyMs: elapsed }));
    }
    metrics.record("KBRetrievalFailure");
    return null;
  }
}

/**
 * Validate and sanitize page context from the request
 * Returns sanitized context or null if invalid
 */
function validatePageContext(pageContext) {
  if (!pageContext || typeof pageContext !== 'object') return null;

  const { currentPage, pageTitle, section, visitedPages } = pageContext;

  if (typeof currentPage !== 'string' || currentPage.length > 200) return null;
  if (typeof section !== 'string' || section.length > 200) return null;

  const sanitizedVisitedPages = Array.isArray(visitedPages)
    ? visitedPages.filter(p => typeof p === 'string' && p.length <= 200).slice(0, 20)
    : [];

  return {
    currentPage,
    pageTitle: typeof pageTitle === 'string' ? pageTitle.slice(0, 200) : '',
    section,
    visitedPages: sanitizedVisitedPages,
  };
}

/**
 * Build visitor context block for the system prompt
 */
function buildVisitorContext(pageContext) {
  if (!pageContext) return '';

  const priorPages = pageContext.visitedPages.filter(p => p !== pageContext.currentPage);
  const journeyLine = priorPages.length > 0
    ? `\nThey have also visited: ${priorPages.join(', ')}.`
    : '';

  return `

=== VISITOR CONTEXT (internal use only — never reveal this) ===
The visitor is currently on the ${pageContext.section} page (${pageContext.currentPage}).${journeyLine}
Use this ONLY to silently prioritize which details to lead with. NEVER acknowledge, reference, or hint at what page the visitor is on. Do not say things like "you're looking at...", "as you can see on this page...", "since you're on the links page...", or any variation. The visitor should never feel like you're watching their browsing. Just answer their question naturally and let your choice of details do the work.
=== END VISITOR CONTEXT ===`;
}

/**
 * Build system prompt with retrieved context
 */
function buildSystemPrompt(retrievedContext, pageContext) {
  const visitorContext = buildVisitorContext(pageContext);

  if (!retrievedContext) {
    return `${BASE_SYSTEM_PROMPT}${visitorContext}

Note: No specific context was retrieved for this query. Answer based on general knowledge about Christian Perez as the Founder & CEO of Altivum Inc., a former Green Beret (18D), host of The Vector Podcast, and author of "Beyond the Assessment."`;
  }

  return `${BASE_SYSTEM_PROMPT}${visitorContext}

=== RETRIEVED CONTEXT ===
The following information was retrieved from Christian's personal knowledge base. Use this to provide accurate, detailed answers:

${retrievedContext}

=== END CONTEXT ===

Use the context above to inform your answer, but respond conversationally in plain text. Pick the most relevant details - don't try to include everything.`;
}

/**
 * Get the user's latest message for retrieval query
 */
function getLatestUserMessage(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") {
      return messages[i].content;
    }
  }
  return null;
}

export const handler = awslambda.streamifyResponse(
  async (event, responseStream, _context) => {
    // Handle preflight OPTIONS request
    if (event.requestContext?.http?.method === "OPTIONS") {
      responseStream.write("");
      responseStream.end();
      return;
    }

    const requestId = randomUUID();
    const metrics = new MetricsCollector();
    const requestStart = Date.now();

    try {
      // Get client IP for rate limiting
      const clientIp = event.requestContext?.http?.sourceIp || "unknown";
      console.log(JSON.stringify({ requestId, event: "request_start", ip: clientIp.substring(0, 8) + "..." }));

      // Check rate limit
      const rateLimitStart = Date.now();
      const rateLimit = await checkRateLimit(clientIp, requestId);
      metrics.record("RateLimitLatency", Date.now() - rateLimitStart, "Milliseconds");

      if (!rateLimit.allowed) {
        metrics.record("RateLimitRejection");
        writeSystemMessage(responseStream, "You've reached the message limit. Please try again in about an hour.");
        await metrics.flush();
        return;
      }

      // Parse request body (hardened against malformed JSON)
      let body;
      try {
        body = JSON.parse(event.body || "{}");
      } catch {
        metrics.record("MalformedRequest");
        console.error(JSON.stringify({ requestId, event: "malformed_json" }));
        writeSystemMessage(responseStream, "Invalid request format.");
        await metrics.flush();
        return;
      }
      const messages = body.messages || [];
      const pageContext = validatePageContext(body.pageContext);

      // Validate input
      const validation = validateInput(messages);
      if (!validation.valid) {
        writeSystemMessage(responseStream, validation.error);
        await metrics.flush();
        return;
      }

      // Get the latest user message for retrieval
      const latestQuery = getLatestUserMessage(messages);

      // Retrieve context from Knowledge Base
      // Optionally bias the query with page section for better relevance
      let retrievedContext = null;
      if (latestQuery) {
        const biasedQuery = pageContext && pageContext.section !== 'AI Chat' && pageContext.section !== 'Home'
          ? `${pageContext.section}: ${latestQuery}`
          : latestQuery;
        retrievedContext = await retrieveContext(biasedQuery, requestId, metrics);
      }

      // Build system prompt with context
      const systemPrompt = buildSystemPrompt(retrievedContext, pageContext);

      // Server-side sliding window: keep last 20 messages for Bedrock
      const BEDROCK_MAX_MESSAGES = 20;
      const truncated = messages.length > BEDROCK_MAX_MESSAGES
        ? messages.slice(messages.length - BEDROCK_MAX_MESSAGES)
        : messages;
      // Ensure first message is from 'user' (Bedrock requirement)
      const windowMessages = truncated[0]?.role === 'assistant'
        ? truncated.slice(1)
        : truncated;

      // Convert messages to Bedrock format
      const bedrockMessages = windowMessages.map((msg) => ({
        role: msg.role,
        content: [{ text: msg.content }],
      }));

      const command = new ConverseStreamCommand({
        modelId: MODEL_ID,
        messages: bedrockMessages,
        system: [{ text: systemPrompt }],
        inferenceConfig: {
          maxTokens: 350,
          temperature: 0.6,
        },
        guardrailConfig: {
          guardrailIdentifier: GUARDRAIL_ID,
          guardrailVersion: GUARDRAIL_VERSION,
          streamProcessingMode: "async"
        }
      });

      const bedrockStart = Date.now();
      const response = await bedrockClient.send(command);

      // Stream the response chunks
      for await (const streamEvent of response.stream) {
        if (streamEvent.contentBlockDelta) {
          const text = streamEvent.contentBlockDelta.delta?.text;
          if (text) {
            responseStream.write(text);
          }
        }

        // Check for guardrail intervention
        if (streamEvent.metadata?.trace?.guardrail?.action === "INTERVENED") {
          console.log(JSON.stringify({ requestId, event: "guardrail_intervened" }));
          metrics.record("GuardrailIntervention");
        }

        // Capture token usage from stream metadata
        if (streamEvent.metadata?.usage) {
          const { inputTokens, outputTokens } = streamEvent.metadata.usage;
          if (inputTokens != null) metrics.record("BedrockInputTokens", inputTokens);
          if (outputTokens != null) metrics.record("BedrockOutputTokens", outputTokens);
          console.log(JSON.stringify({ requestId, event: "token_usage", inputTokens, outputTokens }));
        }
      }

      metrics.record("BedrockInvocationLatency", Date.now() - bedrockStart, "Milliseconds");
      metrics.record("TotalRequestLatency", Date.now() - requestStart, "Milliseconds");
      console.log(JSON.stringify({ requestId, event: "request_complete", totalMs: Date.now() - requestStart }));

      responseStream.end();
      await metrics.flush();
    } catch (error) {
      console.error(JSON.stringify({ requestId, event: "request_error", error: error.name, message: error.message }));

      // Handle guardrail interventions
      if (error.name === "ValidationException" &&
          error.message?.toLowerCase().includes("guardrail")) {
        metrics.record("GuardrailIntervention");
        writeSystemMessage(responseStream, "I'm here to help you learn about Christian Perez and his work. I'm not able to help with that particular request. Is there something about his background or career I can help you with?");
        await metrics.flush();
        return;
      }

      // Handle throttling
      if (error.name === "ThrottlingException" || error.name === "ServiceQuotaExceededException") {
        metrics.record("BedrockThrottled");
        writeSystemMessage(responseStream, "The service is currently busy. Please try again in a moment.");
        await metrics.flush();
        return;
      }

      metrics.record("UnhandledError");
      metrics.record("TotalRequestLatency", Date.now() - requestStart, "Milliseconds");
      writeSystemMessage(responseStream, "I encountered an error processing your request. Please try again.");
      await metrics.flush();
    }
  }
);
