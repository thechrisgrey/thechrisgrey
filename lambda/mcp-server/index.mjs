import crypto from "node:crypto";
import { createClient as createSanityClient } from "@sanity/client";
import { BedrockAgentRuntimeClient, RetrieveCommand } from "@aws-sdk/client-bedrock-agent-runtime";
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { checkRateLimit } from "lambda-shared/rateLimit";
import { createLogger } from "lambda-shared/logger";
import { MetricsCollector } from "lambda-shared/metrics";
import { CloudWatchClient } from "@aws-sdk/client-cloudwatch";
import { buildMcpServer } from "./server.mjs";
import { buildSearchBlogMcpTool } from "./tools/searchBlog.mjs";
import { buildGetBlogPostMcpTool } from "./tools/getBlogPost.mjs";
import { buildAskAltiMcpTool } from "./tools/askAlti.mjs";
import { createKbCache } from "./kbCache.mjs";

const REGION = process.env.AWS_REGION || "us-east-1";
const RATE_LIMIT_TABLE = process.env.CHAT_RATE_LIMIT_TABLE || "thechrisgrey-chat-ratelimit";
const RATE_LIMIT_MAX = Number(process.env.MCP_RATE_LIMIT_MAX || 60);
const RATE_LIMIT_WINDOW_SECONDS = Number(process.env.MCP_RATE_LIMIT_WINDOW || 3600);
const MODEL_ID = process.env.BEDROCK_MODEL_ID || "us.anthropic.claude-haiku-4-5-20251001-v1:0";
const KB_ID = process.env.KB_ID || "";
const GUARDRAIL_ID = process.env.GUARDRAIL_ID || "";
const GUARDRAIL_VERSION = process.env.GUARDRAIL_VERSION || "";
const SANITY_PROJECT_ID = process.env.SANITY_PROJECT_ID || "";
const SANITY_DATASET = process.env.SANITY_DATASET || "production";

const CORS_ORIGIN = "*";

// Long-lived clients (reused across invocations within a warm Lambda container).
const ddbBase = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(ddbBase);
const bedrockClient = new BedrockRuntimeClient({ region: REGION });
const agentClient = new BedrockAgentRuntimeClient({ region: REGION });
const cloudwatchClient = new CloudWatchClient({ region: REGION });
const sanityClient = SANITY_PROJECT_ID
  ? createSanityClient({
      projectId: SANITY_PROJECT_ID,
      dataset: SANITY_DATASET,
      apiVersion: "2024-10-01",
      useCdn: true,
      timeout: 10000,
    })
  : null;
const kbCache = createKbCache();

// CloudWatch metrics via the shared MetricsCollector (same pattern as
// chat-stream and blueprint). The namespace is dedicated so MCP alarms
// are isolated from other services.
const METRICS_NAMESPACE = "TheChrisGrey/McpServer";

function hashIp(ip) {
  return crypto.createHash("sha256").update(ip).digest("hex").slice(0, 24);
}

function parseBody(raw) {
  if (!raw) return null;
  try {
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return undefined; // explicit: malformed body
  }
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": CORS_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Mcp-Protocol-Version",
    "Access-Control-Max-Age": "86400",
  };
}

function jsonRpcResponse(status, payload) {
  return {
    statusCode: status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(),
    },
    body: JSON.stringify(payload),
  };
}

export const handler = async (event) => {
  const method = event?.requestContext?.http?.method || "POST";
  const path = event?.rawPath || "/";
  const requestId = event?.requestContext?.requestId || crypto.randomUUID();
  const log = createLogger(requestId, { service: "mcp-server" });
  const metrics = new MetricsCollector(cloudwatchClient, METRICS_NAMESPACE);

  // CORS preflight
  if (method === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders(), body: "" };
  }

  // Health probe (handy for monitoring and Route 53 health checks).
  if (method === "GET" && path === "/health") {
    return jsonRpcResponse(200, { ok: true, server: "alti-mcp", version: "1.0.0" });
  }

  if (method !== "POST") {
    return jsonRpcResponse(405, {
      jsonrpc: "2.0",
      id: null,
      error: { code: -32600, message: "Only POST is accepted on this endpoint." },
    });
  }

  // Rate limit per source IP
  const sourceIp = event?.requestContext?.http?.sourceIp || "unknown";
  try {
    const rlResult = await checkRateLimit(docClient, UpdateCommand, {
      table: RATE_LIMIT_TABLE,
      ip: hashIp(sourceIp),
      prefix: "mcp-",
      maxRequests: RATE_LIMIT_MAX,
      windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
      ttlBuffer: 3600,
      requestId,
    });
    if (rlResult && !rlResult.allowed) {
      metrics.record("McpRateLimitRejection");
      await metrics.flush();
      return jsonRpcResponse(429, {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32000,
          message: "Rate limit exceeded. Try again in an hour.",
          data: { retryAfterSeconds: RATE_LIMIT_WINDOW_SECONDS },
        },
      });
    }
  } catch (err) {
    // Rate limiter fails open per shared implementation; log and proceed.
    log.error("mcp_ratelimit_error", { message: err?.message });
  }

  const body = parseBody(event.body);
  if (body === undefined) {
    return jsonRpcResponse(400, {
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: "Parse error" },
    });
  }
  if (body === null || typeof body !== "object") {
    return jsonRpcResponse(400, {
      jsonrpc: "2.0",
      id: null,
      error: { code: -32600, message: "Invalid request" },
    });
  }

  const tools = [];
  if (sanityClient) {
    tools.push(buildSearchBlogMcpTool({ sanityClient, metrics, requestId }));
    tools.push(buildGetBlogPostMcpTool({ sanityClient, metrics, requestId }));
  }
  tools.push(
    buildAskAltiMcpTool({
      bedrockClient,
      ConverseCommand,
      agentClient,
      RetrieveCommand,
      kbId: KB_ID,
      modelId: MODEL_ID,
      guardrailId: GUARDRAIL_ID,
      guardrailVersion: GUARDRAIL_VERSION,
      kbCache,
      metrics,
      requestId,
    }),
  );

  const server = buildMcpServer({
    tools,
    serverInfo: { name: "alti-mcp", version: "1.0.0" },
  });

  const rpcResponse = await server.handle(body, { requestId, sourceIp });

  // Notifications (null response) should return 202 Accepted per MCP guidance.
  if (rpcResponse === null) {
    await metrics.flush();
    return { statusCode: 202, headers: corsHeaders(), body: "" };
  }

  metrics.record("McpRequestComplete");
  await metrics.flush();
  return jsonRpcResponse(200, rpcResponse);
};
