import { describe, it, expect } from 'vitest';
import { formatDate, formatDateShort } from './dateFormatter';

// Note: Date-only strings like "2026-01-10" are parsed as UTC midnight by the
// Date constructor. toLocaleDateString then converts to the local timezone, which
// can shift the day. We use toLocaleDateString to compute expected values so tests
// are timezone-agnostic.

function expectedFull(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function expectedShort(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

describe('dateFormatter', () => {
  describe('formatDate', () => {
    it('should format an ISO date string to full month format', () => {
      const input = '2026-01-15T12:00:00.000Z';
      const result = formatDate(input);
      expect(result).toBe(expectedFull(input));
      expect(result).toContain('January');
      expect(result).toContain('2026');
    });

    it('should format a date-only string correctly', () => {
      const result = formatDate('2025-12-25');
      expect(result).toBe(expectedFull('2025-12-25'));
      expect(result).toContain('2025');
    });

    it('should handle the first day of the year', () => {
      const input = '2024-01-01T12:00:00.000Z';
      const result = formatDate(input);
      expect(result).toBe(expectedFull(input));
      expect(result).toContain('January');
      expect(result).toContain('2024');
    });

    it('should handle the last day of the year', () => {
      const input = '2024-12-31T12:00:00.000Z';
      const result = formatDate(input);
      expect(result).toBe(expectedFull(input));
      expect(result).toContain('December');
      expect(result).toContain('2024');
    });

    it('should handle leap year date', () => {
      const input = '2024-02-29T12:00:00.000Z';
      const result = formatDate(input);
      expect(result).toBe(expectedFull(input));
      expect(result).toContain('February');
      expect(result).toContain('2024');
    });

    it('should return a string', () => {
      expect(typeof formatDate('2026-03-15')).toBe('string');
    });

    it('should produce correct full month names for various months', () => {
      const cases = [
        { input: '2026-03-15T12:00:00Z', month: 'March' },
        { input: '2026-06-15T12:00:00Z', month: 'June' },
        { input: '2026-09-15T12:00:00Z', month: 'September' },
        { input: '2026-11-15T12:00:00Z', month: 'November' },
      ];

      cases.forEach(({ input, month }) => {
        const result = formatDate(input);
        expect(result).toContain(month);
        expect(result).toBe(expectedFull(input));
      });
    });
  });

  describe('formatDateShort', () => {
    it('should format an ISO date string to abbreviated month format', () => {
      const input = '2026-01-15T12:00:00.000Z';
      const result = formatDateShort(input);
      expect(result).toBe(expectedShort(input));
      expect(result).toContain('Jan');
      expect(result).toContain('2026');
    });

    it('should use abbreviated month names (not full)', () => {
      const result = formatDateShort('2025-12-25');
      expect(result).toContain('Dec');
      expect(result).not.toContain('December');
    });

    it('should format a mid-year date correctly', () => {
      const input = '2024-07-04T12:00:00.000Z';
      const result = formatDateShort(input);
      expect(result).toBe(expectedShort(input));
      expect(result).toContain('Jul');
      expect(result).toContain('2024');
    });

    it('should return a string', () => {
      expect(typeof formatDateShort('2026-03-15')).toBe('string');
    });

    it('should produce correct abbreviated month names for various months', () => {
      const cases = [
        { input: '2026-02-15T12:00:00Z', month: 'Feb' },
        { input: '2026-04-15T12:00:00Z', month: 'Apr' },
        { input: '2026-08-15T12:00:00Z', month: 'Aug' },
        { input: '2026-10-15T12:00:00Z', month: 'Oct' },
      ];

      cases.forEach(({ input, month }) => {
        const result = formatDateShort(input);
        expect(result).toContain(month);
        expect(result).toBe(expectedShort(input));
      });
    });
  });

  describe('consistency between formatDate and formatDateShort', () => {
    it('should both produce valid dates for the same input', () => {
      const input = '2026-05-15T12:00:00Z';
      const full = formatDate(input);
      const short = formatDateShort(input);

      expect(full).toContain('2026');
      expect(short).toContain('2026');
      expect(full).toBe(expectedFull(input));
      expect(short).toBe(expectedShort(input));
    });

    it('should have the short month name as a prefix of the full month name', () => {
      const input = '2026-09-15T12:00:00Z';
      const full = formatDate(input);
      const short = formatDateShort(input);

      // "September" contains "Sep"
      expect(full).toContain('September');
      expect(short).toContain('Sep');
    });
  });
});
