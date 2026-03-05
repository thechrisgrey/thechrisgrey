import { describe, it, expect } from 'vitest';
import { prefetchRoute, prefetchBlogPostChunk } from './routeManifest';

// We cannot fully mock the dynamic imports since they are captured at module level,
// but we can test the prefetchRoute deduplication and error handling logic.

describe('routeManifest', () => {
  describe('prefetchRoute', () => {
    it('should not throw for unknown routes', () => {
      expect(() => prefetchRoute('/nonexistent')).not.toThrow();
    });

    it('should not throw for known routes', () => {
      expect(() => prefetchRoute('/about')).not.toThrow();
    });

    it('should handle duplicate calls without error (deduplication)', () => {
      // Calling the same route twice should not throw
      prefetchRoute('/contact');
      expect(() => prefetchRoute('/contact')).not.toThrow();
    });
  });

  describe('prefetchBlogPostChunk', () => {
    it('should be a function that returns a promise', () => {
      expect(typeof prefetchBlogPostChunk).toBe('function');
      // The import will attempt to resolve but we just verify it returns a thenable
      const result = prefetchBlogPostChunk();
      expect(result).toHaveProperty('then');
      // Catch any potential module resolution errors in test environment
      result.catch(() => {});
    });
  });
});
