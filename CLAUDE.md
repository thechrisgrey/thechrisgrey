# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal website for Christian Perez (@thechrisgrey) - Founder & CEO of Altivum Inc., former Green Beret (18D), host of The Vector Podcast, and author of "Beyond the Assessment". Built with React 19 + TypeScript + Vite, styled with Tailwind CSS, deployed on AWS Amplify.

## Reminder

Check `docs/ideas-to-consider.md` for pending feature ideas:
- Portfolio/projects showcase (device mockups or screenshot grid with modal preview)

## Development Commands

**Local Development:**
```bash
npm run dev          # Start dev server at http://localhost:5173
npm run build        # Env validation + podcast episodes + lint + TypeScript compile + production build + sitemap + RSS feed generation
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
- 15 routes: `/` (Home), `/about`, `/altivum`, `/podcast`, `/beyond-the-assessment`, `/aws`, `/claude`, `/blog`, `/blog/:slug`, `/links`, `/contact`, `/chat`, `/privacy`, `/admin`
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
- **`prefers-reduced-motion: reduce`** override in `src/index.css` forces `opacity: 1` and disables `animate-fade-in`/`animate-nav-fade-in` to prevent invisible content for users with motion preferences

**Micro-Interactions (UI Polish):**
- **Card hover lift:** All interactive cards use `hover:-translate-y-0.5 hover:shadow-lg hover:shadow-altivum-gold/5 transition-all duration-300` for subtle elevation on hover
- **Button press:** All buttons via `Button.tsx` use `active:scale-[0.98]` for tactile click feedback
- **Gold glow on CTAs:** Primary buttons use `hover:shadow-[0_0_20px_rgba(197,165,114,0.3)]` for warm glow
- **Arrow nudge:** Arrow icons next to links use `group-hover:translate-x-1 transition-transform` (or `-translate-x-1` for back arrows)
- **Animated underlines:** Footer links and text links use `.link-underline` CSS class (defined in `index.css`) — a `::after` pseudo-element that scales from 0 to 100% width on hover
- **Gradient section dividers:** Sections separated by `<div className="h-px bg-gradient-to-r from-transparent via-altivum-gold/15 to-transparent" />` instead of flat `border-white/5` — used across Podcast, Blog, Links, Contact pages

**Gotcha — Gradient Dividers in Conditional Blocks:**
- When a gradient `<div>` + `<section>` are inside a conditional (`{condition && (...)}`), they must be wrapped in a `<>` fragment since JSX requires a single parent element

### Home Page Scroll Experience

The Home page (`src/pages/Home.tsx`) features a sophisticated scroll-based animation system:

**Structure:**
1. **Hero Section (100vh)**: Static hero image with fade-in animation
2. **Summary Section (675vh mobile / 840vh desktop)**: Sticky profile image with scroll-triggered key points
3. **CTA Section**: Standard content with social links

**Summary Section Mechanics:**
- Profile image is `position: sticky` inside a tall container (675vh mobile, 840vh desktop)
- 8 key points fade in from left as user scrolls:
  - Mobile: appear every 50vh
  - Desktop: appear every 80vh
  - Points: Personal Biography, Altivum Inc, The Altivum Foundation, The Vector Podcast, Beyond the Assessment, Amazon Web Services, Claude, thechrisgrey Blueprint
- Scroll progress tracked via `useState` + `useEffect` with throttled scroll listener using `requestAnimationFrame`; mobile detection uses `useRef` to avoid stale closure
- Key points styled as left-aligned tabs with `border-l-4 border-altivum-gold`
- Uses `will-change: opacity, transform` for performance optimization

**Navigation Transparency:**
- Nav bar stays transparent through hero + summary sections (~780vh total on home page)
- Becomes solid (`bg-altivum-navy/95 backdrop-blur-md`) after scrolling past summary
- Threshold: `window.innerHeight * 10` in `Navigation.tsx`
- On other pages, nav becomes solid after 20px scroll

### Navigation Structure

The Navigation component (`src/components/Navigation.tsx`) features a dropdown system:

**Desktop Navigation:**
- "About" is a dropdown button with 6 sub-items:
  - Personal Biography (`/about`)
  - Altivum Inc (`/altivum`)
  - The Vector Podcast (`/podcast`)
  - Beyond the Assessment (`/beyond-the-assessment`)
  - Amazon Web Services (`/aws`)
  - Claude (`/claude`)
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
- Pre-built schema generators: `buildPersonSchema()`, `buildOrganizationSchema()`, `buildFAQSchema()`, `buildBreadcrumbSchema()`, `buildPodcastSeriesSchema()`, `buildBookSchema()`, `buildServiceSchema()`, `buildWebPageSchema()`, `buildProfilePageSchema()`, `buildContactPageSchema()`
- Pre-defined FAQ content for each page (e.g., `homeFAQs`, `aboutFAQs`, `podcastFAQs`)
- Organization schema includes Chamber of Commerce "Veteran Business of the Month" award
- PodcastSeries schema uses `public/tvp.png` for a stable image URL (not Vite-hashed `src/assets/`)

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

### Alti — AI Agent (`/chat` + Floating Widget)

"Alti" is Altivum's official AI Agent — branded as "a friend of Christian's" to feel approachable rather than corporate. Full-viewport conversational AI experience powered by Amazon Bedrock, Claude Haiku 4.5, and RAG via Bedrock Knowledge Base. Also accessible as a compact floating 3D mascot widget on every other page. Nav link shows "Alti", chat page title is "Alti^TM".

**Shared Chat Engine** (`src/hooks/useChatEngine.ts`):
- All chat state and streaming logic extracted into a reusable `useChatEngine()` hook
- Manages messages, typing state, streaming fetch, conversation history, and scroll behavior
- Both the full chat page and the widget consume this hook independently
- Since the widget hides on `/chat` and the chat page only renders on `/chat`, they never coexist -- `sessionStorage` keeps conversations in sync across navigation
- Exports: `useChatEngine`, `CHAT_STORAGE_KEY`, `Message` interface, `initialWelcomeMessage`

**Chat Widget** (`src/components/chat/`):
- `ChatWidget.tsx`: Orchestrator with `isOpen` state, renders button + panel
- `ChatWidgetButton.tsx`: `fixed bottom-6 right-6 z-40`, lazy-loads `AltiMascot` 3D component, preserves `<button>` for a11y
- `AltiMascot.tsx`: 3D mascot (Alti) rendered via React Three Fiber in a 64x64 Canvas
  - Model: `public/alti.glb` (meshopt + WebP compressed from 13MB → 1.15MB via `@gltf-transform/cli`)
  - Idle animation: gentle float, side-to-side sway, rocking tilt, slow idle turn (all desynced frequencies for organic feel)
  - Hover: model lifts up (lerp to +0.15 Y), gold glow platform intensifies, idle turn stops (faces viewer)
  - Platform: HTML div with radial gold gradient (`altivum-gold`) that brightens on hover
  - `frameloop="always"` for continuous idle animation (tiny canvas, negligible GPU cost)
  - `useGLTF.preload('/alti.glb')` at module scope for early fetch
  - Three.js mocked in all jsdom tests (Canvas requires WebGL)
- `ChatWidgetPanel.tsx`: Compact chat panel (`fixed bottom-24 right-6 z-40`)
  - Header shows "Alti^TM" with status dot, clear/expand/close buttons
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
- Built on **AWS Strands Agents TypeScript SDK** (`@strands-agents/sdk` v1.0.0-rc.4) running Claude Haiku 4.5 (`us.anthropic.claude-haiku-4-5-20251001-v1:0`) through `BedrockModel`
- Tool-using agent: the model can call navigation, contact-draft, newsletter, blog-citation, and memory tools mid-conversation
- RAG-enhanced via Bedrock Knowledge Base retrieval before the agent starts streaming (context injected into system prompt)
- Function URL with two paths:
  - `POST /` — chat streaming
  - `POST /forget` — erases a visitor's stored facts (see Memory below)
- Lambda execution role: `thechrisgrey-chat-stream-role`

**Module Layout:**
- `index.mjs` — handler: validates HMAC + input, routes `/forget`, retrieves KB context, builds tools + agent, streams response
- `agent.mjs` — factory functions for `BedrockModel`, Strands `Agent`, the guardrail config, and `streamAgentResponse(agent, messages, stream, signal, events)`
- `tools/` — six Strands tools, each a small factory exporting a Zod-typed tool definition:
  - `navigate.mjs` — `navigate_to` (whitelisted paths + `/blog/<slug>` regex); emits a `draft_action{action:"navigate"}` event
  - `draftMessage.mjs` — `draft_message` (intents: speaking, podcast, consulting, collaboration, media, general); NEVER fabricates visitor identity
  - `draftNewsletter.mjs` — `draft_newsletter_subscription`; emits newsletter draft_action
  - `citePassage.mjs` — `cite_blog_passage` (GROQ lookup on Sanity by exact slug, returns URL + excerpt); omitted if no Sanity client configured
  - `searchBlog.mjs` — `search_blog` (GROQ `match` + `score()` over title/excerpt/body/tags; emits `draft_action{action:"blog_search_results"}` with up to 5 posts); omitted if no Sanity client configured
  - `rememberFact.mjs` — `remember_fact` (DynamoDB write keyed by deviceHash); omitted if no deviceId is provided
  - `index.mjs` — `buildTools({ responseStream, sanityClient, docClient, deviceId })` returns the set of tools applicable to this request
- `events.mjs` — writes framed event chunks to the response stream: `\x00EVT\x00{json}\x00EVT\x00` for `tool_invocation`, `tool_result`, `draft_action`, `memory_update`, `guardrail_intervention`; plain text streams raw
- `memory.mjs` — DynamoDB helpers for `thechrisgrey-chat-memory`: `putFact`, `getFacts`, `forgetDevice` (90-day TTL, partitioned by deviceHash — SHA-256 of deviceId)
- `prompts.mjs` — system prompt composition; `buildSystemPrompt(retrievedContext, pageContext, facts)` now folds KB context, visitor memory, and TOOL ETIQUETTE rules (PII prohibitions, never invent visitor identity, etc.)
- `kbRetrieve.mjs`, `hmac.mjs`, `validation.mjs`, `metrics.mjs` — unchanged utilities (KB RAG, signature check, input validation, CloudWatch metrics)

**Event Stream Protocol (wire format):**
- Text tokens stream as-is from the model
- Structured events are framed with `\x00EVT\x00` delimiters: `...text\x00EVT\x00{"kind":"draft_action",...}\x00EVT\x00more text...`
- System/error sentinels still use the legacy `\x00SYS\x00` prefix and terminate the stream
- Client parser (`src/utils/chatEvents.ts`) buffers partial delimiters across chunks, routes text/events separately, and falls back to raw text on invalid JSON payloads

**Visitor Memory (opt-in, per-device):**
- DynamoDB table `thechrisgrey-chat-memory` (env: `CHAT_MEMORY_TABLE`), partitioned by `deviceHash` (SHA-256 of the client `deviceId`)
- `remember_fact` tool writes a plain-text fact (≤240 chars) with 90-day TTL — sanitized for prompt-injection sentinels; PII is explicitly disallowed by tool etiquette in the system prompt
- Facts are loaded into the system prompt at the start of every conversation turn when a `deviceId` is supplied
- `POST /forget` clears all facts for a device in a single DynamoDB delete — used by the "Forget me" button in the chat header
- `deviceId` is a localStorage-backed UUID (`src/utils/deviceId.ts`, pattern `/^[a-zA-Z0-9_-]{8,64}$/`) generated via `crypto.randomUUID()`; malformed or missing IDs disable the memory tool rather than rejecting the request

**Agent Timeout / Cancellation:**
- 25-second `AbortController` timeout wraps the Strands `streamAgentResponse()` call
- Guardrail interventions surface as a `guardrail_intervention` event and the stream ends gracefully
- Strands `SlidingWindowConversationManager` uses a window size of 40 turns — client still enforces 20 as a safety cap

**Request Signing (HMAC):**
- Frontend generates HMAC-SHA256 signature using `VITE_CHAT_SIGNING_KEY` (`src/utils/chatSigning.ts`)
- Signature format: `HMAC(key, "${timestamp}.${body}")` sent via `X-Chat-Timestamp` + `X-Chat-Signature` headers
- Lambda verifies signature using `CHAT_SIGNING_KEY` env var before any processing
- 5-minute timestamp window prevents replay attacks; `crypto.timingSafeEqual` prevents timing attacks
- Unsigned/invalid requests are rejected with a generic error message and `SignatureRejection` metric

**PageContext Hardening:**
- `validatePageContext()` whitelists valid paths against known routes (VALID_PATHS set)
- Blog slugs validated via regex: `/^\/blog\/[a-z0-9][a-z0-9-]*$/`
- Section and pageTitle values validated against `SAFE_TEXT_PATTERN` (alphanumeric + safe chars only)
- Invalid pageContext is nullified (not injected into system prompt)

**Bedrock Invocation Timeout:**
- 10-second `AbortController` timeout wraps `bedrockClient.send()`
- On timeout, returns graceful "taking too long" message and records `BedrockTimeout` metric

**Guardrails & Rate Limiting:**
- **Bedrock Guardrail ID:** `5kofhp46ssob` (version 5)
  - Content filters: PROMPT_ATTACK (HIGH), HATE, INSULTS, SEXUAL (HIGH), VIOLENCE, MISCONDUCT (MEDIUM)
  - Denied topics: Programming and code assistance, general knowledge and trivia, creative content generation, illegal activities, professional advice
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
- Passes the localStorage `deviceId` (from `src/utils/deviceId.ts`) alongside each request; memory-scoped tools are only enabled when the ID is well-formed
- Streams are parsed by `createChatStreamParser()` (from `src/utils/chatEvents.ts`) which returns `{ kind: 'text' | 'system' | 'event' }` chunks; text streams straight into the active assistant bubble while events append to that message's `drafts`, `toolActivity`, and `memoryEvents` collections via `applyEventToMessage()`
- Exposes `handleForgetMemory()` which POSTs JSON to `${CHAT_ENDPOINT}/forget` (plain `{ok, deleted}` or `{ok:false, error}` response), clears the `deviceId`, wipes sessionStorage history, and resets to the welcome message
- `Message` interface now carries optional `drafts: DraftAction[]`, `toolActivity: { tool, status }[]`, and `memoryEvents: MemoryEventRecord[]` so messages can render inline tool feedback without extra plumbing

**Agentic UI:**
- `src/components/chat/ToolDraftCard.tsx` — dismissible gold-bordered card with five variants:
  - `navigate` → "Take me there" button invokes `useNavigate()` to the whitelisted path
  - `contact` → "Review & send" builds `/contact?subject=...&message=...&intent=...` via `URLSearchParams` so the form pre-fills
  - `newsletter` → links to `/contact#newsletter`
  - `citation` → links to `/blog/{slug}` with the excerpt preview
  - `blog_search_results` → stacked list of up to 5 matches with per-post "Read this post" buttons and one "Dismiss all"
