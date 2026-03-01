/**
 * RSS Feed Generator Script
 * Fetches blog posts from Sanity and generates rss.xml
 * Run after vite build: node scripts/generate-rss.js
 */

import { createClient } from '@sanity/client';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Sanity client configuration
const client = createClient({
  projectId: 'k5950b3w',
  dataset: 'production',
  apiVersion: '2024-01-01',
  useCdn: false,
});

const SITE_URL = 'https://thechrisgrey.com';
const FEED_TITLE = 'Christian Perez - Blog';
const FEED_DESCRIPTION = 'Thoughts on leadership, technology, veteran entrepreneurship, and building Altivum Inc. By Christian Perez (@thechrisgrey).';
const FEED_AUTHOR = 'Christian Perez';
const FEED_EMAIL = 'admin@altivum.ai';

/**
 * Fetch all published blog posts from Sanity
 */
async function fetchBlogPosts() {
  const query = `*[_type == "post" && defined(slug.current)] | order(publishedAt desc) {
    title,
    "slug": slug.current,
    excerpt,
    publishedAt,
    _updatedAt,
    "categories": categories[]->title
  }`;

  try {
    const posts = await client.fetch(query);
    return posts;
  } catch (error) {
    console.error('Error fetching posts from Sanity:', error);
    process.exit(1);
  }
}

/**
 * Escape XML special characters
 */
function escapeXml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Format date to RFC 822 format for RSS
 */
function formatRssDate(dateString) {
  if (!dateString) return new Date().toUTCString();
  return new Date(dateString).toUTCString();
}

/**
 * Generate RSS item for a single post
 */
function generateRssItem(post) {
  const link = `${SITE_URL}/blog/${post.slug}`;
  const categories = post.categories?.map(cat => `      <category>${escapeXml(cat)}</category>`).join('\n') || '';

  return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${formatRssDate(post.publishedAt)}</pubDate>
      <description>${escapeXml(post.excerpt || '')}</description>
${categories}
    </item>`;
}

/**
 * Generate the complete RSS feed
 */
async function generateRssFeed() {
  console.log('Generating RSS feed...');

  const posts = await fetchBlogPosts();
  console.log(`Found ${posts.length} blog posts`);

  if (posts.length === 0) {
    console.log('No posts found, skipping RSS generation');
    return;
  }

  const lastBuildDate = formatRssDate(new Date().toISOString());
  const items = posts.map(generateRssItem).join('\n');

  const rssFeed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(FEED_TITLE)}</title>
    <link>${SITE_URL}/blog</link>
    <description>${escapeXml(FEED_DESCRIPTION)}</description>
    <language>en-us</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml"/>
    <managingEditor>${FEED_EMAIL} (${FEED_AUTHOR})</managingEditor>
    <webMaster>${FEED_EMAIL} (${FEED_AUTHOR})</webMaster>
    <image>
      <url>${SITE_URL}/tcg.png</url>
      <title>${escapeXml(FEED_TITLE)}</title>
      <link>${SITE_URL}</link>
    </image>
${items}
  </channel>
</rss>
`;

  // Write to dist folder
  const outputPath = resolve(__dirname, '../dist/rss.xml');
  writeFileSync(outputPath, rssFeed, 'utf-8');

  console.log(`RSS feed generated successfully at ${outputPath}`);
  console.log(`Total items: ${posts.length}`);
}

// Run the generator
generateRssFeed().catch(console.error);
