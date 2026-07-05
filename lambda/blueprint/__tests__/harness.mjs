/**
 * Shared test helpers for the blueprint Lambda.
 */
import { createHmac } from "crypto";

export function makeEvent({ body = "", headers = {}, method = "POST", ip = "1.2.3.4" } = {}) {
  return {
    body,
    headers,
    requestContext: { http: { method, sourceIp: ip } },
  };
}

export function signBlueprintEvent(body, key, { offsetSeconds = 0 } = {}) {
  const ts = String(Math.floor(Date.now() / 1000) + offsetSeconds);
  const sig = createHmac("sha256", key).update(`${ts}.${body}`).digest("hex");
  return {
    "x-blueprint-timestamp": ts,
    "x-blueprint-signature": sig,
  };
}

/**
 * Build a canned Converse response shaped like the real ConverseCommand
 * response. `text` is the assistant message content; a guardrail block sets
 * stopReason "guardrail_intervened".
 */
export function bedrockResponseBody(text, { inputTokens = 100, outputTokens = 200, stopReason = "end_turn" } = {}) {
  return {
    output: { message: { role: "assistant", content: [{ text }] } },
    stopReason,
    usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens },
  };
}

/**
 * Scripted bedrock client that returns a sequence of responses in order of
 * invocation. Each entry is either a { text } object, an Error to throw, or
 * a { streamText, chunkSize? } object for streaming (InvokeModelWithResponseStream).
 */
export function scriptedBedrockClient(responses, { guardrailAction = "NONE", guardrailError = null } = {}) {
  let idx = 0;
  return {
    calls: [],
    guardrailCalls: [],
    async send(command, options) {
      // The input guardrail pre-check (ApplyGuardrailCommand) is answered from
      // guardrailAction/guardrailError and recorded separately — it does NOT
      // consume a scripted generation response or appear in `calls`, so
      // generation-call assertions (counts, indices) are unaffected.
      if (command?.constructor?.name === "ApplyGuardrailCommand") {
        this.guardrailCalls.push({ command, options });
        if (guardrailError) throw guardrailError;
        return { action: guardrailAction };
      }
      const call = { command, options };
      this.calls.push(call);
      const entry = responses[idx++];
      if (!entry) {
        throw new Error(`scriptedBedrockClient: no more responses (call #${idx})`);
      }
      if (entry instanceof Error) {
        throw entry;
      }
      if (typeof entry.streamText === "string") {
        return bedrockStreamResponse(entry.streamText, entry);
      }
      return bedrockResponseBody(entry.text, { ...entry.usage, stopReason: entry.stopReason });
    },
  };
}

/**
 * Canned streaming response: turns a target string into ConverseStream events
 * (messageStart → contentBlockDelta × N → contentBlockStop → messageStop →
 * metadata) and exposes them as an async iterable on `.stream`. A guardrail
 * block sets the messageStop stopReason to "guardrail_intervened".
 */
export function bedrockStreamResponse(
  text,
  { chunkSize = 32, inputTokens = 150, outputTokens = 300, stopReason = "end_turn" } = {},
) {
  const deltas = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    deltas.push(text.slice(i, i + chunkSize));
  }
  const events = [
    { messageStart: { role: "assistant" } },
    ...deltas.map((d) => ({
      contentBlockDelta: { delta: { text: d }, contentBlockIndex: 0 },
    })),
    { contentBlockStop: { contentBlockIndex: 0 } },
    { messageStop: { stopReason } },
    {
      metadata: {
        usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens },
        metrics: { latencyMs: 1 },
      },
    },
  ];
  const stream = {
    [Symbol.asyncIterator]() {
      let i = 0;
      return {
        next() {
          if (i >= events.length) return Promise.resolve({ done: true });
          return Promise.resolve({ value: events[i++], done: false });
        },
      };
    },
  };
  return { stream };
}

/**
 * Sanity client stub that returns a fixed examples array for the golden
 * examples GROQ query.
 */
export function fakeSanityClient(examples) {
  return {
    async fetch() {
      return examples;
    },
  };
}