- `ChatMessage.tsx` renders a pulsing hourglass + tool-friendly label while a tool is in flight (`toolActivity`), a compact "Saved" badge for each entry in `memoryEvents`, and a stack of `<ToolDraftCard>`s for any `drafts`
- Chat page header adds a "Forget me" button (delete_sweep icon) next to "Clear" that confirms, calls `handleForgetMemory()`, and reports success/failure via `window.alert`

**Response Guidelines** (enforced in system prompt):
- Plain text only - NO markdown (no bold, italics, headers, bullet lists)
- Conversational flowing paragraphs, not document-style
- Concise: 2-3 sentences for simple questions, 4-6 max for complex
- Synthesize information naturally, don't list every detail
- Topic boundaries: Alti answers questions about Christian Perez only; general concepts allowed in conversational context, standalone off-topic questions get a warm redirect
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
- `lambda/chat-stream/index.mjs`: Lambda handler — HMAC + input validation, `/forget` routing, KB retrieval, Strands agent streaming
- `lambda/chat-stream/agent.mjs`: Strands `BedrockModel` + `Agent` factory with guardrail + sliding window manager
- `lambda/chat-stream/tools/*.mjs`: Five Zod-typed Strands tools (navigate, draft message, draft newsletter, cite blog, remember fact)
- `lambda/chat-stream/events.mjs`: Framed-event writer (`\x00EVT\x00{json}\x00EVT\x00`)
- `lambda/chat-stream/memory.mjs`: DynamoDB helpers for `thechrisgrey-chat-memory`
- `lambda/chat-stream/iam-policy.json`: IAM policy for Bedrock + KB + memory table access
- `lambda/chat-stream/package.json`: Dependencies (`@strands-agents/sdk`, `@sanity/client`, `zod`, bedrock-runtime, bedrock-agent-runtime, dynamodb)

