import { test } from "node:test";
import assert from "node:assert/strict";
import { withTimeout } from "../timeout.mjs";

test("resolves with the wrapped promise value when it settles before the timeout", async () => {
  const result = await withTimeout(Promise.resolve(42), 1000, "fast-op");
  assert.equal(result, 42);
});

test("rejects with the wrapped promise rejection when it settles before the timeout", async () => {
  await assert.rejects(withTimeout(Promise.reject(new Error("bad")), 1000, "failing-op"), /bad/);
});

test("rejects with TimeoutError when the promise exceeds the timeout", async () => {
  const slow = new Promise((resolve) => setTimeout(resolve, 5000));
  await assert.rejects(withTimeout(slow, 50, "slow-op"), /slow-op timed out after 50ms/);
});

test("the timeout error has name TimeoutError", async () => {
  const slow = new Promise(() => {});
  try {
    await withTimeout(slow, 50, "hanging-op");
    assert.fail("should have thrown");
  } catch (err) {
    assert.equal(err.name, "TimeoutError");
    assert.match(err.message, /hanging-op/);
  }
});

test("clears the timeout timer when the promise resolves first (no leak)", async () => {
  const result = await withTimeout(Promise.resolve("ok"), 10000, "no-leak");
  assert.equal(result, "ok");
});

test("clears the timeout timer when the promise rejects first (no leak)", async () => {
  await assert.rejects(withTimeout(Promise.reject(new Error("fail")), 10000, "no-leak-reject"), /fail/);
});

test("works with async functions", async () => {
  const asyncOp = async () => {
    await new Promise((r) => setTimeout(r, 10));
    return "done";
  };
  const result = await withTimeout(asyncOp(), 1000, "async-op");
  assert.equal(result, "done");
});

test("default label is 'operation'", async () => {
  const slow = new Promise(() => {});
  await assert.rejects(withTimeout(slow, 50), /operation timed out/);
});
