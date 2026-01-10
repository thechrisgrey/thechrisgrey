/**
 * Date formatting utilities for consistent date display across the app
 */

/**
 * Format a date string to a full date format (e.g., "January 10, 2026")
 */
export const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

/**
 * Format a date string to a short date format (e.g., "Jan 10, 2026")
 */
export const formatDateShort = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};
