// Editorial display typography — Playfair Display (self-hosted via fontsource).
// Companion to typography.ts (SF Pro body/UI), never a replacement for it.
// Accent rule: within any display headline exactly one word may be italic gold;
// hierarchy comes from scale and italics — never bold (max weight 500).

export const EDITORIAL_FONT_FAMILY =
  '"Playfair Display", "Playfair Fallback", Didot, Georgia, serif';

export const editorialType = {
  // Hero display — the bento scene-tile name (44px -> 104px)
  displayHero: {
    fontFamily: EDITORIAL_FONT_FAMILY,
    fontWeight: 500,
    fontSize: 'clamp(2.75rem, 7vw, 6.5rem)',
    lineHeight: 0.98,
    letterSpacing: '0.01em',
    textTransform: 'uppercase',
  },

  // Section display headlines (36px -> 64px)
  displaySection: {
    fontFamily: EDITORIAL_FONT_FAMILY,
    fontWeight: 400,
    fontSize: 'clamp(2.25rem, 4.5vw, 4rem)',
    lineHeight: 1.08,
    letterSpacing: '0.01em',
    textTransform: 'uppercase',
  },

  // Animated stat numerals (48px -> 88px)
  statNumeral: {
    fontFamily: EDITORIAL_FONT_FAMILY,
    fontWeight: 400,
    fontSize: 'clamp(3rem, 6vw, 5.5rem)',
    lineHeight: 1,
    letterSpacing: '0em',
  },

  // Italic suffix beside a numeral, e.g. the D in 18D (20px -> 28px)
  statSuffix: {
    fontFamily: EDITORIAL_FONT_FAMILY,
    fontWeight: 400,
    fontStyle: 'italic',
    fontSize: 'clamp(1.25rem, 2vw, 1.75rem)',
    lineHeight: 1,
    letterSpacing: '0em',
  },

  // Porcelain italic pull-quotes on image breaks (24px -> 40px)
  pullQuote: {
    fontFamily: EDITORIAL_FONT_FAMILY,
    fontWeight: 400,
    fontStyle: 'italic',
    fontSize: 'clamp(1.5rem, 3vw, 2.5rem)',
    lineHeight: 1.3,
    letterSpacing: '0.01em',
  },

  // Parenthetical section labels, e.g. (ABOUT) (10px -> 12px)
  eyebrow: {
    fontFamily: EDITORIAL_FONT_FAMILY,
    fontWeight: 400,
    fontStyle: 'italic',
    fontSize: 'clamp(0.625rem, 1vw, 0.75rem)',
    lineHeight: 1.4,
    letterSpacing: '0.25em',
  },
} as const;
