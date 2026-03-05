import { describe, it, expect } from 'vitest';
import {
  getPageContext,
  getSuggestionsForPage,
  PAGE_SUGGESTIONS,
} from './pageContext';

describe('pageContext', () => {
  describe('getPageContext', () => {
    it('should return correct context for known routes', () => {
      const ctx = getPageContext('/', ['/']);
      expect(ctx.currentPage).toBe('/');
      expect(ctx.pageTitle).toBe('Home');
      expect(ctx.section).toBe('Home');
      expect(ctx.visitedPages).toEqual(['/']);
    });

    it('should return correct context for the about page', () => {
      const ctx = getPageContext('/about', ['/', '/about']);
      expect(ctx.pageTitle).toBe('Personal Biography');
      expect(ctx.section).toBe('Personal Biography');
    });

    it('should return correct context for the chat page', () => {
      const ctx = getPageContext('/chat', ['/chat']);
      expect(ctx.pageTitle).toBe('AI Chat');
      expect(ctx.section).toBe('AI Chat');
    });

    it('should handle blog post slug routes', () => {
      const ctx = getPageContext('/blog/my-post', ['/blog', '/blog/my-post']);
      expect(ctx.pageTitle).toBe('Blog Post');
      expect(ctx.section).toBe('Blog Post (my-post)');
    });

    it('should not treat /blog as a blog post', () => {
      const ctx = getPageContext('/blog', ['/blog']);
      expect(ctx.pageTitle).toBe('Blog');
      expect(ctx.section).toBe('Blog');
    });

    it('should return default values for unknown routes', () => {
      const ctx = getPageContext('/unknown-page', []);
      expect(ctx.pageTitle).toBe('Page');
      expect(ctx.section).toBe('General');
    });

    it('should pass through visitedPages unchanged', () => {
      const visited = ['/', '/about', '/blog'];
      const ctx = getPageContext('/blog', visited);
      expect(ctx.visitedPages).toBe(visited);
    });
  });

  describe('getSuggestionsForPage', () => {
    it('should return page-specific suggestions for known pages', () => {
      const suggestions = getSuggestionsForPage('/');
      expect(suggestions).toEqual(PAGE_SUGGESTIONS['/']);
      expect(suggestions).toHaveLength(4);
    });

    it('should return about-specific suggestions', () => {
      const suggestions = getSuggestionsForPage('/about');
      expect(suggestions).toEqual(PAGE_SUGGESTIONS['/about']);
    });

    it('should return blog post suggestions for blog slug routes', () => {
      const suggestions = getSuggestionsForPage('/blog/some-article');
      expect(suggestions).toContain('Can you summarize this post?');
      expect(suggestions).toHaveLength(4);
    });

    it('should not return blog post suggestions for /blog itself', () => {
      const suggestions = getSuggestionsForPage('/blog');
      expect(suggestions).toEqual(PAGE_SUGGESTIONS['/blog']);
    });

    it('should return default suggestions for unknown routes', () => {
      const suggestions = getSuggestionsForPage('/nonexistent');
      expect(suggestions).toHaveLength(4);
      expect(suggestions[0]).toContain('Green Beret');
    });
  });
});
