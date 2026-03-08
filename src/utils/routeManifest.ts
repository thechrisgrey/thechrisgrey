type LazyImport = () => Promise<unknown>;

const routeImports = new Map<string, LazyImport>([
  ['/about', () => import('../pages/About')],
  ['/altivum', () => import('../pages/Altivum')],
  ['/podcast', () => import('../pages/Podcast')],
  ['/beyond-the-assessment', () => import('../pages/BeyondTheAssessment')],
  ['/aws', () => import('../pages/AWS')],
  ['/claude', () => import('../pages/Claude')],
  ['/blog', () => import('../pages/Blog')],
  ['/links', () => import('../pages/Links')],
  ['/contact', () => import('../pages/Contact')],
  ['/chat', () => import('../pages/Chat')],
  ['/privacy', () => import('../pages/Privacy')],
]);

// Also export the BlogPost chunk import for use by blog card prefetching
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
