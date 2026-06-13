import { ROUTES, ROUTES_BY_PATH, HOME_CONTEXT } from '../routes';

export interface PageContext {
  currentPage: string;
  pageTitle: string;
  section: string;
  visitedPages: string[];
}

interface RouteMetadata {
  pageTitle: string;
  section: string;
}

/**
 * Per-route grounding context for Alti. Derived from the canonical ROUTES
 * table — every route gets a real `pageTitle` + `section` by construction;
 * the historic drift (where `/foundation` and `/blueprint` fell through to
 * the `{ pageTitle: 'Page', section: 'General' }` default and produced
 * useless Alti grounding) is no longer possible.
 */
const ROUTE_CONTEXT_MAP: Record<string, RouteMetadata> = {
  [HOME_CONTEXT.path]: HOME_CONTEXT.context,
  ...Object.fromEntries(ROUTES.map((r) => [r.path, r.context])),
};

const DEFAULT_SUGGESTIONS = [
  "How did he go from Green Beret to tech CEO?",
  "What drives Altivum's mission?",
  'Why did he write Beyond the Assessment?',
  "What's his take on AI and veterans?",
];

/**
 * Per-route starter chips for Alti. Derived from the canonical ROUTES table.
 * Routes that don't declare their own suggestions fall back to
 * DEFAULT_SUGGESTIONS at lookup time.
 */
export const PAGE_SUGGESTIONS: Record<string, string[]> = {
  [HOME_CONTEXT.path]: HOME_CONTEXT.suggestions,
  ...Object.fromEntries(
    ROUTES.filter((r) => r.suggestions).map((r) => [r.path, r.suggestions!])
  ),
};

export function getPageContext(pathname: string, visitedPages: string[]): PageContext {
  // Handle /blog/:slug routes
  const isBlogPost = pathname.startsWith('/blog/') && pathname !== '/blog';
  const lookupKey = isBlogPost ? '/blog/:slug' : pathname;

  const metadata = ROUTE_CONTEXT_MAP[lookupKey] || ROUTE_CONTEXT_MAP[pathname] || {
    pageTitle: 'Page',
    section: 'General',
  };

  // For blog posts, include the slug in the section
  const section = isBlogPost
    ? `Blog Post (${pathname.replace('/blog/', '')})`
    : metadata.section;

  return {
    currentPage: pathname,
    pageTitle: isBlogPost ? 'Blog Post' : metadata.pageTitle,
    section,
    visitedPages,
  };
}

export function getSuggestionsForPage(pathname: string): string[] {
  // Blog post pages share one suggestion set defined on the /blog/:slug route.
  if (pathname.startsWith('/blog/') && pathname !== '/blog') {
    return ROUTES_BY_PATH.get('/blog/:slug')?.suggestions ?? DEFAULT_SUGGESTIONS;
  }

  return PAGE_SUGGESTIONS[pathname] || DEFAULT_SUGGESTIONS;
}
