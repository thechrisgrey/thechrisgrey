import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { createKbCache } from "../kbCache.mjs";

function fakeClock() {
  let current = 0;
  return {
    now: () => current,
    advance: (ms) => {
      current += ms;
    },
  };
}

describe("createKbCache — basic get/set", () => {
  it("returns null for a missing key", () => {
    const cache = createKbCache();
    assert.equal(cache.get("missing"), null);
  });

  it("stores and retrieves values", () => {
    const cache = createKbCache();
    cache.set("key", "value");
    assert.equal(cache.get("key"), "value");
  });

  it("overwrites an existing key", () => {
    const cache = createKbCache();
    cache.set("key", "v1");
    cache.set("key", "v2");
    assert.equal(cache.get("key"), "v2");
  });

  it("clear() empties the cache", () => {
    const cache = createKbCache();
    cache.set("k", "v");
    cache.clear();
    assert.equal(cache.size(), 0);
    assert.equal(cache.get("k"), null);
  });
});

describe("createKbCache — TTL", () => {
  it("expires entries after ttlMs elapses", () => {
    const clock = fakeClock();
    const cache = createKbCache({ ttlMs: 1000, now: clock.now });
    cache.set("k", "v");
    clock.advance(500);
    assert.equal(cache.get("k"), "v");
    clock.advance(600);
    assert.equal(cache.get("k"), null);
  });

  it("expired entries are removed from the map", () => {
    const clock = fakeClock();
    const cache = createKbCache({ ttlMs: 100, now: clock.now });
    cache.set("k", "v");
    clock.advance(200);
    cache.get("k");
    assert.equal(cache.size(), 0);
  });
});

describe("createKbCache — LRU eviction", () => {
  it("evicts the oldest entry when maxEntries is exceeded", () => {
    const cache = createKbCache({ maxEntries: 2 });
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);
    assert.equal(cache.get("a"), null);
    assert.equal(cache.get("b"), 2);
    assert.equal(cache.get("c"), 3);
  });

  it("get() refreshes recency so the touched entry is not evicted next", () => {
    const cache = createKbCache({ maxEntries: 2 });
    cache.set("a", 1);
    cache.set("b", 2);
    cache.get("a"); // a is now most recently used
    cache.set("c", 3);
    assert.equal(cache.get("a"), 1);
    assert.equal(cache.get("b"), null);
    assert.equal(cache.get("c"), 3);
  });
});