**Deployment:**
```bash
cd lambda/chat-stream
npm install
zip -r function.zip index.mjs agent.mjs events.mjs memory.mjs hmac.mjs validation.mjs prompts.mjs metrics.mjs kbRetrieve.mjs tools package.json node_modules
aws lambda update-function-code --function-name thechrisgrey-chat-stream --zip-file fileb://function.zip --region us-east-1
```

See `lambda/chat-stream/README.md` for the module layout and unit-test commands (`npm run test:lambda`).

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
- Publishes `KBSyncTriggered` / `KBSyncFailure` CloudWatch metrics for observability
- CloudWatch alarm `thechrisgrey-kb-sync-failure` fires if sync fails (SNS → `thechrisgrey-site-alerts`)
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

### thechrisgrey Blueprint (in development)

Public architecture-generator feature at `/blueprint`. User supplies a project spec; Claude Opus 4.7 returns an AWS architecture blueprint with a Mermaid diagram, IaC scaffold, IAM highlights, cost estimate, and 1–4 ready-to-use Claude Code artifacts (skill / slash command / subagent / MCP tool). V1 is waitlist-only — monetization (Pro tier, higher limits) ships in V2.

**Core Design Principles:**
- **Dual-transport, engine-first.** `lambda/blueprint/engine.mjs` exports `generateBlueprint(spec, { tier, sanityClient, bedrockClient, logger })` — a pure function that accepts a validated plain JS object and returns a plain JS object. An HTTP Function URL handler consumes it today; `lambda/mcp-server` will wrap it as a `generate_blueprint` tool tomorrow. No `req`, `res`, CORS, or streaming concerns leak into the engine. New code in this feature must preserve that seam.
- **Monetization gate at the handler layer.** The engine accepts `tier: 'free' | 'pro'` as an option but knows nothing about billing. The HTTP handler and (future) MCP tool wrapper resolve tier from auth/Cognito and pass it in. V1 always passes `'free'`.
- **Single-source schema.** `lambda/blueprint/schema.mjs` is the only place input/output shapes live. The build step exports JSON Schema to `src/utils/blueprintSchema.json` via `z.toJsonSchema()` for the frontend (React Hook Form + Zod resolver) and the future MCP tool's `inputSchema`.
- **Opus for generation, Haiku for validation.** Opus 4.7 (`us.anthropic.claude-opus-4-7` inference profile) generates the blueprint; Haiku 4.5 validates the result against `BlueprintOutputSchema` and flags missing/weak fields. Opus retries once on validation failure.
- **Golden-example grounding.** System prompt injects 2–3 relevant examples (selected from 8–10 curated Sanity docs by category match) to anchor output depth and style. Authored by Christian, stored as `architectureBlueprint` documents. 5-minute in-memory cache per Lambda container.
- **Mermaid diagrams.** Lazy-loaded `mermaid` chunk (~40KB gzip) renders `flowchart TD` / `graph LR` source from `output.diagram_mermaid`.

