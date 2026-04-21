import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { buildGetBlogPostMcpTool } from "../tools/getBlogPost.mjs";

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

describe("get_blog_post MCP tool — metadata", () => {
  it("reports the expected schema", () => {
    const { client } = makeClient(null);
    const tool = buildGetBlogPostMcpTool({ sanityClient: client });
    assert.equal(tool.name, "get_blog_post");
    assert.ok(tool.inputSchema.required.includes("slug"));
    assert.equal(tool.inputSchema.properties.slug.pattern, "^[a-z0-9][a-z0-9-]*$");
  });
});

describe("get_blog_post MCP tool — validation", () => {
  it("rejects a slug with uppercase characters", async () => {
    const { client } = makeClient(null);
    const tool = buildGetBlogPostMcpTool({ sanityClient: client });
    const res = await tool.handler({ arguments: { slug: "Not-Valid" } });
    assert.equal(res.isError, true);
    assert.match(res.content[0].text, /lowercase alphanumeric/);
  });

  it("rejects a slug starting with a hyphen", async () => {
    const { client } = makeClient(null);
    const tool = buildGetBlogPostMcpTool({ sanityClient: client });
    const res = await tool.handler({ arguments: { slug: "-leading" } });
    assert.equal(res.isError, true);
  });

  it("rejects an empty slug", async () => {
    const { client } = makeClient(null);
    const tool = buildGetBlogPostMcpTool({ sanityClient: client });
    const res = await tool.handler({ arguments: { slug: "" } });
    assert.equal(res.isError, true);
  });
});

describe("get_blog_post MCP tool — happy path", () => {
  it("formats title, metadata, and body", async () => {
    const post = {
      slug: "building-alti",
      title: "Building Alti",
      excerpt: "How I wired up the agent.",
      publishedAt: "2025-10-01T12:00:00Z",
      body: "The long story of building the agent.",
      tags: ["agents", "bedrock"],
      series: { title: "Strands Tour", slug: "strands-tour" },
    };
    const { client } = makeClient(post);
    const tool = buildGetBlogPostMcpTool({ sanityClient: client });
    const res = await tool.handler({ arguments: { slug: "building-alti" } });

    assert.equal(res.isError, undefined);
    const text = res.content[0].text;
    assert.match(text, /^# Building Alti/);
    assert.match(text, /https:\/\/thechrisgrey\.com\/blog\/building-alti/);
    assert.match(text, /Published: 2025-10-01/);
    assert.match(text, /Tags: agents, bedrock/);
    assert.match(text, /Series: Strands Tour/);
    assert.match(text, /Excerpt: How I wired up the agent\./);
    assert.match(text, /The long story of building the agent\./);
  });

  it("truncates very long bodies and adds a footer note", async () => {
    const longBody = "x".repeat(9000);
    const post = {
      slug: "long-post",
      title: "Long",
      excerpt: "",
      publishedAt: "",
      body: longBody,
      tags: [],
      series: null,
    };
    const { client } = makeClient(post);
    const tool = buildGetBlogPostMcpTool({ sanityClient: client });
    const res = await tool.handler({ arguments: { slug: "long-post" } });
    assert.match(res.content[0].text, /\[Post truncated at 8000 characters/);
  });

  it("returns an error when Sanity returns no post", async () => {
    const { client } = makeClient(null);
    const tool = buildGetBlogPostMcpTool({ sanityClient: client });
    const res = await tool.handler({ arguments: { slug: "missing" } });
    assert.equal(res.isError, true);
    assert.match(res.content[0].text, /No blog post found for slug 'missing'/);
  });

  it("returns a graceful error when Sanity throws", async () => {
    const { client } = makeClient(new Error("timeout"));
    const tool = buildGetBlogPostMcpTool({ sanityClient: client });
    const res = await tool.handler({ arguments: { slug: "anything" } });
    assert.equal(res.isError, true);
    assert.match(res.content[0].text, /Unable to fetch/);
  });
});
