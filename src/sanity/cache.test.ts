import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getBlogListingCache, setBlogListingCache } from './cache';
import type { BlogListingResult } from './types';

describe('cache', () => {
  const mockData: BlogListingResult = {
    posts: [
      {
        _id: 'post-1',
        title: 'Test Post',
        slug: { current: 'test-post' },
        excerpt: 'A test post excerpt',
        category: 'Technology',
        publishedAt: '2026-01-01',
      },
    ],
    tags: [
      { _id: 'tag-1', title: 'Tech', slug: { current: 'tech' } },
    ],
    series: [
      { _id: 'series-1', title: 'Test Series', slug: { current: 'test-series' } },
    ],
  };

  beforeEach(() => {
    vi.useFakeTimers();
    // Reset the module-level cache by importing fresh
    // Since cache is module-scoped, we set it via setBlogListingCache
    // and read via getBlogListingCache. We need to clear it between tests.
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should return null when cache is empty', () => {
    // On first import with no data set, cache should be null
    // We rely on module reset or test isolation
    expect(getBlogListingCache()).toBeNull();
  });

  it('should return cached data after setting it', () => {
    setBlogListingCache(mockData);
    const result = getBlogListingCache();
    expect(result).toEqual(mockData);
  });

  it('should return the same data object that was set', () => {
    setBlogListingCache(mockData);
    const result = getBlogListingCache();
    expect(result?.posts).toHaveLength(1);
    expect(result?.posts[0].title).toBe('Test Post');
    expect(result?.tags).toHaveLength(1);
    expect(result?.series).toHaveLength(1);
  });

  it('should return null after TTL (5 minutes) expires', () => {
    setBlogListingCache(mockData);

    // Verify data is cached
    expect(getBlogListingCache()).toEqual(mockData);

    // Advance time by 5 minutes + 1ms
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);

    // Cache should be expired
    expect(getBlogListingCache()).toBeNull();
  });

  it('should return data just before TTL expires', () => {
    setBlogListingCache(mockData);

    // Advance time to just under 5 minutes
    vi.advanceTimersByTime(5 * 60 * 1000 - 1);

    expect(getBlogListingCache()).toEqual(mockData);
  });

  it('should overwrite previous cache when set again', () => {
    const updatedData: BlogListingResult = {
      posts: [
        {
          _id: 'post-2',
          title: 'Updated Post',
          slug: { current: 'updated-post' },
          excerpt: 'An updated excerpt',
          category: 'AI',
          publishedAt: '2026-02-01',
        },
      ],
      tags: [],
      series: [],
    };

    setBlogListingCache(mockData);
    setBlogListingCache(updatedData);

    const result = getBlogListingCache();
    expect(result).toEqual(updatedData);
    expect(result?.posts[0].title).toBe('Updated Post');
  });

  it('should reset TTL when cache is overwritten', () => {
    setBlogListingCache(mockData);

    // Advance time by 4 minutes
    vi.advanceTimersByTime(4 * 60 * 1000);

    // Overwrite cache (resets TTL)
    setBlogListingCache(mockData);

    // Advance another 4 minutes (total 8 minutes from start, but only 4 from last set)
    vi.advanceTimersByTime(4 * 60 * 1000);

    // Should still be valid since TTL was reset
    expect(getBlogListingCache()).toEqual(mockData);
  });

  it('should return null after cache expires and then remains null on subsequent reads', () => {
    setBlogListingCache(mockData);

    // Expire the cache
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);

    expect(getBlogListingCache()).toBeNull();
    // Second read should also be null
    expect(getBlogListingCache()).toBeNull();
  });
});
