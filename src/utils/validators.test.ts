import { describe, it, expect } from 'vitest';
import { isValidEmail, EMAIL_REGEX } from './validators';

describe('validators', () => {
  describe('EMAIL_REGEX', () => {
    it('should be a RegExp instance', () => {
      expect(EMAIL_REGEX).toBeInstanceOf(RegExp);
    });
  });

  describe('isValidEmail', () => {
    describe('valid emails', () => {
      it.each([
        'user@example.com',
        'test.user@example.com',
        'user+tag@example.com',
        'user123@example.co',
        'firstname.lastname@domain.com',
        'email@subdomain.domain.com',
        'user@domain.museum',
        'user_name@example.com',
        'user-name@example.com',
        'USER@EXAMPLE.COM',
        '123@domain.com',
        'user%tag@example.com',
      ])('should return true for "%s"', (email) => {
        expect(isValidEmail(email)).toBe(true);
      });
    });

    describe('invalid emails', () => {
      it.each([
        '',
        'notanemail',
        '@example.com',
        'user@',
        'user@.com',
        'user@example',
        'user @example.com',
        'user@exam ple.com',
        '@',
        'user@@example.com',
      ])('should return false for "%s"', (email) => {
        expect(isValidEmail(email)).toBe(false);
      });
    });

    describe('whitespace handling', () => {
      it('should trim leading whitespace and validate', () => {
        expect(isValidEmail('  user@example.com')).toBe(true);
      });

      it('should trim trailing whitespace and validate', () => {
        expect(isValidEmail('user@example.com  ')).toBe(true);
      });

      it('should trim both leading and trailing whitespace', () => {
        expect(isValidEmail('  user@example.com  ')).toBe(true);
      });

      it('should return false for whitespace-only string', () => {
        expect(isValidEmail('   ')).toBe(false);
      });

      it('should return false for email with internal spaces even after trim', () => {
        expect(isValidEmail(' user name@example.com ')).toBe(false);
      });
    });

    describe('regex permissiveness', () => {
      // The regex allows some technically questionable but common patterns.
      // These tests document the actual behavior rather than prescribe strict RFC compliance.
      it('should accept leading dot in local part (regex allows it)', () => {
        expect(isValidEmail('.user@example.com')).toBe(true);
      });

      it('should accept consecutive dots in domain (regex allows it)', () => {
        expect(isValidEmail('user@example..com')).toBe(true);
      });
    });

    describe('edge cases', () => {
      it('should return false for a string with only @', () => {
        expect(isValidEmail('@')).toBe(false);
      });

      it('should return false for email with TLD shorter than 2 characters', () => {
        expect(isValidEmail('user@example.c')).toBe(false);
      });

      it('should return true for email with TLD of exactly 2 characters', () => {
        expect(isValidEmail('user@example.co')).toBe(true);
      });

      it('should return true for email with long TLD', () => {
        expect(isValidEmail('user@example.technology')).toBe(true);
      });

      it('should return false for email with no domain extension', () => {
        expect(isValidEmail('user@localhost')).toBe(false);
      });
    });
  });
});
