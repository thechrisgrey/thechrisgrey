import { describe, it, expect } from 'vitest';
import { classifySanityError, isSanityError } from './errors';

describe('classifySanityError', () => {
  it('maps AbortError to timeout', () => {
    const err = new Error('aborted');
    err.name = 'AbortError';
    expect(classifySanityError(err).kind).toBe('timeout');
  });

  it('maps a 404 statusCode to not_found', () => {
    const err = Object.assign(new Error('Not Found'), { statusCode: 404 });
    expect(classifySanityError(err).kind).toBe('not_found');
  });

  it('maps a 5xx statusCode to network', () => {
    const err = Object.assign(new Error('Server Error'), { statusCode: 503 });
    expect(classifySanityError(err).kind).toBe('network');
  });

  it('maps a TypeError / parse failure to malformed', () => {
    expect(classifySanityError(new TypeError('Unexpected token < in JSON')).kind).toBe('malformed');
  });

  it('maps network-shaped messages to network', () => {
    expect(classifySanityError(new Error('Failed to fetch')).kind).toBe('network');
  });

  it('falls back to unknown for an unrecognized error', () => {
    expect(classifySanityError(new Error('something odd')).kind).toBe('unknown');
  });

  it('falls back to unknown for a non-Error thrown value', () => {
    expect(classifySanityError('a string').kind).toBe('unknown');
  });

  it('prefixes the message with the provided context', () => {
    expect(classifySanityError(new Error('x'), 'Blog listing').message).toMatch(/^Blog listing: /);
  });

  it('preserves the original error in causedBy', () => {
    const err = new Error('boom');
    expect(classifySanityError(err).causedBy).toBe(err);
  });
});

describe('isSanityError', () => {
  it('recognizes a classified error', () => {
    expect(isSanityError(classifySanityError(new Error('x')))).toBe(true);
  });

  it('rejects arbitrary objects and primitives', () => {
    expect(isSanityError({})).toBe(false);
    expect(isSanityError(null)).toBe(false);
    expect(isSanityError('err')).toBe(false);
  });
});
