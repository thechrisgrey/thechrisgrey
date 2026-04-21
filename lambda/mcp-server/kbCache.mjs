/**
 * Time-bounded in-memory cache for Bedrock Knowledge Base retrievals.
 *
 * MCP invocations from external clients are bursty and repetitive
 * (several clients may ask similar questions in the same minute).
 * A 5-minute TTL LRU cuts Bedrock cost and latency without going stale
 * faster than the KB itself refreshes (on-upload, via the kb-sync Lambda).
 */

const DEFAULT_TTL_MS = 5 * 60 * 1000;
const DEFAULT_MAX_ENTRIES = 100;

export function createKbCache({
  ttlMs = DEFAULT_TTL_MS,
  maxEntries = DEFAULT_MAX_ENTRIES,
  now = Date.now,
} = {}) {
  const store = new Map();

  function evictIfFull() {
    while (store.size > maxEntries) {
      const oldestKey = store.keys().next().value;
      if (oldestKey === undefined) break;
      store.delete(oldestKey);
    }
  }

  function get(key) {
    const entry = store.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= now()) {
      store.delete(key);
      return null;
    }
    // Refresh LRU position.
    store.delete(key);
    store.set(key, entry);
    return entry.value;
  }

  function set(key, value) {
    if (store.has(key)) store.delete(key);
    store.set(key, { value, expiresAt: now() + ttlMs });
    evictIfFull();
  }

  function clear() {
    store.clear();
  }

  function size() {
    return store.size;
  }

  return { get, set, clear, size };
}
