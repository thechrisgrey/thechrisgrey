// GROQ queries for fetching blog content from Sanity

// Combined blog listing query (posts + tags + series in one request)
export const BLOG_LISTING_QUERY = `{
  "posts": *[_type == "post" && defined(slug.current)] | order(isFeatured desc, publishedAt desc) {
    _id,
    title,
    slug,
    excerpt,
    category,
    publishedAt,
    readingTime,
    isFeatured,
    image {
      "asset": asset->{ _id, url },
      alt
    },
    "tags": tags[]->{ _id, title, slug },
    "series": series->{ _id, title, slug, description },
    seriesOrder
  },
  "tags": *[_type == "tag"] | order(title asc) { _id, title, slug },
  "series": *[_type == "series"] | order(title asc) { _id, title, slug, description }
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
  },
  "seriesPosts": select(
    defined(series) => *[_type == "post" && series._ref == ^.series._ref] | order(seriesOrder asc) {
      _id, title, slug, seriesOrder
    },
    null
  )
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
