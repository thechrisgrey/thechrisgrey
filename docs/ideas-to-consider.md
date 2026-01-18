# Ideas to Consider

---

## High Impact

### Custom 404 Page Design
**Priority:** High
**Effort:** Low
**Why:** Currently shows basic 404. A branded 404 page with navigation improves UX when users hit dead links.

**Implementation:**
- Design custom 404 page matching site aesthetic
- Include search or suggested links (Home, Blog, Contact)
- Add subtle humor or personality

---

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

### Speaking/Media Page
**Priority:** Medium
**Effort:** Medium
**Why:** Event organizers and media look for speaking topics, past engagements, and booking info. Valuable for someone with your profile.

**Implementation:**
- Create `/speaking` or `/media` route
- Include: speaking topics, past events, testimonials, booking CTA
- Add headshot downloads for event promoters

---

### Reading Progress Bar
**Priority:** Low
**Effort:** Low
**Why:** Visual indicator showing scroll progress on blog posts. Common modern touch that improves reading experience.

**Implementation:**
- Fixed bar at top of viewport on blog posts
- Width based on scroll percentage
- Use `altivum-gold` color for consistency

---

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

### security.txt File
**Priority:** Low
**Effort:** Very Low
**Why:** Standard file at `/.well-known/security.txt` for security researchers to report vulnerabilities. Professional touch.

**Implementation:**
- Create `public/.well-known/security.txt`
- Include contact email and optional PGP key
- Reference: https://securitytxt.org/

---

---

## Completed

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
