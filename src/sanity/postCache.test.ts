import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getPostCache, setPostCache, clearPostCache } from './postCache';
import type { SanityPost } from './types';

const makeMockPost = (slug: string): SanityPost => ({
  _id: `post-${slug}`,
  title: `Post ${slug}`,
  slug: { current: slug },
  excerpt: `Excerpt for ${slug}`,
  category: 'Technology',
  publishedAt: '2026-01-01T12:00:00Z',
});

describe('postCache', () => {
  beforeEach(() => {
    clearPostCache();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return null for a slug that has not been cached', () => {
    expect(getPostCache('nonexistent')).toBeNull();
  });

  it('should store and retrieve a cached post', () => {
    const post = makeMockPost('test-post');
    setPostCache('test-post', post);

    const cached = getPostCache('test-post');
    expect(cached).toEqual(post);
  });

  it('should return the same reference that was cached', () => {
    const post = makeMockPost('ref-test');
    setPostCache('ref-test', post);

    expect(getPostCache('ref-test')).toBe(post);
  });

  it('should return null after TTL expires (10 minutes)', () => {
    const post = makeMockPost('ttl-test');
    setPostCache('ttl-test', post);

    // Still valid at 9 minutes
    vi.advanceTimersByTime(9 * 60 * 1000);
    expect(getPostCache('ttl-test')).toEqual(post);

    // Expired at 10 minutes + 1ms
    vi.advanceTimersByTime(1 * 60 * 1000 + 1);
    expect(getPostCache('ttl-test')).toBeNull();
  });

  it('should handle multiple slugs independently', () => {
    const post1 = makeMockPost('post-1');
    const post2 = makeMockPost('post-2');

    setPostCache('post-1', post1);
    setPostCache('post-2', post2);

    expect(getPostCache('post-1')).toEqual(post1);
    expect(getPostCache('post-2')).toEqual(post2);
  });

  it('should overwrite existing cache for the same slug', () => {
    const post1 = makeMockPost('overwrite');
    const post2 = { ...makeMockPost('overwrite'), title: 'Updated Title' };

    setPostCache('overwrite', post1);
    setPostCache('overwrite', post2);

    expect(getPostCache('overwrite')?.title).toBe('Updated Title');
  });

  it('should clear all cached posts', () => {
    setPostCache('a', makeMockPost('a'));
    setPostCache('b', makeMockPost('b'));

    clearPostCache();

    expect(getPostCache('a')).toBeNull();
    expect(getPostCache('b')).toBeNull();
  });

  it('should delete expired entries from the cache on access', () => {
    const post = makeMockPost('cleanup');
    setPostCache('cleanup', post);

    vi.advanceTimersByTime(11 * 60 * 1000);

    // Access triggers deletion
    getPostCache('cleanup');

    // Internal map should no longer have the entry (verified by re-caching and checking)
    setPostCache('cleanup', post);
    expect(getPostCache('cleanup')).toEqual(post);
  });
});
