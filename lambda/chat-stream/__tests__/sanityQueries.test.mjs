import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import {
  SITE_ORIGIN,
  BLOG_SEARCH_QUERY,
  BLOG_CITE_QUERY,
  BLOG_FULL_POST_QUERY,
  normalizeQuery,
  isMeaningful,
} from "lambda-shared/sanityQueries";

describe("sanityQueries — constants", () => {
  it("SITE_ORIGIN is the canonical site URL", () => {
    assert.equal(SITE_ORIGIN, "https://thechrisgrey.com");
  });

  it("BLOG_SEARCH_QUERY is a non-empty GROQ string with score() ranking", () => {
    assert.equal(typeof BLOG_SEARCH_QUERY, "string");
    assert.ok(BLOG_SEARCH_QUERY.length > 0);
    assert.match(BLOG_SEARCH_QUERY, /score\(/);
    assert.match(BLOG_SEARCH_QUERY, /order\(_score desc\)/);
  });

  it("BLOG_CITE_QUERY fetches a single post by slug", () => {
    assert.equal(typeof BLOG_CITE_QUERY, "string");
    assert.match(BLOG_CITE_QUERY, /slug\.current == \$slug/);
    assert.match(BLOG_CITE_QUERY, /\[0\]/);
  });

  it("BLOG_FULL_POST_QUERY pulls body as portable-text text", () => {
    assert.equal(typeof BLOG_FULL_POST_QUERY, "string");
    assert.match(BLOG_FULL_POST_QUERY, /pt::text\(body\)/);
    assert.match(BLOG_FULL_POST_QUERY, /tags/);
  });
});

describe("sanityQueries — normalizeQuery", () => {
  it("trims leading and trailing whitespace", () => {
    assert.equal(normalizeQuery("  hello  "), "hello");
  });

  it("collapses internal whitespace to single space", () => {
    assert.equal(normalizeQuery("hello    world\t\tfoo"), "hello world foo");
  });

  it("handles empty string", () => {
    assert.equal(normalizeQuery(""), "");
  });

  it("handles null and undefined safely", () => {
    assert.equal(normalizeQuery(null), "");
    assert.equal(normalizeQuery(undefined), "");
  });
});

describe("sanityQueries — isMeaningful", () => {
  it("returns true when at least one non-stopword is present", () => {
    assert.equal(isMeaningful("Green Beret"), true);
    assert.equal(isMeaningful("strands agents"), true);
    assert.equal(isMeaningful("the podcast"), true);
  });

  it("returns false when query is only stopwords", () => {
    assert.equal(isMeaningful("the a an"), false);
    assert.equal(isMeaningful("is it"), false);
  });

  it("returns false on empty string", () => {
    assert.equal(isMeaningful(""), false);
  });

  it("is case-insensitive for stopword detection", () => {
    assert.equal(isMeaningful("THE A AN"), false);
    assert.equal(isMeaningful("Green"), true);
  });
});
