import { test } from "node:test";
import assert from "node:assert/strict";
import {
  verifySignature,
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  SIGNATURE_MAX_AGE_SECONDS,
} from "../hmac.mjs";
import { makeEvent, signBlueprintEvent } from "./harness.mjs";

const KEY = "test-signing-key-abc123";

test("verifySignature returns valid when key is empty (disabled)", () => {
  const event = makeEvent({ body: '{"spec":{}}' });
  assert.deepEqual(verifySignature(event, ""), { valid: true });
});

test("verifySignature rejects missing timestamp header", () => {
  const event = makeEvent({
    body: '{"spec":{}}',
    headers: { [SIGNATURE_HEADER]: "deadbeef" },
  });
  const res = verifySignature(event, KEY);
  assert.equal(res.valid, false);
  assert.equal(res.error, "missing_headers");
});

test("verifySignature rejects missing signature header", () => {
  const event = makeEvent({
    body: '{"spec":{}}',
    headers: { [TIMESTAMP_HEADER]: String(Math.floor(Date.now() / 1000)) },
  });
  const res = verifySignature(event, KEY);
  assert.equal(res.valid, false);
  assert.equal(res.error, "missing_headers");
});

test("verifySignature rejects non-numeric timestamp", () => {
  const event = makeEvent({
    body: '{}',
    headers: {
      [TIMESTAMP_HEADER]: "not-a-number",
      [SIGNATURE_HEADER]: "abc",
    },
  });
  const res = verifySignature(event, KEY);
  assert.equal(res.valid, false);
  assert.equal(res.error, "invalid_timestamp");
});

test("verifySignature rejects expired timestamps", () => {
  const body = '{"spec":{}}';
  const stale = signBlueprintEvent(body, KEY, {
    offsetSeconds: -(SIGNATURE_MAX_AGE_SECONDS + 10),
  });
  const event = makeEvent({ body, headers: stale });
  const res = verifySignature(event, KEY);
  assert.equal(res.valid, false);
  assert.equal(res.error, "expired_timestamp");
});

test("verifySignature rejects future timestamps outside the window", () => {
  const body = '{"spec":{}}';
  const future = signBlueprintEvent(body, KEY, {
    offsetSeconds: SIGNATURE_MAX_AGE_SECONDS + 10,
  });
  const event = makeEvent({ body, headers: future });
  const res = verifySignature(event, KEY);
  assert.equal(res.valid, false);
  assert.equal(res.error, "expired_timestamp");
});

test("verifySignature rejects a wrong signature", () => {
  const body = '{"spec":{}}';
  const ts = String(Math.floor(Date.now() / 1000));
  const event = makeEvent({
    body,
    headers: {
      [TIMESTAMP_HEADER]: ts,
      [SIGNATURE_HEADER]: "0".repeat(64), // right length hex, wrong bytes
    },
  });
  const res = verifySignature(event, KEY);
  assert.equal(res.valid, false);
  assert.equal(res.error, "invalid_signature");
});

test("verifySignature rejects signature with wrong length", () => {
  const body = "{}";
  const ts = String(Math.floor(Date.now() / 1000));
  const event = makeEvent({
    body,
    headers: {
      [TIMESTAMP_HEADER]: ts,
      [SIGNATURE_HEADER]: "deadbeef", // 4 bytes, not 32
    },
  });
  const res = verifySignature(event, KEY);
  assert.equal(res.valid, false);
  assert.equal(res.error, "invalid_signature");
});

test("verifySignature rejects signatures computed with a different key", () => {
  const body = '{"spec":{}}';
  const wrongHeaders = signBlueprintEvent(body, "totally-different-key");
  const event = makeEvent({ body, headers: wrongHeaders });
  const res = verifySignature(event, KEY);
  assert.equal(res.valid, false);
  assert.equal(res.error, "invalid_signature");
});

test("verifySignature accepts a well-formed signature on the exact body", () => {
  const body = '{"spec":{"goal":"x"}}';
  const headers = signBlueprintEvent(body, KEY);
  const event = makeEvent({ body, headers });
  assert.deepEqual(verifySignature(event, KEY), { valid: true });
});

test("verifySignature is body-sensitive (tampered body fails)", () => {
  const signedBody = '{"spec":{"goal":"x"}}';
  const headers = signBlueprintEvent(signedBody, KEY);
  const tamperedBody = '{"spec":{"goal":"y"}}';
  const event = makeEvent({ body: tamperedBody, headers });
  const res = verifySignature(event, KEY);
  assert.equal(res.valid, false);
  assert.equal(res.error, "invalid_signature");
});
