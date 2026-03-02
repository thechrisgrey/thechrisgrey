import type { BlogListingResult } from './types'

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

let cache: { data: BlogListingResult; fetchedAt: number } | null = null

export function getBlogListingCache(): BlogListingResult | null {
  if (!cache) return null
  if (Date.now() - cache.fetchedAt > CACHE_TTL_MS) {
    cache = null
    return null
  }
  return cache.data
}

export function setBlogListingCache(data: BlogListingResult): void {
  cache = { data, fetchedAt: Date.now() }
}
