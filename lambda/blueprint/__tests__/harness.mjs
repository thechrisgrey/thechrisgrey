/**
 * Shared test helpers for the blueprint Lambda.
 */
import { createHmac } from "crypto";

export function makeEvent({
  body = "",
  headers = {},
  method = "POST",
  ip = "1.2.3.4",
} = {}) {
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
 * Build a canned Anthropic-on-Bedrock response body shaped like the real
 * InvokeModelCommand response. `text` is the assistant message content.
 */
export function bedrockResponseBody(text, { inputTokens = 100, outputTokens = 200 } = {}) {
  const payload = {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-test",
    content: [{ type: "text", text }],
    stop_reason: "end_turn",
    usage: { input_tokens: inputTokens, output_tokens: outputTokens },
  };
  return {
    body: new TextEncoder().encode(JSON.stringify(payload)),
  };
}

/**
 * Scripted bedrock client that returns a sequence of responses in order of
 * invocation. Each entry is either a { text } object, an Error to throw, or
 * a { streamText, chunkSize? } object for streaming (InvokeModelWithResponseStream).
 */
export function scriptedBedrockClient(responses) {
  let idx = 0;
  return {
    calls: [],
    async send(command, options) {
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
      return bedrockResponseBody(entry.text, entry.usage);
    },
  };
}

/**
 * Canned streaming response: turns a target string into Anthropic-on-Bedrock
 * streaming events (message_start → content_block_delta × N → message_delta →
 * message_stop) and exposes them as an async iterable on `.body`.
 */
export function bedrockStreamResponse(text, {
  chunkSize = 32,
  inputTokens = 150,
  outputTokens = 300,
} = {}) {
  const deltas = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    deltas.push(text.slice(i, i + chunkSize));
  }
  const events = [
    {
      type: "message_start",
      message: { usage: { input_tokens: inputTokens, output_tokens: 0 } },
    },
    ...deltas.map((d) => ({
      type: "content_block_delta",
      delta: { type: "text_delta", text: d },
    })),
    {
      type: "message_delta",
      delta: { stop_reason: "end_turn" },
      usage: { output_tokens: outputTokens },
    },
    { type: "message_stop" },
  ];
  const encoder = new TextEncoder();
  const body = {
    [Symbol.asyncIterator]() {
      let i = 0;
      return {
        next() {
          if (i >= events.length) return Promise.resolve({ done: true });
          const ev = events[i++];
          return Promise.resolve({
            value: { chunk: { bytes: encoder.encode(JSON.stringify(ev)) } },
            done: false,
          });
        },
      };
    },
  };
  return { body };
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
      "A straightforward serverless RAG chat on Bedrock Knowledge Base. "
      + "Lambda fronts the Function URL, retrieves 5 chunks via KB, invokes "
      + "Haiku 4.5, and streams tokens back to the browser. No containers, "
      + "no VPC, no GPU. Works under $20/month at 1k queries/day.",
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
        "import * as cdk from 'aws-cdk-lib';\n"
        + "import * as lambda from 'aws-cdk-lib/aws-lambda';\n"
        + "export class RagStack extends cdk.Stack {\n"
        + "  constructor(scope: cdk.App, id: string) { super(scope, id);\n"
        + "    const fn = new lambda.Function(this, 'Chat', {\n"
        + "      runtime: lambda.Runtime.NODEJS_20_X,\n"
        + "      handler: 'index.handler',\n"
        + "      code: lambda.Code.fromAsset('./dist'),\n"
        + "    });\n"
        + "    fn.addFunctionUrl({ authType: lambda.FunctionUrlAuthType.NONE });\n"
        + "  }\n}\n",
    },
    iam_highlights: [
      "Scope bedrock:InvokeModel to the specific model ARN, not *",
      "Scope bedrock:Retrieve to the specific knowledge-base ARN",
    ],
    cost_estimate: {
      monthly_low_usd: 5,
      monthly_high_usd: 30,
      assumptions: [
        "1k queries/day at 500 tokens in, 300 tokens out",
        "KB has 500MB of content",
      ],
    },
    claude_artifacts: [
      {
        kind: "skill",
        name: "deploy-rag-stack",
        description:
          "Claude Code skill for deploying this RAG CDK stack to AWS with one command",
        body:
          "---\nname: deploy-rag-stack\ndescription: Deploy the RAG stack\n---\n\n"
          + "# Deploy RAG Stack\n\n"
          + "Run `npx cdk deploy` from the project root. Confirm Bedrock "
          + "access is enabled for the target account and that Haiku 4.5 is "
          + "available in us-east-1 before deploying.",
      },
    ],
    next_steps: [
      "Enable Bedrock access for anthropic.claude-haiku-4-5-20251001-v1:0 in your account",
      "Create the Knowledge Base and point its data source at your S3 bucket",
      "Run cdk deploy and copy the Function URL into your frontend",
    ],
    caveats: [
      "Assumes us-east-1; add a second region for DR in production",
    ],
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
