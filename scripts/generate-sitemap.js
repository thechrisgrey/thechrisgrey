/**
 * Sitemap Generator Script
 * Fetches blog posts from Sanity and generates a dynamic sitemap.xml
 * Run after vite build: node scripts/generate-sitemap.js
 */

import { createClient } from '@sanity/client';
import { writeFileSync, realpathSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Sanity client configuration
const client = createClient({
  projectId: 'k5950b3w',
  dataset: 'production',
  apiVersion: '2024-01-01',
  useCdn: false, // We want fresh data at build time
  timeout: 15000, // 15s — fail fast if Sanity is unreachable
});

// Static pages with their priorities and change frequencies.
//
// The bare route paths are exported as STATIC_ROUTES (single source of truth):
// scripts/prerender.js imports them so the prerender crawl set can never drift
// from the sitemap. This file owns the per-route SEO metadata (priority,
// changefreq); prerender only needs the paths.
const staticPages = [
  { url: '/', priority: '1.0', changefreq: 'weekly' },
  { url: '/about', priority: '0.8', changefreq: 'monthly' },
  { url: '/altivum', priority: '0.9', changefreq: 'weekly' },
  { url: '/foundation', priority: '0.9', changefreq: 'weekly' },
  { url: '/podcast', priority: '0.8', changefreq: 'weekly' },
  { url: '/blog', priority: '0.8', changefreq: 'weekly' },
  { url: '/contact', priority: '0.7', changefreq: 'monthly' },
  { url: '/links', priority: '0.7', changefreq: 'monthly' },
  { url: '/beyond-the-assessment', priority: '0.7', changefreq: 'monthly' },
  { url: '/chat', priority: '0.7', changefreq: 'weekly' },
  { url: '/privacy', priority: '0.3', changefreq: 'yearly' },
];

/**
 * Bare static route paths, the single source of truth shared with
 * scripts/prerender.js (which imports this) so the prerender crawl set and the
 * sitemap never diverge. Derived from staticPages so adding a route in one
 * place updates both.
 */
export const STATIC_ROUTES = staticPages.map((page) => page.url);

/**
 * GROQ projection for every published blog slug, shared with
 * scripts/prerender.js. Sitemap also needs _updatedAt for <lastmod>; prerender
 * only reads .slug, so the extra field is harmless there.
 */
export const BLOG_SLUGS_QUERY = `*[_type == "post" && defined(slug.current)] | order(publishedAt desc) {
    "slug": slug.current,
    "lastmod": _updatedAt
  }`;

const SITE_URL = 'https://thechrisgrey.com';

/**
 * Fetch all published blog posts from Sanity
 */
async function fetchBlogPosts() {
  try {
    const posts = await client.fetch(BLOG_SLUGS_QUERY);
    return posts;
  } catch (error) {
    console.error('Error fetching posts from Sanity:', error);
    process.exit(1);
  }
}

/**
 * Format date to YYYY-MM-DD for sitemap
 */
function formatDate(dateString) {
  if (!dateString) return new Date().toISOString().split('T')[0];
  return new Date(dateString).toISOString().split('T')[0];
}

/**
 * Generate XML for a single URL entry
 */
function generateUrlEntry({ loc, lastmod, changefreq, priority }) {
  return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

/**
 * Generate the complete sitemap XML
 */
async function generateSitemap() {
  console.log('Generating sitemap...');

  const today = formatDate(new Date().toISOString());

  // Generate static page entries
  const staticEntries = staticPages.map(page =>
    generateUrlEntry({
      loc: `${SITE_URL}${page.url}`,
      lastmod: today,
      changefreq: page.changefreq,
      priority: page.priority,
    })
  );

  // Fetch and generate blog post entries
  const posts = await fetchBlogPosts();
  console.log(`Found ${posts.length} blog posts`);

  const blogEntries = posts.map(post =>
    generateUrlEntry({
      loc: `${SITE_URL}/blog/${post.slug}`,
      lastmod: formatDate(post.lastmod),
      changefreq: 'monthly',
      priority: '0.6',
    })
  );

  // Combine all entries
  const allEntries = [...staticEntries, ...blogEntries];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allEntries.join('\n')}
</urlset>
`;

  // Write to dist folder
  const outputPath = resolve(__dirname, '../dist/sitemap.xml');
  writeFileSync(outputPath, sitemap, 'utf-8');

  console.log(`Sitemap generated successfully at ${outputPath}`);
  console.log(`Total URLs: ${allEntries.length} (${staticPages.length} static + ${posts.length} blog posts)`);
}

// Run the generator only when executed directly (`node scripts/generate-sitemap.js`).
// Guarded so scripts/prerender.js can import STATIC_ROUTES / BLOG_SLUGS_QUERY
// without triggering a sitemap write as an import side effect. Compared via
// pathToFileURL(realpathSync(...)) so the match is robust to symlinked /
// realpath-differing invocations rather than the fragile `file://${argv[1]}` idiom.
const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
if (invokedDirectly) {
  generateSitemap().catch((err) => {
    console.error('Sitemap generation failed:', err);
    process.exit(1);
  });
}
