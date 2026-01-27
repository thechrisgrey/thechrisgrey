# thechrisgrey.com

Personal website for **Christian Perez** (@thechrisgrey) — Founder & CEO of Altivum Inc., former Green Beret (18D Special Forces Medical Sergeant), Bronze Star Recipient, host of The Vector Podcast, and author of "Beyond the Assessment."

**Live Site:** [https://thechrisgrey.com](https://thechrisgrey.com)

---

## Table of Contents

- [Technology Stack](#technology-stack)
- [Features](#features)
- [Architecture](#architecture)
- [AWS Infrastructure](#aws-infrastructure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)
- [Project Structure](#project-structure)
- [Key Integrations](#key-integrations)
- [Design System](#design-system)
- [Build Scripts](#build-scripts)
- [License](#license)

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, TypeScript, Vite |
| **Styling** | Tailwind CSS (custom design system) |
| **Routing** | React Router v6 |
| **CMS** | Sanity.io (blog content) |
| **AI Chat** | Amazon Bedrock (Claude Haiku 4.5) + RAG |
| **Hosting** | AWS Amplify |
| **CDN/Analytics** | Cloudflare Web Analytics |
| **Typography** | SF Pro Display (system font stack) |

---

## Features

### Pages
- **Home** — Sophisticated scroll-based animations with sticky profile sections
- **About** — Personal biography and military background
- **Altivum Inc** — Company showcase and services
- **The Vector Podcast** — YouTube video embeds, Spotify player, collapsible episode list
- **Beyond the Assessment** — Book information and purchase links
- **Blog** — Sanity CMS-powered with categories, tags, series, and reading progress
- **AI Chat** — Full-viewport conversational AI with RAG-enhanced responses
- **Links** — Linktree-style quick links page
- **Contact** — Contact form, speaking topics, downloadable press kit

### Technical Features
- **SEO Optimized** — JSON-LD structured data, Open Graph, dynamic sitemap, RSS feed
- **AI Chat with RAG** — Amazon Bedrock Knowledge Base retrieval for contextual responses
- **Podcast Auto-Sync** — YouTube Data API integration fetches episodes at build time
- **Chat Persistence** — Conversation history saved to sessionStorage
- **Error Boundaries** — Page-level error handling with custom fallback UIs
- **Accessibility** — Focus trapping, keyboard navigation, ARIA labels, skip links
- **Performance** — Image optimization, lazy loading, code splitting

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │   Home   │ │  Podcast │ │   Blog   │ │   Chat   │   ...     │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
└─────────────────────────────────────────────────────────────────┘
        │               │              │              │
        │               │              │              │
        ▼               ▼              ▼              ▼
┌───────────┐   ┌───────────┐   ┌───────────┐   ┌───────────────┐
│  Amplify  │   │  YouTube  │   │  Sanity   │   │    Bedrock    │
│  Hosting  │   │  Data API │   │    CMS    │   │  + RAG (KB)   │
└───────────┘   └───────────┘   └───────────┘   └───────────────┘
                (build-time)     (runtime)       (Lambda stream)
```

### Request Flow — AI Chat
```
User Message
    │
    ▼
Lambda Function URL (streaming)
    │
    ├──► Bedrock Knowledge Base (retrieve context)
    │         │
    │         ▼
    │    S3 Vectors (autobiography chunks)
    │
    ├──► Bedrock Guardrails (content filtering)
    │
    └──► Bedrock ConverseStream API (Claude Haiku 4.5)
              │
              ▼
         Streaming Response → Client
```

---

## AWS Infrastructure

| Service | Resource | Region | Purpose |
|---------|----------|--------|---------|
| **Amplify** | `dv3g3860t7qiz` | us-east-2 | Hosting, CI/CD |
| **Lambda** | `thechrisgrey-chat-stream` | us-east-1 | AI chat streaming |
| **Lambda** | `thechrisgrey-contact-email` | us-east-2 | Contact form |
| **Lambda** | `thechrisgrey-newsletter-subscription` | us-east-2 | Newsletter |
| **Lambda** | `thechrisgrey-kb-sync` | us-east-1 | KB auto-sync on S3 changes |
| **Bedrock KB** | `ARFYABW8HP` | us-east-1 | RAG knowledge base |
| **S3** | `thechrisgrey-kb-source` | us-east-1 | KB source documents |
| **S3** | `thechrisgrey-vectors` | us-east-1 | Vector embeddings |
| **DynamoDB** | `thechrisgrey-chat-ratelimit` | us-east-1 | Rate limiting (20 req/hr/IP) |
| **Secrets Manager** | `thechrisgrey/youtube-api-key` | us-east-1 | YouTube API key |
| **CloudWatch** | `tcg-AI-chat` | us-east-1 | Bedrock invocation logs |

---

## Getting Started

### Prerequisites

- Node.js 18.x or 20.x
- npm
- AWS CLI (configured for deployment)

### Installation

```bash
git clone https://github.com/Christian-Perez-Personal/thechrisgrey.git
cd thechrisgrey
npm install
```

### Development Server

```bash
npm run dev
```

Opens at [http://localhost:5173](http://localhost:5173)

### Production Build

```bash
npm run build
```

Build includes:
1. Podcast episode fetch from YouTube API
2. TypeScript compilation
3. Vite production build
4. Sitemap generation (Sanity blog posts)
5. RSS feed generation

### Preview Build

```bash
npm run preview
```

### Linting

```bash
npm run lint
```

---

## Environment Variables

Set in AWS Amplify console (Environment variables):

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_CHAT_ENDPOINT` | Lambda Function URL for AI chat | Yes |
| `VITE_CONTACT_ENDPOINT` | Lambda Function URL for contact form | Yes |
| `VITE_NEWSLETTER_ENDPOINT` | Lambda Function URL for newsletter | Yes |
| `YOUTUBE_API_KEY` | YouTube Data API v3 key (build-time) | Yes |

**Note:** `VITE_` prefixed variables are bundled into the frontend. `YOUTUBE_API_KEY` is only used at build time.

### Adding/Updating Environment Variables

```bash
aws amplify update-branch \
  --app-id dv3g3860t7qiz \
  --branch-name main \
  --environment-variables "KEY1=value1,KEY2=value2" \
  --region us-east-2
```

**Important:** This replaces all variables. Include existing ones when adding new ones.

---

## Deployment

### Automatic (Recommended)

Push to `main` branch triggers automatic Amplify deployment.

```bash
git push origin main
```

### Manual Rebuild

```bash
aws amplify start-job \
  --app-id dv3g3860t7qiz \
  --branch-name main \
  --job-type RELEASE \
  --region us-east-2
```

### Lambda Deployment (Chat)

```bash
cd lambda/chat-stream
npm install
zip -r function.zip index.mjs package.json node_modules
aws lambda update-function-code \
  --function-name thechrisgrey-chat-stream \
  --zip-file fileb://function.zip \
  --region us-east-1
```

---

## Project Structure

```
thechrisgrey/
├── public/                     # Static assets (served as-is)
│   ├── profile1.jpeg           # Hero profile image (full quality)
│   ├── og.png                  # Open Graph image
│   ├── press-kit/              # Downloadable press materials
│   ├── press-kit.zip           # Press kit archive
│   └── .well-known/            # security.txt
│
├── src/
│   ├── assets/                 # Optimized images (Vite processed)
│   │
│   ├── components/
│   │   ├── chat/               # AI chat components
│   │   │   ├── ChatMessage.tsx
│   │   │   ├── ChatInput.tsx
│   │   │   ├── ChatSuggestions.tsx
│   │   │   └── TypingIndicator.tsx
│   │   ├── ErrorBoundary.tsx   # Global + page-level error handling
│   │   ├── ErrorFallbacks.tsx  # Custom fallback UIs
│   │   ├── EpisodeCard.tsx     # Podcast episode (featured/standard/compact)
│   │   ├── Navigation.tsx      # Responsive nav with dropdowns
│   │   ├── Footer.tsx
│   │   ├── SEO.tsx             # Meta tags + JSON-LD structured data
│   │   └── ReadingProgressBar.tsx
│   │
│   ├── pages/
│   │   ├── Home.tsx            # Scroll animations, sticky sections
│   │   ├── About.tsx
│   │   ├── Altivum.tsx
│   │   ├── Podcast.tsx         # YouTube embed, Spotify, episode list
│   │   ├── BeyondTheAssessment.tsx
│   │   ├── Blog.tsx            # Sanity CMS list with filters
│   │   ├── BlogPost.tsx        # Single post with Portable Text
│   │   ├── Chat.tsx            # AI chat with persistence
│   │   ├── Links.tsx
│   │   ├── Contact.tsx
│   │   ├── Privacy.tsx
│   │   └── NotFound.tsx        # Custom 404
│   │
│   ├── hooks/
│   │   ├── useFormSubmit.ts    # Form submission with loading states
│   │   ├── useFocusTrap.ts     # Modal focus management
│   │   ├── useSessionStorage.ts # Typed sessionStorage with Date revival
│   │   └── index.ts
│   │
│   ├── data/
│   │   ├── podcastEpisodes.ts  # Episode data (uses generated or fallback)
│   │   └── generatedEpisodes.json  # Auto-generated from YouTube API
│   │
│   ├── sanity/
│   │   ├── client.ts           # Sanity client config
│   │   ├── queries.ts          # GROQ queries
│   │   ├── types.ts            # TypeScript interfaces
│   │   └── PortableTextComponents.tsx
│   │
│   ├── utils/
│   │   ├── typography.ts       # Centralized typography system
│   │   ├── schemas.ts          # JSON-LD schema builders
│   │   ├── validators.ts       # Email validation, etc.
│   │   └── dateFormatter.ts
│   │
│   ├── constants/
│   │   └── links.ts            # Social media URLs
│   │
│   ├── types/
│   │   └── podcast.ts          # Podcast interfaces
│   │
│   ├── App.tsx                 # Routes, layout, error boundaries
│   ├── main.tsx                # Entry point
│   └── index.css               # Tailwind directives, focus styles
│
├── lambda/
│   ├── chat-stream/            # Bedrock streaming Lambda
│   │   ├── index.mjs
│   │   ├── package.json
│   │   └── iam-policy.json
│   └── kb-sync/                # Knowledge Base auto-sync Lambda
│       └── index.mjs
│
├── scripts/
│   ├── generate-sitemap.js     # Build-time sitemap from Sanity
│   ├── generate-rss.js         # Build-time RSS feed
│   └── generate-podcast-episodes.js  # Fetch from YouTube API
│
├── docs/
│   ├── bedrock-logging-queries.md  # CloudWatch Insights queries
│   └── ideas-to-consider.md
│
├── amplify.yml                 # Amplify build config
├── tailwind.config.js          # Custom colors, fonts, animations
├── vite.config.ts              # Vite + image optimization
├── tsconfig.json
├── CLAUDE.md                   # AI assistant context
└── README.md
```

---

## Key Integrations

### Sanity CMS (Blog)

- **Project ID:** `k5950b3w`
- **Dataset:** `production`
- **Content:** Blog posts with categories, tags, series, Portable Text

```typescript
import { client, POSTS_QUERY } from './sanity';
const posts = await client.fetch(POSTS_QUERY);
```

### YouTube Data API (Podcast)

Episodes fetched at build time from `@AltivumPress` channel.

**Setup:**
1. Enable YouTube Data API v3 in Google Cloud Console
2. Create API key (Public data, restricted to YouTube API)
3. Add `YOUTUBE_API_KEY` to Amplify environment variables

**How it works:**
1. `generate-podcast-episodes.js` runs at build start
2. Fetches channel → uploads playlist → video details
3. Generates `src/data/generatedEpisodes.json`
4. Falls back to static data if API unavailable

### Amazon Bedrock (AI Chat)

- **Model:** Claude Haiku 4.5 (`us.anthropic.claude-haiku-4-5-20251001-v1:0`)
- **Knowledge Base:** `ARFYABW8HP` (autobiography chunks)
- **Guardrail:** `5kofhp46ssob` (content filtering)
- **Rate Limit:** 20 requests/hour per IP

**Features:**
- Streaming responses via Lambda Function URL
- RAG retrieval (5 chunks) before each response
- Conversation history in sessionStorage
- Plain text responses (no markdown)

### Cloudflare Web Analytics

Privacy-friendly analytics (no cookies, no personal data).

---

## Design System

### Color Palette

| Name | Hex | Usage |
|------|-----|-------|
| `altivum-dark` | `#0A0F1C` | Backgrounds |
| `altivum-navy` | `#1A2332` | Cards, nav |
| `altivum-blue` | `#2E4A6B` | Accents |
| `altivum-slate` | `#4A5A73` | Borders, muted |
| `altivum-silver` | `#9BA6B8` | Body text |
| `altivum-gold` | `#C5A572` | Highlights, CTAs |

### Typography

SF Pro Display with system font fallbacks. Ultra-light weight (200) throughout.

```typescript
import { typography } from './utils/typography';

<h1 style={typography.heroHeader}>Title</h1>
<p style={typography.bodyText}>Content</p>
```

**Styles:** `heroHeader`, `sectionHeader`, `cardTitleLarge`, `cardTitleSmall`, `subtitle`, `bodyText`, `smallText`

### Custom Animations

- `animate-fade-in` — Hero entrance (1.2s)
- `animate-nav-fade-in` — Nav delayed entrance (0.8s, 2s delay)
- `shimmer` — Background shimmer effect

---

## Build Scripts

| Script | Purpose |
|--------|---------|
| `generate-podcast-episodes.js` | Fetch YouTube videos → `generatedEpisodes.json` |
| `generate-sitemap.js` | Fetch Sanity posts → `dist/sitemap.xml` |
| `generate-rss.js` | Fetch Sanity posts → `dist/rss.xml` |

**Build order:**
```bash
podcast-episodes → tsc → vite build → sitemap → rss
```

---

## License

Copyright © 2026 Christian Perez. All rights reserved.

For inquiries, use the [contact form](https://thechrisgrey.com/contact) or email via the website.
