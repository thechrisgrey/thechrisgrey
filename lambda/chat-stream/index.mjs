import {
  BedrockAgentRuntimeClient,
  RetrieveCommand,
} from "@aws-sdk/client-bedrock-agent-runtime";
import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  BatchWriteCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { CloudWatchClient } from "@aws-sdk/client-cloudwatch";
import { createClient as createSanityClient } from "@sanity/client";
import { randomUUID } from "crypto";
import { checkRateLimit } from "lambda-shared/rateLimit";

import { authenticateRequest } from "lambda-shared/requestAuth";
import { MetricsCollector } from "lambda-shared/metrics";
import { validateInput, validatePageContext, getLatestUserMessage } from "./validation.mjs";
import { buildSystemPrompt } from "./prompts.mjs";
import { retrieveContext } from "./kbRetrieve.mjs";
import { buildBedrockModel, buildAgent, streamAgentResponse } from "./agent.mjs";
import { buildTools } from "./tools/index.mjs";
import { getFacts, forgetDevice } from "./memory.mjs";
import { emitEvent, EVENT_KINDS } from "./events.mjs";
import { detectGenUiIntent, renderGenUi } from "./genUi.mjs";

const agentClient = new BedrockAgentRuntimeClient({ region: "us-east-1" });
const bedrockRuntimeClient = new BedrockRuntimeClient({ region: "us-east-1" });
const dynamoClient = new DynamoDBClient({ region: "us-east-1" });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const cloudwatchClient = new CloudWatchClient({ region: "us-east-1" });

const sanityProjectId = process.env.SANITY_PROJECT_ID || "k5950b3w";
const sanityDataset = process.env.SANITY_DATASET || "production";
const sanityClient = sanityProjectId
  ? createSanityClient({
      projectId: sanityProjectId,
      dataset: sanityDataset,
      apiVersion: process.env.SANITY_API_VERSION || "2024-01-01",
      useCdn: true,
      timeout: 4000,
    })
  : null;

const MODEL_ID = "us.anthropic.claude-haiku-4-5-20251001-v1:0";
const KNOWLEDGE_BASE_ID = "ARFYABW8HP";
const PODCAST_KNOWLEDGE_BASE_ID = process.env.PODCAST_KB_ID || "";
const GUARDRAIL_ID = "5kofhp46ssob";
const GUARDRAIL_VERSION = "5";
const SYSTEM_MESSAGE_PREFIX = "\x00SYS\x00";
const SIGNING_KEY = process.env.CHAT_SIGNING_KEY || "";
const SESSION_TOKEN_KEY = process.env.SESSION_TOKEN_KEY || "";
const BEDROCK_MAX_MESSAGES = 20;
const DEVICE_ID_PATTERN = /^[a-zA-Z0-9_-]{8,64}$/;

if (!SESSION_TOKEN_KEY && !SIGNING_KEY) {
  console.warn(JSON.stringify({
    event: "startup_warning",
    message: "Neither SESSION_TOKEN_KEY nor CHAT_SIGNING_KEY set — request authentication is DISABLED",
  }));
}

function writeSystemMessage(responseStream, message) {
  responseStream.write(SYSTEM_MESSAGE_PREFIX + message);
  responseStream.end();
}

function validateDeviceId(raw) {
  if (typeof raw !== "string") return null;
  if (!DEVICE_ID_PATTERN.test(raw)) return null;
  return raw;
}

function toStrandsMessages(messages) {
  const truncated = messages.length > BEDROCK_MAX_MESSAGES
    ? messages.slice(messages.length - BEDROCK_MAX_MESSAGES)
    : messages;
  const windowed = truncated[0]?.role === "assistant"
    ? truncated.slice(1)
    : truncated;

  if (windowed.length === 0) return { history: [], latest: null };

  const latest = windowed[windowed.length - 1];
  if (latest.role !== "user") return { history: [], latest: null };

  const historyRaw = windowed.slice(0, -1);
  const history = historyRaw.map((msg) => ({
    role: msg.role,
    content: [{ text: msg.content }],
  }));

  return { history, latest: latest.content };
}

