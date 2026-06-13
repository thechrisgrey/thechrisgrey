import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

// --- Isolate from AWS BEFORE importing the handler -------------------------
// kb-sync/index.mjs builds its BedrockAgentClient + CloudWatchClient at module
// scope (lines 14-15) with NO dependency-injection seam: the clients are not
// exported and the handler closes over them directly. The repo's established
// pattern for this exact situation (see lambda/metrics/__tests__/
// requestId-propagation.test.mjs) is to override the SDK client classes'
// `prototype.send` BEFORE importing the handler. That intercepts the *exact*
// clients the real handler uses while still running the entire real handler
// body: real event parsing, real StartIngestionJobCommand / PutMetricDataCommand
// construction, real response shaping, and the real try/catch error path.
//
// Defense-in-depth: strip every credential/IMDS source so that even if a stub
// were bypassed, the SDK could not reach the network.
delete process.env.AWS_ACCESS_KEY_ID;
delete process.env.AWS_SECRET_ACCESS_KEY;
delete process.env.AWS_SESSION_TOKEN;
delete process.env.AWS_PROFILE;
process.env.AWS_SHARED_CREDENTIALS_FILE = "/dev/null";
process.env.AWS_CONFIG_FILE = "/dev/null";
process.env.AWS_EC2_METADATA_DISABLED = "true";
process.env.AWS_REGION = "us-east-1";

const { BedrockAgentClient, StartIngestionJobCommand } = await import(
  "@aws-sdk/client-bedrock-agent"
);
const { CloudWatchClient, PutMetricDataCommand } = await import(
  "@aws-sdk/client-cloudwatch"
);

// These IDs are hard-coded as module constants in index.mjs. The Lambda has no
// env override for them, so the test asserts against the literal production
// values the handler actually ships (KB ARFYABW8HP / DataSource TXQTRAJOSD,
// per CLAUDE.md and lambda/kb-sync/iam-policy.json).
const EXPECTED_KB_ID = "ARFYABW8HP";
const EXPECTED_DATA_SOURCE_ID = "TXQTRAJOSD";
const EXPECTED_NAMESPACE = "TheChrisGrey/SiteMetrics";

// Capture every command sent through each SDK client. We swap the *behavior*
// per-test (success vs. throw) via mutable closures, but the interception is
// installed once on the real prototypes.
let bedrockCalls = [];
let bedrockBehavior = null; // (cmd) => response | throws
let cloudwatchCalls = [];
let cloudwatchBehavior = null;

// The real handler calls `client.send(new StartIngestionJobCommand(...))`.
// Overriding the prototype catches that exact send. We record the *real*
// command object (with its real `.input`) so assertions exercise the genuine
// command-construction logic, not a re-implementation.
BedrockAgentClient.prototype.send = async function bedrockStub(command) {
  bedrockCalls.push(command);
  if (bedrockBehavior) return bedrockBehavior(command);
  // Default: a response shaped like the real StartIngestionJob output —
  // { ingestionJob: { ingestionJobId, status, ... } }.
  return {
    ingestionJob: {
      ingestionJobId: "default-job-id",
      status: "STARTING",
    },
  };
};

CloudWatchClient.prototype.send = async function cloudwatchStub(command) {
  cloudwatchCalls.push(command);
  if (cloudwatchBehavior) return cloudwatchBehavior(command);
  return {}; // real PutMetricData returns an empty object on success
};

const { handler } = await import("../index.mjs");

// Silence the handler's structured console.log/error during tests; restore
// after each so a failure still surfaces useful output if needed.
let restoreConsole = null;
function muteConsole() {
  const log = console.log;
  const error = console.error;
  console.log = () => {};
  console.error = () => {};
  restoreConsole = () => {
    console.log = log;
    console.error = error;
  };
}

beforeEach(() => {
  bedrockCalls = [];
  cloudwatchCalls = [];
  bedrockBehavior = null;
  cloudwatchBehavior = null;
  muteConsole();
});

afterEach(() => {
  if (restoreConsole) restoreConsole();
  restoreConsole = null;
});

// A realistic S3 PUT event, matching the shape S3 actually delivers to a
// Lambda notification (Records[].s3.bucket.name / s3.object.key / eventName).
function s3PutEvent({
  bucket = "thechrisgrey-kb-source",
  key = "knowledge-base.txt",
  eventName = "ObjectCreated:Put",
} = {}) {
  return {
    Records: [
      {
        eventVersion: "2.1",
        eventSource: "aws:s3",
        awsRegion: "us-east-1",
        eventName,
        s3: {
          s3SchemaVersion: "1.0",
          bucket: { name: bucket, arn: `arn:aws:s3:::${bucket}` },
          object: { key, size: 1024, eTag: "abc123" },
        },
      },
    ],
  };
}

test("StartIngestionJob is built with the hard-coded KB + DataSource IDs", async () => {
  const response = await handler(s3PutEvent());

  assert.equal(
    bedrockCalls.length,
    1,
    "handler must send exactly one StartIngestionJobCommand"
  );

  const command = bedrockCalls[0];
  // The handler sends a *real* StartIngestionJobCommand; assert against the
  // genuine SDK class, not a duck-typed shape.
  assert.ok(
    command instanceof StartIngestionJobCommand,
    "command must be a real StartIngestionJobCommand instance"
  );
  // The real SDK stores the constructor config on `.input` (verified against
  // the live SDK), so this asserts the exact wiring the handler builds.
  assert.deepEqual(command.input, {
    knowledgeBaseId: EXPECTED_KB_ID,
    dataSourceId: EXPECTED_DATA_SOURCE_ID,
  });

  assert.equal(response.statusCode, 200);
});

