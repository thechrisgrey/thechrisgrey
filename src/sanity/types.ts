// TypeScript types for Sanity content

export interface SanityImage {
  asset: {
    _id: string
    url: string
  }
  alt?: string
  caption?: string
}

export interface SanityTag {
  _id: string
  title: string
  slug: { current: string }
}

export interface SanitySeries {
  _id: string
  title: string
  slug: { current: string }
  description?: string
  image?: SanityImage
}

export interface SanityPost {
  _id: string
  _updatedAt?: string
  title: string
  slug: { current: string }
  excerpt: string
  category: string
  publishedAt: string
  readingTime?: number
  isFeatured?: boolean
  pdfUrl?: string
  seoTitle?: string
  seoDescription?: string
  image?: SanityImage
  body?: SanityBlock[]
  tags?: SanityTag[]
  series?: SanitySeries
  seriesOrder?: number
  relatedPosts?: SanityPostPreview[]
}

export interface SanityPostPreview {
  _id: string
  title: string
  slug: { current: string }
  excerpt: string
  category: string
  publishedAt: string
  readingTime?: number
  isFeatured?: boolean
  image?: SanityImage
  tags?: SanityTag[]
}

// Portable Text block types
export interface SanityBlock {
  _type: string
  _key: string
  [key: string]: unknown
}

export interface CodeBlock {
  _type: 'codeBlock'
  _key: string
  filename?: string
  code: {
    _type: 'code'
    language?: string
    code: string
    highlightedLines?: number[]
  }
}

export interface Callout {
  _type: 'callout'
  _key: string
  type: 'note' | 'tip' | 'warning' | 'important'
  text: string
}

export interface YouTube {
  _type: 'youtube'
  _key: string
  url: string
  caption?: string
}

export interface Divider {
  _type: 'divider'
  _key: string
  style?: 'line' | 'dots' | 'space'
}

export interface PullQuote {
  _type: 'pullQuote'
  _key: string
  quote: string
  attribution?: string
}

export interface BookReference {
  _type: 'bookReference'
  _key: string
  title: string
  author: string
  cover?: SanityImage
  description?: string
  link?: string
}