**File Layout:**

```
lambda/blueprint/                 # Public generation Lambda (HTTP + future MCP)
  index.mjs                       # Function URL handler: HMAC + rate-limit + CORS → engine
  engine.mjs                      # generateBlueprint(spec) — transport-agnostic core
  schema.mjs                      # Zod BlueprintInput/Output + GoldenExample schemas
  prompts.mjs                     # System prompt + golden-example selection/injection
  artifacts.mjs                   # Claude skill / slash / subagent / MCP tool emitters
  validation.mjs                  # Haiku 4.5 output validator
  bedrock.mjs                     # Bedrock client wrapper (Opus + Haiku)
  goldenExamples.mjs              # Sanity GROQ fetch + 10-min in-memory cache
  package.json, iam-policy.json
  __tests__/*.test.mjs            # node --test

lambda/blueprint-builder/         # Dedicated admin Lambda (NOT extending kb-builder)
  index.mjs                       # Cognito-auth'd CRUD for architectureBlueprint docs
  package.json, iam-policy.json

src/pages/Blueprint.tsx
src/pages/admin/BlueprintAdmin.tsx
src/components/blueprint/*.tsx    # Form, Result, ArtifactCard, ServiceList, MermaidDiagram, CostCard, Waitlist, LoadingSkeleton
src/hooks/useBlueprint.ts, useBlueprintAdmin.ts
src/utils/blueprintSigning.ts     # HMAC signer (mirrors chatSigning.ts)

docs/blueprint/golden-examples-template.md    # Fill-in template for 8–10 curated examples
docs/blueprint/system-prompt-principles.md    # Authored by Christian (opinionated architecture principles)
```

