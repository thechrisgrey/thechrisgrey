/**
 * Date formatting utilities for consistent date display across the app
 */

const BARE_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Resolve a date string to a Date suitable for LOCAL formatting.
 *
 * A bare `YYYY-MM-DD` string is a calendar date with no timezone meaning, but
 * `new Date('YYYY-MM-DD')` parses it as UTC midnight — which rolls back a day in
 * negative-offset (e.g. US) zones (e.g. an episode dated 2026-02-20 rendered as
 * "February 19"). Build it at LOCAL noon from its parts instead, so the intended
 * calendar day survives in every timezone (noon ±14h never crosses a day).
 *
 * Full ISO timestamps (e.g. Sanity blog `publishedAt`) carry a real instant and
 * keep the existing `new Date(...)` local rendering, so blog dates are unchanged.
 * (Mirrors the string-parse approach already used by `formatMonthYear` in Podcast.tsx.)
 */
const toLocalDate = (dateString: string): Date => {
  if (BARE_DATE.test(dateString)) {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day, 12);
  }
  return new Date(dateString);
};

/**
 * Format a date string to a full date format (e.g., "January 10, 2026")
 */
export const formatDate = (dateString: string): string => {
  return toLocalDate(dateString).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

/**
 * Format a date string to a short date format (e.g., "Jan 10, 2026")
 */
export const formatDateShort = (dateString: string): string => {
  return toLocalDate(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};
