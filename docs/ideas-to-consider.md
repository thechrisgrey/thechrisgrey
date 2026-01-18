# Ideas to Consider

## Portfolio/Projects Showcase

**Goal:** Allow visitors to explore projects and sites I've built without the page feeling too busy or the implementation looking cheesy.

---

### Option 1: Device Mockups

Show live sites inside a MacBook or phone frame. Click to expand into a full interactive modal.

**Pros:**
- Feels polished and intentional
- Device frame adds visual context
- Interactive on demand, not forced

**Cons:**
- More complex to implement well
- Need to handle responsive device frames

**Implementation notes:**
- Could use CSS-only device frames or a library
- Modal opens with full iframe, close button returns to gallery
- Consider lazy-loading iframes only when modal opens

---

### Option 2: Screenshot Grid with Modal Preview

Clean card grid with static screenshots. Click opens a modal with the live iframe embedded.

**Pros:**
- Clean initial view, no iframe overhead
- User opts into the interactive experience
- Screenshots load fast, iframe loads on demand
- Fits the current minimalist design language

**Cons:**
- Screenshots can get stale if sites change
- Two-step interaction (click to preview, click to visit)

**Implementation notes:**
- Screenshot cards with subtle hover effect (scale, border glow)
- Modal with iframe + "Visit Site" external link button
- Could add project title, tech stack badges on cards

---

### Design Considerations

- Both options should respect the site's aesthetic: thin borders, generous whitespace, subtle animations
- Modal backdrop should use `bg-altivum-dark/90 backdrop-blur-md` for consistency
- Consider X-Frame-Options - some sites may not allow embedding (have fallback)
- Mobile: possibly skip iframe entirely and just link to live site

---

### Sites to Potentially Showcase

- Altivum.io
- VetROI
- GradROI
- The Vector Podcast site
- Client projects (with permission)

---

## AI Chat: Amazon Bedrock Knowledge Base - IMPLEMENTED

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
