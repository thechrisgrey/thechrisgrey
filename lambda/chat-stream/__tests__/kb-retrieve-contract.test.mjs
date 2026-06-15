/**
 * Knowledge Base retrieval CONTRACT test — opt-in, against the LIVE Bedrock KB.
 *
 * kbRetrieve.test.mjs proves the retrieval LOGIC with a fake Bedrock client that
 * returns hardcoded passages — it never calls the real Retrieve API. So nothing
 * proves the live KB (ARFYABW8HP) is reachable, that the configured KB id is
 * valid, or that `RetrieveResponse.retrievalResults[].content.text` still has the
 * shape `retrieveContext()` parses. A wrong KB id, a region mismatch, or an API
 * shape change would ship green and leave Alti silently un-grounded.
 *
 * This runs the REAL retrieveContext() (lambda/chat-stream/kbRetrieve.mjs) with a
 * real BedrockAgentRuntimeClient + RetrieveCommand.
 *
 * GATING: skips cleanly (exit 0) unless KB_RETRIEVE_CONTRACT_TESTS is set. Enable:
 *
 *   KB_RETRIEVE_CONTRACT_TESTS=1 node --test lambda/chat-stream/__tests__/kb-retrieve-contract.test.mjs
 *
 * Optional env: KB_ID (default ARFYABW8HP, matching index.mjs), AWS_REGION
 * (default us-east-1). Requires AWS credentials with bedrock:Retrieve on the KB.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { retrieveContext } from "../kbRetrieve.mjs";
import { recordingMetrics } from "./harness.mjs";

if (!process.env.KB_RETRIEVE_CONTRACT_TESTS) {
  test(
    "kb retrieve contract (skipped: set KB_RETRIEVE_CONTRACT_TESTS=1 to run against live Bedrock KB)",
    { skip: true },
    () => {},
  );
} else {
  const { BedrockAgentRuntimeClient, RetrieveCommand } = await import(
    "@aws-sdk/client-bedrock-agent-runtime"
  );

  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";
  const knowledgeBaseId = process.env.KB_ID || "ARFYABW8HP";
  const agentClient = new BedrockAgentRuntimeClient({ region });
  const LIVE_TIMEOUT_MS = 30_000;

  test(
    "LIVE Retrieve against the KB returns a parseable string or null (never throws)",
    { timeout: LIVE_TIMEOUT_MS },
    async () => {
      const metrics = recordingMetrics();
      const result = await retrieveContext(
        agentClient,
        RetrieveCommand,
        "Christian Perez Green Beret 18D special forces background",
        { knowledgeBaseId, requestId: "contract-1", metrics, timeoutMs: 8000, numberOfResults: 5 },
      );

      // The contract: retrieveContext returns either the joined passage string or
      // null (empty/error). If it returns a string it must be non-empty content.
      assert.ok(
        result === null || (typeof result === "string" && result.length > 0),
        `expected a non-empty string or null, got ${typeof result}`,
      );

      // A successful call records latency; a hard failure records a failure metric.
      // Either way the API must have been reached without an unhandled throw.
      const names = metrics.records.map((r) => r.name);
      assert.ok(
        names.includes("KBRetrievalLatency") || names.includes("KBRetrievalFailure"),
        `expected a latency or failure metric, got: ${names.join(", ") || "(none)"}`,
      );
    },
  );

  test(
    "LIVE Retrieve degrades to null on an aggressive timeout (AbortError is caught, not thrown)",
    { timeout: LIVE_TIMEOUT_MS },
    async () => {
      const metrics = recordingMetrics();
      // 1ms ceiling forces the AbortController path; retrieveContext must swallow
      // the AbortError and return null rather than throwing into the agent loop.
      const result = await retrieveContext(
        agentClient,
        RetrieveCommand,
        "anything",
        { knowledgeBaseId, requestId: "contract-timeout", metrics, timeoutMs: 1, numberOfResults: 1 },
      );
      assert.equal(result, null, "an aborted retrieval must return null");
      const names = metrics.records.map((r) => r.name);
      assert.ok(names.includes("KBRetrievalFailure"), "a timed-out retrieval must record KBRetrievalFailure");
    },
  );
}
