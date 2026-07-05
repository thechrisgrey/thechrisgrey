import { createClient } from '@sanity/client';
import { createImageUrlBuilder, type SanityImageSource } from '@sanity/image-url';

export const client = createClient({
  projectId: 'k5950b3w',
  dataset: 'production',
  apiVersion: '2024-01-01',
  useCdn: true, // Enable CDN for faster reads in production
  timeout: 10000, // 10s — fail fast if Sanity is down
});

// Image URL builder
const builder = createImageUrlBuilder({ projectId: 'k5950b3w', dataset: 'production' });

// `SanityImageSource` is the exact input `@sanity/image-url` accepts — it covers
// both the dereferenced form our listing/post queries return (`{ asset: { _id, url } }`)
// and the raw-reference form (`{ asset: { _ref } }`) that un-expanded fields like
// bookReference covers arrive as. Typing to it removes the `any` without
// over-narrowing and breaking either shape.
export function urlFor(source: SanityImageSource) {
  return builder.image(source);
}

// The Vector Podcast project (separate Sanity project for podcast content)
export const podcastClient = createClient({
  projectId: 'uaxzdsfa',
  dataset: 'production',
  apiVersion: '2024-01-01',
  useCdn: true,
  timeout: 10000,
});

const podcastBuilder = createImageUrlBuilder({ projectId: 'uaxzdsfa', dataset: 'production' });

export function podcastUrlFor(source: SanityImageSource) {
  return podcastBuilder.image(source);
}
