# Differentiated Page Experiences -- Claude & AWS Pages

**Date:** 2026-03-23
**Status:** Approved
**Scope:** Redesign the Claude (`/claude`) and AWS (`/aws`) pages to break the repeating hero-paragraphs-cards-timeline template with unique interactive experiences targeting a highly technical audience.

## Context

All About subpages currently share an identical layout structure: hero image, spaced paragraphs, 3-column cards with pill tags, and a timeline with dot markers. This makes pages predictable after the first visit. The goal is to differentiate two key pages -- Claude and AWS -- so that each becomes its own experience that educates and impresses engineers and technical leaders.

**Design principles:**
- The page itself is the portfolio piece (educate + impress)
- Real data over simulated where possible
- Go big on interactivity (R3F, GSAP, SVG animations are all in scope)
- Existing content below the fold can stay; the new interactive section is inserted after the intro

## Claude Page: Live Architecture X-Ray

### Concept

An animated, interactive SVG pipeline diagram showing the real Alti chat system architecture. Visitors can send a real prompt through the pipeline and watch each stage light up in sequence with actual latency numbers.

### Page Structure

1. **Hero section** (unchanged): Claude hero image with fade-in animation
2. **Introduction paragraphs** (unchanged): Three paragraphs establishing Claude as the foundation
3. **Architecture X-Ray** (new): Interactive pipeline diagram with live trace capability
4. **Focus Areas cards** (unchanged): 3-column cards with tool pills
5. **How I Work timeline** (unchanged): Production First / Human in the Loop / Full-Stack AI
6. **Anthropic Academy** (unchanged): Featured cert + cert grid

### Pipeline Stages

The diagram shows 7 sequential nodes connected by animated edges:

1. **User Input** -- Browser-side message composition
2. **HMAC Signing** -- `chatSigning.ts` generates SHA256 signature with timestamp
3. **Lambda Handler** -- `thechrisgrey-chat-stream` receives and validates request
4. **Guardrail Check** -- Bedrock Guardrail `5kofhp46ssob` (v2) screens content
5. **RAG Retrieval** -- Knowledge Base `ARFYABW8HP` retrieves 5 chunks from S3 Vectors
6. **Bedrock Inference** -- Claude Haiku 4.5 generates response via ConverseStream API
7. **Streaming Response** -- Response streams back through Lambda Function URL to browser

### Rendering

- **Technology:** Custom SVG with GSAP animations. No React Flow dependency.
- **Layout:** Horizontal pipeline on desktop (md+), vertical on mobile.
- **Initial state:** All nodes dim (altivum-slate border, low opacity). Edges are dashed lines.
- **Trace animation:** Nodes light up gold sequentially with a pulse animation. Edges become solid with a traveling dot. Latency labels (e.g., "~12ms", "~340ms") appear on edges as each stage completes.

### "Trace It" Interaction

- Input field with placeholder: "Ask Alti something..."
- "Trace It" button sends a real request to the existing chat Lambda (`VITE_CHAT_ENDPOINT`)
- Uses the same HMAC signing from `src/utils/chatSigning.ts`
- Request includes a `pageContext` matching the existing `PageContext` interface: `{ currentPage: '/claude', pageTitle: 'Claude', section: 'Architecture X-Ray', visitedPages: [] }`
- **Rate limiting:** 1 live trace per browser session (sessionStorage flag). Subsequent clicks replay the cached response with the same animation.
- **Error handling for system messages:** The streaming response may be a system message (guardrail block, rate limit, or timeout) prefixed with `\x00SYS\x00`. The `TraceResponseBubble` must strip this prefix (same logic as `useChatEngine.ts`). When a system message is detected:
  - The pipeline animation stops at whichever node was active
  - That node turns amber (warning state) instead of gold
  - The response bubble shows a friendly message: "This trace was filtered by the guardrail" or "Rate limit reached -- showing a previous trace" as appropriate
  - The animation auto-replays with a cached successful response after 2 seconds (so the visitor still sees the full pipeline in action). The `setTimeout` must be stored in a `useRef` and cancelled in the component's `useEffect` cleanup to prevent state updates on unmounted components if the user navigates away.
- **Interaction with Lambda rate limit:** The Lambda enforces 20 req/hour per IP shared with the chat widget. If the visitor has been chatting with Alti, the trace may hit this limit. The system-message handling above covers this case -- no special client-side rate limit check is needed beyond the sessionStorage 1-trace flag.
- As the streaming response arrives, a mini chat bubble appears below the pipeline showing the response text
- Pre-populated suggestion prompts (3 options) appear if the input is empty, similar to the chat page

### Node Expansion

- Clicking any pipeline node expands a detail panel directly below the pipeline (GSAP height animation, pushes content down)
- Only one node expanded at a time (clicking another collapses the current)
- Detail panel contents per node:
  - **Service name and type** (e.g., "AWS Lambda -- Streaming Function")
  - **What it does** (1-2 sentences)
  - **Real config** (e.g., guardrail ID, model ID, KB ID, rate limit threshold)
  - **Why it exists** (1-2 sentences on the engineering decision)
