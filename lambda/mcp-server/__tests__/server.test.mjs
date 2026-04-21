import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { buildMcpServer, PROTOCOL_VERSION } from "../server.mjs";

function fakeTool({ name = "echo", returns = { content: [{ type: "text", text: "ok" }] } } = {}) {
  let lastArgs = null;
  return {
    name,
    description: `fake ${name}`,
    inputSchema: {
      type: "object",
      properties: { text: { type: "string" } },
      required: ["text"],
    },
    handler: async ({ arguments: args }) => {
      lastArgs = args;
      return returns;
    },
    getLastArgs: () => lastArgs,
  };
}

describe("buildMcpServer — initialize", () => {
  it("returns protocol version and server info", async () => {
    const tool = fakeTool();
    const server = buildMcpServer({
      tools: [tool],
      serverInfo: { name: "alti-mcp", version: "1.2.3" },
    });
    const resp = await server.handle({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
    assert.equal(resp.jsonrpc, "2.0");
    assert.equal(resp.id, 1);
    assert.equal(resp.result.protocolVersion, PROTOCOL_VERSION);
    assert.deepEqual(resp.result.capabilities, { tools: {} });
    assert.equal(resp.result.serverInfo.name, "alti-mcp");
    assert.equal(resp.result.serverInfo.version, "1.2.3");
    assert.ok(typeof resp.result.instructions === "string");
  });

  it("uses a default serverInfo when none is provided", async () => {
    const server = buildMcpServer({ tools: [fakeTool()] });
    const resp = await server.handle({ jsonrpc: "2.0", id: 1, method: "initialize" });
    assert.equal(resp.result.serverInfo.name, "alti-mcp");
  });
});

describe("buildMcpServer — tools/list", () => {
  it("returns all tool descriptors with their input schemas", async () => {
    const server = buildMcpServer({
      tools: [fakeTool({ name: "one" }), fakeTool({ name: "two" })],
    });
    const resp = await server.handle({ jsonrpc: "2.0", id: 2, method: "tools/list" });
    assert.equal(resp.result.tools.length, 2);
    assert.equal(resp.result.tools[0].name, "one");
    assert.equal(resp.result.tools[1].name, "two");
    assert.equal(resp.result.tools[0].inputSchema.type, "object");
  });
});

describe("buildMcpServer — tools/call", () => {
  it("dispatches arguments to the matching tool handler", async () => {
    const tool = fakeTool({ name: "echo", returns: { content: [{ type: "text", text: "hi" }] } });
    const server = buildMcpServer({ tools: [tool] });
    const resp = await server.handle({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "echo", arguments: { text: "hello" } },
    });
    assert.equal(resp.result.content[0].text, "hi");
    assert.deepEqual(tool.getLastArgs(), { text: "hello" });
  });

  it("returns INVALID_PARAMS for an unknown tool name", async () => {
    const server = buildMcpServer({ tools: [fakeTool({ name: "known" })] });
    const resp = await server.handle({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "nope", arguments: {} },
    });
    assert.equal(resp.error.code, -32602);
    assert.match(resp.error.data, /Unknown tool: nope/);
  });

  it("wraps handler errors in INTERNAL_ERROR", async () => {
    const tool = {
      name: "boom",
      description: "explodes",
      inputSchema: { type: "object" },
      handler: async () => {
        throw new Error("kaboom");
      },
    };
    const server = buildMcpServer({ tools: [tool] });
    const resp = await server.handle({
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: { name: "boom", arguments: {} },
    });
    assert.equal(resp.error.code, -32603);
    assert.equal(resp.error.data, "kaboom");
  });

  it("passes through a missing arguments field as empty object", async () => {
    const tool = fakeTool();
    const server = buildMcpServer({ tools: [tool] });
    await server.handle({
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: { name: "echo" },
    });
    assert.deepEqual(tool.getLastArgs(), {});
  });
});

describe("buildMcpServer — ping and notifications", () => {
  it("responds to ping with an empty result", async () => {
    const server = buildMcpServer({ tools: [fakeTool()] });
    const resp = await server.handle({ jsonrpc: "2.0", id: 7, method: "ping" });
    assert.deepEqual(resp.result, {});
  });

  it("returns null for notifications/initialized (no response body)", async () => {
    const server = buildMcpServer({ tools: [fakeTool()] });
    const resp = await server.handle({ jsonrpc: "2.0", method: "notifications/initialized" });
    assert.equal(resp, null);
  });

  it("returns null for notifications/cancelled", async () => {
    const server = buildMcpServer({ tools: [fakeTool()] });
    const resp = await server.handle({ jsonrpc: "2.0", method: "notifications/cancelled" });
    assert.equal(resp, null);
  });
});

describe("buildMcpServer — malformed requests", () => {
  it("rejects non-object body", async () => {
    const server = buildMcpServer({ tools: [fakeTool()] });
    const resp = await server.handle("not an object");
    assert.equal(resp.error.code, -32600);
  });

  it("rejects wrong jsonrpc version", async () => {
    const server = buildMcpServer({ tools: [fakeTool()] });
    const resp = await server.handle({ jsonrpc: "1.0", id: 1, method: "initialize" });
    assert.equal(resp.error.code, -32600);
    assert.equal(resp.error.data, "jsonrpc must be '2.0'");
  });

  it("returns METHOD_NOT_FOUND for unknown methods", async () => {
    const server = buildMcpServer({ tools: [fakeTool()] });
    const resp = await server.handle({ jsonrpc: "2.0", id: 8, method: "nonsense/whatever" });
    assert.equal(resp.error.code, -32601);
    assert.match(resp.error.data, /Unknown method: nonsense\/whatever/);
  });
});
