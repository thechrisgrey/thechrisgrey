import { describe, it, expect } from 'vitest';
import { typography } from './typography';

describe('typography', () => {
  const expectedKeys = [
    'heroHeader',
    'sectionHeader',
    'cardTitleLarge',
    'cardTitleSmall',
    'subtitle',
    'bodyText',
    'smallText',
  ] as const;

  const requiredProperties = [
    'fontFamily',
    'fontWeight',
    'letterSpacing',
    'fontSize',
    'lineHeight',
  ] as const;

  it('should export a typography object', () => {
    expect(typography).toBeDefined();
    expect(typeof typography).toBe('object');
  });

  it('should have exactly 7 style entries', () => {
    expect(Object.keys(typography)).toHaveLength(7);
  });

  describe.each(expectedKeys)('%s', (key) => {
    it('should exist in the typography object', () => {
      expect(typography[key]).toBeDefined();
    });

    it.each(requiredProperties)('should have %s property', (prop) => {
      expect(typography[key]).toHaveProperty(prop);
    });

    it('should have fontFamily as a string containing SF Pro Display', () => {
      expect(typeof typography[key].fontFamily).toBe('string');
      expect(typography[key].fontFamily).toContain('SF Pro Display');
    });

    it('should have fontWeight as a number', () => {
      expect(typeof typography[key].fontWeight).toBe('number');
    });

    it('should have letterSpacing as a string', () => {
      expect(typeof typography[key].letterSpacing).toBe('string');
    });

    it('should have fontSize as a string', () => {
      expect(typeof typography[key].fontSize).toBe('string');
    });

    it('should have lineHeight as a number', () => {
      expect(typeof typography[key].lineHeight).toBe('number');
    });
  });

  describe('consistent base values', () => {
    it('should use weight 200 for all styles', () => {
      expectedKeys.forEach((key) => {
        expect(typography[key].fontWeight).toBe(200);
      });
    });

    it('should use 0.02em letter-spacing for all styles', () => {
      expectedKeys.forEach((key) => {
        expect(typography[key].letterSpacing).toBe('0.02em');
      });
    });

    it('should use the same font family for all styles', () => {
      const firstFamily = typography.heroHeader.fontFamily;
      expectedKeys.forEach((key) => {
        expect(typography[key].fontFamily).toBe(firstFamily);
      });
    });
  });

  describe('font sizing uses clamp()', () => {
    it('should use clamp() for all fontSize values', () => {
      expectedKeys.forEach((key) => {
        expect(typography[key].fontSize).toMatch(/^clamp\(/);
      });
    });
  });

  describe('line height values', () => {
    it('should have lineHeight between 1 and 2 for all styles', () => {
      expectedKeys.forEach((key) => {
        expect(typography[key].lineHeight).toBeGreaterThanOrEqual(1);
        expect(typography[key].lineHeight).toBeLessThanOrEqual(2);
      });
    });
  });
});
