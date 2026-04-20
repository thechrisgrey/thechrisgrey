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
import { CloudWatchClient } from "@aws-sdk/client-cloudwatch";
import { randomUUID } from "crypto";
import { checkRateLimit } from "lambda-shared/rateLimit";

import { verifySignature } from "./hmac.mjs";
import { validateInput, validatePageContext, getLatestUserMessage } from "./validation.mjs";
import { buildSystemPrompt } from "./prompts.mjs";
import { MetricsCollector } from "./metrics.mjs";
import { retrieveContext } from "./kbRetrieve.mjs";

const bedrockClient = new BedrockRuntimeClient({ region: "us-east-1" });
const agentClient = new BedrockAgentRuntimeClient({ region: "us-east-1" });
const dynamoClient = new DynamoDBClient({ region: "us-east-1" });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const cloudwatchClient = new CloudWatchClient({ region: "us-east-1" });

const MODEL_ID = "us.anthropic.claude-haiku-4-5-20251001-v1:0";
const KNOWLEDGE_BASE_ID = "ARFYABW8HP";
const GUARDRAIL_ID = "5kofhp46ssob";
const GUARDRAIL_VERSION = "5";
const SYSTEM_MESSAGE_PREFIX = "\x00SYS\x00";
const SIGNING_KEY = process.env.CHAT_SIGNING_KEY || "";
const BEDROCK_MAX_MESSAGES = 20;

if (!SIGNING_KEY) {
  console.warn(JSON.stringify({
    event: "startup_warning",
    message: "CHAT_SIGNING_KEY not set — HMAC signature verification is DISABLED",
  }));
}

function writeSystemMessage(responseStream, message) {
  responseStream.write(SYSTEM_MESSAGE_PREFIX + message);
  responseStream.end();
}

export const handler = awslambda.streamifyResponse(
  async (event, responseStream, _context) => {
    if (event.requestContext?.http?.method === "OPTIONS") {
      responseStream.write("");
      responseStream.end();
      return;
    }

    const requestId = randomUUID();
    const metrics = new MetricsCollector(cloudwatchClient);
    const requestStart = Date.now();

    const sigResult = verifySignature(event, SIGNING_KEY);
    if (!sigResult.valid) {
      metrics.record("SignatureRejection");
      console.log(JSON.stringify({ requestId, event: "signature_rejected", reason: sigResult.error }));
      writeSystemMessage(responseStream, "Unable to process request.");
      await metrics.flush();
      return;
    }

    try {
      const clientIp = event.requestContext?.http?.sourceIp || "unknown";
      console.log(JSON.stringify({ requestId, event: "request_start", ip: clientIp.substring(0, 8) + "..." }));

      const rateLimitStart = Date.now();
      const rateLimit = await checkRateLimit(docClient, UpdateCommand, {
        table: "thechrisgrey-chat-ratelimit",
        ip: clientIp,
        maxRequests: 20,
        windowSeconds: 3600,
        ttlBuffer: 3600,
        requestId,
      });
      metrics.record("RateLimitLatency", Date.now() - rateLimitStart, "Milliseconds");

      if (!rateLimit.allowed) {
        metrics.record("RateLimitRejection");
        writeSystemMessage(responseStream, "You've reached the message limit. Please try again in about an hour.");
        await metrics.flush();
        return;
      }

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

      const validation = validateInput(messages);
      if (!validation.valid) {
        writeSystemMessage(responseStream, validation.error);
        await metrics.flush();
        return;
      }

      const latestQuery = getLatestUserMessage(messages);

      let retrievedContext = null;
      if (latestQuery) {
        const biasedQuery = pageContext && pageContext.section !== "AI Chat" && pageContext.section !== "Home"
          ? `${pageContext.section}: ${latestQuery}`
          : latestQuery;
        retrievedContext = await retrieveContext(agentClient, RetrieveCommand, biasedQuery, {
          knowledgeBaseId: KNOWLEDGE_BASE_ID,
          requestId,
          metrics,
          timeoutMs: 4000,
          numberOfResults: 5,
        });
      }

      const systemPrompt = buildSystemPrompt(retrievedContext, pageContext);

      const truncated = messages.length > BEDROCK_MAX_MESSAGES
        ? messages.slice(messages.length - BEDROCK_MAX_MESSAGES)
        : messages;
      const windowMessages = truncated[0]?.role === "assistant"
        ? truncated.slice(1)
        : truncated;

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
          streamProcessingMode: "async",
        },
      });

      const bedrockStart = Date.now();
      const bedrockAbort = new AbortController();
      const bedrockTimeout = setTimeout(() => bedrockAbort.abort(), 10_000);
      const response = await bedrockClient.send(command, {
        abortSignal: bedrockAbort.signal,
      });

      for await (const streamEvent of response.stream) {
        if (streamEvent.contentBlockDelta) {
          const text = streamEvent.contentBlockDelta.delta?.text;
          if (text) {
            responseStream.write(text);
          }
        }

        if (streamEvent.metadata?.trace?.guardrail?.action === "INTERVENED") {
          console.log(JSON.stringify({ requestId, event: "guardrail_intervened_stream" }));
          metrics.record("GuardrailInterventionStream");
          writeSystemMessage(responseStream, "I'm here to help you learn about Christian Perez and his work. I'm not able to help with that particular request. Is there something about his background or career I can help you with?");
          await metrics.flush();
          return;
        }

        if (streamEvent.metadata?.usage) {
          const { inputTokens, outputTokens } = streamEvent.metadata.usage;
          if (inputTokens != null) metrics.record("BedrockInputTokens", inputTokens);
          if (outputTokens != null) metrics.record("BedrockOutputTokens", outputTokens);
          console.log(JSON.stringify({ requestId, event: "token_usage", inputTokens, outputTokens }));
        }
      }

      clearTimeout(bedrockTimeout);
      metrics.record("BedrockInvocationLatency", Date.now() - bedrockStart, "Milliseconds");
      metrics.record("TotalRequestLatency", Date.now() - requestStart, "Milliseconds");
      console.log(JSON.stringify({ requestId, event: "request_complete", totalMs: Date.now() - requestStart }));

      responseStream.end();
      await metrics.flush();
    } catch (error) {
      console.error(JSON.stringify({ requestId, event: "request_error", error: error.name, message: error.message }));

      if (error.name === "AbortError") {
        metrics.record("BedrockTimeout");
        writeSystemMessage(responseStream, "The response is taking too long. Please try again.");
        await metrics.flush();
        return;
      }

      if (error.name === "ValidationException" &&
          error.message?.toLowerCase().includes("guardrail")) {
        console.log(JSON.stringify({ requestId, event: "guardrail_intervened_prestream" }));
        metrics.record("GuardrailInterventionPreStream");
        writeSystemMessage(responseStream, "I'm here to help you learn about Christian Perez and his work. I'm not able to help with that particular request. Is there something about his background or career I can help you with?");
        await metrics.flush();
        return;
      }

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
