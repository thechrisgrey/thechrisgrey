import {
  BedrockRuntimeClient,
  ConverseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";
import {
  BedrockAgentRuntimeClient,
  RetrieveCommand,
} from "@aws-sdk/client-bedrock-agent-runtime";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
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
const BASE_SYSTEM_PROMPT = `You are an AI assistant representing Christian Perez (also known as @thechrisgrey). You help visitors learn about his background, work, and expertise.

CRITICAL FORMATTING RULES:
- Write in plain text only. NO markdown formatting whatsoever.
- Do NOT use **bold**, *italics*, headers, or bullet points/lists.
- Write in natural flowing paragraphs, like a conversation.
- Keep responses concise: 2-3 sentences for simple questions, 4-6 sentences max for complex topics.
- Be direct and get to the point quickly.

Your tone:
- Conversational and friendly, like chatting with someone
- Knowledgeable but not preachy or lecture-like
- Warm and approachable

Guidelines:
- Answer questions about Christian's background, Altivum, the podcast, and his book
- Synthesize information naturally - don't list every detail from the context
- Use your general knowledge to supplement context when relevant (e.g., explaining AWS programs, industry concepts, military terms)
- Never fabricate details about Christian specifically - but you can provide general information about topics he's involved with
- If asked about unrelated topics, briefly redirect to what you do know about Christian
- You can mention visiting the website for more details`;

/**
 * Check rate limit for an IP address
 * Returns { allowed: boolean, remaining: number }
 */
async function checkRateLimit(ip) {
  const ipHash = createHash('sha256').update(ip || 'unknown').digest('hex');
  const now = Math.floor(Date.now() / 1000);

  try {
    const result = await docClient.send(new GetCommand({
      TableName: RATE_LIMIT_TABLE,
      Key: { pk: ipHash }
    }));

    const item = result.Item;

    if (item && (now - item.windowStart) < RATE_LIMIT_WINDOW) {
      // Within current window
      if (item.requestCount >= RATE_LIMIT_MAX) {
        return { allowed: false, remaining: 0 };
      }

      // Increment counter
      await docClient.send(new PutCommand({
        TableName: RATE_LIMIT_TABLE,
        Item: {
          pk: ipHash,
          requestCount: item.requestCount + 1,
          windowStart: item.windowStart,
          ttl: item.windowStart + RATE_LIMIT_WINDOW + 3600 // Extra hour buffer for TTL
        }
      }));

      return { allowed: true, remaining: RATE_LIMIT_MAX - item.requestCount - 1 };
    }

    // New window - reset counter
    await docClient.send(new PutCommand({
      TableName: RATE_LIMIT_TABLE,
      Item: {
        pk: ipHash,
        requestCount: 1,
        windowStart: now,
        ttl: now + RATE_LIMIT_WINDOW + 3600
      }
    }));

    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  } catch (error) {
    console.error("Rate limit error:", error);
    // Fail open - allow request if rate limiting fails
    return { allowed: true, remaining: -1 };
  }
}

/**
 * Validate input messages
 * Returns { valid: boolean, error?: string }
 */
function validateInput(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return { valid: false, error: "Please send a message to start our conversation." };
  }

  for (const msg of messages) {
    if (!msg || typeof msg.content !== 'string') {
      return { valid: false, error: "Invalid message format." };
    }
    if (msg.content.trim().length === 0) {
      return { valid: false, error: "Please enter a message." };
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

      // Convert messages to Bedrock format
      const bedrockMessages = messages.map((msg) => ({
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