**Sanity Schema (`architectureBlueprint`):** Fields — `title` (string), `slug`, `category` (string enum: same 8 categories as `BlueprintInputSchema`), `spec` (object matching `BlueprintInputSchema`), `output` (object matching `BlueprintOutputSchema`), `notes` (text, optional), `isActive` (boolean), `sortOrder` (number). Deploy via Sanity MCP `deploy_schema` tool or Sanity Studio when the feature reaches implementation.

**Rate Limiting & Cost:**
- Primary quota: 1 blueprint / 30 days per `deviceHash`, shared `thechrisgrey-chat-ratelimit` table with `blueprint-{deviceHash}` prefix via `lambda-shared/checkRateLimit`. Tight because Opus 4.7 is expensive.
- Secondary soft quota (added only if abuse detected): 5 blueprints/day per IP, `blueprint-ip-{hash}` prefix.
- Pro tier (V2): higher limits, gated at the handler layer via Cognito bearer token.
- CloudWatch alarms (us-east-1): `thechrisgrey-blueprint-opus-cost` at $25/day on Opus spend, `thechrisgrey-blueprint-errors` at >20% error rate over 15 min, `thechrisgrey-blueprint-validation-failures` at >10% Haiku rejection. All → SNS `thechrisgrey-site-alerts`.

**Frontend Integration:**
- Home page scroll tab #8: "thechrisgrey Blueprint" / "Architect" — extends the 7-key-point sequence in `Home.tsx`.
- Summary section heights: mobile `675vh`, desktop `840vh` (after Foundation + Blueprint tabs). Per-point spacing stays at `50vh` mobile / `80vh` desktop.
- Navigation transparency threshold: `window.innerHeight * 10` in `Navigation.tsx` (bumped from `* 8` as the key-point sequence grew).
- Route `/blueprint` is lazy-loaded and feature-flagged via `VITE_BLUEPRINT_ENABLED`.
- Waitlist endpoint reuses the existing newsletter Lambda with `source: "blueprint"` tag.

**Environment Variables (add in Phase 1–2):**
- Lambda `blueprint`: `BLUEPRINT_SIGNING_KEY`, `BLUEPRINT_RATE_LIMIT_TABLE`, `SANITY_PROJECT_ID`, `SANITY_DATASET`, `SANITY_READ_TOKEN`, `BEDROCK_OPUS_MODEL_ID`, `BEDROCK_HAIKU_MODEL_ID`.
- Lambda `blueprint-builder`: `SANITY_WRITE_TOKEN`, `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID` (reuses pattern from `kb-builder`).
- Frontend: `VITE_BLUEPRINT_ENDPOINT`, `VITE_BLUEPRINT_SIGNING_KEY`, `VITE_BLUEPRINT_ENABLED`, `VITE_BLUEPRINT_BUILDER_ENDPOINT`.

**MCP Integration (deferred but pre-designed):** When ready, add `lambda/mcp-server/tools/generateBlueprint.mjs` that imports the pure engine and exposes it as an MCP tool. Its `inputSchema` is `BlueprintInputSchema` converted via `z.toJsonSchema()`. The MCP server's existing per-IP quota is the rate limit on that path — the engine does not own rate limiting.

### KB Admin (`/admin`)

Protected admin page for managing the AI chat's Knowledge Base content.

**Authentication:**
- AWS Cognito User Pool: `thechrisgrey-admin-pool` (us-east-1)
- Single admin user, no self-signup
- Tokens stored in sessionStorage (1-hour expiry)

**Data Flow:**
1. Admin creates/edits `kbEntry` documents via kb-builder Lambda → Sanity CMS
2. "Publish to KB" reads all active entries, assembles structured text document
3. Uploads `knowledge-base.txt` to `s3://thechrisgrey-kb-source/`
4. Existing kb-sync Lambda triggers Bedrock re-ingestion automatically

