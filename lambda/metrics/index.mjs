import {
  CloudWatchClient,
  PutMetricDataCommand,
  GetMetricStatisticsCommand,
} from "@aws-sdk/client-cloudwatch";
import {
  CognitoIdentityProviderClient,
  GetUserCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { createHash } from "crypto";

const cloudwatch = new CloudWatchClient({ region: "us-east-1" });
const cognitoClient = new CognitoIdentityProviderClient({ region: "us-east-1" });
const dynamoClient = new DynamoDBClient({ region: "us-east-1" });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const NAMESPACE = "TheChrisGrey/SiteMetrics";
const VALID_VITALS = new Set(["CLS", "INP", "FCP", "LCP", "TTFB"]);
const VALID_RATINGS = new Set(["good", "needs-improvement", "poor"]);

// Standard CSP blocked-uri values reported by browsers
const VALID_CSP_KEYWORDS = new Set(["inline", "eval", "self", "data", "blob", "unknown"]);
const CSP_URI_PATTERN = /^https?:\/\/[\w.-]+$/;

// DynamoDB-based rate limiting (survives cold starts)
const RATE_LIMIT_TABLE = "thechrisgrey-chat-ratelimit";
const RATE_LIMIT_WINDOW = 60; // 1 minute in seconds
const MAX_VITALS_PER_WINDOW = 200;
const MAX_CSP_PER_WINDOW = 100;

const RATE_LIMITS = {
  vitals: MAX_VITALS_PER_WINDOW,
  csp: MAX_CSP_PER_WINDOW,
};

async function checkRateLimit(type, clientIp) {
  const ipHash = createHash("sha256").update(clientIp || "unknown").digest("hex");
  const pk = `metrics-${type}-${ipHash}`;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - (now % RATE_LIMIT_WINDOW);
  const max = RATE_LIMITS[type] || 100;

  try {
    const result = await docClient.send(new UpdateCommand({
      TableName: RATE_LIMIT_TABLE,
      Key: { pk },
      UpdateExpression: "ADD requestCount :inc SET #ttl = :ttl, windowStart = if_not_exists(windowStart, :ws)",
      ConditionExpression: "attribute_not_exists(pk) OR windowStart = :ws",
      ExpressionAttributeNames: { "#ttl": "ttl" },
      ExpressionAttributeValues: {
        ":inc": 1,
        ":ws": windowStart,
        ":ttl": windowStart + RATE_LIMIT_WINDOW + 300,
      },
      ReturnValues: "ALL_NEW",
    }));

    const count = result.Attributes?.requestCount ?? 1;
    return count <= max;
  } catch (error) {
    if (error.name === "ConditionalCheckFailedException") {
      // Stale window — reset counter
      try {
        await docClient.send(new UpdateCommand({
          TableName: RATE_LIMIT_TABLE,
          Key: { pk },
          UpdateExpression: "SET requestCount = :one, windowStart = :ws, #ttl = :ttl",
          ExpressionAttributeNames: { "#ttl": "ttl" },
          ExpressionAttributeValues: {
            ":one": 1,
            ":ws": windowStart,
            ":ttl": windowStart + RATE_LIMIT_WINDOW + 300,
          },
        }));
        return true;
      } catch {
        return true; // Fail open
      }
    }
    console.error("Rate limit error:", error.name);
    return true; // Fail open on DynamoDB errors
  }
}

function respond(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  };
}

async function putMetric(metricName, value, dimensions = []) {
  const command = new PutMetricDataCommand({
    Namespace: NAMESPACE,
    MetricData: [
      {
        MetricName: metricName,
        Value: value,
        Unit: "None",
        Timestamp: new Date(),
        Dimensions: dimensions,
      },
    ],
  });
  await cloudwatch.send(command);
}

async function handleVitals(body) {
  const { name, value, rating } = body;

  if (!name || typeof value !== "number") {
    return respond(400, { error: "name and numeric value are required" });
  }
  if (!Number.isFinite(value) || value < 0 || value > 60000) {
    return respond(400, { error: "value must be a finite number between 0 and 60000" });
  }
  if (!VALID_VITALS.has(name)) {
    return respond(400, { error: `Invalid metric name. Must be one of: ${[...VALID_VITALS].join(", ")}` });
  }

  const dimensions = [];
  if (rating && VALID_RATINGS.has(rating)) {
    dimensions.push({ Name: "Rating", Value: rating });
  }

  try {
    await putMetric(name, value, dimensions);
  } catch {
    return respond(202, { received: true, note: "metric accepted but write deferred" });
  }
  return respond(200, { received: true });
}

async function handleCspReport(body) {
  const report = body["csp-report"] || body;
  const rawUri = (report["blocked-uri"] || report.blockedURL || "unknown").toString();
  const blockedUri = rawUri.substring(0, 256);

  // Validate blocked-uri is a legitimate CSP value
  if (!VALID_CSP_KEYWORDS.has(blockedUri) && !CSP_URI_PATTERN.test(blockedUri)) {
    return respond(400, { error: "Invalid blocked-uri format" });
  }

  await putMetric("CSPViolation", 1, [
    { Name: "BlockedURI", Value: blockedUri },
  ]);
  return respond(200, { received: true });
}

