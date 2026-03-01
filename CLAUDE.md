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
npm run build        # Lint + TypeScript compile + production build + sitemap + RSS feed generation
npm run preview      # Preview production build locally
npm run lint         # Run ESLint on TypeScript files
```

**Deployment:**
- Pushing to `main` branch automatically triggers AWS Amplify deployment
- Amplify App ID: `d3du8eg39a9peo` (us-east-2)
- Amplify uses `amplify.yml` configuration (runs `npm ci` then `npm run build`)
- Build artifacts from `dist/` directory are deployed

**Manual Amplify Rebuild:**
```bash
aws amplify start-job --app-id d3du8eg39a9peo --branch-name main --job-type RELEASE --region us-east-2
```

## Architecture

### Routing & Layout
- React Router v6 with client-side routing
- Global layout in `App.tsx`: `<ScrollToTop>` → `<Navigation>` → `<Suspense>` → `<Routes>` → `<Footer>`
- **Code splitting:** All page routes except Home use `React.lazy()` for on-demand chunk loading
  - Home stays static (critical first-load path)
  - `PageLoadingFallback` shows a gold spinner during chunk loads
  - Each page produces its own JS chunk (e.g., `About-[hash].js`, `Blog-[hash].js`)
- 11 routes: `/` (Home), `/about`, `/altivum`, `/podcast`, `/beyond-the-assessment`, `/blog`, `/blog/:slug`, `/links`, `/contact`, `/chat`, `/privacy`
- Catch-all `*` route renders custom 404 page (`src/pages/NotFound.tsx`)
- Footer and chat widget are conditionally hidden on full-viewport pages (e.g., `/chat`)

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
- `animate-widget-open`: Chat widget panel entrance (250ms slide-up + scale-in)
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

### Security Headers

HTTP security headers are configured in `amplify.yml` via a `**/*` catch-all pattern:
- **HSTS**: `max-age=31536000; includeSubDomains`
- **X-Content-Type-Options**: `nosniff`
- **X-Frame-Options**: `SAMEORIGIN`
- **Referrer-Policy**: `strict-origin-when-cross-origin`
- **Permissions-Policy**: Denies camera, microphone, geolocation
- **CSP**: Allowlisted origins for scripts (Cloudflare), styles (Material Icons), images (Sanity, YouTube thumbnails), connections (Lambda endpoints, Sanity API, Cloudflare beacon), frames (YouTube, Spotify, Buzzsprout)

When adding new external resources, update the CSP in `amplify.yml` to include the new origin.

### YouTube Facade

`src/components/YouTubeFacade.tsx` replaces raw YouTube iframes with a click-to-play facade:
- Shows `maxresdefault.jpg` thumbnail with gold play button (falls back to `hqdefault.jpg`)
- Only loads the YouTube iframe when user clicks play (`autoplay=1`)
- Includes `sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"` on real iframe
- Used in `Podcast.tsx` (latest episode) and `PortableTextComponents.tsx` (blog embeds)
- Props: `videoId`, `title`, optional `embedParams`

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

### AI Chat (`/chat` + Floating Widget)

Full-viewport conversational AI experience powered by Amazon Bedrock, Claude Haiku 4.5, and RAG via Bedrock Knowledge Base. Also accessible as a compact floating widget on every other page.

**Shared Chat Engine** (`src/hooks/useChatEngine.ts`):
- All chat state and streaming logic extracted into a reusable `useChatEngine()` hook
- Manages messages, typing state, streaming fetch, conversation history, and scroll behavior
- Both the full chat page and the widget consume this hook independently
- Since the widget hides on `/chat` and the chat page only renders on `/chat`, they never coexist -- `sessionStorage` keeps conversations in sync across navigation
- Exports: `useChatEngine`, `CHAT_STORAGE_KEY`, `Message` interface, `initialWelcomeMessage`

**Chat Widget** (`src/components/chat/`):
- `ChatWidget.tsx`: Orchestrator with `isOpen` state, renders button + panel
- `ChatWidgetButton.tsx`: Gold FAB, `fixed bottom-6 right-6 z-40`, toggles `chat`/`close` icons, `aria-expanded`
- `ChatWidgetPanel.tsx`: Compact chat panel (`fixed bottom-24 right-6 z-40`)
  - Header with status dot, clear/expand/close buttons
  - Reuses existing `ChatMessage`, `ChatInput`, `ChatSuggestions`, `TypingIndicator`
  - "Expand" button navigates to `/chat` for the full experience
  - Uses `useFocusTrap` for accessibility, Escape to close
  - Mobile: `w-[calc(100vw-2rem)] h-[calc(100vh-8rem)]`, Desktop: `sm:w-[400px] sm:h-[560px]`
- Widget hidden on `/chat` page (controlled in `App.tsx` via `isFullscreenPage`)

**Full Chat Page** (`src/pages/Chat.tsx`):
- Full-viewport layout (`h-screen overflow-hidden`) - no page scroll, no footer
- Messages scroll within container, input stays anchored at bottom
- Real-time streaming responses via fetch + ReadableStream
- Components in `src/components/chat/`: `ChatMessage`, `ChatInput`, `ChatSuggestions`, `TypingIndicator`
- Suggested prompts use third person ("How did he..." not "What's your...")
- **Conversation Persistence:** Messages saved to sessionStorage (key: `chat-messages`)
  - Survives page refresh within same browser session
  - Auto-clears when browser closes (privacy-friendly)
  - "Clear" button in header resets conversation
- **Error Boundary:** Wrapped with `ChatErrorFallback` for graceful error recovery

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
- **Rate Limiting:** Atomic DynamoDB-based per-IP tracking (race-condition-free)
  - Table: `thechrisgrey-chat-ratelimit`
  - Uses `UpdateCommand` with `ADD` + `ConditionExpression` for atomic increment
  - Limit: 20 requests/hour per IP (SHA256 hashed)
  - Window: 1 hour, TTL auto-cleanup after 2 hours
  - Stale window triggers `ConditionalCheckFailedException` → counter resets
  - IP extracted from `requestContext.http.sourceIp` only (no `x-forwarded-for` — prevents header spoofing bypass)
- **Input Validation:** Role whitelist (`user`/`assistant` only — blocks `system` injection), 4000-char per-message limit, 50-message array cap
- **Server-side Truncation:** Last 20 messages sent to Bedrock (sliding window), ensures first message is `user` role
- **Cost Monitoring:** CloudWatch alarm `thechrisgrey-bedrock-cost-alarm` triggers at $25/day

**Frontend Streaming Hardening** (`useChatEngine.ts`):
- `AbortController` with 30s timeout on every fetch
- Abort-on-resend: sending a new message cancels any in-flight request
- Client-side 20-message sliding window mirrors server-side limit
- Graceful `AbortError` handling: preserves partial streamed content, only shows timeout message if nothing received

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

**Model Invocation Logging:**
- Log Group: `tcg-AI-chat` (us-east-1, 7-day retention)
- IAM Role: `thechrisgrey-bedrock-logging-role`
- Logs include full text data (questions and responses)
- Token usage captured for cost analysis
- See `docs/bedrock-logging-queries.md` for CloudWatch Logs Insights queries

### Dynamic Sitemap & RSS Feed

**Sitemap** generated at build time via `scripts/generate-sitemap.js`:
- Fetches all blog posts from Sanity
- Combines static pages + dynamic blog post URLs
- Outputs to `dist/sitemap.xml`
- **Fail-fast:** Build aborts (`process.exit(1)`) if Sanity fetch fails — prevents deploying a sitemap missing blog posts

**RSS Feed** generated at build time via `scripts/generate-rss.js`:
- Fetches all blog posts from Sanity
- Outputs to `dist/rss.xml`
- Auto-discovery link in `index.html` head
- Link in footer Quick Links section
- **Fail-fast:** Build aborts (`process.exit(1)`) if Sanity fetch fails

### Podcast Page (`/podcast`)

**Data Source:**
- Episodes fetched from YouTube channel at build time via `scripts/generate-podcast-episodes.js`
- Requires `YOUTUBE_API_KEY` environment variable (set in Amplify)
- Falls back to static episodes in `src/data/podcastEpisodes.ts` if API key unavailable
- Generated data stored in `src/data/generatedEpisodes.json`

**YouTube Integration:**
- Fetches all videos from @AltivumPress channel
- Extracts: title, description, thumbnail, duration, publish date, video ID
- Parses episode numbers from titles (patterns: "Ep 1", "Episode 1", "#1")
- Latest episode displayed via `YouTubeFacade` (click-to-play, no iframe until interaction)

**Build Process:**
1. `generate-podcast-episodes.js` runs first in build
2. Fetches YouTube Data API v3 (channel → uploads playlist → videos)
3. Generates `generatedEpisodes.json` with episode data
4. Vite bundles the JSON into the app

**Setting Up YouTube API Key:**
1. Go to Google Cloud Console → APIs & Services → Credentials
2. Create API Key (restrict to YouTube Data API v3)
3. Add to Amplify: `aws amplify update-branch --app-id d3du8eg39a9peo --branch-name main --environment-variables "YOUTUBE_API_KEY=your-key" --region us-east-2`

**Auto-Update Webhook (Optional):**
To automatically rebuild when new videos are uploaded:
- Set up YouTube PubSubHubbub subscription
- Or use scheduled CloudWatch Events to trigger Amplify rebuild periodically

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

**Press Kit** (`public/press-kit/` and `public/press-kit.zip`):
- Downloadable zip linked from Contact page "Download Press Kit" button
- `headshots/`: Professional, Casual, Military headshots (PNG)
- `logos/`: White, Black, @thechrisgrey, The Vector Podcast logos (PNG)
- `bios/`: Short (~100 words) and long (~400 words) bios
- `christian-perez-fact-sheet.pdf`: Key facts and credentials
- `speaking-topics.pdf`: Speaking topic descriptions

### Blog Features

**Blog Series & Discovery** (`src/pages/Blog.tsx`):
- Blog listing supports `?series=<slug>` URL param to filter posts by series
- Series filter shows a context banner with series title, description, and post count
- Posts sorted by `seriesOrder` when viewing a series (ascending)
- Categories derived from actual post data (not hardcoded) — new categories appear automatically
- Active filter chips include series with removable close button
- `POSTS_QUERY` includes `series` and `seriesOrder` projections for the listing page

**Syntax Highlighting** (`src/components/HighlightedCodeBlock.tsx`):
- Shiki (WASM-based) syntax highlighter for blog code blocks
- Dynamically imported only when a blog post with code blocks is viewed
- Shows plain monochrome text immediately, swaps in highlighted HTML once Shiki loads
- `React.memo` optimized (code content is static per render)
- Graceful fallback: if Shiki fails or language unsupported, shows plain text
- Uses `github-dark` theme, `not-prose` wrapper to prevent Tailwind Typography conflicts

**Blog Image CLS Fix** (`src/sanity/PortableTextComponents.tsx`):
- Inline images wrapped in `aspect-ratio: 4/3` container to reserve space and eliminate CLS
- `loading="lazy"` and `decoding="async"` on blog images for below-fold performance
- `object-cover` handles non-4:3 images gracefully

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

### Accessibility

**Focus Management:**
- `useFocusTrap` hook (`src/hooks/useFocusTrap.ts`) - traps Tab key within modals, returns focus on close
- Modals use `role="dialog"`, `aria-modal="true"`, `aria-labelledby`
- Chat messages container has `aria-live="polite"` for screen reader announcements

**Keyboard Navigation:**
- About dropdown supports Arrow keys (up/down), Escape to close
- All interactive elements have `focus-visible` outlines (gold, 2px)
- Skip-to-content link for keyboard users

**Focus Styles** (in `src/index.css`):
- `focus-visible` shows gold outline only on keyboard navigation
- Mouse clicks don't show focus rings

### Error Handling

**ErrorBoundary** (`src/components/ErrorBoundary.tsx`):
- Global boundary wraps all Routes in App.tsx as safety net
- Page-level boundaries wrap high-risk routes (Blog, BlogPost, Chat)
- Shows friendly error page with Refresh/Go Home options
- In development mode, shows collapsible error details
- Navigation remains visible on error

**Enhanced Props:**
- `fallback`: Custom fallback UI component
- `onReset`: Callback for page-specific cleanup (e.g., clear sessionStorage)
- `showHomeButton`: Optional home navigation (default: true, false for full-viewport pages)
- `pageName`: Contextual error messaging

**Page-Specific Fallbacks** (`src/components/ErrorFallbacks.tsx`):
- `BlogErrorFallback`: "Unable to load blog" with retry button
- `ChatErrorFallback`: Full-viewport layout matching Chat page (no Home button)
- `GenericPageErrorFallback`: Reusable default with optional page name

### Analytics

**Cloudflare Web Analytics:**
- Privacy-friendly (no cookies, no personal data)
- Script in `index.html` before closing `</body>`
- Dashboard: Cloudflare → Analytics & Logs → Web Analytics

### Utilities

**Validators** (`src/utils/validators.ts`):
- `isValidEmail(email)` - shared email validation
- `EMAIL_REGEX` - exported regex pattern

## Key Files

- `tailwind.config.js`: Custom colors, fonts, animations
- `src/utils/typography.ts`: Centralized typography system
- `src/utils/schemas.ts`: Schema.org structured data builders for SEO/AEO
- `src/utils/validators.ts`: Shared validation functions (email)
- `src/constants/links.ts`: Centralized social media and external links
- `src/components/Navigation.tsx`: Fixed nav with scroll-based transparency and dropdown menu
- `src/components/SEO.tsx`: SEO/metadata management with structured data
- `src/components/ErrorBoundary.tsx`: Graceful error handling for render errors (supports page-level boundaries)
- `src/components/ErrorFallbacks.tsx`: Page-specific error fallback components
- `src/hooks/useFocusTrap.ts`: Focus trap hook for modals
- `src/hooks/useSessionStorage.ts`: Generic sessionStorage hook with JSON serialization and Date revival
- `src/pages/Home.tsx`: Complex scroll animations and sticky sections
- `src/pages/Chat.tsx`: Full-viewport AI chat experience
- `src/hooks/useChatEngine.ts`: Shared chat state/streaming hook used by both Chat page and widget
- `src/components/chat/`: Chat UI components (ChatMessage, ChatInput, ChatSuggestions, TypingIndicator, ChatWidget, ChatWidgetButton, ChatWidgetPanel)
- `src/sanity/`: Sanity CMS client, queries, types for blog
- `lambda/chat-stream/`: Bedrock streaming Lambda function for AI chat
- `lambda/kb-sync/`: Lambda triggered by S3 to auto-sync Knowledge Base
- `docs/bedrock-logging-queries.md`: CloudWatch Logs Insights queries for chat analytics
- `scripts/generate-sitemap.js`: Build-time sitemap generator
- `scripts/generate-rss.js`: Build-time RSS feed generator
- `scripts/generate-podcast-episodes.js`: Fetches episodes from YouTube at build time
- `src/data/podcastEpisodes.ts`: Podcast episode data (uses generated YouTube data or fallback)
- `src/data/generatedEpisodes.json`: Auto-generated YouTube episode data
- `src/components/YouTubeFacade.tsx`: Click-to-play YouTube facade (thumbnail + play button → iframe on click)
- `src/components/HighlightedCodeBlock.tsx`: Shiki-powered syntax highlighting for blog code blocks
- `src/components/ReadingProgressBar.tsx`: Scroll progress indicator for blog posts
- `src/pages/NotFound.tsx`: Custom 404 page
- `public/.well-known/security.txt`: Security vulnerability reporting contact
- `public/press-kit/`: Press materials for event organizers (headshots, bios, logos)
- `public/press-kit.zip`: Downloadable press kit (linked from Contact page)
- `amplify.yml`: AWS Amplify build configuration
- `index.html`: Material Icons CDN, Cloudflare Analytics, favicon, RSS auto-discovery

## Environment Variables

Required (set in AWS Amplify console):
- `VITE_CONTACT_ENDPOINT`: AWS Lambda URL for contact form submissions
- `VITE_NEWSLETTER_ENDPOINT`: AWS Lambda URL for newsletter subscriptions
- `VITE_CHAT_ENDPOINT`: AWS Lambda Function URL for AI chat streaming
- `YOUTUBE_API_KEY`: YouTube Data API v3 key for podcast episode fetching (build-time only, not VITE_ prefixed)

**Important:** Local `.env.local` variables are NOT automatically synced to production. Any new `VITE_*` variable added locally must also be added to Amplify via:
- AWS Console: Amplify > App > Environment variables
- CLI: `aws amplify update-branch --app-id d3du8eg39a9peo --branch-name main --environment-variables "VITE_NEW_VAR=value" --region us-east-2`

After adding/changing env vars, trigger a rebuild for changes to take effect.

## Deployment Notes

- **Node version pinned** to 20 via `.nvmrc`
- **Never commit** `node_modules/` or `dist/` (in `.gitignore`)
- Assets in `public/` are copied to dist root (e.g., `public/tcg.png` → `/tcg.png`)
- Vite bundles `src/assets/` imports with cache-busting hashes
- Build must succeed (`npm run build`) before deploying
- Site is hosted at `https://thechrisgrey.com`
