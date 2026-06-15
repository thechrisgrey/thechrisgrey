// Hand-written runtime type guards for the Sanity data boundary (no Zod).
//
// `client.fetch<T>()` does NOT validate its result at runtime — the generic is a
// compile-time promise only. A schema drift in the CMS (a renamed field, a
// reference that stopped dereferencing) would otherwise reach `render`/cache as
// the wrong shape and crash to a blank page. These guards validate the documented
// REQUIRED fields before fetched data is trusted or cached.

import type {
  SanityImage,
  SanityPost,
  SanityPostPreview,
  BlogListingResult,
  PodcastGuest,
} from './types';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasStringField(obj: Record<string, unknown>, key: string): boolean {
  return typeof obj[key] === 'string';
}

function hasSlug(obj: Record<string, unknown>): boolean {
  const slug = obj.slug;
  return isObject(slug) && typeof slug.current === 'string';
}

/**
 * Strict: a fully-dereferenced image whose asset was projected to `{ _id, url }`,
 * as the listing/post GROQ queries return.
 */
export function isSanityImage(value: unknown): value is SanityImage {
  if (!isObject(value)) return false;
  const asset = value.asset;
  return isObject(asset) && typeof asset._id === 'string' && typeof asset.url === 'string';
}

/**
 * Permissive: anything `@sanity/image-url` can build a URL from — either a
 * dereferenced asset (`{ _id, url }`) OR a raw reference (`{ _ref }`). Used at the
 * RENDER boundary, where un-expanded fields (e.g. a bookReference cover) arrive as
 * `{ asset: { _ref } }` and must NOT be rejected.
 */
export function isRenderableImageSource(value: unknown): boolean {
  if (!isObject(value)) return false;
  const asset = value.asset;
  if (!isObject(asset)) return false;
  return (
    typeof asset._ref === 'string' ||
    (typeof asset._id === 'string' && typeof asset.url === 'string')
  );
}

function hasPostPreviewCore(obj: Record<string, unknown>): boolean {
  return (
    hasStringField(obj, '_id') &&
    hasStringField(obj, 'title') &&
    hasSlug(obj) &&
    hasStringField(obj, 'excerpt') &&
    hasStringField(obj, 'category') &&
    hasStringField(obj, 'publishedAt')
  );
}

export function isSanityPostPreview(value: unknown): value is SanityPostPreview {
  return isObject(value) && hasPostPreviewCore(value);
}

export function isSanityPost(value: unknown): value is SanityPost {
  // The full post shares the same required core as the preview; the extra fields
  // (body, tags, series, ...) are all optional in SanityPost.
  return isObject(value) && hasPostPreviewCore(value);
}

export function isBlogListingResult(value: unknown): value is BlogListingResult {
  return (
    isObject(value) &&
    Array.isArray(value.posts) &&
    Array.isArray(value.tags) &&
    Array.isArray(value.series) &&
    value.posts.every(isSanityPostPreview)
  );
}

const MILITARY_BRANCHES = new Set([
  'army',
  'navy',
  'marines',
  'air-force',
  'space-force',
  'coast-guard',
]);

export function isPodcastGuest(value: unknown): value is PodcastGuest {
  if (!isObject(value)) return false;
  // branch is optional, but when present must be a known enum value.
  if (
    value.branch !== undefined &&
    (typeof value.branch !== 'string' || !MILITARY_BRANCHES.has(value.branch))
  ) {
    return false;
  }
  return (
    hasStringField(value, '_id') &&
    hasStringField(value, 'name') &&
    hasStringField(value, 'role') &&
    typeof value.order === 'number'
  );
}

export function isPodcastGuestArray(value: unknown): value is PodcastGuest[] {
  return Array.isArray(value) && value.every(isPodcastGuest);
}