function writeForgetResult(responseStream, payload) {
  responseStream.write(JSON.stringify(payload));
  responseStream.end();
}

async function handleForget(event, responseStream, requestId, metrics) {
  try {
    const body = JSON.parse(event.body || "{}");
    const deviceId = validateDeviceId(body.deviceId);
    if (!deviceId) {
      metrics.record("ForgetRejection_InvalidDevice");
      writeForgetResult(responseStream, { ok: false, error: "Invalid request." });
      await metrics.flush();
      return;
    }
    const { deleted } = await forgetDevice(docClient, QueryCommand, BatchWriteCommand, deviceId);
    metrics.record("MemoryForget");
    metrics.record("MemoryForgetDeleted", deleted);
    console.log(JSON.stringify({ requestId, event: "memory_forget", deleted }));
    writeForgetResult(responseStream, { ok: true, deleted });
    await metrics.flush();
  } catch (error) {
    console.error(JSON.stringify({
      requestId,
      event: "forget_error",
      error: error.name,
      message: error.message,
    }));
    metrics.record("ForgetFailure");
    writeForgetResult(responseStream, { ok: false, error: "Unable to clear memory right now." });
    await metrics.flush();
  }
}

export const handler = awslambda.streamifyResponse(
  async (event, responseStream, _context) => {
    if (event.requestContext?.http?.method === "OPTIONS") {
      responseStream.write("");
      responseStream.end();
      return;
    }

    const requestId = randomUUID();
    const metrics = new MetricsCollector(cloudwatchClient, "TheChrisGrey/SiteMetrics");
    const requestStart = Date.now();

    // Accept EITHER a server-issued session token (new model) OR the legacy
    // request-body HMAC signature (transition window). See lambda-shared/requestAuth.
    const auth = authenticateRequest(event, {
      sessionKey: SESSION_TOKEN_KEY,
      scope: "chat",
      legacyKey: SIGNING_KEY,
    });
    if (!auth.valid) {
      metrics.record("AuthRejection");
      console.log(JSON.stringify({ requestId, event: "auth_rejected", method: auth.method, reason: auth.error }));
      writeSystemMessage(responseStream, "Unable to process request.");
      await metrics.flush();
      return;
    }
    // Watch the legacy path drain to zero before retiring the bundled HMAC key.
    metrics.record(auth.method === "token" ? "AuthSessionToken" : "AuthLegacySignature");

    const rawPath = event.rawPath || event.requestContext?.http?.path || "/";
    if (rawPath.endsWith("/forget")) {
      await handleForget(event, responseStream, requestId, metrics);
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
      const deviceId = validateDeviceId(body.deviceId);

      const validation = validateInput(messages);
      if (!validation.valid) {
        writeSystemMessage(responseStream, validation.error);
        await metrics.flush();
        return;
      }

      const { history, latest } = toStrandsMessages(messages);
      if (!latest) {
        metrics.record("InvalidLatestMessage");
        writeSystemMessage(responseStream, "Please send a message to start our conversation.");
        await metrics.flush();
        return;
      }

      const latestQuery = getLatestUserMessage(messages) || latest;

      let facts = [];
      if (deviceId) {
        const memStart = Date.now();
        try {
          facts = await getFacts(docClient, QueryCommand, deviceId);
          metrics.record("MemoryLoadLatency", Date.now() - memStart, "Milliseconds");
          metrics.record("MemoryFactsLoaded", facts.length);
        } catch (err) {
          metrics.record("MemoryLoadFailure");
          console.error(JSON.stringify({
            requestId,
            event: "memory_load_failure",
            error: err.name,
            message: err.message,
          }));
          facts = [];
        }
      }

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

      // Generative UI (render_ui) is gated to the dedicated /chat page only — never
      // the floating widget, which reports the host page's path. The system prompt
      // only advertises render_ui on that surface, matching the registered tools.
      // currentPage is already trailing-slash-normalized by validatePageContext, so
      // prod's "/chat/" resolves here as "/chat" (see normalizePath in validation.mjs).
      const surface = pageContext?.currentPage === "/chat" ? "page" : "widget";

      // Explicit "gen-ui" command → deterministic visual answer: force the render_ui
      // tool on Opus and emit the block(s), bypassing the conversational agent. The
      // visitor asked for a visual, so we never leave it to the model's discretion.
      // Gated to the /chat surface (matches render_ui availability).
      if (surface === "page" && detectGenUiIntent(latestQuery)) {
        metrics.record("GenUiRequested");
        const genUiAbort = new AbortController();
        const genUiTimer = setTimeout(() => genUiAbort.abort(), 20_000);
        try {
          const genUiResult = await renderGenUi({
            bedrockClient: bedrockRuntimeClient,
            ConverseCommand,
            userMessage: latestQuery,
            retrievedContext: retrievedContext || "",
            responseStream,
            metrics,
            requestId,
            abortSignal: genUiAbort.signal,
          });
          if (!genUiResult.ok) {
            writeSystemMessage(responseStream, "I couldn't compose that visual just now. Try rephrasing, or ask me to describe it in words instead.");
          }
        } finally {
          clearTimeout(genUiTimer);
        }
        responseStream.end();
        await metrics.flush();
        return;
      }

      const systemPrompt = buildSystemPrompt(retrievedContext, pageContext, facts, surface);

      const tools = buildTools({
        responseStream,
        metrics,
        sanityClient,
        agentClient,
        RetrieveCommand,
        podcastKbId: PODCAST_KNOWLEDGE_BASE_ID,
        docClient,
        PutCommand,
        deviceId,
        surface,
        requestId,
      });

      const model = buildBedrockModel({
        modelId: MODEL_ID,
        region: "us-east-1",
        guardrailId: GUARDRAIL_ID,
        guardrailVersion: GUARDRAIL_VERSION,
        maxTokens: 500,
        temperature: 0.6,
      });

      const agent = buildAgent({
        model,
        tools,
        systemPrompt,
        messages: history,
        name: "Alti",
      });

      const agentStart = Date.now();
      const agentAbort = new AbortController();
      const agentTimeout = setTimeout(() => agentAbort.abort(), 25_000);

      let result;
      try {
        result = await streamAgentResponse({
          agent,
          userMessage: latest,
          responseStream,
          cancelSignal: agentAbort.signal,
          metrics,
        });
      } finally {
        clearTimeout(agentTimeout);
      }

      metrics.record("AgentInvocationLatency", Date.now() - agentStart, "Milliseconds");

      if (result.usage) {
        if (result.usage.inputTokens != null) metrics.record("BedrockInputTokens", result.usage.inputTokens);
        if (result.usage.outputTokens != null) metrics.record("BedrockOutputTokens", result.usage.outputTokens);
        console.log(JSON.stringify({
          requestId,
          event: "token_usage",
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
        }));
      }

      if (result.guardrailIntervened) {
        metrics.record("GuardrailInterventionStream");
        console.log(JSON.stringify({ requestId, event: "guardrail_intervened" }));
        if (!result.hadText) {
          writeSystemMessage(
            responseStream,
            "I'm here to help you learn about Christian Perez and his work. I'm not able to help with that particular request. Is there something about his background or career I can help you with?",
          );
          await metrics.flush();
          return;
        }
      }

      if (!result.hadText) {
        emitEvent(responseStream, {
          kind: EVENT_KINDS.GUARDRAIL,
          reason: "empty_response",
          stopReason: result.stopReason || "unknown",
        });
        writeSystemMessage(responseStream, "I couldn't put together a response just now. Mind rephrasing?");
        await metrics.flush();
        return;
      }

      metrics.record("TotalRequestLatency", Date.now() - requestStart, "Milliseconds");
      console.log(JSON.stringify({ requestId, event: "request_complete", totalMs: Date.now() - requestStart }));

      responseStream.end();
      await metrics.flush();
    } catch (error) {
      console.error(JSON.stringify({
        requestId,
        event: "request_error",
        error: error.name,
        message: error.message,
      }));

      if (error.name === "AbortError") {
        metrics.record("AgentTimeout");
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
  },
);
