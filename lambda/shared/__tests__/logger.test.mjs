import { test } from "node:test";
import assert from "node:assert/strict";
import { createLogger, redact, LEVELS } from "../logger.mjs";

// Capture console output so tests can assert on the emitted JSON.
function captureConsole() {
  const lines = { log: [], warn: [], error: [] };
  const origLog = console.log;
  const origWarn = console.warn;
  const origError = console.error;
  console.log = (...args) => void lines.log.push(args[0]);
  console.warn = (...args) => void lines.warn.push(args[0]);
  console.error = (...args) => void lines.error.push(args[0]);
  return {
    lines,
    restore() {
      console.log = origLog;
      console.warn = origWarn;
      console.error = origError;
    },
  };
}

function parseLogEntry(raw) {
  const obj = JSON.parse(raw);
  return obj;
}

test("createLogger returns an object with debug/info/warn/error methods", () => {
  const log = createLogger("req-1");
  assert.equal(typeof log.debug, "function");
  assert.equal(typeof log.info, "function");
  assert.equal(typeof log.warn, "function");
  assert.equal(typeof log.error, "function");
});

test("info emits a structured JSON line with requestId, level, event, and ts", () => {
  const cap = captureConsole();
  try {
    const log = createLogger("req-abc");
    log.info("request_start", { method: "POST", path: "/vitals" });

    assert.equal(cap.lines.log.length, 1);
    const entry = parseLogEntry(cap.lines.log[0]);
    assert.equal(entry.requestId, "req-abc");
    assert.equal(entry.level, "info");
    assert.equal(entry.event, "request_start");
    assert.equal(entry.method, "POST");
    assert.equal(entry.path, "/vitals");
    assert.ok(typeof entry.ts === "string" && entry.ts.length > 0);
  } finally {
    cap.restore();
  }
});

test("error writes to console.error, warn to console.warn, info/debug to console.log", () => {
  const cap = captureConsole();
  try {
    const log = createLogger("req-routing");
    log.debug("dbg"); // filtered by default (LOG_LEVEL=info)
    log.info("inf");
    log.warn("wrn");
    log.error("err");

    assert.equal(cap.lines.log.length, 1); // info only (debug filtered at default level)
    assert.equal(cap.lines.warn.length, 1);
    assert.equal(cap.lines.error.length, 1);

    assert.equal(parseLogEntry(cap.lines.log[0]).event, "inf");
    assert.equal(parseLogEntry(cap.lines.warn[0]).event, "wrn");
    assert.equal(parseLogEntry(cap.lines.error[0]).event, "err");
  } finally {
    cap.restore();
  }
});

test("context fields are attached to every log line", () => {
  const cap = captureConsole();
  try {
    const log = createLogger("req-ctx", { service: "chat-stream", version: "1.0" });
    log.info("request_start");
    log.error("handler_error", { message: "boom" });

    const info = parseLogEntry(cap.lines.log[0]);
    assert.equal(info.service, "chat-stream");
    assert.equal(info.version, "1.0");

    const err = parseLogEntry(cap.lines.error[0]);
    assert.equal(err.service, "chat-stream");
    assert.equal(err.version, "1.0");
  } finally {
    cap.restore();
  }
});

test("extra fields are merged into the payload alongside context", () => {
  const cap = captureConsole();
  try {
    const log = createLogger("req-merge", { service: "mcp-server" });
    log.info("request_complete", { durationMs: 42, tokens: 150 });

    const entry = parseLogEntry(cap.lines.log[0]);
    assert.equal(entry.service, "mcp-server");
    assert.equal(entry.durationMs, 42);
    assert.equal(entry.tokens, 150);
  } finally {
    cap.restore();
  }
});

test("redact replaces email addresses with [REDACTED]", () => {
  assert.equal(redact("contact chris@altivum.io for details"), "contact [REDACTED] for details");
  assert.equal(redact("Email: jane.doe+tag@example.co.uk"), "Email: [REDACTED]");
});

