import { createClient } from '@sanity/client'
import { createImageUrlBuilder } from '@sanity/image-url'

export const client = createClient({
  projectId: 'k5950b3w',
  dataset: 'production',
  apiVersion: '2024-01-01',
  useCdn: true, // Enable CDN for faster reads in production
  timeout: 10000, // 10s — fail fast if Sanity is down
})

// Image URL builder
const builder = createImageUrlBuilder({ projectId: 'k5950b3w', dataset: 'production' })

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function urlFor(source: any) {
  return builder.image(source)
}

// The Vector Podcast project (separate Sanity project for podcast content)
export const podcastClient = createClient({
  projectId: 'uaxzdsfa',
  dataset: 'production',
  apiVersion: '2024-01-01',
  useCdn: true,
  timeout: 10000,
})

const podcastBuilder = createImageUrlBuilder({ projectId: 'uaxzdsfa', dataset: 'production' })

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function podcastUrlFor(source: any) {
  return podcastBuilder.image(source)
}
