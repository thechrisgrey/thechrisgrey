// GROQ queries for fetching blog content from Sanity

// Fetch all published posts (for blog listing)
export const POSTS_QUERY = `*[
  _type == "post"
  && defined(slug.current)
] | order(isFeatured desc, publishedAt desc) {
  _id,
  title,
  slug,
  excerpt,
  category,
  publishedAt,
  readingTime,
  isFeatured,
  image {
    asset->,
    alt
  },
  "tags": tags[]->{ _id, title, slug }
}`

// Fetch a single post by slug (for post detail view)
export const POST_BY_SLUG_QUERY = `*[
  _type == "post"
  && slug.current == $slug
][0] {
  _id,
  title,
  slug,
  excerpt,
  category,
  publishedAt,
  readingTime,
  isFeatured,
  pdfUrl,
  seoTitle,
  seoDescription,
  image {
    asset->,
    alt
  },
  body[] {
    ...,
    _type == "image" => {
      ...,
      asset->
    }
  },
  "tags": tags[]->{ _id, title, slug },
  "series": series->{ _id, title, slug, description },
  seriesOrder,
  "relatedPosts": relatedPosts[]->{
    _id,
    title,
    slug,
    excerpt,
    category,
    publishedAt,
    image { asset->, alt }
  }
}`

// Fetch posts by tag
export const POSTS_BY_TAG_QUERY = `*[
  _type == "post"
  && defined(slug.current)
  && $tagSlug in tags[]->slug.current
] | order(publishedAt desc) {
  _id,
  title,
  slug,
  excerpt,
  category,
  publishedAt,
  readingTime,
  image {
    asset->,
    alt
  }
}`

// Fetch posts in a series
export const POSTS_BY_SERIES_QUERY = `*[
  _type == "post"
  && defined(slug.current)
  && series->slug.current == $seriesSlug
] | order(seriesOrder asc) {
  _id,
  title,
  slug,
  excerpt,
  seriesOrder,
  publishedAt,
  image {
    asset->,
    alt
  }
}`

// Fetch all tags
export const TAGS_QUERY = `*[_type == "tag"] | order(title asc) {
  _id,
  title,
  slug
}`

// Fetch all series
export const SERIES_QUERY = `*[_type == "series"] | order(title asc) {
  _id,
  title,
  slug,
  description
}`

// Fetch all podcast guests
export const PODCAST_GUESTS_QUERY = `*[_type == "podcastGuest"] | order(order asc) {
  _id,
  name,
  role,
  branch,
  episodeUrl,
  image { asset->, alt },
  linkedinUrl,
  websiteUrl,
  websiteLabel,
  order
}`
