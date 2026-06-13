/**
 * Session-token issuer — HTTP Function URL handler (non-streaming JSON).
 *
 * Mints short-lived, scoped session tokens (chat + blueprint) that the chat and
 * blueprint Lambdas verify. This replaces the old model where a single HMAC key
 * was shipped in the browser bundle (VITE_*_SIGNING_KEY) — which authenticated
 * nothing, since any visitor could read the key. The signing key now lives ONLY
 * here (SESSION_TOKEN_KEY) and is never exposed to the client.
 *
 * Flow: Origin allowlist -> per-IP issuance rate limit (cheap) -> Cloudflare
 * Turnstile verification (the real bot gate) -> issue device-bound tokens.
 *
 * The core is a dependency-injected factory (createIssuerHandler) so the real
 * rate-limit + token-issuance paths are unit-tested without touching AWS or the
 * network. The default `handler` wires the real clients and env config.
 */

import { createHash, randomUUID } from "crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { checkRateLimit } from "lambda-shared/rateLimit";
import { issueSessionToken } from "lambda-shared/sessionToken";

const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const DEVICE_ID_PATTERN = /^[a-zA-Z0-9_-]{8,64}$/;

/**
 * Verify a Cloudflare Turnstile token against the siteverify endpoint.
 * Fails CLOSED (returns false) on any network/parse error — a token can only be
 * minted when Cloudflare affirmatively confirms the challenge.
 * @param {string} token   - the cf-turnstile-response from the client
 * @param {string} secret  - the Turnstile secret key (server-only)
 * @param {string} [remoteip]
 * @param {typeof fetch} [fetchImpl=fetch]
 * @returns {Promise<boolean>}
 */
export async function verifyTurnstile(token, secret, remoteip, fetchImpl = fetch) {
  try {
    const form = new URLSearchParams();
    form.set("secret", secret);
    form.set("response", token || "");
    if (remoteip) form.set("remoteip", remoteip);

    const res = await fetchImpl(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    const data = await res.json();
    return data?.success === true;
  } catch {
    return false;
  }
}

function hashDeviceId(deviceId) {
  return createHash("sha256").update(deviceId).digest("hex");
}

/**
 * Build the issuer handler from injected dependencies.
 * @param {object} deps
 * @param {object} deps.docClient
 * @param {Function} deps.UpdateCommand
 * @param {(token:string, secret:string, ip?:string)=>Promise<boolean>} deps.verifyTurnstile
 * @param {object} deps.config
 */
export function createIssuerHandler({ docClient, UpdateCommand, verifyTurnstile, config }) {
  const {
    signingKey,
    turnstileSecret,
    corsOrigin,
    allowedOrigins,
    rateLimitTable,
    chatTtl,
    blueprintTtl,
    maxIssuancePerHour,
  } = config;

  const corsHeaders = {
    "Access-Control-Allow-Origin": corsOrigin,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "3600",
  };

  const reply = (statusCode, body) => ({
    statusCode,
    headers: { "Content-Type": "application/json", ...corsHeaders },
    body: JSON.stringify(body),
  });

  return async function issuerHandler(event) {
    const requestId = randomUUID();
    const method = event.requestContext?.http?.method;

    if (method === "OPTIONS") {
      return { statusCode: 204, headers: corsHeaders, body: "" };
    }
    if (method !== "POST") {
      return reply(405, { error: "method_not_allowed" });
    }

    const origin = event.headers?.origin || event.headers?.Origin || "";
    if (allowedOrigins.length && !allowedOrigins.includes(origin)) {
      console.log(JSON.stringify({ requestId, event: "origin_rejected", origin }));
      return reply(403, { error: "forbidden_origin" });
    }

    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return reply(400, { error: "invalid_json" });
    }

    const deviceId = typeof body.deviceId === "string" ? body.deviceId : "";
    if (!DEVICE_ID_PATTERN.test(deviceId)) {
      return reply(400, { error: "invalid_device_id" });
    }

    const clientIp = event.requestContext?.http?.sourceIp || "unknown";

    // Cheap gate first: per-IP issuance rate limit (conserves Turnstile calls).
    const rl = await checkRateLimit(docClient, UpdateCommand, {
      table: rateLimitTable,
      ip: clientIp,
      prefix: "session-",
      maxRequests: maxIssuancePerHour,
      windowSeconds: 3600,
      ttlBuffer: 3600,
      requestId,
    });
    if (!rl.allowed) {
      console.log(JSON.stringify({ requestId, event: "issuance_rate_limited" }));
      return reply(429, { error: "rate_limited" });
    }

    // Real bot gate: Cloudflare Turnstile. Skipped only when no secret is set
    // (local/dev), mirroring the empty-key-disables convention in hmac.mjs.
    if (turnstileSecret) {
      const ok = await verifyTurnstile(body.turnstileToken, turnstileSecret, clientIp);
      if (!ok) {
        console.log(JSON.stringify({ requestId, event: "turnstile_failed" }));
        return reply(403, { error: "turnstile_failed" });
      }
    }

    const deviceHash = hashDeviceId(deviceId);
    const chatToken = issueSessionToken({ deviceHash, scope: "chat" }, signingKey, chatTtl);
    const blueprintToken = issueSessionToken({ deviceHash, scope: "blueprint" }, signingKey, blueprintTtl);

    console.log(JSON.stringify({ requestId, event: "tokens_issued" }));
    return reply(200, {
      chatToken,
      blueprintToken,
      chatExpiresIn: chatTtl,
      blueprintExpiresIn: blueprintTtl,
    });
  };
}

// ── Real wiring (module scope so warm invocations reuse clients) ─────────────

const REGION = process.env.AWS_REGION || "us-east-1";
const SIGNING_KEY = process.env.SESSION_TOKEN_KEY || "";
const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET || "";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "https://thechrisgrey.com";
const RATE_LIMIT_TABLE =
  process.env.SESSION_RATE_LIMIT_TABLE ||
  process.env.CHAT_RATE_LIMIT_TABLE ||
  "thechrisgrey-chat-ratelimit";
const CHAT_TTL = parseInt(process.env.SESSION_CHAT_TTL || "1800", 10); // 30 min
const BLUEPRINT_TTL = parseInt(process.env.SESSION_BLUEPRINT_TTL || "600", 10); // 10 min
const MAX_ISSUANCE_PER_HOUR = parseInt(process.env.SESSION_MAX_ISSUANCE || "60", 10);

if (!SIGNING_KEY) {
  console.warn(JSON.stringify({
    event: "startup_warning",
    message: "SESSION_TOKEN_KEY not set — issued tokens will not be verifiable by the chat/blueprint Lambdas",
  }));
}
if (!TURNSTILE_SECRET) {
  console.warn(JSON.stringify({
    event: "startup_warning",
    message: "TURNSTILE_SECRET not set — Turnstile verification DISABLED (dev only)",
  }));
}

const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export const handler = createIssuerHandler({
  docClient,
  UpdateCommand,
  verifyTurnstile,
  config: {
    signingKey: SIGNING_KEY,
    turnstileSecret: TURNSTILE_SECRET,
    corsOrigin: CORS_ORIGIN,
    allowedOrigins: [CORS_ORIGIN],
    rateLimitTable: RATE_LIMIT_TABLE,
    chatTtl: CHAT_TTL,
    blueprintTtl: BLUEPRINT_TTL,
    maxIssuancePerHour: MAX_ISSUANCE_PER_HOUR,
  },
});

export default { handler };