export function silentLogger() {
  return {
    info: () => {},
    warn: () => {},
    error: () => {},
  };
}

/**
 * Produce a valid BlueprintOutput object for use in tests. All required
 * fields populated with reasonable content.
 */
export function validBlueprintOutput(overrides = {}) {
  return {
    architecture_summary:
      "A straightforward serverless RAG chat on Bedrock Knowledge Base. " +
      "Lambda fronts the Function URL, retrieves 5 chunks via KB, invokes " +
      "Haiku 4.5, and streams tokens back to the browser. No containers, " +
      "no VPC, no GPU. Works under $20/month at 1k queries/day.",
    services: [
      {
        service: "AWS Lambda",
        purpose: "Host the chat Function URL and stream responses",
        rationale: "Cold start < 500ms, no infra to manage, scales to zero",
        cost_signal: "low",
      },
      {
        service: "Amazon Bedrock",
        purpose: "Invoke Claude Haiku 4.5 for generation",
        rationale: "Managed inference, no model hosting, pay-per-token",
        cost_signal: "medium",
      },
    ],
    diagram_mermaid: [
      "flowchart TD",
      "  Browser -->|HTTPS| Lambda",
      "  Lambda -->|Retrieve| KB[Bedrock KB]",
      "  Lambda -->|Invoke| Bedrock",
      "  Bedrock -->|Stream| Lambda",
      "  Lambda -->|Stream| Browser",
    ].join("\n"),
    iac_scaffold: {
      tool: "cdk",
      rationale: "CDK gives us TypeScript infrastructure with type-safe Bedrock + Lambda constructs",
      snippet:
        "import * as cdk from 'aws-cdk-lib';\n" +
        "import * as lambda from 'aws-cdk-lib/aws-lambda';\n" +
        "export class RagStack extends cdk.Stack {\n" +
        "  constructor(scope: cdk.App, id: string) { super(scope, id);\n" +
        "    const fn = new lambda.Function(this, 'Chat', {\n" +
        "      runtime: lambda.Runtime.NODEJS_20_X,\n" +
        "      handler: 'index.handler',\n" +
        "      code: lambda.Code.fromAsset('./dist'),\n" +
        "    });\n" +
        "    fn.addFunctionUrl({ authType: lambda.FunctionUrlAuthType.NONE });\n" +
        "  }\n}\n",
    },
    iam_highlights: [
      "Scope bedrock:InvokeModel to the specific model ARN, not *",
      "Scope bedrock:Retrieve to the specific knowledge-base ARN",
    ],
    cost_estimate: {
      monthly_low_usd: 5,
      monthly_high_usd: 30,
      assumptions: ["1k queries/day at 500 tokens in, 300 tokens out", "KB has 500MB of content"],
    },
    claude_artifacts: [
      {
        kind: "skill",
        name: "deploy-rag-stack",
        description: "Claude Code skill for deploying this RAG CDK stack to AWS with one command",
        body:
          "---\nname: deploy-rag-stack\ndescription: Deploy the RAG stack\n---\n\n" +
          "# Deploy RAG Stack\n\n" +
          "Run `npx cdk deploy` from the project root. Confirm Bedrock " +
          "access is enabled for the target account and that Haiku 4.5 is " +
          "available in us-east-1 before deploying.",
      },
    ],
    next_steps: [
      "Enable Bedrock access for anthropic.claude-haiku-4-5-20251001-v1:0 in your account",
      "Create the Knowledge Base and point its data source at your S3 bucket",
      "Run cdk deploy and copy the Function URL into your frontend",
    ],
    caveats: ["Assumes us-east-1; add a second region for DR in production"],
    ...overrides,
  };
}

export function validBlueprintInput(overrides = {}) {
  return {
    goal: "A serverless RAG chat for my personal documentation under $30/month",
    category: "rag",
    scale: { traffic: "1k queries/day", data_volume: "500MB of markdown" },
    constraints: { monthly_budget_usd: 30 },
    preferred_languages: ["typescript"],
    ...overrides,
  };
}
