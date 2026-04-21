import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { buildSearchBlogMcpTool } from "../tools/searchBlog.mjs";

function makeClient(response) {
  const calls = [];
  return {
    calls,
    client: {
      fetch: async (query, params) => {
        calls.push({ query, params });
        if (response instanceof Error) throw response;
        return typeof response === "function" ? response() : response;
      },
    },
  };
}

describe("search_blog MCP tool — metadata", () => {
  it("reports the expected name and description", () => {
    const { client } = makeClient([]);
    const tool = buildSearchBlogMcpTool({ sanityClient: client });
    assert.equal(tool.name, "search_blog");
    assert.match(tool.description, /Christian Perez/);
    assert.equal(tool.inputSchema.type, "object");
    assert.ok(tool.inputSchema.required.includes("query"));
  });
});

describe("search_blog MCP tool — input validation", () => {
  it("rejects a query shorter than 2 chars", async () => {
    const { client } = makeClient([]);
    const tool = buildSearchBlogMcpTool({ sanityClient: client });
    const res = await tool.handler({ arguments: { query: "a" } });
    assert.equal(res.isError, true);
    assert.match(res.content[0].text, /2-120 characters/);
  });

  it("rejects a stopword-only query", async () => {
    const { client } = makeClient([]);
    const tool = buildSearchBlogMcpTool({ sanityClient: client });
    const res = await tool.handler({ arguments: { query: "the a an" } });
    assert.equal(res.isError, true);
    assert.match(res.content[0].text, /meaningful keyword/);
  });
});

describe("search_blog MCP tool — happy path", () => {
  it("formats results with title, excerpt, and URL", async () => {
    const posts = [
      { slug: "alpha", title: "Alpha Post", excerpt: "About alpha.", publishedAt: "2025-01-01" },
      { slug: "beta", title: "Beta Post", excerpt: "About beta.", publishedAt: "2025-02-01" },
    ];
    const { client, calls } = makeClient(posts);
    const tool = buildSearchBlogMcpTool({ sanityClient: client });
    const res = await tool.handler({ arguments: { query: "strands agents" } });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].params.q, "strands agents");
    assert.equal(calls[0].params.limit, 3);
    assert.equal(res.isError, undefined);
    assert.match(res.content[0].text, /Found 2 posts matching "strands agents"/);
    assert.match(res.content[0].text, /Alpha Post/);
    assert.match(res.content[0].text, /Beta Post/);
    assert.match(res.content[0].text, /https:\/\/thechrisgrey\.com\/blog\/alpha/);
  });

  it("returns a friendly message when no results match", async () => {
    const { client } = makeClient([]);
    const tool = buildSearchBlogMcpTool({ sanityClient: client });
    const res = await tool.handler({ arguments: { query: "nonexistent-topic" } });
    assert.match(res.content[0].text, /No posts matching "nonexistent-topic"/);
  });

  it("clamps a limit of 99 to 5", async () => {
    const { client, calls } = makeClient([]);
    const tool = buildSearchBlogMcpTool({ sanityClient: client });
    await tool.handler({ arguments: { query: "strands", limit: 99 } });
    assert.equal(calls[0].params.limit, 5);
  });

  it("filters malformed rows out of the Sanity response", async () => {
    const mixed = [
      { slug: "ok", title: "OK", excerpt: "", publishedAt: "" },
      { slug: null, title: "Bad" },
      null,
      { slug: "ok2", title: "OK Two", excerpt: "x", publishedAt: "" },
    ];
    const { client } = makeClient(mixed);
    const tool = buildSearchBlogMcpTool({ sanityClient: client });
    const res = await tool.handler({ arguments: { query: "strands" } });
    assert.match(res.content[0].text, /Found 2 posts/);
    assert.match(res.content[0].text, /OK Two/);
  });
});

describe("search_blog MCP tool — errors", () => {
  it("returns a graceful error if Sanity throws", async () => {
    const { client } = makeClient(new Error("network down"));
    const tool = buildSearchBlogMcpTool({ sanityClient: client });
    const res = await tool.handler({ arguments: { query: "strands" } });
    assert.equal(res.isError, true);
    assert.match(res.content[0].text, /Unable to search/);
  });
});
