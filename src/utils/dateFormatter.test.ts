import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { formatDate, formatDateShort } from './dateFormatter';

// The off-by-one bug only manifests in negative-offset (e.g. US) timezones, so
// pin a deterministic one for this suite. Runtime reassignment of process.env.TZ
// is honored by Intl/Date in Node, so this makes the regression assertions below
// catch the bug on any machine/CI regardless of its local zone.
const ORIGINAL_TZ = process.env.TZ;
beforeAll(() => {
  process.env.TZ = 'America/Los_Angeles';
});
afterAll(() => {
  process.env.TZ = ORIGINAL_TZ;
});

// Note: the helpers below intentionally mirror the implementation's own path so
// the older tests stay timezone-agnostic. They are NOT used by the hard-coded
// regression assertions further down (those would mask a regression if derived
// from the same code path they test).
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
      // Bare dates render their intended calendar day in every timezone. Asserted
      // against a hard-coded literal, not the UTC-parse helper (which models the
      // pre-fix bug and would expect "December 24" under the pinned Pacific TZ).
      const result = formatDate('2025-12-25');
      expect(result).toBe('December 25, 2025');
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

// Regression coverage for the UTC off-by-one bug. Pinned to America/Los_Angeles
// (see beforeAll above). Expected values are hard-coded literals — NOT derived
// from new Date(...).toLocaleDateString(...) — so they remain a true guard even
// if the implementation path changes.
describe('dateFormatter — timezone-safe bare dates (regression)', () => {
  it('renders the intended calendar day for a bare date, not the day before', () => {
    // Pre-fix in a negative-offset zone this rendered "January 9, 2026".
    expect(formatDate('2026-01-10')).toBe('January 10, 2026');
    expect(formatDateShort('2026-01-10')).toBe('Jan 10, 2026');
  });

  it('handles the first-of-month worst case without rolling to the prior month', () => {
    // Pre-fix this rendered "February 28, 2026".
    expect(formatDate('2026-03-01')).toBe('March 1, 2026');
  });

  it('leaves full ISO timestamps on local rendering (blog behavior unchanged)', () => {
    // A real instant: 18:30Z is 10:30 local in LA — same calendar day. The fix
    // must NOT force full timestamps to UTC; this documents that boundary.
    expect(formatDate('2026-01-10T18:30:00Z')).toBe('January 10, 2026');
  });
});
