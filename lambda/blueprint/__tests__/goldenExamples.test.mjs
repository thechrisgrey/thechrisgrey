import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createGoldenExamplesFetcher,
  GOLDEN_EXAMPLES_QUERY,
} from "../goldenExamples.mjs";

function countingSanityClient(results, { failFirst = false } = {}) {
  let calls = 0;
  let shouldFail = failFirst;
  return {
    callCount: () => calls,
    setFail(v) { shouldFail = v; },
    async fetch(query) {
      calls++;
      if (shouldFail) {
        shouldFail = false;
        throw new Error("simulated Sanity outage");
      }
      return results;
    },
  };
}

test("GOLDEN_EXAMPLES_QUERY filters by isActive and orders by sortOrder", () => {
  assert.match(GOLDEN_EXAMPLES_QUERY, /isActive == true/);
  assert.match(GOLDEN_EXAMPLES_QUERY, /order\(sortOrder asc\)/);
});

test("fetcher serves cached results within TTL", async () => {
  const sanity = countingSanityClient([{ _id: "a" }]);
  const fetcher = createGoldenExamplesFetcher(sanity, { ttlMs: 60_000 });
  await fetcher.getExamples();
  await fetcher.getExamples();
  await fetcher.getExamples();
  assert.equal(sanity.callCount(), 1, "cache should serve 2nd/3rd calls");
});

test("fetcher refetches after TTL expires", async () => {
  let clock = 1000;
  const sanity = countingSanityClient([{ _id: "a" }]);
  const fetcher = createGoldenExamplesFetcher(sanity, {
    ttlMs: 500,
    now: () => clock,
  });
  await fetcher.getExamples();
  clock += 600; // past TTL
  await fetcher.getExamples();
  assert.equal(sanity.callCount(), 2);
});

test("fetcher negative-caches errors and returns empty list", async () => {
  const sanity = countingSanityClient([{ _id: "a" }], { failFirst: true });
  const fetcher = createGoldenExamplesFetcher(sanity, {
    ttlMs: 60_000,
    negativeTtlMs: 60_000,
  });
  const first = await fetcher.getExamples();
  assert.deepEqual(first, [], "failure returns []");
  const second = await fetcher.getExamples();
  assert.deepEqual(second, [], "served from negative cache");
  assert.equal(sanity.callCount(), 1, "no retry until negative TTL expires");
});

test("fetcher dedupes concurrent requests (single in-flight promise)", async () => {
  let resolveFetch;
  const slowFetcher = {
    calls: 0,
    async fetch() {
      this.calls++;
      await new Promise((r) => { resolveFetch = r; });
      return [{ _id: "x" }];
    },
  };
  const fetcher = createGoldenExamplesFetcher(slowFetcher);
  const p1 = fetcher.getExamples();
  const p2 = fetcher.getExamples();
  const p3 = fetcher.getExamples();
  resolveFetch();
  const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
  assert.equal(slowFetcher.calls, 1, "three concurrent calls → one fetch");
  assert.deepEqual(r1, r2);
  assert.deepEqual(r2, r3);
});

test("fetcher.clear() invalidates cache", async () => {
  const sanity = countingSanityClient([{ _id: "a" }]);
  const fetcher = createGoldenExamplesFetcher(sanity, { ttlMs: 60_000 });
  await fetcher.getExamples();
  fetcher.clear();
  await fetcher.getExamples();
  assert.equal(sanity.callCount(), 2);
});

test("fetcher returns [] when sanityClient is null", async () => {
  const fetcher = createGoldenExamplesFetcher(null);
  const res = await fetcher.getExamples();
  assert.deepEqual(res, []);
});

test("fetcher coerces non-array results to []", async () => {
  const sanity = {
    async fetch() {
      return null; // Sanity could theoretically return non-array
    },
  };
  const fetcher = createGoldenExamplesFetcher(sanity);
  const res = await fetcher.getExamples();
  assert.deepEqual(res, []);
});

test("negative cache expires and allows retry", async () => {
  let clock = 1000;
  const sanity = countingSanityClient([{ _id: "a" }], { failFirst: true });
  const fetcher = createGoldenExamplesFetcher(sanity, {
    negativeTtlMs: 100,
    ttlMs: 60_000,
    now: () => clock,
  });
  const first = await fetcher.getExamples();
  assert.deepEqual(first, []);
  clock += 200; // past negative TTL
  const second = await fetcher.getExamples();
  assert.deepEqual(second, [{ _id: "a" }]);
  assert.equal(sanity.callCount(), 2);
});
