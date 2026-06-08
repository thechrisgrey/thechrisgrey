import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "..", "index.mjs"), "utf8");

test("both checkRateLimit calls forward requestId", () => {
  // Each call block ends with "});" — count blocks that contain "requestId,"
  const callBlocks = src.split("checkRateLimit(docClient, UpdateCommand, {").slice(1);
  assert.equal(callBlocks.length, 2, "expected exactly 2 checkRateLimit call sites");
  for (const [i, block] of callBlocks.entries()) {
    const body = block.slice(0, block.indexOf("});"));
    assert.ok(
      /\brequestId,/.test(body),
      `checkRateLimit call #${i + 1} must pass requestId,`
    );
  }
});
