#!/usr/bin/env node
/**
 * Pre-promotion smoke test against DEPLOYED Lambda Function URLs.
 *
 * This is the "run the real thing" gate from CLAUDE.md: green unit tests prove
 * nothing about the live endpoints. Run this after deploying and BEFORE trusting
 * a release. It is NOT part of CI gating — it needs live URLs/secrets.
 *
 * Usage (set what you have; unset checks are skipped, not failed):
 *   SMOKE_SESSION_ENDPOINT=https://.../  \
 *   SMOKE_CHAT_ENDPOINT=https://.../      \
 *   SMOKE_LEGACY_CHAT_KEY=...   # optional: legacy HMAC key to sign a real chat request \
 *   SMOKE_CHAT_TOKEN=...        # optional: a chat-scoped bearer token to send a real request \
 *   node scripts/smoke-test-lambdas.mjs
 *
 * Exits non-zero if any executed check fails.
 */
import { createHmac } from 'crypto';
import { verifySessionToken } from '../lambda/shared/sessionToken.mjs';

const results = [];
const record = (name, ok, detail) => {
  results.push({ name, ok, detail });
  const tag = ok === null ? 'SKIP' : ok ? 'PASS' : 'FAIL';
  console.log(`[${tag}] ${name}${detail ? ` — ${detail}` : ''}`);
};

async function readBody(res) {
  try {
    return await res.text();
  } catch {
    return '';
  }
}

async function checkSessionIssuer(endpoint) {
  if (!endpoint) return record('session issuer reachable', null, 'SMOKE_SESSION_ENDPOINT unset');
  try {
    // No Turnstile token: a live issuer with TURNSTILE_SECRET set must gate (403);
    // one without (dev) returns 200. Either proves it is reachable and behaving.
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://thechrisgrey.com' },
      body: JSON.stringify({ deviceId: 'smoke-device-0001' }),
    });
    // A live issuer with TURNSTILE_SECRET set gates (403, no Turnstile token here);
    // one without (dev/staging) returns 200. Either proves it is reachable + behaving.
    const ok = res.status === 403 || res.status === 200;
    record('session issuer reachable + gating', ok, `status ${res.status}`);

    // If it minted tokens AND we have the server key, prove the token actually
    // verifies for its scope — not just that the endpoint returned 200.
    const serverKey = process.env.SMOKE_SESSION_TOKEN_KEY || '';
    if (res.status === 200 && serverKey) {
      const body = JSON.parse((await readBody(res)) || '{}');
      const chat = verifySessionToken(body.chatToken, serverKey, { scope: 'chat' });
      const bp = verifySessionToken(body.blueprintToken, serverKey, { scope: 'blueprint' });
      record(
        'issued tokens verify for their scope',
        chat.valid === true && bp.valid === true,
        `chat=${chat.valid ? 'valid' : chat.error}, blueprint=${bp.valid ? 'valid' : bp.error}`,
      );
    } else if (res.status === 200) {
      record('issued tokens verify for their scope', null, 'set SMOKE_SESSION_TOKEN_KEY to verify minted tokens');
    }
  } catch (e) {
    record('session issuer reachable + gating', false, e.message);
  }
}

async function checkChatRejectsUnauthenticated(endpoint) {
  if (!endpoint) return record('chat rejects unauthenticated', null, 'SMOKE_CHAT_ENDPOINT unset');
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
    });
    const body = await readBody(res);
    // Auth is enforced: an unsigned, tokenless request must NOT get a normal answer.
    const ok = body.includes('Unable to process request.');
    record(
      'chat enforces auth on unauthenticated request',
      ok,
      ok ? 'rejected' : `unexpected body: ${body.slice(0, 80)}`,
    );
  } catch (e) {
    record('chat enforces auth on unauthenticated request', false, e.message);
  }
}

async function checkChatAcceptsRealRequest(endpoint, { legacyKey, token }) {
  if (!endpoint) return record('chat accepts an authenticated request', null, 'SMOKE_CHAT_ENDPOINT unset');
  if (!legacyKey && !token) {
    return record('chat accepts an authenticated request', null, 'no SMOKE_CHAT_TOKEN or SMOKE_LEGACY_CHAT_KEY');
  }
  const body = JSON.stringify({ messages: [{ role: 'user', content: 'Say hello in one word.' }] });
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  } else {
    const ts = String(Math.floor(Date.now() / 1000));
    headers['x-chat-timestamp'] = ts;
    headers['x-chat-signature'] = createHmac('sha256', legacyKey).update(`${ts}.${body}`).digest('hex');
  }
  try {
    const res = await fetch(endpoint, { method: 'POST', headers, body });
    const text = await readBody(res);
    const ok = res.ok && !text.includes('Unable to process request.') && text.trim().length > 0;
    record('chat accepts an authenticated request + streams', ok, `status ${res.status}, ${text.length} bytes`);
  } catch (e) {
    record('chat accepts an authenticated request + streams', false, e.message);
  }
}

const sessionEndpoint = process.env.SMOKE_SESSION_ENDPOINT || '';
const chatEndpoint = process.env.SMOKE_CHAT_ENDPOINT || '';

await checkSessionIssuer(sessionEndpoint);
await checkChatRejectsUnauthenticated(chatEndpoint);
await checkChatAcceptsRealRequest(chatEndpoint, {
  legacyKey: process.env.SMOKE_LEGACY_CHAT_KEY || '',
  token: process.env.SMOKE_CHAT_TOKEN || '',
});

const failed = results.filter((r) => r.ok === false);
const ran = results.filter((r) => r.ok !== null);
console.log(
  `\n${ran.length - failed.length}/${ran.length} executed checks passed (${results.length - ran.length} skipped).`,
);
process.exit(failed.length ? 1 : 0);
