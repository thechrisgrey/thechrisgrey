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

class FakeConverseCommand {
  constructor(input) {
    this.input = input;
  }
}

class FakeRetrieveCommand {
  constructor(input) {
    this.input = input;
  }
}

// A canned Converse response (the shape ConverseCommand returns).
function converseResponse({ text = "", stopReason = "end_turn" } = {}) {
  return {
    output: { message: { role: "assistant", content: [{ text }] } },
    stopReason,
    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
  };
}

describe("ask_alti MCP tool — validation", () => {
  it("rejects a question that is too short", async () => {
    const tool = buildAskAltiMcpTool({
      bedrockClient: { send: async () => null },
      ConverseCommand: FakeConverseCommand,
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
  it("returns the Bedrock response text and tags the user input with guardContent", async () => {
    const bedrock = makeBedrockClient(
      converseResponse({ text: "Christian is a Green Beret and founder of Altivum." }),
    );
    const tool = buildAskAltiMcpTool({
      bedrockClient: bedrock.client,
      ConverseCommand: FakeConverseCommand,
      modelId: "test-model",
    });
    const res = await tool.handler({ arguments: { question: "Who is Christian Perez?" } });
    assert.equal(res.isError, undefined);
    assert.equal(res.content[0].text, "Christian is a Green Beret and founder of Altivum.");
    assert.equal(bedrock.calls.length, 1);
    const { input } = bedrock.calls[0];
    assert.equal(input.modelId, "test-model");
    assert.ok(input.system[0].text.includes("Alti"));
    assert.equal(input.messages[0].role, "user");
    // The question is wrapped in guardContent so the guardrail evaluates only it.
    assert.equal(input.messages[0].content[0].guardContent.text.text, "Who is Christian Perez?");
  });

  it("attaches a Converse guardrailConfig when configured", async () => {
    const bedrock = makeBedrockClient(converseResponse({ text: "ok" }));
    const tool = buildAskAltiMcpTool({
      bedrockClient: bedrock.client,
      ConverseCommand: FakeConverseCommand,
      modelId: "m",
      guardrailId: "G1",
      guardrailVersion: "5",
    });
    await tool.handler({ arguments: { question: "Tell me about Altivum." } });
    const { input } = bedrock.calls[0];
    assert.equal(input.guardrailConfig.guardrailIdentifier, "G1");
    assert.equal(input.guardrailConfig.guardrailVersion, "5");
  });

  it("returns a guardrail message when stopReason is guardrail_intervened", async () => {
    const bedrock = makeBedrockClient(
      converseResponse({ text: "Sorry, I can't help with that.", stopReason: "guardrail_intervened" }),
    );
    const tool = buildAskAltiMcpTool({
      bedrockClient: bedrock.client,
      ConverseCommand: FakeConverseCommand,
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
    const bedrock = makeBedrockClient(converseResponse({ text: "reply" }));
    const tool = buildAskAltiMcpTool({
      bedrockClient: bedrock.client,
      ConverseCommand: FakeConverseCommand,
      agentClient: agent.client,
      RetrieveCommand: FakeRetrieveCommand,
      kbId: "kb-123",
      modelId: "m",
    });
    await tool.handler({ arguments: { question: "What unit was he in?" } });

    assert.equal(agent.calls.length, 1);
    assert.equal(agent.calls[0].input.knowledgeBaseId, "kb-123");
    assert.match(bedrock.calls[0].input.system[0].text, /10th Special Forces Group/);
  });

  it("proceeds without KB context when retrieval throws", async () => {
    const agent = { send: async () => { throw new Error("kb down"); } };
    const bedrock = makeBedrockClient(converseResponse({ text: "reply" }));
    const tool = buildAskAltiMcpTool({
      bedrockClient: bedrock.client,
      ConverseCommand: FakeConverseCommand,
      agentClient: agent,
      RetrieveCommand: FakeRetrieveCommand,
      kbId: "kb-123",
      modelId: "m",
    });
    const res = await tool.handler({ arguments: { question: "Anything?" } });
    assert.equal(res.isError, undefined);
    assert.match(bedrock.calls[0].input.system[0].text, /No additional context was retrieved/);
  });
});

describe("ask_alti MCP tool — Bedrock failures", () => {
  it("returns a graceful error on Bedrock throw", async () => {
    const tool = buildAskAltiMcpTool({
      bedrockClient: { send: async () => { throw new Error("boom"); } },
      ConverseCommand: FakeConverseCommand,
      modelId: "m",
    });
    const res = await tool.handler({ arguments: { question: "Tell me about Altivum." } });
    assert.equal(res.isError, true);
    assert.match(res.content[0].text, /unavailable/i);
  });
});
