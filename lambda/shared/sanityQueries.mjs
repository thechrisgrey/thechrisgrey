export const SITE_ORIGIN = "https://thechrisgrey.com";

export const BLOG_SEARCH_QUERY = `*[_type == "post" && defined(slug.current) && (
  title match $q ||
  excerpt match $q ||
  pt::text(body) match $q ||
  count(tags[@ match $q]) > 0
)] | score(
  title match $q,
  excerpt match $q,
  pt::text(body) match $q
) | order(_score desc)[0...$limit]{
  title,
  "slug": slug.current,
  excerpt,
  publishedAt
}`;

export const BLOG_CITE_QUERY = `*[_type == "post" && slug.current == $slug][0]{
  title,
  excerpt,
  "slug": slug.current,
  publishedAt
}`;

export const BLOG_FULL_POST_QUERY = `*[_type == "post" && slug.current == $slug][0]{
  title,
  excerpt,
  "slug": slug.current,
  publishedAt,
  "body": pt::text(body),
  tags,
  "series": series->{ title, "slug": slug.current }
}`;

const STOP_ONLY = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "for",
  "to",
  "of",
  "in",
  "on",
  "at",
  "is",
  "it",
  "be",
  "by",
  "as",
  "but",
  "if",
  "so",
  "do",
  "did",
  "was",
]);

/**
 * @param {unknown} raw
 * @returns {string}
 */
export function normalizeQuery(raw) {
  return String(raw ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isMeaningful(query) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return words.some((w) => !STOP_ONLY.has(w));
}
