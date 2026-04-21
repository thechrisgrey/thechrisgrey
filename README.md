# thechrisgrey.com

[![TypeScript](https://img.shields.io/badge/TypeScript-5.2-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![AWS Amplify](https://img.shields.io/badge/AWS_Amplify-Hosted-FF9900?logo=awsamplify&logoColor=white)](https://aws.amazon.com/amplify/)
[![Amazon Bedrock](https://img.shields.io/badge/Amazon_Bedrock-Claude_Haiku_4.5-232F3E?logo=amazonaws&logoColor=white)](https://aws.amazon.com/bedrock/)
[![CI](https://img.shields.io/github/actions/workflow/status/thechrisgrey/thechrisgrey/ci.yml?branch=main&label=CI&logo=github)](https://github.com/thechrisgrey/thechrisgrey/actions)
[![License](https://img.shields.io/badge/License-All_Rights_Reserved-lightgrey)](#license)

Personal website for **Christian Perez** ([@thechrisgrey](https://thechrisgrey.com)) | Founder & CEO of Altivum Inc. | Former Green Beret (18D Special Forces Medical Sergeant) | Bronze Star Recipient | Host of The Vector Podcast | Author of "Beyond the Assessment"

**[https://thechrisgrey.com](https://thechrisgrey.com)**

---

## Table of Contents

- [Technology Stack](#technology-stack)
- [Features](#features)
- [Architecture](#architecture)
- [AWS Infrastructure](#aws-infrastructure)
- [Getting Started](#getting-started)
- [Testing](#testing)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)
- [Project Structure](#project-structure)
- [Key Integrations](#key-integrations)
- [Design System](#design-system)
- [License](#license)

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, TypeScript 5, Vite 5 |
| **Styling** | Tailwind CSS 3.4 (custom design system) |
| **Routing** | React Router v6 |
| **CMS** | Sanity.io (blog content) |
| **AI Chat** | Amazon Bedrock (Claude Haiku 4.5) + RAG |
| **Auth** | Amazon Cognito (admin panel) |
| **Hosting** | AWS Amplify |
| **CDN/Analytics** | Cloudflare Web Analytics |
| **Testing** | Vitest + React Testing Library + Cypress |
| **Code Quality** | ESLint, strict TypeScript |

---

## Features

### Pages

- **Home** : Scroll-based animations with sticky profile sections
- **About** : Personal biography and military background
- **Altivum Inc** : Company showcase and services
- **The Vector Podcast** : YouTube embeds, Spotify player, collapsible episode list
- **Beyond the Assessment** : Book information and purchase links
- **Blog** : Sanity CMS-powered with categories, tags, series, and reading progress
- **AI Chat** : Full-viewport conversational AI with RAG-enhanced responses
- **Claude** : AWS certifications and Claude expertise showcase
- **AWS** : AWS partnership and community builder profile
- **Admin** : Cognito-authenticated KB management and site health dashboard
- **Links** : Linktree-style quick links
- **Contact** : Contact form, speaking topics, downloadable press kit

### Technical Highlights

- **SEO** : JSON-LD structured data, Open Graph, dynamic sitemap, RSS feed
- **AI Chat with RAG** : Bedrock Knowledge Base retrieval with streaming responses
- **Podcast Auto-Sync** : YouTube Data API fetches episodes at build time
- **Chat Widget** : Floating chat widget available across all pages
- **Metrics Dashboard** : CloudWatch and DynamoDB-backed operational metrics
- **Error Boundaries** : Page-level error handling with custom fallback UIs
- **Accessibility** : Focus trapping, keyboard navigation, ARIA labels, skip links
- **Performance** : Image optimization (Sharp/SVGO), lazy loading, code splitting, manual chunking

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
        ▼               ▼              ▼              ▼
┌───────────┐   ┌───────────┐   ┌───────────┐   ┌───────────────┐
│  Amplify  │   │  YouTube  │   │  Sanity   │   │    Bedrock    │
│  Hosting  │   │  Data API │   │    CMS    │   │  + RAG (KB)   │
└───────────┘   └───────────┘   └───────────┘   └───────────────┘
                (build-time)     (runtime)       (Lambda stream)
```

### AI Chat Request Flow

```
User Message
    │
    ▼
Lambda Function URL (streaming)
    │
    ├──> Bedrock Knowledge Base (retrieve context)
    │         │
    │         ▼
    │    S3 Vectors (autobiography chunks)
    │
    ├──> Bedrock Guardrails (content filtering)
    │
    └──> Bedrock ConverseStream API (Claude Haiku 4.5)
              │
              ▼
         Streaming Response -> Client
```

---

## AWS Infrastructure

| Service | Resource | Region | Purpose |
|---------|----------|--------|---------|
| **Amplify** | `d3du8eg39a9peo` | us-east-2 | Hosting, CI/CD |
| **Lambda** | `thechrisgrey-chat-stream` | us-east-1 | AI chat streaming |
| **Lambda** | `thechrisgrey-contact-email` | us-east-2 | Contact form |
| **Lambda** | `thechrisgrey-newsletter-subscription` | us-east-2 | Newsletter |
| **Lambda** | `thechrisgrey-kb-sync` | us-east-1 | KB auto-sync on S3 changes |
| **Lambda** | `thechrisgrey-kb-builder` | us-east-1 | KB admin CRUD operations |
| **Lambda** | `thechrisgrey-metrics` | us-east-1 | Metrics collection and reporting |
| **Bedrock KB** | `ARFYABW8HP` | us-east-1 | RAG knowledge base |
| **Cognito** | User Pool | us-east-1 | Admin authentication |
| **S3** | `thechrisgrey-kb-source` | us-east-1 | KB source documents |
| **S3** | `thechrisgrey-vectors` | us-east-1 | Vector embeddings |
| **DynamoDB** | `thechrisgrey-chat-ratelimit` | us-east-1 | Rate limiting (20 req/hr/IP) |
| **Secrets Manager** | `thechrisgrey/youtube-api-key` | us-east-1 | YouTube API key |
| **CloudWatch** | `tcg-AI-chat` | us-east-1 | Bedrock invocation logs |

---

## Getting Started

### Prerequisites

- Node.js 18.x or 20.x (see `.nvmrc`)
- npm
- AWS CLI (for deployment)

### Installation

```bash
git clone https://github.com/thechrisgrey/thechrisgrey.git
cd thechrisgrey
npm install
```

### Development

```bash
npm run dev             # Start dev server at http://localhost:5173
npm run build           # Full production build
npm run preview         # Preview production build
npm run lint            # Run ESLint
```

### Build Pipeline

The production build runs these steps in sequence:

```
validate-env -> podcast-episodes -> lint -> tsc -> vite build -> sitemap -> rss
```

---

## Testing

| Framework | Scope | Command |
|-----------|-------|---------|
| **Vitest** | Unit + Integration | `npm test` |
| **Vitest** | Watch mode | `npm run test:watch` |
| **Vitest** | Coverage report | `npm run test:coverage` |
| **Cypress** | E2E (headless) | `npm run cy:run` |
| **Cypress** | E2E (interactive) | `npm run cy:open` |

The test suite includes unit tests for components, hooks, and utilities; integration tests for page-level behavior; and end-to-end tests covering navigation, chat, blog, and contact flows.

---

## Environment Variables

Set in AWS Amplify console or in a local `.env` file:

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_CHAT_ENDPOINT` | Lambda Function URL for AI chat | Yes |
| `VITE_CONTACT_ENDPOINT` | Lambda Function URL for contact form | Yes |
| `VITE_NEWSLETTER_ENDPOINT` | Lambda Function URL for newsletter | Yes |
| `VITE_COGNITO_USER_POOL_ID` | Cognito User Pool ID (admin auth) | Yes |
| `VITE_COGNITO_CLIENT_ID` | Cognito App Client ID | Yes |
| `VITE_KB_BUILDER_ENDPOINT` | Lambda Function URL for KB admin | Yes |
| `VITE_CHAT_SIGNING_KEY` | HMAC signing key for chat requests | Yes |
| `VITE_METRICS_ENDPOINT` | Lambda Function URL for metrics | Yes |
| `YOUTUBE_API_KEY` | YouTube Data API v3 key (build-time only) | Yes |

`VITE_` prefixed variables are bundled into the frontend. `YOUTUBE_API_KEY` is only used during the build step.

---

## Deployment

### Automatic (Recommended)

Push to `main` triggers automatic Amplify deployment:

```bash
git push origin main
```

### Manual Rebuild

```bash
aws amplify start-job \
  --app-id d3du8eg39a9peo \
  --branch-name main \
  --job-type RELEASE \
  --region us-east-2
```

### Lambda Deployment

Each Lambda function is deployed independently:

```bash
cd lambda/chat-stream
npm install
zip -r function.zip index.mjs package.json node_modules
aws lambda update-function-code \
  --function-name thechrisgrey-chat-stream \
  --zip-file fileb://function.zip \
  --region us-east-1
```

Repeat for `kb-sync`, `kb-builder`, and `metrics` (adjust function name and region as needed).

---

## Project Structure

```
thechrisgrey/
├── public/                          # Static assets (served as-is)
│   ├── assets/documents/            # Downloadable PDFs
│   ├── press-kit/                   # Press materials + archive
│   ├── .well-known/security.txt
│   ├── robots.txt
│   ├── _redirects
│   ├── og.png                       # Open Graph image
│   └── favicon.png
│
├── src/
│   ├── components/
│   │   ├── admin/                   # Admin panel (login, KB entries, site health)
│   │   ├── chat/                    # AI chat (message, input, suggestions, widget)
│   │   ├── ui/                      # Base UI (Button, FormInput, IconButton)
│   │   ├── Navigation.tsx
│   │   ├── Footer.tsx
│   │   ├── SEO.tsx                  # Meta tags + JSON-LD
│   │   ├── ErrorBoundary.tsx
│   │   ├── ErrorFallbacks.tsx
│   │   ├── EpisodeCard.tsx
│   │   ├── NewsletterForm.tsx
│   │   ├── ReadingProgressBar.tsx
│   │   └── ...
│   │
│   ├── pages/                       # Route-level page components
│   │   ├── Home.tsx, About.tsx, Altivum.tsx, Podcast.tsx
│   │   ├── BeyondTheAssessment.tsx, Blog.tsx, BlogPost.tsx
│   │   ├── Chat.tsx, Claude.tsx, AWS.tsx, Admin.tsx
│   │   ├── Contact.tsx, Links.tsx, Privacy.tsx
│   │   └── NotFound.tsx
│   │
│   ├── hooks/                       # Custom React hooks
│   │   ├── useAuth.ts               # Cognito authentication
│   │   ├── useChatEngine.ts         # Chat state and streaming
│   │   ├── useFocusTrap.ts          # Modal focus management
│   │   ├── useKbAdmin.ts            # KB admin operations
│   │   ├── usePageContext.ts        # Page-level context for chat
│   │   ├── useSessionStorage.ts     # Typed sessionStorage with Date revival
│   │   └── useSiteHealth.ts         # Site health monitoring
│   │
│   ├── sanity/                      # Sanity CMS client, queries, types, cache
│   ├── utils/                       # Typography, schemas, validators, web vitals
│   ├── constants/                   # Social links
│   ├── types/                       # TypeScript interfaces
│   ├── data/                        # Podcast episode data (generated + fallback)
│   ├── assets/                      # Optimized images (Vite processed)
│   │
│   ├── __tests__/
│   │   ├── integration/             # Page-level integration tests
│   │   └── setup.ts
│   │
│   ├── App.tsx                      # Routes, layout, error boundaries
│   ├── main.tsx                     # Entry point
│   └── index.css                    # Tailwind directives
│
├── lambda/
│   ├── shared/                      # Shared utilities (auth, rate limiting, response)
│   ├── chat-stream/                 # Bedrock streaming Lambda
│   ├── kb-sync/                     # Knowledge Base auto-sync
│   ├── kb-builder/                  # KB admin CRUD
│   └── metrics/                     # Metrics collection
│
├── scripts/
│   ├── validate-env.js              # Build-time env validation
│   ├── generate-podcast-episodes.js # YouTube API fetch
│   ├── generate-sitemap.js          # Sitemap from Sanity
│   └── generate-rss.js             # RSS feed from Sanity
│
├── cypress/                         # E2E tests
│   ├── e2e/                         # Test specs
│   ├── fixtures/                    # Test data
│   └── support/                     # Custom commands
│
├── docs/                            # Internal documentation and plans
├── .github/workflows/ci.yml        # GitHub Actions CI
├── amplify.yml                      # Amplify build config
├── tailwind.config.js
├── vite.config.ts
├── vitest.config.ts
├── cypress.config.ts
└── tsconfig.json
```

---

## Key Integrations

### Sanity CMS (Blog)

- **Project ID:** `k5950b3w` | **Dataset:** `production`
- Content includes blog posts with categories, tags, series, and Portable Text rich content
- Client-side caching via `postCache.ts` with Date revival

### YouTube Data API (Podcast)

Episodes are fetched at build time from the `@AltivumPress` channel.

1. `generate-podcast-episodes.js` runs during the build step
2. Fetches channel, uploads playlist, and video details
3. Generates `src/data/generatedEpisodes.json`
4. Falls back to static data if the API is unavailable

### Amazon Bedrock (AI Chat)

- **Model:** Claude Haiku 4.5 (`us.anthropic.claude-haiku-4-5-20251001-v1:0`)
- **Knowledge Base:** `ARFYABW8HP` (autobiography chunks)
- **Guardrail:** `5kofhp46ssob` (content filtering)
- **Rate Limit:** 20 requests/hour per IP (DynamoDB-backed)
- Streaming responses via Lambda Function URL with RAG retrieval (5 chunks per query)

### Cloudflare Web Analytics

Privacy-friendly, cookie-free analytics with no personal data collection.

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

SF Pro Display with system font fallbacks. Ultra-light weight (200) throughout. Defined in `src/utils/typography.ts`.

### Animations

- `animate-fade-in` : Hero entrance (1.2s)
- `animate-nav-fade-in` : Nav delayed entrance (0.8s, 2s delay)
- `shimmer` : Background shimmer effect
- `widget-open` : Chat widget expansion (250ms)

---

## License

Copyright 2026 Christian Perez. All rights reserved.

For inquiries, use the [contact form](https://thechrisgrey.com/contact) or email via the website.
