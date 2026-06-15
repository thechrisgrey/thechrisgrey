import { describe, it, expect } from 'vitest';
import {
  isSanityImage,
  isRenderableImageSource,
  isSanityPost,
  isSanityPostPreview,
  isBlogListingResult,
  isPodcastGuest,
  isPodcastGuestArray,
} from './guards';

const validImage = { asset: { _id: 'image-abc-1200x800-jpg', url: 'https://cdn.sanity.io/x.jpg' }, alt: 'x' };
const refImage = { asset: { _ref: 'image-abc-1200x800-jpg' } };

const validPreview = {
  _id: 'post-1',
  title: 'A Post',
  slug: { current: 'a-post' },
  excerpt: 'An excerpt',
  category: 'Technology',
  publishedAt: '2026-01-15',
};

const validGuest = { _id: 'g1', name: 'Jane', role: 'Founder', order: 1 };

describe('isSanityImage (strict, dereferenced)', () => {
  it('accepts a dereferenced asset', () => {
    expect(isSanityImage(validImage)).toBe(true);
  });
  it('rejects a raw reference (no _id/url)', () => {
    expect(isSanityImage(refImage)).toBe(false);
  });
  it('rejects missing asset / non-objects', () => {
    expect(isSanityImage({ asset: { _id: 'x' } })).toBe(false);
    expect(isSanityImage(null)).toBe(false);
    expect(isSanityImage(undefined)).toBe(false);
  });
});

describe('isRenderableImageSource (permissive)', () => {
  it('accepts both dereferenced and _ref forms', () => {
    expect(isRenderableImageSource(validImage)).toBe(true);
    expect(isRenderableImageSource(refImage)).toBe(true);
  });
  it('rejects an asset with neither _ref nor _id/url', () => {
    expect(isRenderableImageSource({ asset: {} })).toBe(false);
    expect(isRenderableImageSource({})).toBe(false);
    expect(isRenderableImageSource(undefined)).toBe(false);
  });
});

describe('isSanityPostPreview / isSanityPost', () => {
  it('accepts a record with all required core fields', () => {
    expect(isSanityPostPreview(validPreview)).toBe(true);
    expect(isSanityPost(validPreview)).toBe(true);
  });
  it('rejects when a required field is missing', () => {
    const { title: _omit, ...noTitle } = validPreview;
    void _omit;
    expect(isSanityPostPreview(noTitle)).toBe(false);
  });
  it('rejects when slug.current is missing', () => {
    expect(isSanityPost({ ...validPreview, slug: {} })).toBe(false);
  });
});

describe('isBlogListingResult', () => {
  it('accepts a well-formed listing (incl. empty posts)', () => {
    expect(isBlogListingResult({ posts: [validPreview], tags: [], series: [] })).toBe(true);
    expect(isBlogListingResult({ posts: [], tags: [], series: [] })).toBe(true);
  });
  it('rejects when an array is missing', () => {
    expect(isBlogListingResult({ posts: [], tags: [] })).toBe(false);
  });
  it('rejects when a post is malformed', () => {
    expect(isBlogListingResult({ posts: [{ _id: 'x' }], tags: [], series: [] })).toBe(false);
  });
});

describe('isPodcastGuest / isPodcastGuestArray', () => {
  it('accepts a valid guest with and without a branch', () => {
    expect(isPodcastGuest(validGuest)).toBe(true);
    expect(isPodcastGuest({ ...validGuest, branch: 'army' })).toBe(true);
  });
  it('rejects an unknown branch value', () => {
    expect(isPodcastGuest({ ...validGuest, branch: 'starfleet' })).toBe(false);
  });
  it('rejects when order is not a number', () => {
    expect(isPodcastGuest({ ...validGuest, order: '1' })).toBe(false);
  });
  it('validates arrays element-wise', () => {
    expect(isPodcastGuestArray([validGuest])).toBe(true);
    expect(isPodcastGuestArray([validGuest, { _id: 'bad' }])).toBe(false);
    expect(isPodcastGuestArray('nope')).toBe(false);
  });
});
