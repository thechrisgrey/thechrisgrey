import { test } from "node:test";
import assert from "node:assert/strict";
import { validateEntryFields, CATEGORY_ORDER } from "../validation.mjs";

test("requireAll rejects a missing title/category/content", () => {
  assert.match(validateEntryFields({ category: "biography", content: "x" }, true), /required/);
  assert.equal(validateEntryFields({ title: "T", category: "biography", content: "x" }, true), null);
});

test("rejects an over-length title", () => {
  assert.match(validateEntryFields({ title: "a".repeat(201) }), /at most 200/);
});

test("rejects a category outside the allowlist", () => {
  assert.match(validateEntryFields({ category: "bogus" }), /must be one of/);
  assert.equal(validateEntryFields({ category: CATEGORY_ORDER[0] }), null);
});

test("rejects over-length content", () => {
  assert.match(validateEntryFields({ content: "a".repeat(50001) }), /at most 50000/);
});

test("rejects an unparseable date but accepts a valid one", () => {
  assert.match(validateEntryFields({ date: "not-a-date" }), /valid date/);
  assert.equal(validateEntryFields({ date: "2026-01-15" }), null);
});

test("rejects sortOrder outside 0..1000", () => {
  assert.match(validateEntryFields({ sortOrder: -1 }), /between 0 and 1000/);
  assert.match(validateEntryFields({ sortOrder: 1001 }), /between 0 and 1000/);
  assert.equal(validateEntryFields({ sortOrder: 500 }), null);
});

test("empty patch (no fields, requireAll=false) is valid", () => {
  assert.equal(validateEntryFields({}, false), null);
});
