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
import { createHash } from "crypto";

const bedrockClient = new BedrockRuntimeClient({ region: "us-east-1" });
const agentClient = new BedrockAgentRuntimeClient({ region: "us-east-1" });
const dynamoClient = new DynamoDBClient({ region: "us-east-1" });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const MODEL_ID = "us.anthropic.claude-haiku-4-5-20251001-v1:0";
const KNOWLEDGE_BASE_ID = "ARFYABW8HP";
const GUARDRAIL_ID = "5kofhp46ssob";
const GUARDRAIL_VERSION = "1";
const RATE_LIMIT_TABLE = "thechrisgrey-chat-ratelimit";
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW = 3600; // 1 hour in seconds

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
async function checkRateLimit(ip) {
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
    console.error("Rate limit error:", error);
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
async function retrieveContext(query) {
  try {
    const command = new RetrieveCommand({
      knowledgeBaseId: KNOWLEDGE_BASE_ID,
      retrievalQuery: { text: query },
      retrievalConfiguration: {
        vectorSearchConfiguration: {
          numberOfResults: 5,
        },
      },
    });

    const response = await agentClient.send(command);

    if (!response.retrievalResults || response.retrievalResults.length === 0) {
      return null;
    }

    // Combine retrieved chunks into context
    const contextChunks = response.retrievalResults
      .filter(result => result.content?.text)
      .map(result => result.content.text);

    return contextChunks.join("\n\n---\n\n");
  } catch (error) {
    console.error("Knowledge Base retrieval error:", error);
    return null;
  }
}

/**
 * Build system prompt with retrieved context
 */
function buildSystemPrompt(retrievedContext) {
  if (!retrievedContext) {
    return `${BASE_SYSTEM_PROMPT}

Note: No specific context was retrieved for this query. Answer based on general knowledge about Christian Perez as the Founder & CEO of Altivum Inc., a former Green Beret (18D), host of The Vector Podcast, and author of "Beyond the Assessment."`;
  }

  return `${BASE_SYSTEM_PROMPT}

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

    try {
      // Get client IP for rate limiting
      const clientIp = event.requestContext?.http?.sourceIp ||
                       event.headers?.["x-forwarded-for"]?.split(",")[0] ||
                       "unknown";

      // Check rate limit
      const rateLimit = await checkRateLimit(clientIp);
      if (!rateLimit.allowed) {
        responseStream.write("You've reached the message limit. Please try again in about an hour.");
        responseStream.end();
        return;
      }

      // Parse request body
      const body = JSON.parse(event.body || "{}");
      const messages = body.messages || [];

      // Validate input
      const validation = validateInput(messages);
      if (!validation.valid) {
        responseStream.write(validation.error);
        responseStream.end();
        return;
      }

      // Get the latest user message for retrieval
      const latestQuery = getLatestUserMessage(messages);

      // Retrieve context from Knowledge Base
      let retrievedContext = null;
      if (latestQuery) {
        retrievedContext = await retrieveContext(latestQuery);
      }

      // Build system prompt with context
      const systemPrompt = buildSystemPrompt(retrievedContext);

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

      const response = await bedrockClient.send(command);

      // Stream the response chunks
      for await (const event of response.stream) {
        if (event.contentBlockDelta) {
          const text = event.contentBlockDelta.delta?.text;
          if (text) {
            responseStream.write(text);
          }
        }

        // Check for guardrail intervention
        if (event.metadata?.trace?.guardrail?.action === "INTERVENED") {
          console.log("Guardrail intervened:", JSON.stringify(event.metadata.trace.guardrail));
        }
      }

      responseStream.end();
    } catch (error) {
      console.error("Error:", error);

      // Handle guardrail interventions
      if (error.name === "ValidationException" &&
          error.message?.toLowerCase().includes("guardrail")) {
        responseStream.write("I'm here to help you learn about Christian Perez and his work. I'm not able to help with that particular request. Is there something about his background or career I can help you with?");
        responseStream.end();
        return;
      }

      // Handle throttling
      if (error.name === "ThrottlingException" || error.name === "ServiceQuotaExceededException") {
        responseStream.write("The service is currently busy. Please try again in a moment.");
        responseStream.end();
        return;
      }

      responseStream.write(
        "I apologize, but I encountered an error processing your request. Please try again."
      );
      responseStream.end();
    }
  }
);
