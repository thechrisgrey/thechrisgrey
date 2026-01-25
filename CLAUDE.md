# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal website for Christian Perez (@thechrisgrey) - Founder & CEO of Altivum Inc., former Green Beret (18D), host of The Vector Podcast, and author of "Beyond the Assessment". Built with React + TypeScript + Vite, styled with Tailwind CSS, deployed on AWS Amplify.

## Reminder

Check `docs/ideas-to-consider.md` for pending feature ideas:
- Portfolio/projects showcase (device mockups or screenshot grid with modal preview)

## Development Commands

**Local Development:**
```bash
npm run dev          # Start dev server at http://localhost:5173
npm run build        # TypeScript compile + production build + sitemap + RSS feed generation
npm run preview      # Preview production build locally
npm run lint         # Run ESLint on TypeScript files
```

**Deployment:**
- Pushing to `main` branch automatically triggers AWS Amplify deployment
- Amplify App ID: `dv3g3860t7qiz` (us-east-2)
- Amplify uses `amplify.yml` configuration (runs `npm ci` then `npm run build`)
- Build artifacts from `dist/` directory are deployed

**Manual Amplify Rebuild:**
```bash
aws amplify start-job --app-id dv3g3860t7qiz --branch-name main --job-type RELEASE --region us-east-2
```

## Architecture

### Routing & Layout
- React Router v6 with client-side routing
- Global layout in `App.tsx`: `<ScrollToTop>` → `<Navigation>` → `<Routes>` → `<Footer>`
- 11 routes: `/` (Home), `/about`, `/altivum`, `/podcast`, `/beyond-the-assessment`, `/blog`, `/blog/:slug`, `/links`, `/contact`, `/chat`, `/privacy`
- Catch-all `*` route renders custom 404 page (`src/pages/NotFound.tsx`)
- Footer is conditionally hidden on full-viewport pages (e.g., `/chat`)

### Design System (Tailwind)

**Custom Color Palette** (defined in `tailwind.config.js`):
- `altivum-dark`: #0A0F1C (backgrounds)
- `altivum-navy`: #1A2332 (cards, nav)
- `altivum-blue`: #2E4A6B (accents)
- `altivum-slate`: #4A5A73
- `altivum-silver`: #9BA6B8 (body text)
- `altivum-gold`: #C5A572 (highlights, CTAs)

