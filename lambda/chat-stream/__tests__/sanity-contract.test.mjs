/**
 * Sanity client CONTRACT test — opt-in, against the LIVE Sanity project.
 *
 * Every Sanity test in this repo mocks the client or intercepts at the network
 * layer; none proves the real `@sanity/client` can authenticate against project
 * k5950b3w and that the live schema still satisfies the GROQ projections the app
 * sends. A renamed field, a dropped `pt::text(body)`, or a reference that stopped
 * dereferencing would ship green (the generic `client.fetch<T>()` is a
 * compile-time promise only) and surface as a blank blog in production.
 *
 * This exercises the REAL lambda queries (lambda/shared/sanityQueries.mjs) the
 * chat searchBlog/cite tools send, plus a representative listing projection.
 *
 * GATING: skips cleanly (exit 0) unless SANITY_CONTRACT_TESTS is set. Enable with:
 *
 *   SANITY_CONTRACT_TESTS=1 node --test lambda/chat-stream/__tests__/sanity-contract.test.mjs
 *
 * Optional env: SANITY_PROJECT_ID (default k5950b3w), SANITY_DATASET (default
 * production), SANITY_API_VERSION (default 2024-01-01). Public dataset reads need
 * no token. Requires at least one published post to assert post-shape contracts.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

if (!process.env.SANITY_CONTRACT_TESTS) {
  test("sanity contract (skipped: set SANITY_CONTRACT_TESTS=1 to run against live Sanity)", { skip: true }, () => {});
} else {
  const { createClient } = await import("@sanity/client");
  const { BLOG_CITE_QUERY, BLOG_FULL_POST_QUERY, BLOG_SEARCH_QUERY } = await import("../../shared/sanityQueries.mjs");

  // Matches src/sanity/client.ts exactly so we test the same surface the app uses.
  const client = createClient({
    projectId: process.env.SANITY_PROJECT_ID || "k5950b3w",
    dataset: process.env.SANITY_DATASET || "production",
    apiVersion: process.env.SANITY_API_VERSION || "2024-01-01",
    useCdn: true,
    timeout: 10000,
  });

  const LISTING_QUERY = `*[_type == "post" && defined(slug.current)] | order(publishedAt desc)[0...3]{
    _id, title, "slug": slug.current, excerpt, category, publishedAt
  }`;

  const LIVE_TIMEOUT_MS = 30_000;

  test("LIVE listing query returns posts with the required preview fields", { timeout: LIVE_TIMEOUT_MS }, async () => {
    const posts = await client.fetch(LISTING_QUERY);
    assert.ok(Array.isArray(posts), "listing must return an array");
    assert.ok(posts.length > 0, "live project must contain at least one published post for this contract");
    for (const p of posts) {
      assert.equal(typeof p._id, "string", "_id must be a string");
      assert.equal(typeof p.title, "string", "title must be a string");
      assert.equal(typeof p.slug, "string", "slug.current must project to a string");
      assert.equal(typeof p.excerpt, "string", "excerpt must be a string");
      assert.equal(typeof p.publishedAt, "string", "publishedAt must be a string");
    }
  });

  test(
    "LIVE BLOG_FULL_POST_QUERY + BLOG_CITE_QUERY resolve a real slug to the expected shape",
    { timeout: LIVE_TIMEOUT_MS },
    async () => {
      const [first] = await client.fetch(LISTING_QUERY);
      assert.ok(first?.slug, "need a real slug to test the single-post queries");

      const full = await client.fetch(BLOG_FULL_POST_QUERY, { slug: first.slug });
      assert.ok(full, `BLOG_FULL_POST_QUERY returned null for known slug ${first.slug}`);
      assert.equal(typeof full.title, "string", "title must be a string");
      assert.equal(typeof full.slug, "string", "slug must project to a string");
      // `body` is projected via pt::text(body) — a string (possibly empty). If the
      // schema renamed `body`, this projection would come back undefined.
      assert.ok("body" in full, "BLOG_FULL_POST_QUERY must project a `body` field (pt::text)");

      const cite = await client.fetch(BLOG_CITE_QUERY, { slug: first.slug });
      assert.ok(cite, "BLOG_CITE_QUERY returned null for a known slug");
      assert.equal(typeof cite.title, "string", "cite title must be a string");
    },
  );

  test("LIVE single-post query returns null for a nonexistent slug", { timeout: LIVE_TIMEOUT_MS }, async () => {
    const missing = await client.fetch(BLOG_FULL_POST_QUERY, {
      slug: "this-slug-does-not-exist-contract-test",
    });
    assert.equal(missing, null, "a nonexistent slug must resolve to null");
  });

  test("LIVE BLOG_SEARCH_QUERY executes and returns an array", { timeout: LIVE_TIMEOUT_MS }, async () => {
    const results = await client.fetch(BLOG_SEARCH_QUERY, { q: "a*", limit: 5 });
    assert.ok(Array.isArray(results), "search must return an array (may be empty)");
  });
}
