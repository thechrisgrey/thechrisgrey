import { describe, it, expect } from 'vitest';
import { BLOG_LISTING_QUERY, POST_BY_SLUG_QUERY, PODCAST_GUESTS_QUERY } from './queries';

describe('GROQ queries', () => {
  describe('BLOG_LISTING_QUERY', () => {
    it('should be a non-empty string', () => {
      expect(typeof BLOG_LISTING_QUERY).toBe('string');
      expect(BLOG_LISTING_QUERY.length).toBeGreaterThan(0);
    });

    it('should query for post type', () => {
      expect(BLOG_LISTING_QUERY).toContain('_type == "post"');
    });

    it('should require defined slug', () => {
      expect(BLOG_LISTING_QUERY).toContain('defined(slug.current)');
    });

    it('should order by featured and publishedAt', () => {
      expect(BLOG_LISTING_QUERY).toContain('isFeatured desc');
      expect(BLOG_LISTING_QUERY).toContain('publishedAt desc');
    });

    it('should project essential post fields', () => {
      const expectedFields = ['_id', 'title', 'slug', 'excerpt', 'category', 'publishedAt', 'readingTime', 'isFeatured', 'image'];
      expectedFields.forEach((field) => {
        expect(BLOG_LISTING_QUERY).toContain(field);
      });
    });

    it('should include tags projection', () => {
      expect(BLOG_LISTING_QUERY).toContain('"tags"');
      expect(BLOG_LISTING_QUERY).toContain('tags[]->');
    });

    it('should include series projection', () => {
      expect(BLOG_LISTING_QUERY).toContain('"series"');
      expect(BLOG_LISTING_QUERY).toContain('series->');
    });

    it('should include seriesOrder field', () => {
      expect(BLOG_LISTING_QUERY).toContain('seriesOrder');
    });

    it('should also query for tags and series at top level', () => {
      expect(BLOG_LISTING_QUERY).toContain('_type == "tag"');
      expect(BLOG_LISTING_QUERY).toContain('_type == "series"');
    });
  });

  describe('POST_BY_SLUG_QUERY', () => {
    it('should be a non-empty string', () => {
      expect(typeof POST_BY_SLUG_QUERY).toBe('string');
      expect(POST_BY_SLUG_QUERY.length).toBeGreaterThan(0);
    });

    it('should query for post type', () => {
      expect(POST_BY_SLUG_QUERY).toContain('_type == "post"');
    });

    it('should filter by slug parameter', () => {
      expect(POST_BY_SLUG_QUERY).toContain('slug.current == $slug');
    });

    it('should select first result with [0]', () => {
      expect(POST_BY_SLUG_QUERY).toContain('[0]');
    });

    it('should include body field for full content', () => {
      expect(POST_BY_SLUG_QUERY).toContain('body[]');
    });

    it('should include relatedPosts projection', () => {
      expect(POST_BY_SLUG_QUERY).toContain('relatedPosts');
    });

    it('should include seriesPosts projection', () => {
      expect(POST_BY_SLUG_QUERY).toContain('seriesPosts');
    });

    it('should include SEO fields', () => {
      expect(POST_BY_SLUG_QUERY).toContain('seoTitle');
      expect(POST_BY_SLUG_QUERY).toContain('seoDescription');
    });

    it('should include pdfUrl field', () => {
      expect(POST_BY_SLUG_QUERY).toContain('pdfUrl');
    });
  });

  describe('PODCAST_GUESTS_QUERY', () => {
    it('should be a non-empty string', () => {
      expect(typeof PODCAST_GUESTS_QUERY).toBe('string');
      expect(PODCAST_GUESTS_QUERY.length).toBeGreaterThan(0);
    });

    it('should query for podcastGuest type', () => {
      expect(PODCAST_GUESTS_QUERY).toContain('_type == "podcastGuest"');
    });

    it('should order by order ascending', () => {
      expect(PODCAST_GUESTS_QUERY).toContain('order(order asc)');
    });

    it('should project guest fields', () => {
      const expectedFields = ['name', 'role', 'branch', 'episodeUrl', 'image', 'linkedinUrl', 'websiteUrl', 'websiteLabel', 'order'];
      expectedFields.forEach((field) => {
        expect(PODCAST_GUESTS_QUERY).toContain(field);
      });
    });
  });
});
