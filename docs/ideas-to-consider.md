# Ideas to Consider

---

## High Impact

### Page-Specific Open Graph Images
**Priority:** Medium
**Effort:** Medium
**Why:** Currently using one `og.png` for all pages. Unique images for About, Podcast, Book, etc. improve social sharing engagement.

**Implementation:**
- Create OG images for each main page (1200x630)
- Update SEO component calls with page-specific images
- Consider auto-generating for blog posts

---

## Nice to Have

### Print Styles for Blog
**Priority:** Low
**Effort:** Low
**Why:** Blog articles that print cleanly for offline reading. Some readers prefer physical copies.

**Implementation:**
- Add `@media print` styles
- Hide navigation, footer, related posts
- Optimize typography for print
- Include URL at bottom of printed page

---

## Completed

### Speaking & Media Section - IMPLEMENTED

**Status:** Implemented on January 19, 2026

Merged speaking/media functionality into the Contact page (`/contact`) instead of creating a separate route:
- **Speaking Topics**: 4 topic cards (Cloud & AI Strategy, Veteran Transition, Entrepreneurship, Leadership)
- **Event Types**: Keynotes, panels, podcasts, workshops, media interviews, veteran events
- **Press Kit Download**: CTA for event organizers to download bio and headshots
- Updated SEO title to "Contact & Speaking" and meta description for speaking/media keywords
- Press kit file location: `public/press-kit.zip` (needs to be created with actual materials)

---

### Reading Progress Bar - IMPLEMENTED

**Status:** Implemented on January 18, 2026

Added gold progress bar to blog posts:
- 3px `altivum-gold` bar fixed at top of viewport
- Fills 0-100% as user scrolls through article
- Throttled with requestAnimationFrame for performance
- Component: `src/components/ReadingProgressBar.tsx`

---

### security.txt - IMPLEMENTED

**Status:** Implemented on January 18, 2026

Added security.txt for vulnerability reporting:
- Location: `/.well-known/security.txt`
- Contact: admin@altivum.ai
- Expires: January 18, 2027

---

### Custom 404 Page - IMPLEMENTED

**Status:** Implemented on January 18, 2026

Added branded 404 page matching site aesthetic:
- Large "404" display with gold accent
- Friendly message: "Looks like this page went off the grid"
- Primary CTAs: Go Home, Read the Blog, Get in Touch
- Quick links to all main pages
- Catch-all route `*` in App.tsx

---

### RSS Feed for Blog - IMPLEMENTED

**Status:** Implemented on January 18, 2026

Added RSS feed generation at build time:
- `scripts/generate-rss.js` fetches posts from Sanity and generates `rss.xml`
- RSS link added to HTML head for feed reader auto-discovery
- RSS Feed link added to footer Quick Links section
- Feed URL: `https://thechrisgrey.com/rss.xml`

---

### AI Chat Guardrails & Rate Limiting - IMPLEMENTED

**Status:** Implemented on January 18, 2026

Added comprehensive protection for the AI chat feature:
- **Bedrock Guardrail** (ID: `5kofhp46ssob`): Content filters for prompt attacks, hate speech, sexual content, violence; denied topics for off-topic requests, illegal activities, professional advice; profanity word filter
- **DynamoDB Rate Limiting** (Table: `thechrisgrey-chat-ratelimit`): 20 requests/hour per IP with SHA256 hashing, automatic TTL cleanup after 2 hours
- **CloudWatch Cost Alarm**: Alerts when Bedrock costs exceed $25/day

---

### Privacy Policy Page - IMPLEMENTED

**Status:** Implemented on January 18, 2026

Added `/privacy` route with comprehensive privacy policy covering data collection, third-party services, cookies, user rights (GDPR/CCPA), and contact information. Footer link added.

---

### AI Chat: Amazon Bedrock Knowledge Base - IMPLEMENTED

**Status:** Implemented on January 17, 2026

**Goal:** Upgrade the AI assistant from static system prompt to dynamic RAG (Retrieval-Augmented Generation) so it can answer specific questions about Christian's background, career, and content.

---

### Implementation Details

**Architecture:**
```
User question
    → Query Bedrock Knowledge Base (Retrieve API)
    → Get 5 most relevant chunks
    → Inject into system prompt
    → Claude generates contextual response
    → Stream response to user
```

**AWS Resources:**
- **Knowledge Base ID:** `ARFYABW8HP`
- **Data Source ID:** `TXQTRAJOSD`
- **Source Bucket:** `s3://thechrisgrey-kb-source/` (us-east-1)
- **Vector Store:** S3 Vectors (cost-effective alternative to OpenSearch Serverless)
  - Vector Bucket: `thechrisgrey-vectors`
  - Vector Index: `autobiography-index`
- **Embeddings Model:** Amazon Titan Text Embeddings v2 (1024 dimensions)
- **IAM Role:** `TheChrisGreyKnowledgeBaseRole`

**Current Content:**
- `Autobiography.docx` - Christian's comprehensive autobiography

---

### To Add More Content

1. Upload documents to `s3://thechrisgrey-kb-source/`
2. Sync the Knowledge Base:
```bash
aws bedrock-agent start-ingestion-job \
  --knowledge-base-id ARFYABW8HP \
  --data-source-id TXQTRAJOSD \
  --region us-east-1
```

**Future content to add:**
- Blog posts (exported from Sanity)
- Podcast transcripts
- Book excerpts / chapter summaries

---

### Cost Notes

Using S3 Vectors instead of OpenSearch Serverless significantly reduces costs:
- S3 Vectors: Pay-per-use (~$0.0001 per 1000 vectors stored + query costs)
- OpenSearch Serverless: ~$700/mo minimum baseline

---

### Lambda Changes

The Lambda function (`lambda/chat-stream/index.mjs`) now:
1. Extracts the latest user message
2. Queries the Knowledge Base for relevant context
3. Builds a system prompt with retrieved context
4. Streams the response from Claude

Required IAM permissions added: `bedrock:Retrieve` for the Knowledge Base
