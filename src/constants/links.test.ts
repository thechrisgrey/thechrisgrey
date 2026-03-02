import { describe, it, expect } from 'vitest';
import { SOCIAL_LINKS } from './links';

describe('SOCIAL_LINKS', () => {
  it('should be a non-empty object', () => {
    expect(typeof SOCIAL_LINKS).toBe('object');
    expect(Object.keys(SOCIAL_LINKS).length).toBeGreaterThan(0);
  });

  it('should have no empty string values', () => {
    Object.entries(SOCIAL_LINKS).forEach(([key, value]) => {
      expect(value, `${key} should not be empty`).not.toBe('');
    });
  });

  it('should have all values as strings', () => {
    Object.entries(SOCIAL_LINKS).forEach(([key, value]) => {
      expect(typeof value, `${key} should be a string`).toBe('string');
    });
  });

  describe('URL format validation', () => {
    it('should have all values starting with https://, mailto:, or tel:', () => {
      const validPrefixes = ['https://', 'mailto:', 'tel:'];

      Object.entries(SOCIAL_LINKS).forEach(([key, value]) => {
        const hasValidPrefix = validPrefixes.some((prefix) =>
          value.startsWith(prefix)
        );
        expect(
          hasValidPrefix,
          `${key} ("${value}") should start with one of: ${validPrefixes.join(', ')}`
        ).toBe(true);
      });
    });
  });

  describe('expected link categories', () => {
    describe('personal social media', () => {
      it('should have linkedin link', () => {
        expect(SOCIAL_LINKS.linkedin).toContain('linkedin.com');
      });

      it('should have twitter link', () => {
        expect(SOCIAL_LINKS.twitter).toContain('x.com');
      });

      it('should have instagram link', () => {
        expect(SOCIAL_LINKS.instagram).toContain('instagram.com');
      });

      it('should have github link', () => {
        expect(SOCIAL_LINKS.github).toContain('github.com');
      });

      it('should have email link as mailto:', () => {
        expect(SOCIAL_LINKS.email).toMatch(/^mailto:/);
      });

      it('should have phone link as tel:', () => {
        expect(SOCIAL_LINKS.phone).toMatch(/^tel:/);
      });
    });

    describe('company social media', () => {
      it('should have altivumLinkedIn', () => {
        expect(SOCIAL_LINKS.altivumLinkedIn).toContain('linkedin.com');
      });

      it('should have altivumYouTube', () => {
        expect(SOCIAL_LINKS.altivumYouTube).toContain('youtube.com');
      });

      it('should have altivumEmail as mailto:', () => {
        expect(SOCIAL_LINKS.altivumEmail).toMatch(/^mailto:/);
      });
    });

    describe('websites', () => {
      it('should have altivum website', () => {
        expect(SOCIAL_LINKS.altivum).toContain('altivum.ai');
      });

      it('should have altivumLogic website', () => {
        expect(SOCIAL_LINKS.altivumLogic).toContain('logic.altivum.ai');
      });

      it('should have vetroi website', () => {
        expect(SOCIAL_LINKS.vetroi).toContain('vetroi.altivum.ai');
      });
    });

    describe('external links', () => {
      it('should have Amazon book link', () => {
        expect(SOCIAL_LINKS.amazonBook).toBeDefined();
        expect(SOCIAL_LINKS.amazonBook).toMatch(/^https:\/\//);
      });
    });

    describe('podcast platforms', () => {
      it('should have podcast RSS feed', () => {
        expect(SOCIAL_LINKS.podcastRSS).toBeDefined();
      });

      it('should have Spotify link', () => {
        expect(SOCIAL_LINKS.podcastSpotify).toContain('spotify.com');
      });

      it('should have Apple Podcasts link', () => {
        expect(SOCIAL_LINKS.podcastApple).toContain('apple.com');
      });
    });
  });
});