- Clicking the expanded panel again or pressing Escape collapses it

### Component Structure

```
src/components/claude/
  ArchitectureXRay.tsx        -- Main container, orchestrates pipeline + detail panel
  PipelineNode.tsx            -- Individual SVG node (dim/active/expanded states)
  PipelineEdge.tsx            -- SVG edge with latency label and traveling dot animation
  NodeDetailPanel.tsx         -- Expandable detail panel for a clicked node
  TraceInput.tsx              -- Input field + "Trace It" button + suggestion prompts
  TraceResponseBubble.tsx     -- Mini chat bubble showing streaming response
```

### Data

Pipeline node metadata stored in a static data file:

```
src/data/architectureNodes.ts
```

Each node: `{ id, label, sublabel, service, description, config: Record<string, string>, reasoning }`

Edge data: `{ from, to, estimatedLatency }` -- approximate real-world latency values based on CloudWatch logs (`tcg-AI-chat` log group):
- User Input to HMAC Signing: ~1ms (client-side crypto)
- HMAC to Lambda Handler: ~50ms warm / ~500ms cold start
- Lambda to Guardrail Check: ~80-150ms
- Guardrail to RAG Retrieval: ~200-400ms
- RAG to Bedrock Inference: ~500-2000ms (varies by response length)
- Bedrock to Streaming Response: ~10ms (first byte)

### Accessibility

- Pipeline nodes are keyboard navigable (Tab between nodes, Enter/Space to expand)
- `aria-expanded` on expandable nodes
- `aria-live="polite"` on the streaming response bubble
- Trace animation respects `prefers-reduced-motion` (nodes change state instantly without animation)

## AWS Page: Infrastructure Topology Map

### Concept

A 3D interactive visualization of the actual AWS infrastructure rendered via React Three Fiber. Service clusters float in 3D space with animated particle data flow along edges. Click a cluster to zoom in and explore individual services.

### Page Structure

1. **Hero section** (unchanged): AWS hero image
2. **Community Builder banner** (unchanged): Full-width image with gradient overlays
3. **Introduction paragraphs** (unchanged): Community Builder context + track info
4. **The Stack** (new): 3D topology map with service clusters
5. **Focus Areas cards** (removed): Content migrated as follows:
   - "AI & Machine Learning" card content → **AI/ML cluster** detail panel
   - "Cloud Architecture" card content → split across **Compute** and **Data** cluster detail panels
   - "Community & Content" card content → removed (not infrastructure-related; the intro paragraphs already cover the community builder narrative)
6. **What This Means timeline** (removed): Content migrated as follows:
   - "Direct Access" → mentioned in the intro paragraphs (already covered)
   - "Knowledge Sharing" → mentioned in the intro paragraphs (already covered)
   - "Builder Network" → mentioned in the intro paragraphs (already covered)
   - These three items describe the Community Builder program, not infrastructure -- they don't belong in the topology map. The intro section already covers this narrative.

### Service Clusters

6 clusters, each containing 2-4 related services:

1. **CDN / Edge** -- Amplify, CloudFront
2. **Compute** -- Lambda (chat-stream, kb-sync, kb-builder, metrics)
3. **AI / ML** -- Bedrock (Claude Haiku 4.5, Titan Embeddings, Knowledge Base, Guardrails)
4. **Data** -- DynamoDB (rate limiting), S3 (KB source, vectors, static assets)
5. **Auth / Security** -- Cognito (admin pool), IAM roles, HMAC signing
6. **Observability** -- CloudWatch (metrics, logs, alarms), SNS (alerts)

### 3D Scene (Desktop)

- **Technology:** React Three Fiber + drei helpers (already in project)
- **Canvas:** Full-width, ~500px height, `bg-altivum-dark` background
- **Clusters:** Sphere meshes with Text labels (drei). Size proportional to service count. Gold wireframe material with subtle glow.
- **Edges:** Line geometry connecting related clusters. Gold particles (Points geometry) travel along edges showing data flow direction.
- **Camera:** Perspective camera, slight downward angle. OrbitControls for drag rotation. Auto-rotates slowly when idle (0.2 rad/s).
- **Lighting:** Ambient (0.4) + point light centered above (gold tint, 0.6 intensity)
- **Click interaction:** Clicking a cluster triggers a camera fly-to animation (GSAP or drei CameraControls). The cluster expands into individual service nodes arranged in a small ring. A detail panel appears in an HTML overlay (drei Html component) showing service names, configs, and descriptions.
- **Zoom out:** Click empty space or press Escape to fly camera back to overview position.

### 2D Fallback (Mobile)

- The 2D SVG fallback renders in two cases: (1) screens below `md` breakpoint, or (2) **WebGL is unavailable on any viewport size**. A `checkWebGLSupport()` utility (test for `document.createElement('canvas').getContext('webgl2') || ...getContext('webgl')`) runs before mounting `TopologyScene`. If WebGL is absent, fall through to 2D even on desktop. The `TopologyScene` R3F canvas is additionally wrapped in the project's `ErrorBoundary` component to catch runtime WebGL failures (driver crashes, context lost).
- Same 6 clusters rendered as circles with connection lines (similar visual language to the Claude page pipeline)
- Tap a cluster to expand an inline detail panel (same content as desktop)
- No drag/orbit -- simple tap interaction
- Desktop/mobile swap: `InfraTopology` checks `webglSupported && isDesktop` (via a `useMediaQuery('(min-width: 768px)')` hook) to decide which renderer to mount