**KB Builder Lambda** (`lambda/kb-builder/`):
- Function: `thechrisgrey-kb-builder` (us-east-1)
- Endpoints: GET/POST/PUT/DELETE `/entries`, POST `/publish`
- Validates Cognito token on every request
- Holds Sanity write token (env: `SANITY_WRITE_TOKEN`)
- IAM Role: `thechrisgrey-kb-builder-role`

**Sanity Document Type:** `kbEntry`
- Fields: title, category, content (plain text), date, sortOrder, isActive
- Categories: biography, career, military, education, business, philosophy, podcast, book, skills, awards

**Deployment:**
```bash
cd lambda/kb-builder
npm install
zip -r function.zip index.mjs package.json node_modules
aws lambda update-function-code --function-name thechrisgrey-kb-builder --zip-file fileb://function.zip --region us-east-1
```

### Dynamic Sitemap & RSS Feed

**Sitemap** generated at build time via `scripts/generate-sitemap.js`:
- Fetches all blog posts from Sanity
- Combines static pages + dynamic blog post URLs
- Outputs to `dist/sitemap.xml`
- **Fail-fast:** Build aborts (`process.exit(1)`) if Sanity fetch fails or file write fails

**RSS Feed** generated at build time via `scripts/generate-rss.js`:
- Fetches all blog posts from Sanity
- Outputs to `dist/rss.xml`
- Auto-discovery link in `index.html` head
- Link in footer Quick Links section
- **Fail-fast:** Build aborts (`process.exit(1)`) if Sanity fetch fails, zero posts found, or file write fails

**Environment Validation** (`scripts/validate-env.js`):
- Runs as the first step in the build pipeline
- Checks required `VITE_*` env vars: `VITE_NEWSLETTER_ENDPOINT`, `VITE_CONTACT_ENDPOINT`, `VITE_CHAT_ENDPOINT`, `VITE_CHAT_SIGNING_KEY`
- Build fails immediately with clear message if any are missing

**Sanity Client Timeouts:**
- Frontend clients (`src/sanity/client.ts`): 10s timeout — prevents hanging page loads if Sanity is down
- Build scripts (`generate-sitemap.js`, `generate-rss.js`): 15s timeout — fails build fast if Sanity unreachable

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
- Shiki syntax highlighter for blog code blocks using JavaScript regex engine (no WASM)
- Singleton highlighter pattern in `src/utils/shikiHighlighter.ts` — created once, reused across all code blocks
- Only 15 language grammars bundled (typescript, javascript, python, bash, json, html, css, yaml, markdown, sql, go, rust, java, tsx, jsx) via individual `@shikijs/langs/*` imports
- Each language grammar is a lazy chunk loaded on demand — unsupported languages fall back to plain text
- Shows plain monochrome text immediately, swaps in highlighted HTML once Shiki loads
- `React.memo` optimized (code content is static per render)
- Uses `github-dark` theme, `not-prose` wrapper to prevent Tailwind Typography conflicts
- **Do NOT use bare `import('shiki')`** — this bundles ALL 306+ language grammars (~9MB). Always use the singleton from `shikiHighlighter.ts`

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
- `TypingIndicator` has `role="status"` and `aria-label` for screen reader announcements

**SEO & Indexing:**
- 404 page (`NotFound.tsx`) and BlogPost fetch-error state use `noindex={true}` to prevent search engine indexing
- Hero images across all pages use `fetchPriority="high"` for LCP optimization

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

**Plausible Analytics:**
- Privacy-friendly (no cookies, no personal data), runs alongside Cloudflare
- External script from `https://plausible.io/js/pa-bQzxzh5KzDB8jWsj-fPb8.js`
- Init code extracted to `public/plausible-init.js` to keep strict CSP (no `'unsafe-inline'` for scripts)
- `plausible.io` allowlisted in `script-src` and `connect-src` in `amplify.yml`

**Web Vitals** (`src/utils/webVitals.ts`):
- Captures CLS, INP, FCP, LCP, TTFB via `web-vitals` library
- Dev: logs to console; Prod: sends via `navigator.sendBeacon` to metrics Lambda
- Requires `VITE_METRICS_ENDPOINT` env var; silently no-ops if not set

**Metrics Lambda** (`lambda/metrics/`):
- Function: `thechrisgrey-metrics` (us-east-1)
- Function URL: `https://dnsio2ypcuxamxgzjpxr7knwpe0ybbuq.lambda-url.us-east-1.on.aws`
- IAM Role: `thechrisgrey-metrics-role`
- Endpoints:
  - POST `/vitals`: Receives Web Vitals data → CloudWatch custom metrics
  - POST `/csp-report`: Receives CSP violation reports → CloudWatch
  - GET `/health`: Returns 24h metric averages (requires Cognito Bearer token)
- CloudWatch Namespace: `TheChrisGrey/SiteMetrics`
- **Rate Limiting:** DynamoDB-based per-IP tracking (survives cold starts)
  - Table: `thechrisgrey-chat-ratelimit` (shared with chat, prefixed keys: `metrics-vitals-{hash}`, `metrics-csp-{hash}`)
  - Limits: 200 vitals/min, 100 CSP reports/min per IP

