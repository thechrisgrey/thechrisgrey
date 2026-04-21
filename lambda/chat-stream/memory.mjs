import { createHash, randomUUID } from "crypto";

export const MEMORY_TABLE = process.env.CHAT_MEMORY_TABLE || "thechrisgrey-chat-memory";
export const MEMORY_TTL_SECONDS = 90 * 24 * 60 * 60;
export const MAX_FACTS_RETURNED = 20;
export const MAX_FACT_LENGTH = 240;

export function hashDeviceId(deviceId) {
  if (!deviceId || typeof deviceId !== "string") {
    throw new Error("hashDeviceId: deviceId must be a non-empty string");
  }
  return createHash("sha256").update(deviceId).digest("hex");
}

export async function getFacts(docClient, QueryCommand, deviceId, { limit = MAX_FACTS_RETURNED } = {}) {
  if (!deviceId) return [];
  const deviceHash = hashDeviceId(deviceId);
  const now = Math.floor(Date.now() / 1000);

  const result = await docClient.send(new QueryCommand({
    TableName: MEMORY_TABLE,
    KeyConditionExpression: "deviceHash = :d",
    FilterExpression: "#ttl > :now",
    ExpressionAttributeNames: { "#ttl": "ttl" },
    ExpressionAttributeValues: {
      ":d": deviceHash,
      ":now": now,
    },
    ScanIndexForward: false,
    Limit: limit,
  }));

  return (result.Items || []).map((item) => ({
    factId: item.factId,
    content: item.content,
    createdAt: item.createdAt,
  }));
}

export async function putFact(docClient, PutCommand, deviceId, content) {
  if (!deviceId) throw new Error("putFact: deviceId is required");
  if (!content || typeof content !== "string") {
    throw new Error("putFact: content must be a non-empty string");
  }
  const trimmed = content.trim().slice(0, MAX_FACT_LENGTH);
  if (!trimmed) throw new Error("putFact: content is empty after trim");

  const deviceHash = hashDeviceId(deviceId);
  const factId = randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const ttl = now + MEMORY_TTL_SECONDS;

  await docClient.send(new PutCommand({
    TableName: MEMORY_TABLE,
    Item: {
      deviceHash,
      factId,
      content: trimmed,
      createdAt: now,
      ttl,
    },
  }));

  return { factId, content: trimmed, createdAt: now };
}

export async function forgetDevice(docClient, QueryCommand, BatchWriteCommand, deviceId) {
  if (!deviceId) throw new Error("forgetDevice: deviceId is required");
  const deviceHash = hashDeviceId(deviceId);

  let deleted = 0;
  let lastKey;
  do {
    const page = await docClient.send(new QueryCommand({
      TableName: MEMORY_TABLE,
      KeyConditionExpression: "deviceHash = :d",
      ExpressionAttributeValues: { ":d": deviceHash },
      ProjectionExpression: "deviceHash, factId",
      ExclusiveStartKey: lastKey,
      Limit: 100,
    }));

    const items = page.Items || [];
    if (items.length === 0) break;

    for (let i = 0; i < items.length; i += 25) {
      const batch = items.slice(i, i + 25).map((item) => ({
        DeleteRequest: { Key: { deviceHash: item.deviceHash, factId: item.factId } },
      }));
      await docClient.send(new BatchWriteCommand({
        RequestItems: { [MEMORY_TABLE]: batch },
      }));
      deleted += batch.length;
    }

    lastKey = page.LastEvaluatedKey;
  } while (lastKey);

  return { deleted };
}