test("redact replaces phone-shaped digit runs with [REDACTED]", () => {
  assert.equal(redact("call 512-555-0199"), "call [REDACTED]");
  assert.equal(redact("+1 (512) 555-0199"), "[REDACTED]");
});

test("redact does not false-positive on short digit runs (years, ZIPs)", () => {
  assert.equal(redact("graduated in 2014"), "graduated in 2014");
  assert.equal(redact("ZIP 78701"), "ZIP 78701");
  assert.equal(redact("served as 18D for 12 years"), "served as 18D for 12 years");
});

test("redact does not redact social handles without a domain dot", () => {
  assert.equal(redact("follow @thechrisgrey on X"), "follow @thechrisgrey on X");
});

test("redact replaces sensitive keys with [REDACTED] regardless of value", () => {
  const obj = { user: "chris", token: "abc123", Authorization: "Bearer xyz", password: "secret" };
  const result = redact(obj);
  assert.equal(result.user, "chris");
  assert.equal(result.token, "[REDACTED]");
  assert.equal(result.Authorization, "[REDACTED]");
  assert.equal(result.password, "[REDACTED]");
});

test("redact handles nested objects and arrays", () => {
  const obj = {
    user: { email: "chris@altivum.io", name: "Chris" },
    tags: ["tag1", "512-555-0199"],
  };
  const result = redact(obj);
  assert.equal(result.user.email, "[REDACTED]");
  assert.equal(result.user.name, "Chris");
  assert.equal(result.tags[0], "tag1");
  assert.equal(result.tags[1], "[REDACTED]");
});

test("redact passes through null, undefined, numbers, booleans", () => {
  assert.equal(redact(null), null);
  assert.equal(redact(undefined), undefined);
  assert.equal(redact(42), 42);
  assert.equal(redact(true), true);
});

test("logger redacts PII in extra fields before emitting", () => {
  const cap = captureConsole();
  try {
    const log = createLogger("req-pii");
    log.info("user_message", { text: "my email is chris@altivum.io" });

    const entry = parseLogEntry(cap.lines.log[0]);
    assert.equal(entry.text, "my email is [REDACTED]");
  } finally {
    cap.restore();
  }
});

test("logger redacts sensitive keys in extra fields", () => {
  const cap = captureConsole();
  try {
    const log = createLogger("req-secret");
    log.info("auth_result", { token: "abc123", valid: true });

    const entry = parseLogEntry(cap.lines.log[0]);
    assert.equal(entry.token, "[REDACTED]");
    assert.equal(entry.valid, true);
  } finally {
    cap.restore();
  }
});

test("logger with no extra fields does not add empty object keys", () => {
  const cap = captureConsole();
  try {
    const log = createLogger("req-noextra");
    log.info("simple_event");

    const entry = parseLogEntry(cap.lines.log[0]);
    assert.equal(entry.event, "simple_event");
    // No extra fields should be merged: requestId + level + event + ts = 4 keys
    assert.equal(Object.keys(entry).length, 4);
  } finally {
    cap.restore();
  }
});

test("LEVELS has the expected numeric ordering", () => {
  assert.equal(LEVELS.debug, 10);
  assert.equal(LEVELS.info, 20);
  assert.equal(LEVELS.warn, 30);
  assert.equal(LEVELS.error, 40);
  assert.ok(LEVELS.debug < LEVELS.info);
  assert.ok(LEVELS.info < LEVELS.warn);
  assert.ok(LEVELS.warn < LEVELS.error);
});

test("logger redacts PII in static context fields at creation time", () => {
  const cap = captureConsole();
  try {
    const log = createLogger("req-ctx-pii", {
      service: "chat-stream",
      email: "admin@example.com",
      token: "secret-value",
    });
    log.info("request_start");

    const entry = parseLogEntry(cap.lines.log[0]);
    assert.equal(entry.service, "chat-stream");
    assert.equal(entry.email, "[REDACTED]", "email in context must be redacted");
    assert.equal(entry.token, "[REDACTED]", "token in context must be redacted");
  } finally {
    cap.restore();
  }
});
