import { createHash } from "crypto";
import { createLogger } from "./logger.mjs";

/**
 * Atomic DynamoDB-based rate limiter with sliding windows.
 *
 * Uses ADD + ConditionExpression for race-condition-free counting.
 * Fails open on DynamoDB errors (availability > strictness).
 *
 * @param {any} docClient - Injected DynamoDBDocumentClient (duck-typed: must have .send)
 * @param {any} UpdateCommand - Injected UpdateCommand constructor
 * @param {object} opts
 * @param {string} opts.table        - DynamoDB table name
 * @param {string} opts.ip           - Client IP address
 * @param {string} [opts.prefix=""]  - PK prefix (e.g. "metrics-vitals-", "kb-builder-")
 * @param {number} opts.maxRequests  - Max requests allowed per window
 * @param {number} opts.windowSeconds - Window length in seconds
 * @param {number} [opts.ttlBuffer=300] - Extra seconds before TTL deletes the row
 * @param {string|null} [opts.requestId=null] - If set, errors are logged as structured JSON with this ID
 * @returns {Promise<{ allowed: boolean, remaining: number }>}
 */
export async function checkRateLimit(
  docClient,
  UpdateCommand,
  { table, ip, prefix = "", maxRequests, windowSeconds, ttlBuffer = 300, requestId = null },
) {
  const ipHash = createHash("sha256")
    .update(ip || "unknown")
    .digest("hex");
  const pk = prefix ? `${prefix}${ipHash}` : ipHash;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - (now % windowSeconds);

  try {
    const result = await docClient.send(
      new UpdateCommand({
        TableName: table,
        Key: { pk },
        UpdateExpression: "ADD requestCount :inc SET #ttl = :ttl, windowStart = if_not_exists(windowStart, :ws)",
        ConditionExpression: "attribute_not_exists(pk) OR windowStart = :ws",
        ExpressionAttributeNames: { "#ttl": "ttl" },
        ExpressionAttributeValues: {
          ":inc": 1,
          ":ws": windowStart,
          ":ttl": windowStart + windowSeconds + ttlBuffer,
        },
        ReturnValues: "ALL_NEW",
      }),
    );

    const count = result.Attributes?.requestCount ?? 1;
    if (count > maxRequests) {
      return { allowed: false, remaining: 0 };
    }
    return { allowed: true, remaining: maxRequests - count };
  } catch (error) {
    // ConditionalCheckFailedException = stale window, safe to reset
    if (error.name === "ConditionalCheckFailedException") {
      try {
        await docClient.send(
          new UpdateCommand({
            TableName: table,
            Key: { pk },
            UpdateExpression: "SET requestCount = :one, windowStart = :ws, #ttl = :ttl",
            ExpressionAttributeNames: { "#ttl": "ttl" },
            ExpressionAttributeValues: {
              ":one": 1,
              ":ws": windowStart,
              ":ttl": windowStart + windowSeconds + ttlBuffer,
            },
          }),
        );
        return { allowed: true, remaining: maxRequests - 1 };
      } catch {
        return { allowed: true, remaining: -1 };
      }
    }
    if (requestId) {
      const log = createLogger(requestId, { service: "rate-limit" });
      log.error("rate_limit_error", { error: error.name });
    } else {
      console.error("Rate limit error:", error.name);
    }
    return { allowed: true, remaining: -1 };
  }
}
