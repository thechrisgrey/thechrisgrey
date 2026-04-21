import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "crypto";
import { verifySignature } from "../hmac.mjs";
import { makeEvent, signEvent } from "./harness.mjs";

const KEY = "test-secret-key";

test("empty signing key bypasses verification", () => {
  const event = makeEvent({ body: "{}" });
  assert.deepEqual(verifySignature(event, ""), { valid: true });
});

test("valid signature passes", () => {
  const body = '{"messages":[{"role":"user","content":"hi"}]}';
  const event = makeEvent({ body, headers: signEvent(body, KEY) });
  assert.deepEqual(verifySignature(event, KEY), { valid: true });
});

test("missing timestamp header fails", () => {
  const body = "{}";
  const headers = signEvent(body, KEY);
  delete headers["x-chat-timestamp"];
  const event = makeEvent({ body, headers });
  assert.deepEqual(verifySignature(event, KEY), { valid: false, error: "missing_headers" });
});

test("missing signature header fails", () => {
  const body = "{}";
  const headers = signEvent(body, KEY);
  delete headers["x-chat-signature"];
  const event = makeEvent({ body, headers });
  assert.deepEqual(verifySignature(event, KEY), { valid: false, error: "missing_headers" });
});

test("non-numeric timestamp fails", () => {
  const body = "{}";
  const event = makeEvent({
    body,
    headers: { "x-chat-timestamp": "not-a-number", "x-chat-signature": "deadbeef" },
  });
  assert.deepEqual(verifySignature(event, KEY), { valid: false, error: "invalid_timestamp" });
});

test("expired timestamp fails", () => {
  const body = "{}";
  const event = makeEvent({ body, headers: signEvent(body, KEY, { offsetSeconds: -600 }) });
  assert.deepEqual(verifySignature(event, KEY), { valid: false, error: "expired_timestamp" });
});

test("tampered body fails", () => {
  const body = '{"messages":[{"role":"user","content":"hi"}]}';
  const headers = signEvent(body, KEY);
  const event = makeEvent({ body: body + "tampered", headers });
  assert.deepEqual(verifySignature(event, KEY), { valid: false, error: "invalid_signature" });
});

test("wrong-length signature fails without throwing", () => {
  const body = "{}";
  const ts = String(Math.floor(Date.now() / 1000));
  const event = makeEvent({
    body,
    headers: { "x-chat-timestamp": ts, "x-chat-signature": "abcd" },
  });
  assert.deepEqual(verifySignature(event, KEY), { valid: false, error: "invalid_signature" });
});

test("signature from wrong key fails", () => {
  const body = "{}";
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = createHmac("sha256", "different-key").update(`${ts}.${body}`).digest("hex");
  const event = makeEvent({
    body,
    headers: { "x-chat-timestamp": ts, "x-chat-signature": sig },
  });
  assert.deepEqual(verifySignature(event, KEY), { valid: false, error: "invalid_signature" });
});