**CloudWatch Alarms** (us-east-1):
- `thechrisgrey-high-cls`: CLS average > 0.25 over 1 hour
- `thechrisgrey-kb-failures`: KB retrieval failures > 5/hour
- `thechrisgrey-rate-limit-surge`: Rate limit rejections > 50/hour
- `thechrisgrey-csp-violations`: CSP violations > 20/hour
- `thechrisgrey-kb-sync-failure`: KB sync job failed to start
- SNS Topic: `thechrisgrey-site-alerts` → chris@altivum.ai

**Site Health Dashboard** (`src/hooks/useSiteHealth.ts`):
- Admin-only panel on `/admin` page showing Core Web Vitals, Chat Pipeline metrics, and Security data
- Fetches from metrics Lambda GET `/health` endpoint using Cognito token
- Auto-refreshes every 5 minutes

### Shared Lambda Utilities (`lambda/shared/`)

Common infrastructure used by chat-stream, metrics, and kb-builder Lambdas:

- `checkRateLimit(docClient, UpdateCommand, opts)`: Atomic DynamoDB rate limiting
- `validateCognitoToken(cognitoClient, GetUserCommand, authHeader)`: Cognito token validation
- `respond(statusCode, body, corsOrigin?)`: JSON response builder with optional CORS

**Usage:** Each Lambda lists `"lambda-shared": "file:../shared"` in its package.json. The shared code is copied into `node_modules/` on `npm install` and included in deployment zips automatically.

**Design:** AWS SDK clients are injected as parameters (not imported by the shared module) to avoid version conflicts and keep the module dependency-free.

**Deployment Note:** Always run `npm install` before zipping a Lambda for deployment to ensure the shared module is included:
```bash
cd lambda/<function-name>
npm install
zip -r function.zip index.mjs package.json node_modules
aws lambda update-function-code --function-name thechrisgrey-<function-name> --zip-file fileb://function.zip --region us-east-1
```

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
- `scripts/validate-env.js`: Build-time environment variable validation
- `src/pages/Home.tsx`: Complex scroll animations and sticky sections
- `src/pages/Chat.tsx`: Full-viewport AI chat experience
- `src/hooks/useChatEngine.ts`: Shared chat state/streaming hook used by both Chat page and widget
- `src/components/chat/`: Chat UI components (ChatMessage, ChatInput, ChatSuggestions, TypingIndicator, ChatWidget, ChatWidgetButton, AltiMascot, ChatWidgetPanel, ToolDraftCard)
- `src/components/chat/ToolDraftCard.tsx`: Dismissible gold-bordered card for agentic drafts (navigate / contact / newsletter / citation)
- `src/utils/chatEvents.ts`: Streaming event protocol parser (`createChatStreamParser`) + TypeScript types for all agent events
- `src/utils/deviceId.ts`: localStorage-backed UUID used to scope visitor memory across sessions
- `src/sanity/`: Sanity CMS client, queries, types for blog
- `lambda/shared/`: Shared utilities (rate limiting, auth, response) used by all Lambda functions
- `lambda/chat-stream/`: Strands Agent Lambda for AI chat (streaming + tools + memory)
- `lambda/chat-stream/agent.mjs`, `events.mjs`, `memory.mjs`, `tools/`: New agentic modules (see Alti section above)
- `lambda/kb-sync/`: Lambda triggered by S3 to auto-sync Knowledge Base
- `lambda/kb-builder/`: KB admin Lambda (Sanity CRUD + S3 document assembly + input validation)
- `lambda/metrics/`: Metrics Lambda (Web Vitals, CSP reports, health dashboard)
- `src/pages/Admin.tsx`: KB admin page (login + entry CRUD + publish)
- `src/hooks/useAuth.ts`: Cognito authentication hook
- `src/hooks/useKbAdmin.ts`: KB entry CRUD and publish hook
- `src/hooks/useSiteHealth.ts`: Metrics dashboard hook for admin page
- `src/utils/routeManifest.ts`: Route-to-import mapping for chunk prefetching
- `src/components/PrefetchLink.tsx`: Link wrapper that prefetches route chunks on hover/focus
- `src/components/BlogPostArticleSkeleton.tsx`: Layout-matching loading skeleton for blog posts
- `src/sanity/postCache.ts`: Per-slug blog post in-memory cache (10-min TTL)
- `docs/bedrock-logging-queries.md`: CloudWatch Logs Insights queries for chat analytics
- `scripts/generate-sitemap.js`: Build-time sitemap generator
- `scripts/generate-rss.js`: Build-time RSS feed generator
- `scripts/generate-podcast-episodes.js`: Fetches episodes from YouTube at build time
- `src/data/podcastEpisodes.ts`: Podcast episode data (uses generated YouTube data or fallback)
- `src/data/generatedEpisodes.json`: Auto-generated YouTube episode data
- `src/components/YouTubeFacade.tsx`: Click-to-play YouTube facade (thumbnail + play button → iframe on click)
- `src/components/HighlightedCodeBlock.tsx`: Shiki-powered syntax highlighting for blog code blocks
- `src/utils/shikiHighlighter.ts`: Singleton Shiki highlighter with explicit language imports (15 langs, JS regex engine)
- `src/components/ReadingProgressBar.tsx`: Scroll progress indicator for blog posts
- `src/pages/AWS.tsx`: AWS Community Builder page (AI Engineering track, focus areas, program details)
- `src/pages/Claude.tsx`: Claude / Applied AI Engineer page (focus areas, how I work, Anthropic Academy certifications)
- `src/pages/NotFound.tsx`: Custom 404 page
- `public/.well-known/security.txt`: Security vulnerability reporting contact
- `public/press-kit/`: Press materials for event organizers (headshots, bios, logos)
- `public/press-kit.zip`: Downloadable press kit (linked from Contact page)
- `amplify.yml`: AWS Amplify build configuration
- `index.html`: Material Icons CDN, Cloudflare Analytics, Plausible Analytics, favicon, RSS auto-discovery
- `public/plausible-init.js`: Plausible init snippet (separate file to keep strict CSP)

