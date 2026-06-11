import { describe, it, expect } from 'vitest';
import { editorialType, EDITORIAL_FONT_FAMILY } from './editorialType';

describe('editorialType', () => {
  it('exposes the Playfair Display stack', () => {
    expect(EDITORIAL_FONT_FAMILY).toContain('Playfair Display');
    expect(EDITORIAL_FONT_FAMILY).toContain('serif');
  });

  it('defines all six editorial styles', () => {
    expect(Object.keys(editorialType).sort()).toEqual([
      'displayHero',
      'displaySection',
      'eyebrow',
      'pullQuote',
      'statNumeral',
      'statSuffix',
    ]);
  });

  it('every style uses the editorial font family and fluid clamp sizing', () => {
    for (const style of Object.values(editorialType)) {
      expect(style.fontFamily).toBe(EDITORIAL_FONT_FAMILY);
      expect(style.fontSize).toMatch(/^clamp\(/);
    }
  });

  it('display styles are uppercase, never bold', () => {
    expect(editorialType.displayHero.textTransform).toBe('uppercase');
    expect(editorialType.displaySection.textTransform).toBe('uppercase');
    for (const style of Object.values(editorialType)) {
      expect(style.fontWeight).toBeLessThanOrEqual(500);
    }
  });

  it('eyebrow, pullQuote, and statSuffix are italic', () => {
    expect(editorialType.eyebrow.fontStyle).toBe('italic');
    expect(editorialType.pullQuote.fontStyle).toBe('italic');
    expect(editorialType.statSuffix.fontStyle).toBe('italic');
    expect(editorialType.eyebrow.letterSpacing).toBe('0.25em');
  });
});