### Detail Panel (Both Platforms)

When a cluster is expanded (clicked on desktop, tapped on mobile), a detail panel shows:

- **Cluster name and service count**
- **Individual services grid** (2 columns): Each service shows name, type, region, and a 1-line description
- **Connection info**: Which other clusters this one connects to and why
- Close button + Escape key to dismiss

### Component Structure

```
src/components/aws/
  InfraTopology.tsx           -- Main container, handles desktop/mobile swap
  TopologyScene.tsx           -- R3F Canvas + scene setup (lights, camera, controls)
  ServiceCluster.tsx          -- 3D cluster mesh (sphere + label + glow)
  ClusterEdge.tsx             -- 3D edge line with particle flow
  ClusterDetail.tsx           -- drei Html overlay for expanded cluster info
  TopologyFallback2D.tsx      -- SVG 2D version for mobile
  FallbackCluster.tsx         -- SVG circle cluster for mobile
  FallbackDetail.tsx          -- Inline detail panel for mobile
```

### Data

Cluster and service metadata stored in a static data file:

```
src/data/infrastructureTopology.ts
```

Each cluster: `{ id, label, position: [x, y, z], services: Array<{ name, type, region, description }>, connections: string[] }`

### Performance

- R3F canvas uses `frameloop="always"` because particles and auto-rotation require continuous rendering. The canvas is full-width at ~500px height -- meaningful GPU cost. Mitigations: (1) particle count kept low (50-100 total), (2) auto-rotation pauses when the tab is not visible (`document.hidden` check in `useFrame`), (3) `frameloop` switches to `"demand"` after user clicks a cluster (static expanded view doesn't need continuous rendering), resumes `"always"` on zoom-out.
- The AWS page is already lazy-loaded at the route level (`React.lazy()` in `App.tsx`). The topology components are **static imports within the AWS chunk** -- no nested `React.lazy()` to avoid a double-Suspense flash. The existing `PageLoadingFallback` gold spinner covers the initial chunk load.
- The `three-vendor` manual chunk in `vite.config.ts` already isolates Three.js -- no additional chunking needed

### Accessibility

- **3D keyboard navigation:** drei's `Html` component renders outside the R3F canvas DOM subtree, making natural Tab order unreliable. Instead, an accessible HTML overlay layer is positioned absolutely over the canvas with `pointer-events: none`. Real `<button>` elements in this overlay correspond to each cluster position (updated via refs synced with R3F's `useFrame`). These buttons have `pointer-events: auto` so they receive keyboard focus and click events. This approach ensures Tab order follows DOM order, not canvas z-depth. The 2D SVG fallback uses standard HTML buttons and has full keyboard accessibility natively.
- `aria-label` on each cluster button with service names
- Detail panel has `role="dialog"` with focus trap (reuses project's `useFocusTrap` hook)
- `prefers-reduced-motion`: disables auto-rotation and particle animation, camera transitions become instant

## Shared Considerations

### New Dependencies

- **GSAP** (`gsap`): For SVG pipeline animations (Claude page) and camera transitions (AWS page). ~23KB gzipped. Free tier is sufficient -- no Club/Business plugins needed. Install: `npm install gsap`. The sequential timeline coordination (nodes lighting up in order with staggered edge animations) is the primary use case that justifies GSAP over CSS animations. Since both the Claude and AWS page chunks import GSAP, add a `gsap-vendor` manual chunk in `vite.config.ts` (same pattern as `three-vendor`) to deduplicate it across the two lazy-loaded page chunks. This keeps GSAP out of the initial bundle -- it only loads when either `/claude` or `/aws` is visited, but is shared rather than duplicated between them.
- No other new dependencies. R3F/drei/three are already in the project.

### Bundle Impact

- Claude page components: ~8-12KB gzipped (SVG + GSAP animations)
- AWS page components: ~15-20KB gzipped (R3F scene + 2D fallback)
- Both pages are already code-split via `React.lazy()`, so these only load when visiting the respective page

### CSP

No CSP changes needed. All rendering is local (SVG, Canvas). The Claude page trace uses the existing chat endpoint already in the CSP connect-src.

### Testing

- Pipeline node rendering and state transitions (dim/active/expanded)
- Trace input validation and sessionStorage rate limiting
- Node detail panel expand/collapse
- Mobile breakpoint swap (3D to 2D fallback on AWS page)
- `prefers-reduced-motion` behavior
- Three.js components mocked in jsdom tests (same pattern as AltiMascot)

### SEO

- Both pages retain their existing SEO component with structured data
- Interactive sections use semantic HTML where possible (headings, buttons, descriptions)
- Pipeline node descriptions and cluster service info are in the DOM (not canvas-only), ensuring crawlability
