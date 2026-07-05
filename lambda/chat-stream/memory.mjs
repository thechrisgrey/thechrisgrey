import { createHash, randomUUID } from "crypto";
import { withTimeout } from "./timeout.mjs";

export const MEMORY_TABLE = process.env.CHAT_MEMORY_TABLE || "thechrisgrey-chat-memory";
// Per-write timeout for the visitor-memory put. Matches the 4s budget the KB and
// podcast retrieval tools use, and stays well under the 25s agent deadline so a
// hung DynamoDB write fails fast instead of starving the rest of the turn.
export const PUT_FACT_TIMEOUT_MS = 4000;
export const MEMORY_TTL_SECONDS = 90 * 24 * 60 * 60;
export const MAX_FACTS_RETURNED = 20;
export const MAX_FACT_LENGTH = 240;
const BATCH_RETRY_MAX = 5;
const BATCH_RETRY_BASE_MS = 50;
const BATCH_RETRY_CAP_MS = 1000;
const SENTINEL_PATTERN = /={2,}\s*[A-Z0-9 _-]{3,}\s*={2,}/;
// PII guards — visitor memory must never persist contact identifiers
// (CLAUDE.md "PII disallowed"). Prompt instructions in rememberFact/prompts ask
// the model not to store these; these regexes make it a server-side control.
// Email: a token containing '@' with a dotted domain. Requires a '.' after the
// '@' so a bare social handle like "@thechrisgrey" (no domain dot) is allowed.
const EMAIL_PATTERN = /[^\s@]+@[^\s@]+\.[^\s@]+/;
// Phone / long digit run: 10+ digits joined only by phone-ish separators
// (space, parens, '.', '-'). The `[\s().-]*` between digits bridges real phone
// formats like "+1 (512) 555-0199" while letters/commas still break a run, so
// years (2024), ZIPs (78701), and "18D for 12 years" stay under the threshold.
const PHONE_PATTERN = /(?:\+?\d[\s().-]*){10,}/;

export function hashDeviceId(deviceId) {
  if (!deviceId || typeof deviceId !== "string") {
    throw new Error("hashDeviceId: deviceId must be a non-empty string");
  }
  return createHash("sha256").update(deviceId).digest("hex");
}

export function sanitizeFactContent(raw) {
  if (!raw || typeof raw !== "string") return "";
  const collapsed = raw.replace(/\s+/g, " ").trim();
  if (!collapsed) return "";
  if (SENTINEL_PATTERN.test(collapsed)) return "";
  if (EMAIL_PATTERN.test(collapsed)) return "";
  if (PHONE_PATTERN.test(collapsed)) return "";
  return collapsed.slice(0, MAX_FACT_LENGTH);
}

function buildFactId(timestampSeconds) {
  const ts = String(timestampSeconds).padStart(12, "0");
  return `${ts}#${randomUUID()}`;
}

export async function getFacts(docClient, QueryCommand, deviceId, { limit = MAX_FACTS_RETURNED } = {}) {
  if (!deviceId) return [];
  const deviceHash = hashDeviceId(deviceId);
  const now = Math.floor(Date.now() / 1000);
  const collected = [];
  let lastKey;

  while (collected.length < limit) {
    const result = await docClient.send(
      new QueryCommand({
        TableName: MEMORY_TABLE,
        KeyConditionExpression: "deviceHash = :d",
        ExpressionAttributeValues: { ":d": deviceHash },
        ScanIndexForward: false,
        Limit: Math.min(limit * 2, 100),
        ExclusiveStartKey: lastKey,
      }),
    );

    const items = result.Items || [];
    for (const item of items) {
      if (typeof item.ttl === "number" && item.ttl <= now) continue;
      collected.push({
        factId: item.factId,
        content: item.content,
        createdAt: item.createdAt,
      });
      if (collected.length >= limit) break;
    }

    if (!result.LastEvaluatedKey) break;
    lastKey = result.LastEvaluatedKey;
  }

  return collected;
}

export async function putFact(docClient, PutCommand, deviceId, content, { timeoutMs = PUT_FACT_TIMEOUT_MS } = {}) {
  if (!deviceId) throw new Error("putFact: deviceId is required");
  if (!content || typeof content !== "string") {
    throw new Error("putFact: content must be a non-empty string");
  }
  const sanitized = sanitizeFactContent(content);
  if (!sanitized) throw new Error("putFact: content is empty or rejected after sanitization");

  const deviceHash = hashDeviceId(deviceId);
  const now = Math.floor(Date.now() / 1000);
  const factId = buildFactId(now);
  const ttl = now + MEMORY_TTL_SECONDS;

  // Bound the DynamoDB write so a hung dependency can't block the agent turn.
  await withTimeout(
    docClient.send(
      new PutCommand({
        TableName: MEMORY_TABLE,
        Item: {
          deviceHash,
          factId,
          content: sanitized,
          createdAt: now,
          ttl,
        },
      }),
    ),
    timeoutMs,
    "putFact",
  );

  return { factId, content: sanitized, createdAt: now };
}

async function flushBatch(docClient, BatchWriteCommand, batch) {
  let requestItems = { [MEMORY_TABLE]: batch };
  let attempt = 0;
  let processed = 0;

  while (requestItems[MEMORY_TABLE] && requestItems[MEMORY_TABLE].length > 0) {
    const pending = requestItems[MEMORY_TABLE].length;
    const res = await docClient.send(new BatchWriteCommand({ RequestItems: requestItems }));
    const unprocessed = (res.UnprocessedItems && res.UnprocessedItems[MEMORY_TABLE]) || [];
    processed += pending - unprocessed.length;
    if (unprocessed.length === 0) break;
    if (attempt >= BATCH_RETRY_MAX) {
      throw new Error("forgetDevice: UnprocessedItems retries exhausted");
    }
    const delay = Math.min(BATCH_RETRY_BASE_MS * 2 ** attempt, BATCH_RETRY_CAP_MS);
    await new Promise((resolve) => setTimeout(resolve, delay));
    requestItems = { [MEMORY_TABLE]: unprocessed };
    attempt += 1;
  }

  return processed;
}

export async function forgetDevice(docClient, QueryCommand, BatchWriteCommand, deviceId) {
  if (!deviceId) throw new Error("forgetDevice: deviceId is required");
  const deviceHash = hashDeviceId(deviceId);

  let deleted = 0;
  let lastKey;
  do {
    const page = await docClient.send(
      new QueryCommand({
        TableName: MEMORY_TABLE,
        KeyConditionExpression: "deviceHash = :d",
        ExpressionAttributeValues: { ":d": deviceHash },
        ProjectionExpression: "deviceHash, factId",
        ExclusiveStartKey: lastKey,
        Limit: 100,
      }),
    );

    const items = page.Items || [];
    if (items.length === 0) break;

    for (let i = 0; i < items.length; i += 25) {
      const batch = items.slice(i, i + 25).map((item) => ({
        DeleteRequest: { Key: { deviceHash: item.deviceHash, factId: item.factId } },
      }));
      deleted += await flushBatch(docClient, BatchWriteCommand, batch);
    }

    lastKey = page.LastEvaluatedKey;
  } while (lastKey);

  return { deleted };
}