async function getMetricAverage(metricName, periodHours = 24) {
  const now = new Date();
  const start = new Date(now.getTime() - periodHours * 60 * 60 * 1000);

  const command = new GetMetricStatisticsCommand({
    Namespace: NAMESPACE,
    MetricName: metricName,
    StartTime: start,
    EndTime: now,
    Period: periodHours * 3600,
    Statistics: ["Average", "SampleCount"],
  });

  const result = await cloudwatch.send(command);
  const datapoint = result.Datapoints?.[0];
  return {
    average: datapoint?.Average ?? null,
    count: datapoint?.SampleCount ?? 0,
  };
}

async function getMetricSum(metricName, periodHours = 24) {
  const now = new Date();
  const start = new Date(now.getTime() - periodHours * 60 * 60 * 1000);

  const command = new GetMetricStatisticsCommand({
    Namespace: NAMESPACE,
    MetricName: metricName,
    StartTime: start,
    EndTime: now,
    Period: periodHours * 3600,
    Statistics: ["Sum"],
  });

  const result = await cloudwatch.send(command);
  return result.Datapoints?.[0]?.Sum ?? 0;
}

async function validateToken(authHeader) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  try {
    const command = new GetUserCommand({ AccessToken: authHeader.slice(7) });
    await cognitoClient.send(command);
    return true;
  } catch (error) {
    console.error("Token validation failed:", error.name);
    return null;
  }
}

function settledValue(result, fallback = null) {
  if (result.status === "fulfilled") return result.value;
  console.error("Metric fetch failed:", result.reason?.message || result.reason);
  return fallback;
}

async function handleHealth(authHeader) {
  const user = await validateToken(authHeader);
  if (!user) {
    return respond(401, { error: "Unauthorized" });
  }

  const vitalsResults = await Promise.allSettled([
    getMetricAverage("LCP"),
    getMetricAverage("CLS"),
    getMetricAverage("INP"),
    getMetricAverage("FCP"),
    getMetricAverage("TTFB"),
  ]);
  const [lcp, cls, inp, fcp, ttfb] = vitalsResults.map((r) =>
    settledValue(r, { average: null, count: 0 })
  );

  const metricResults = await Promise.allSettled([
    getMetricSum("CSPViolation"),
    getMetricSum("KBRetrievalFailure"),
    getMetricSum("KBRetrievalSuccess"),
    getMetricSum("GuardrailIntervention"),
    getMetricSum("RateLimitRejection"),
    getMetricSum("BedrockInputTokens"),
    getMetricSum("BedrockOutputTokens"),
    getMetricSum("MalformedRequest"),
    getMetricAverage("KBRetrievalLatency"),
    getMetricAverage("BedrockInvocationLatency"),
    getMetricAverage("TotalRequestLatency"),
  ]);
  const [
    cspViolations,
    kbFailures,
    kbSuccesses,
    guardrails,
    rateLimits,
    inputTokens,
    outputTokens,
    malformedRequests,
    kbLatency,
    bedrockLatency,
    totalLatency,
  ] = metricResults.map((r, i) =>
    settledValue(r, i >= 8 ? { average: null, count: 0 } : 0)
  );

  const kbTotal = kbSuccesses + kbFailures;
  const kbSuccessRate = kbTotal > 0 ? ((kbSuccesses / kbTotal) * 100).toFixed(1) : null;

  return respond(200, {
    vitals: { lcp, cls, inp, fcp, ttfb },
    chat: {
      kbSuccessRate,
      kbFailures,
      kbSuccesses,
      guardrailInterventions: guardrails,
      rateLimitRejections: rateLimits,
    },
    performance: {
      kbRetrievalLatency: kbLatency,
      bedrockInvocationLatency: bedrockLatency,
      totalRequestLatency: totalLatency,
    },
    costs: {
      bedrockInputTokens: inputTokens,
      bedrockOutputTokens: outputTokens,
      malformedRequests,
    },
    security: { cspViolations },
    periodHours: 24,
    timestamp: new Date().toISOString(),
  });
}

export const handler = async (event) => {
  const method = event.requestContext?.http?.method;
  const path = event.rawPath || "";
  const clientIp = event.requestContext?.http?.sourceIp || "unknown";

  try {
    if (method === "POST" && path === "/vitals") {
      if (!(await checkRateLimit("vitals", clientIp))) {
        return respond(429, { error: "Too many requests" });
      }
      let body;
      try {
        body = JSON.parse(event.body || "{}");
      } catch {
        return respond(400, { error: "Invalid JSON" });
      }
      return await handleVitals(body);
    }

    if (method === "POST" && path === "/csp-report") {
      if (!(await checkRateLimit("csp", clientIp))) {
        return respond(429, { error: "Too many requests" });
      }
      let body;
      try {
        body = JSON.parse(event.body || "{}");
      } catch {
        return respond(400, { error: "Invalid JSON" });
      }
      return await handleCspReport(body);
    }

    if (method === "GET" && path === "/health") {
      const authHeader = event.headers?.authorization || event.headers?.Authorization;
      return await handleHealth(authHeader);
    }

    return respond(404, { error: "Not found" });
  } catch (error) {
    console.error("Metrics handler error:", error);
    return respond(500, { error: "Internal server error" });
  }
};