**Typography System:**
- All fonts use SF Pro Display (Apple's system font) with fallbacks to Helvetica Neue, Segoe UI
- Centralized typography utilities in `src/utils/typography.ts`
- Consistent ultra-light weight (200) across all text
- Fluid sizing using `clamp()` for responsive design
- 7 predefined text styles: `heroHeader`, `sectionHeader`, `cardTitleLarge`, `cardTitleSmall`, `subtitle`, `bodyText`, `smallText`
- Usage: Import `typography` and apply styles inline: `<h1 style={typography.heroHeader}>Title</h1>`
- NEVER use Google Fonts (Inter, Playfair, Montserrat) - those were removed in favor of SF Pro Display

**Icons:**
- Google Material Icons loaded via CDN in `index.html`
- Usage: `<span className="material-icons">icon_name</span>`
- Brand logos (social media) use inline SVG paths

**Custom Animations:**
- `animate-fade-in`: Hero section entrance (1.2s)
- `animate-nav-fade-in`: Navigation delayed entrance (0.8s with 2s delay)
- `shimmer`: Background shimmer effect
- Defined as Tailwind keyframes in `tailwind.config.js`

### Home Page Scroll Experience

The Home page (`src/pages/Home.tsx`) features a sophisticated scroll-based animation system:

**Structure:**
1. **Hero Section (100vh)**: Static hero image with fade-in animation
2. **Summary Section (450vh mobile / 500vh desktop)**: Sticky profile image with scroll-triggered key points
3. **CTA Section**: Standard content with social links

**Summary Section Mechanics:**
- Profile image is `position: sticky` inside a tall container (450vh mobile, 500vh desktop)
- 4 key points fade in from left as user scrolls:
  - Mobile: appear every 50vh
  - Desktop: appear every 80vh
  - Points: Personal Biography, Altivum Inc, The Vector Podcast, Beyond the Assessment
- Scroll progress tracked via `useState` + `useEffect` with throttled scroll listener using `requestAnimationFrame`
- Key points styled as left-aligned tabs with `border-l-4 border-altivum-gold`
- Uses `will-change: opacity, transform` for performance optimization

**Navigation Transparency:**
- Nav bar stays transparent through hero + summary sections (600vh total on home page)
- Becomes solid (`bg-altivum-navy/95 backdrop-blur-md`) after scrolling past summary
- Threshold: `window.innerHeight * 6` in `Navigation.tsx`
- On other pages, nav becomes solid after 20px scroll

### Navigation Structure

The Navigation component (`src/components/Navigation.tsx`) features a dropdown system:

**Desktop Navigation:**
- "About" is a dropdown button with 4 sub-items:
  - Personal Biography (`/about`)
  - Altivum Inc (`/altivum`)
  - The Vector Podcast (`/podcast`)
  - Beyond the Assessment (`/beyond-the-assessment`)
- Dropdown closes when clicking outside (using `useRef` and `mousedown` event listener)
- Other nav items: Home, Blog, Links, Contact

**Mobile Navigation:**
- Hamburger menu toggle (visible on `md:hidden`)
- "About" section expanded inline with all sub-items
- Menu has solid background (`bg-altivum-navy/95 backdrop-blur-md`) for readability

### SEO & Metadata

**SEO Component** (`src/components/SEO.tsx`):
- Uses `react-helmet-async` for dynamic meta tags
- Automatically appends "| Christian Perez" to page titles
- Default OG image: `https://thechrisgrey.com/og.png`
- Includes JSON-LD structured data with `@graph` for AI discovery:
  - Person schema for Christian Perez
  - Organization schema for Altivum Inc.
  - WebSite schema for the site itself
- Custom structured data can be merged via `structuredData` prop
- All pages should use this component for consistent SEO

**Usage:**
```tsx
<SEO
  title="Page Title"
  description="Page description"
  keywords="optional, keywords"
  faq={faqArray}           // optional FAQ schema for AEO
  breadcrumbs={[...]}      // optional breadcrumb schema
  structuredData={[...]}   // optional additional schemas
/>
```

**Schema Builders** (`src/utils/schemas.ts`):
- Pre-built schema generators: `buildPersonSchema()`, `buildOrganizationSchema()`, `buildFAQSchema()`, `buildBreadcrumbSchema()`, `buildPodcastSeriesSchema()`, `buildBookSchema()`, etc.
- Pre-defined FAQ content for each page (e.g., `homeFAQs`, `aboutFAQs`, `podcastFAQs`)
- Organization schema includes Chamber of Commerce "Veteran Business of the Month" award

### Sanity CMS (Blog)

The blog is powered by Sanity CMS with content fetched at runtime.

**Configuration** (`src/sanity/`):
- `client.ts`: Sanity client (project: `k5950b3w`, dataset: `production`)
- `queries.ts`: GROQ queries for posts, tags, series
- `types.ts`: TypeScript interfaces for Sanity documents
- `PortableTextComponents.tsx`: Custom renderers for rich text

**Content Types:**
- Posts with categories, tags, series support
- Featured posts, reading time, related posts
- Images with alt text via `@sanity/image-url`

**Usage:**
```tsx
import { client, urlFor, POSTS_QUERY } from '../sanity';
const posts = await client.fetch(POSTS_QUERY);
```

### AI Chat (`/chat`)

Full-viewport conversational AI experience powered by Amazon Bedrock, Claude Haiku 4.5, and RAG via Bedrock Knowledge Base.

**Frontend** (`src/pages/Chat.tsx`):
- Full-viewport layout (`h-screen overflow-hidden`) - no page scroll, no footer
- Messages scroll within container, input stays anchored at bottom
- Real-time streaming responses via fetch + ReadableStream
- Components in `src/components/chat/`: `ChatMessage`, `ChatInput`, `ChatSuggestions`, `TypingIndicator`
- Suggested prompts use third person ("How did he..." not "What's your...")

**Backend** (`lambda/chat-stream/`):
- Lambda function with streaming response via `awslambda.streamifyResponse()`
- Uses Bedrock ConverseStream API with Claude Haiku 4.5 (`us.anthropic.claude-haiku-4-5-20251001-v1:0`)
- RAG-enhanced via Bedrock Knowledge Base retrieval before each response
- Function URL: streaming enabled with CORS for thechrisgrey.com
- Lambda execution role: `thechrisgrey-chat-stream-role`

**Guardrails & Rate Limiting:**
- **Bedrock Guardrail ID:** `5kofhp46ssob` (version 1)
  - Content filters: PROMPT_ATTACK (HIGH), HATE, INSULTS, SEXUAL (HIGH), VIOLENCE, MISCONDUCT (MEDIUM)
  - Denied topics: Off-topic technical support, illegal activities, professional advice
  - Profanity word filter enabled
- **Rate Limiting:** DynamoDB-based per-IP tracking
  - Table: `thechrisgrey-chat-ratelimit`
  - Limit: 20 requests/hour per IP (SHA256 hashed)
  - Window: 1 hour, TTL auto-cleanup after 2 hours
- **Cost Monitoring:** CloudWatch alarm `thechrisgrey-bedrock-cost-alarm` triggers at $25/day

**Response Guidelines** (enforced in system prompt):
- Plain text only - NO markdown (no bold, italics, headers, bullet lists)
- Conversational flowing paragraphs, not document-style
- Concise: 2-3 sentences for simple questions, 4-6 max for complex
- Synthesize information naturally, don't list every detail
- `maxTokens: 350`, `temperature: 0.6`

**Knowledge Base (RAG)**:
- Knowledge Base ID: `ARFYABW8HP`
- Data Source ID: `TXQTRAJOSD`
- Source Bucket: `s3://thechrisgrey-kb-source/` (us-east-1)
- Vector Store: S3 Vectors (cost-effective alternative to OpenSearch Serverless)
  - Vector Bucket: `thechrisgrey-vectors`
  - Vector Index: `autobiography-index`
  - Non-filterable metadata keys: `AMAZON_BEDROCK_TEXT`, `AMAZON_BEDROCK_METADATA`
- Embeddings: Amazon Titan Text Embeddings v2 (1024 dimensions, cosine distance)
- Retrieves 5 most relevant chunks for each user query
- IAM Role: `TheChrisGreyKnowledgeBaseRole`

**Files:**
- `lambda/chat-stream/index.mjs`: Lambda handler with KB retrieval + streaming
- `lambda/chat-stream/iam-policy.json`: IAM policy for Bedrock + KB access
- `lambda/chat-stream/package.json`: Dependencies (bedrock-runtime, bedrock-agent-runtime, dynamodb)

**Deployment:**
```bash
cd lambda/chat-stream
npm install
zip -r function.zip index.mjs package.json node_modules
aws lambda update-function-code --function-name thechrisgrey-chat-stream --zip-file fileb://function.zip --region us-east-1
```

**Updating Knowledge Base Content:**

Content syncs automatically when files change in S3:
1. Upload new documents to `s3://thechrisgrey-kb-source/`
2. Delete outdated documents
3. KB sync triggers automatically via Lambda (`thechrisgrey-kb-sync`)

**Auto-Sync Lambda** (`lambda/kb-sync/`):
- Function: `thechrisgrey-kb-sync` (us-east-1)
- Role: `thechrisgrey-kb-sync-role`
- Triggered by S3 events: `ObjectCreated:*` and `ObjectRemoved:*`
- Calls `StartIngestionJob` on the Knowledge Base
- Handles concurrent sync attempts gracefully (conflict errors are expected and harmless)

Manual sync (if needed):
```bash
aws bedrock-agent start-ingestion-job --knowledge-base-id ARFYABW8HP --data-source-id TXQTRAJOSD --region us-east-1
```

**S3 Vectors Note:** When creating the vector index, you MUST configure `AMAZON_BEDROCK_TEXT` and `AMAZON_BEDROCK_METADATA` as non-filterable metadata keys. Without this, ingestion fails with "Filterable metadata must have at most 2048 bytes" because text chunks exceed the 2KB filterable limit.

### Dynamic Sitemap & RSS Feed

**Sitemap** generated at build time via `scripts/generate-sitemap.js`:
- Fetches all blog posts from Sanity
- Combines static pages + dynamic blog post URLs
- Outputs to `dist/sitemap.xml`

**RSS Feed** generated at build time via `scripts/generate-rss.js`:
- Fetches all blog posts from Sanity
- Outputs to `dist/rss.xml`
- Auto-discovery link in `index.html` head
- Link in footer Quick Links section

### Contact Page & Speaking/Media

The Contact page (`/contact`) combines contact form with speaking/media information:

**Structure:**
- Hero section with "Let's Connect"
- Speaking & Media section with speaking topics and event types
- Contact form (left) and contact info cards (right)

**Speaking Topics:**
- Cloud & AI Strategy
- Veteran Transition
- Entrepreneurship
- Leadership (Special Operations lessons)

**Press Kit** (`public/press-kit/`):
- `README.txt`: Guide for what to include
- `headshots/`: High-res photos for event promoters
- `logos/`: Brand logos
- Add bios and materials as needed

### Blog Features

**Reading Progress Bar** (`src/components/ReadingProgressBar.tsx`):
- 3px gold bar fixed at top of blog posts
- Shows scroll progress (0-100%)
- Throttled with requestAnimationFrame for performance

### Component Patterns

**Responsive Design:**
- Mobile-first approach with Tailwind breakpoints (`sm:`, `md:`, `lg:`)
- Touch-optimized with `touch-manipulation` class on interactive elements
- Mobile-specific considerations: larger tap targets (min-h-[48px]), adjusted spacing

**Images:**
- **Optimized images** (`src/assets/`): Auto-compressed to 80% quality by `vite-plugin-image-optimizer`
  - Import: `import heroImage from '../assets/hero2.png'`
  - Good for: logos, icons, decorative images where compression is acceptable
- **Full-quality images** (`public/`): Served as-is, no processing
  - Reference with absolute path: `const profileImage = '/profile1.jpeg'`
  - Good for: hero photos, profile pictures, images where quality is critical
  - Root-level images in `public/` are excluded from optimization via `vite.config.ts`
- The profile image (`profile1.jpeg`) is in `public/` for maximum quality on home page

## Key Files

- `tailwind.config.js`: Custom colors, fonts, animations
- `src/utils/typography.ts`: Centralized typography system
- `src/utils/schemas.ts`: Schema.org structured data builders for SEO/AEO
- `src/constants/links.ts`: Centralized social media and external links
- `src/components/Navigation.tsx`: Fixed nav with scroll-based transparency and dropdown menu
- `src/components/SEO.tsx`: SEO/metadata management with structured data
- `src/pages/Home.tsx`: Complex scroll animations and sticky sections
- `src/pages/Chat.tsx`: Full-viewport AI chat experience
- `src/components/chat/`: Chat UI components (ChatMessage, ChatInput, ChatSuggestions, TypingIndicator)
- `src/sanity/`: Sanity CMS client, queries, types for blog
- `lambda/chat-stream/`: Bedrock streaming Lambda function for AI chat
- `lambda/kb-sync/`: Lambda triggered by S3 to auto-sync Knowledge Base
- `scripts/generate-sitemap.js`: Build-time sitemap generator
- `scripts/generate-rss.js`: Build-time RSS feed generator
- `src/components/ReadingProgressBar.tsx`: Scroll progress indicator for blog posts
- `src/pages/NotFound.tsx`: Custom 404 page
- `public/.well-known/security.txt`: Security vulnerability reporting contact
- `public/press-kit/`: Press materials for event organizers (headshots, bios, logos)
- `amplify.yml`: AWS Amplify build configuration
- `index.html`: Material Icons CDN link, favicon, RSS auto-discovery, base meta tags

## Environment Variables

Required (set in AWS Amplify console):
- `VITE_CONTACT_ENDPOINT`: AWS Lambda URL for contact form submissions
- `VITE_NEWSLETTER_ENDPOINT`: AWS Lambda URL for newsletter subscriptions
- `VITE_CHAT_ENDPOINT`: AWS Lambda Function URL for AI chat streaming

**Important:** Local `.env.local` variables are NOT automatically synced to production. Any new `VITE_*` variable added locally must also be added to Amplify via:
- AWS Console: Amplify > App > Environment variables
- CLI: `aws amplify update-branch --app-id dv3g3860t7qiz --branch-name main --environment-variables "VITE_NEW_VAR=value" --region us-east-2`

After adding/changing env vars, trigger a rebuild for changes to take effect.

## Deployment Notes

- **Never commit** `node_modules/` or `dist/` (in `.gitignore`)
- Assets in `public/` are copied to dist root (e.g., `public/tcg.png` → `/tcg.png`)
- Vite bundles `src/assets/` imports with cache-busting hashes
- Build must succeed (`npm run build`) before deploying
- Site is hosted at `https://thechrisgrey.com`
