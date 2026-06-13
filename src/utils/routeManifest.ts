import { ROUTES } from '../routes';

/**
 * Hover/focus prefetch map. Derived from the canonical ROUTES table — adding
 * a route in `src/routes.ts` automatically enables hover prefetch for it
 * unless the route sets `noPrefetch: true`.
 */
const routeImports = new Map<string, () => Promise<unknown>>(
  ROUTES.filter((r) => !r.noPrefetch).map((r) => [r.path, r.importer])
);

/**
 * Direct importer for the BlogPost chunk so blog cards can prefetch the post
 * page on hover. The `/blog/:slug` route in ROUTES is `noPrefetch: true` to
 * keep this dedicated prefetcher the single owner of that chunk.
 */
export const prefetchBlogPostChunk = () => import('../pages/BlogPost');

const prefetched = new Set<string>();

export function prefetchRoute(path: string): void {
  if (prefetched.has(path)) return;

  const importFn = routeImports.get(path);
  if (!importFn) return;

  prefetched.add(path);
  importFn().catch(() => {
    // Prefetch failure is silent — the route will load normally on navigation
    prefetched.delete(path);
  });
}
