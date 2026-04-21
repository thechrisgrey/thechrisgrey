import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { buildAskAltiMcpTool } from "../tools/askAlti.mjs";

function makeBedrockClient(response) {
  const calls = [];
  return {
    calls,
    client: {
      send: async (cmd) => {
        calls.push(cmd);
        if (response instanceof Error) throw response;
        return typeof response === "function" ? await response(cmd) : response;
      },
    },
  };
}

function makeAgentClient(response) {
  const calls = [];
  return {
    calls,
    client: {
      send: async (cmd) => {
        calls.push(cmd);
        if (response instanceof Error) throw response;
        return typeof response === "function" ? await response(cmd) : response;
      },
    },
  };
}

class FakeInvokeModelCommand {
  constructor(input) {
    this.input = input;
  }
}

class FakeRetrieveCommand {
  constructor(input) {
    this.input = input;
  }
}

function encodeBedrockBody(obj) {
  const enc = new TextEncoder();
  return enc.encode(JSON.stringify(obj));
}

describe("ask_alti MCP tool — validation", () => {
  it("rejects a question that is too short", async () => {
    const tool = buildAskAltiMcpTool({
      bedrockClient: { send: async () => null },
      InvokeModelCommand: FakeInvokeModelCommand,
      modelId: "model-id",
    });
    const res = await tool.handler({ arguments: { question: "hi" } });
    assert.equal(res.isError, true);
    assert.match(res.content[0].text, /3-1000 characters/);
  });

  it("rejects when Bedrock is not configured", async () => {
    const tool = buildAskAltiMcpTool({});
    const res = await tool.handler({ arguments: { question: "Who is Christian?" } });
    assert.equal(res.isError, true);
    assert.match(res.content[0].text, /not configured/);
  });
});

describe("ask_alti MCP tool — happy path", () => {
  it("returns the Bedrock response text", async () => {
    const bedrock = makeBedrockClient({
      body: encodeBedrockBody({
        stop_reason: "end_turn",
        content: [{ type: "text", text: "Christian is a Green Beret and founder of Altivum." }],
      }),
    });
    const tool = buildAskAltiMcpTool({
      bedrockClient: bedrock.client,
      InvokeModelCommand: FakeInvokeModelCommand,
      modelId: "test-model",
    });
    const res = await tool.handler({ arguments: { question: "Who is Christian Perez?" } });
    assert.equal(res.isError, undefined);
    assert.equal(res.content[0].text, "Christian is a Green Beret and founder of Altivum.");
    assert.equal(bedrock.calls.length, 1);
    assert.equal(bedrock.calls[0].input.modelId, "test-model");
    const payload = JSON.parse(bedrock.calls[0].input.body);
    assert.ok(typeof payload.system === "string" && payload.system.includes("Alti"));
    assert.equal(payload.messages[0].role, "user");
    assert.equal(payload.messages[0].content, "Who is Christian Perez?");
  });

  it("attaches guardrail params when configured", async () => {
    const bedrock = makeBedrockClient({
      body: encodeBedrockBody({ stop_reason: "end_turn", content: [{ type: "text", text: "ok" }] }),
    });
    const tool = buildAskAltiMcpTool({
      bedrockClient: bedrock.client,
      InvokeModelCommand: FakeInvokeModelCommand,
      modelId: "m",
      guardrailId: "G1",
      guardrailVersion: "5",
    });
    await tool.handler({ arguments: { question: "Tell me about Altivum." } });
    const { input } = bedrock.calls[0];
    assert.equal(input.guardrailIdentifier, "G1");
    assert.equal(input.guardrailVersion, "5");
  });

  it("returns a guardrail message when stop_reason is guardrail_intervened", async () => {
    const bedrock = makeBedrockClient({
      body: encodeBedrockBody({
        stop_reason: "guardrail_intervened",
        content: [{ type: "text", text: "" }],
      }),
    });
    const tool = buildAskAltiMcpTool({
      bedrockClient: bedrock.client,
      InvokeModelCommand: FakeInvokeModelCommand,
      modelId: "m",
    });
    const res = await tool.handler({ arguments: { question: "Say something harmful." } });
    assert.match(res.content[0].text, /can't answer that/i);
  });
});

describe("ask_alti MCP tool — KB retrieval", () => {
  it("pulls KB context when an agent client and kbId are provided", async () => {
    const agent = makeAgentClient({
      retrievalResults: [
        { content: { text: "Christian served in 10th Special Forces Group." } },
        { content: { text: "He hosts The Vector Podcast." } },
      ],
    });
    const bedrock = makeBedrockClient({
      body: encodeBedrockBody({ stop_reason: "end_turn", content: [{ type: "text", text: "reply" }] }),
    });
    const tool = buildAskAltiMcpTool({
      bedrockClient: bedrock.client,
      InvokeModelCommand: FakeInvokeModelCommand,
      agentClient: agent.client,
      RetrieveCommand: FakeRetrieveCommand,
      kbId: "kb-123",
      modelId: "m",
    });
    await tool.handler({ arguments: { question: "What unit was he in?" } });

    assert.equal(agent.calls.length, 1);
    assert.equal(agent.calls[0].input.knowledgeBaseId, "kb-123");
    const payload = JSON.parse(bedrock.calls[0].input.body);
    assert.match(payload.system, /10th Special Forces Group/);
  });

  it("proceeds without KB context when retrieval throws", async () => {
    const agent = { send: async () => { throw new Error("kb down"); } };
    const bedrock = makeBedrockClient({
      body: encodeBedrockBody({ stop_reason: "end_turn", content: [{ type: "text", text: "reply" }] }),
    });
    const tool = buildAskAltiMcpTool({
      bedrockClient: bedrock.client,
      InvokeModelCommand: FakeInvokeModelCommand,
      agentClient: agent,
      RetrieveCommand: FakeRetrieveCommand,
      kbId: "kb-123",
      modelId: "m",
    });
    const res = await tool.handler({ arguments: { question: "Anything?" } });
    assert.equal(res.isError, undefined);
    const payload = JSON.parse(bedrock.calls[0].input.body);
    assert.match(payload.system, /No additional context was retrieved/);
  });
});

describe("ask_alti MCP tool — Bedrock failures", () => {
  it("returns a graceful error on Bedrock throw", async () => {
    const tool = buildAskAltiMcpTool({
      bedrockClient: { send: async () => { throw new Error("boom"); } },
      InvokeModelCommand: FakeInvokeModelCommand,
      modelId: "m",
    });
    const res = await tool.handler({ arguments: { question: "Tell me about Altivum." } });
    assert.equal(res.isError, true);
    assert.match(res.content[0].text, /unavailable/i);
  });
});
