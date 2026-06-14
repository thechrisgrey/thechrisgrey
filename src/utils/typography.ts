// SF Pro Display Typography System
// Display/heading styles use ultra-light (200) for an elegant, airy feel.
// Reading text (body + small/caption) uses light (300) instead: at 12–18px,
// weight 200 on the dark palette is thin and low-contrast, flattening hierarchy
// and reading "fashion-thin" rather than substantial. 300 keeps the aesthetic
// while making running text legible and giving it more presence.
// Consistent letter-spacing (0.02em); fluid sizing via clamp().

const baseFontFamily = '"SF Pro Display", "Helvetica Neue", "Segoe UI", system-ui, sans-serif';
const baseFontWeight = 200; // display / headings — elegant ultralight
const bodyFontWeight = 300; // reading text — legible at small sizes on dark
const baseLetterSpacing = '0.02em';

export const typography = {
  // Hero headers - largest text (40px -> 80px)
  heroHeader: {
    fontFamily: baseFontFamily,
    fontWeight: baseFontWeight,
    letterSpacing: baseLetterSpacing,
    fontSize: 'clamp(2.5rem, 6vw, 5rem)', // 40px -> 80px
    lineHeight: 1.2,
  },

  // Section headers - large headings (32px -> 64px)
  sectionHeader: {
    fontFamily: baseFontFamily,
    fontWeight: baseFontWeight,
    letterSpacing: baseLetterSpacing,
    fontSize: 'clamp(2rem, 5vw, 4rem)', // 32px -> 64px
    lineHeight: 1.2,
  },

  // Card titles (large) - prominent card headings (24px -> 32px)
  cardTitleLarge: {
    fontFamily: baseFontFamily,
    fontWeight: baseFontWeight,
    letterSpacing: baseLetterSpacing,
    fontSize: 'clamp(1.5rem, 2.5vw, 2rem)', // 24px -> 32px
    lineHeight: 1.3,
  },

  // Card titles (small) - smaller card headings (20px -> 24px)
  cardTitleSmall: {
    fontFamily: baseFontFamily,
    fontWeight: baseFontWeight,
    letterSpacing: baseLetterSpacing,
    fontSize: 'clamp(1.25rem, 2vw, 1.5rem)', // 20px -> 24px
    lineHeight: 1.3,
  },

  // Subtitles - supporting text for headers (16px -> 24px)
  subtitle: {
    fontFamily: baseFontFamily,
    fontWeight: baseFontWeight,
    letterSpacing: baseLetterSpacing,
    fontSize: 'clamp(1rem, 2vw, 1.5rem)', // 16px -> 24px
    lineHeight: 1.5,
  },

  // Body text - standard paragraph text (14px -> 18px)
  bodyText: {
    fontFamily: baseFontFamily,
    fontWeight: bodyFontWeight,
    letterSpacing: baseLetterSpacing,
    fontSize: 'clamp(0.875rem, 1.5vw, 1.125rem)', // 14px -> 18px
    lineHeight: 1.5,
  },

  // Small text - captions, labels, footer text (12px -> 14px)
  smallText: {
    fontFamily: baseFontFamily,
    fontWeight: bodyFontWeight,
    letterSpacing: baseLetterSpacing,
    fontSize: 'clamp(0.75rem, 1vw, 0.875rem)', // 12px -> 14px
    lineHeight: 1.5,
  },
} as const;
