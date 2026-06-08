import { test } from "node:test";
import assert from "node:assert/strict";
import { validateVitals, validateCspUri } from "../validation.mjs";

test("validateVitals rejects a missing name", () => {
  assert.equal(validateVitals({ value: 10 }).ok, false);
});

test("validateVitals rejects a non-numeric value", () => {
  assert.equal(validateVitals({ name: "LCP", value: "10" }).ok, false);
});

test("validateVitals rejects an out-of-range value", () => {
  assert.equal(validateVitals({ name: "LCP", value: 60001 }).ok, false);
  assert.equal(validateVitals({ name: "LCP", value: -1 }).ok, false);
});

test("validateVitals rejects an unknown metric name", () => {
  assert.equal(validateVitals({ name: "BOGUS", value: 10 }).ok, false);
});

test("validateVitals accepts a valid CLS sample with no rating", () => {
  const r = validateVitals({ name: "CLS", value: 0.1 });
  assert.equal(r.ok, true);
  assert.deepEqual(r.dimensions, []);
});

test("validateVitals attaches a Rating dimension only for valid ratings", () => {
  assert.deepEqual(validateVitals({ name: "INP", value: 200, rating: "good" }).dimensions, [
    { Name: "Rating", Value: "good" },
  ]);
  assert.deepEqual(validateVitals({ name: "INP", value: 200, rating: "bogus" }).dimensions, []);
});

test("validateCspUri accepts known keywords and http(s) origins", () => {
  assert.equal(validateCspUri("inline"), true);
  assert.equal(validateCspUri("https://evil.example.com"), true);
});

test("validateCspUri rejects malformed blocked-uri values", () => {
  assert.equal(validateCspUri("javascript:alert(1)"), false);
  assert.equal(validateCspUri(""), false);
});
