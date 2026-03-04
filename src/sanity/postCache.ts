import type { SanityPost } from './types'

const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes

const cache = new Map<string, { data: SanityPost; fetchedAt: number }>()

export function getPostCache(slug: string): SanityPost | null {
  const entry = cache.get(slug)
  if (!entry) return null
  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
    cache.delete(slug)
    return null
  }
  return entry.data
}

export function setPostCache(slug: string, data: SanityPost): void {
  cache.set(slug, { data, fetchedAt: Date.now() })
}

export function clearPostCache(): void {
  cache.clear()
}