## Environment Variables

Required (set in AWS Amplify console):
- `VITE_CONTACT_ENDPOINT`: AWS Lambda URL for contact form submissions
- `VITE_NEWSLETTER_ENDPOINT`: AWS Lambda URL for newsletter subscriptions
- `VITE_CHAT_ENDPOINT`: AWS Lambda Function URL for AI chat streaming
- `YOUTUBE_API_KEY`: YouTube Data API v3 key for podcast episode fetching (build-time only, not VITE_ prefixed)
- `VITE_COGNITO_USER_POOL_ID`: Cognito User Pool ID for admin auth
- `VITE_COGNITO_CLIENT_ID`: Cognito App Client ID for admin auth
- `VITE_KB_BUILDER_ENDPOINT`: Lambda Function URL for KB admin operations
- `VITE_METRICS_ENDPOINT`: Lambda Function URL for Web Vitals and metrics collection

Required on the chat-stream Lambda (set via `aws lambda update-function-configuration`):
- `CHAT_SIGNING_KEY`: HMAC-SHA256 shared secret (must match `VITE_CHAT_SIGNING_KEY`)
- `CHAT_RATE_LIMIT_TABLE`: DynamoDB table for per-IP rate limits (`thechrisgrey-chat-ratelimit`)
- `CHAT_MEMORY_TABLE`: DynamoDB table for per-device visitor facts (`thechrisgrey-chat-memory`, partition key `deviceId`, TTL field `ttl`)
- `KB_ID`, `KB_DATA_SOURCE_ID`: Bedrock Knowledge Base identifiers
- `GUARDRAIL_ID`, `GUARDRAIL_VERSION`: Bedrock Guardrail identifiers
- `SANITY_PROJECT_ID`, `SANITY_DATASET`: Optional — enables the `cite_blog_passage` tool when present

**Important:** Local `.env.local` variables are NOT automatically synced to production. Any new `VITE_*` variable added locally must also be added to Amplify via:
- AWS Console: Amplify > App > Environment variables
- CLI: `aws amplify update-branch --app-id d3du8eg39a9peo --branch-name main --environment-variables "VITE_NEW_VAR=value" --region us-east-2`

After adding/changing env vars, trigger a rebuild for changes to take effect.

## 3D Mascot (Alti)

The chat widget FAB is a 3D model rendered via React Three Fiber.

**Dependencies:** `three`, `@react-three/fiber`, `@react-three/drei`
- `three` is isolated in a `three-vendor` manual chunk in `vite.config.ts`
- R3F and drei are left to Rollup's natural code splitting

**Model Compression:**
- Original: `alti.glb` (13MB, project root — not committed)
- Compressed: `public/alti.glb` (1.15MB, meshopt geometry + WebP textures)
- Compressed via: `npx @gltf-transform/cli optimize alti.glb public/alti.glb --compress meshopt --texture-compress webp`
- No CSP changes needed — meshopt has no Web Worker or CDN dependencies (unlike Draco)

**Testing:** Three.js Canvas requires WebGL which jsdom doesn't provide. All tests that render components containing `AltiMascot` must mock it:
```tsx
vi.mock('./AltiMascot', () => ({
  default: ({ isOpen }: { isOpen: boolean }) => (
    <div data-testid="alti-mascot" data-is-open={isOpen} />
  ),
}));
```

**React 19 + react-helmet-async:** The SEO integration test uses an explicit `cleanup()` wrapped in try-catch because React 19's stricter unmount can race with Helmet's direct DOM manipulation in jsdom. This is a test-only issue — browsers are unaffected.

## Deployment Notes

- **Node version pinned** to 20 via `.nvmrc`
- **Never commit** `node_modules/` or `dist/` (in `.gitignore`)
- Assets in `public/` are copied to dist root (e.g., `public/tcg.png` → `/tcg.png`)
- Vite bundles `src/assets/` imports with cache-busting hashes
- Build must succeed (`npm run build`) before deploying
- Site is hosted at `https://thechrisgrey.com`