test("success path returns 200 with the ingestionJobId from the Bedrock response", async () => {
  bedrockBehavior = () => ({
    ingestionJob: {
      ingestionJobId: "job-7f3a9c",
      status: "STARTING",
      knowledgeBaseId: EXPECTED_KB_ID,
      dataSourceId: EXPECTED_DATA_SOURCE_ID,
    },
  });

  const response = await handler(s3PutEvent({ key: "docs/new-entry.txt" }));

  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  assert.equal(body.message, "Knowledge Base sync triggered");
  // ingestionJobId must be read off the real response shape
  // (response.ingestionJob.ingestionJobId).
  assert.equal(body.ingestionJobId, "job-7f3a9c");
  // triggeredBy echoes the parsed S3 record(s).
  assert.deepEqual(body.triggeredBy, [
    {
      eventName: "ObjectCreated:Put",
      key: "docs/new-entry.txt",
      bucket: "thechrisgrey-kb-source",
    },
  ]);
});

test("success path publishes the KBSyncTriggered CloudWatch metric", async () => {
  await handler(s3PutEvent());

  assert.equal(
    cloudwatchCalls.length,
    1,
    "exactly one PutMetricDataCommand on the success path"
  );
  const metricCmd = cloudwatchCalls[0];
  assert.ok(
    metricCmd instanceof PutMetricDataCommand,
    "must be a real PutMetricDataCommand instance"
  );
  assert.equal(metricCmd.input.Namespace, EXPECTED_NAMESPACE);
  assert.equal(metricCmd.input.MetricData.length, 1);
  const datum = metricCmd.input.MetricData[0];
  assert.equal(datum.MetricName, "KBSyncTriggered");
  assert.equal(datum.Value, 1);
  assert.equal(datum.Unit, "Count");
  assert.ok(datum.Timestamp instanceof Date, "Timestamp is a Date");
});

test("multi-record S3 event still triggers a single ingestion job and echoes every record", async () => {
  // S3 can batch multiple object changes into one notification. The handler
  // summarizes all of them but triggers exactly one full-KB ingestion (the KB
  // re-ingests the whole data source regardless of which keys changed).
  const event = {
    Records: [
      s3PutEvent({ key: "a.txt", eventName: "ObjectCreated:Put" }).Records[0],
      s3PutEvent({ key: "b.txt", eventName: "ObjectRemoved:Delete" }).Records[0],
    ],
  };

  const response = await handler(event);

  assert.equal(
    bedrockCalls.length,
    1,
    "one ingestion job regardless of record count"
  );
  const body = JSON.parse(response.body);
  assert.deepEqual(
    body.triggeredBy.map((r) => ({ name: r.eventName, key: r.key })),
    [
      { name: "ObjectCreated:Put", key: "a.txt" },
      { name: "ObjectRemoved:Delete", key: "b.txt" },
    ]
  );
});

test("empty/non-matching event (no Records) does not crash and still maps to an empty summary", async () => {
  // The handler treats `event.Records || []`, so an event without Records (or a
  // direct/console test invoke) must not throw. NOTE: the handler does NOT
  // short-circuit on an empty event — it still fires an ingestion job. This
  // test pins that ACTUAL behavior rather than an assumed "ignore" path.
  const response = await handler({});

  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  assert.deepEqual(body.triggeredBy, []);
  // Documented reality: the current handler fires even with zero records.
  assert.equal(
    bedrockCalls.length,
    1,
    "current handler fires ingestion even on an empty event (no Records short-circuit)"
  );
});

test("Bedrock failure returns 500, swallows the error (no throw), and publishes KBSyncFailure", async () => {
  const boom = new Error("ingestion already running");
  boom.name = "ConflictException";
  bedrockBehavior = () => {
    throw boom;
  };

  // The handler intentionally does NOT re-throw (so S3 won't retry); it must
  // resolve, not reject.
  let response;
  await assert.doesNotReject(async () => {
    response = await handler(s3PutEvent());
  }, "handler must not throw on a Bedrock failure (prevents S3 retries)");

  assert.equal(response.statusCode, 500);
  const body = JSON.parse(response.body);
  assert.equal(body.message, "Failed to trigger Knowledge Base sync");
  assert.equal(body.error, "ingestion already running");

  // On failure it publishes KBSyncFailure (the only metric on this path).
  assert.equal(cloudwatchCalls.length, 1);
  assert.equal(
    cloudwatchCalls[0].input.MetricData[0].MetricName,
    "KBSyncFailure"
  );
});

test("a failing metric publish is swallowed and does not break the success path", async () => {
  // publishMetric does `.catch(...)` on the CloudWatch send, so a metric
  // outage must not turn a successful ingestion into a 500.
  cloudwatchBehavior = () => {
    const err = new Error("cloudwatch throttled");
    err.name = "ThrottlingException";
    throw err;
  };

  let response;
  await assert.doesNotReject(async () => {
    response = await handler(s3PutEvent());
  }, "a CloudWatch failure must not reject the handler");

  // Ingestion still happened and the response is still a success.
  assert.equal(bedrockCalls.length, 1);
  assert.equal(response.statusCode, 200);
});
