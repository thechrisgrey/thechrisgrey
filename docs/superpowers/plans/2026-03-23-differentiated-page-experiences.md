# Differentiated Page Experiences Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Claude and AWS pages with unique interactive experiences -- a Live Architecture X-Ray (SVG pipeline with real API trace) and a 3D Infrastructure Topology Map (R3F) -- to replace the generic shared template.

**Architecture:** The Claude page gets a custom SVG pipeline diagram animated with GSAP that sends real requests to the existing chat Lambda. The AWS page gets a 3D R3F scene showing service clusters with particle data flow, plus a 2D SVG fallback for mobile/no-WebGL. Both share a new GSAP dependency and static data files.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, GSAP (new), React Three Fiber + drei (existing), Vite

**Spec:** `docs/superpowers/specs/2026-03-23-differentiated-page-experiences-design.md`

---

## File Map

### New Files

```
src/data/architectureNodes.ts              -- Pipeline node + edge metadata for Claude page
src/data/infrastructureTopology.ts         -- Cluster + service metadata for AWS page
src/utils/checkWebGL.ts                    -- WebGL support detection utility
src/hooks/useMediaQuery.ts                 -- Responsive breakpoint hook
src/components/claude/ArchitectureXRay.tsx -- Main X-Ray container
src/components/claude/PipelineNode.tsx     -- SVG pipeline node component
src/components/claude/PipelineEdge.tsx     -- SVG edge with latency label
src/components/claude/NodeDetailPanel.tsx  -- Expandable node detail panel
src/components/claude/TraceInput.tsx       -- Input + "Trace It" button
src/components/claude/TraceResponseBubble.tsx -- Streaming response mini-bubble
src/components/aws/InfraTopology.tsx       -- Main topology container (3D/2D switch)
src/components/aws/TopologyScene.tsx       -- R3F Canvas + 3D scene
src/components/aws/ServiceCluster.tsx      -- 3D cluster sphere mesh
src/components/aws/ClusterEdge.tsx         -- 3D edge with particle flow
src/components/aws/ClusterDetail.tsx       -- Expanded cluster detail overlay
src/components/aws/TopologyFallback2D.tsx  -- SVG 2D fallback
src/components/aws/FallbackCluster.tsx     -- SVG circle cluster
src/components/aws/FallbackDetail.tsx      -- Inline detail panel for 2D
```

### Modified Files

```
package.json                               -- Add gsap dependency
vite.config.ts                             -- Add gsap-vendor manual chunk
src/pages/Claude.tsx                       -- Insert ArchitectureXRay after intro
src/pages/AWS.tsx                          -- Replace Focus Areas + Timeline with InfraTopology
```

---

## Task 1: Install GSAP and Configure Vite Chunking

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`

- [ ] **Step 1: Install GSAP**

```bash
npm install gsap
```

- [ ] **Step 2: Add gsap-vendor manual chunk to vite.config.ts**

In `vite.config.ts`, add `'gsap-vendor': ['gsap']` to the `manualChunks` object alongside the existing `three-vendor` entry:

```typescript
manualChunks: {
  'vendor': ['react', 'react-dom'],
  'sanity': ['@sanity/client', '@sanity/image-url', '@portabletext/react'],
  'router': ['react-router-dom'],
  'cognito': ['@aws-sdk/client-cognito-identity-provider'],
  'three-vendor': ['three'],
  'gsap-vendor': ['gsap'],
}
```

- [ ] **Step 3: Verify build succeeds**

```bash
npm run build
```

Expected: Build completes. A `gsap-vendor-[hash].js` chunk appears in `dist/assets/`.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json vite.config.ts
git commit -m "chore: add gsap dependency and vendor chunk"
```

---

## Task 2: Create Shared Utilities (WebGL Check + useMediaQuery)

**Files:**
- Create: `src/utils/checkWebGL.ts`
- Create: `src/hooks/useMediaQuery.ts`

- [ ] **Step 1: Create WebGL support check utility**

Create `src/utils/checkWebGL.ts`:

```typescript
let cachedResult: boolean | null = null;

export function checkWebGLSupport(): boolean {
  if (cachedResult !== null) return cachedResult;

  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    cachedResult = gl !== null;
  } catch {
    cachedResult = false;
  }

  return cachedResult!;
}
```

- [ ] **Step 2: Create useMediaQuery hook**

Create `src/hooks/useMediaQuery.ts`:

```typescript
import { useState, useEffect } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/utils/checkWebGL.ts src/hooks/useMediaQuery.ts
git commit -m "feat: add WebGL check utility and useMediaQuery hook"
```

---

## Task 3: Create Claude Page Data File

**Files:**
- Create: `src/data/architectureNodes.ts`

- [ ] **Step 1: Create the architecture data file**

Create `src/data/architectureNodes.ts` with node metadata, edge data, and TypeScript interfaces:

```typescript
export interface PipelineNodeData {
  id: string;
  label: string;
  sublabel: string;
  service: string;
  description: string;
  config: Record<string, string>;
  reasoning: string;
}

export interface PipelineEdgeData {
  from: string;
  to: string;
  estimatedLatencyMs: string;
}

export const pipelineNodes: PipelineNodeData[] = [
  {
    id: 'user-input',
    label: 'User Input',
    sublabel: 'Browser',
    service: 'React Frontend',
    description: 'The visitor types a message in the chat interface. The message is validated client-side (4000 char limit) and prepared for signing.',
    config: {
      'Max Length': '4,000 characters',
      'Framework': 'React 19 + TypeScript',
      'Component': 'TraceInput.tsx',
    },
    reasoning: 'Client-side validation prevents oversized payloads from reaching the Lambda, reducing unnecessary invocations and costs.',
  },
  {
    id: 'hmac-signing',
    label: 'HMAC',
    sublabel: 'Signing',
    service: 'Web Crypto API',
    description: 'Generates an HMAC-SHA256 signature using a shared secret. The signature and timestamp are sent as headers to authenticate the request.',
    config: {
      'Algorithm': 'HMAC-SHA256',
      'Format': 'timestamp.body',
      'Headers': 'X-Chat-Timestamp, X-Chat-Signature',
    },
    reasoning: 'HMAC signing prevents unauthorized callers from invoking the Lambda directly. The 5-minute timestamp window prevents replay attacks.',
  },
  {
    id: 'lambda-handler',
    label: 'Lambda',
    sublabel: 'Handler',
    service: 'AWS Lambda -- Streaming Function',
    description: 'Receives the request, verifies the HMAC signature with timing-safe comparison, validates input structure, and orchestrates the downstream pipeline.',
    config: {
      'Function': 'thechrisgrey-chat-stream',
      'Runtime': 'Node.js 20.x',
      'Region': 'us-east-1',
      'Streaming': 'awslambda.streamifyResponse()',
    },
    reasoning: 'Lambda Function URLs with streaming enabled provide sub-second time-to-first-byte without API Gateway overhead or WebSocket complexity.',
  },
  {
    id: 'guardrail-check',
    label: 'Guardrail',
    sublabel: 'Check',
    service: 'Amazon Bedrock Guardrails',
    description: 'Screens the user message against content policies before it reaches the model. Blocks prompt attacks, hate speech, and off-topic requests.',
    config: {
      'Guardrail ID': '5kofhp46ssob',
      'Version': '2',
      'Filters': 'PROMPT_ATTACK, HATE, SEXUAL, VIOLENCE, MISCONDUCT',
      'Denied Topics': 'Code assistance, general trivia, other public figures',
    },
    reasoning: 'Pre-inference guardrails reject harmful content before it consumes Bedrock tokens, saving cost and ensuring the AI agent stays on-topic.',
  },
  {
    id: 'rag-retrieval',
    label: 'RAG',
    sublabel: 'Retrieval',
    service: 'Bedrock Knowledge Base + S3 Vectors',
    description: 'Retrieves the 5 most relevant text chunks from the knowledge base using Titan Embeddings v2 (1024 dimensions, cosine distance).',
    config: {
      'KB ID': 'ARFYABW8HP',
      'Embeddings': 'Amazon Titan Text Embeddings v2',
      'Dimensions': '1,024',
      'Vector Store': 'S3 Vectors',
      'Top K': '5 chunks',
    },
    reasoning: 'RAG grounds Claude\'s responses in verified biographical content, preventing hallucination. S3 Vectors replaced OpenSearch Serverless to eliminate the $345/month minimum OCU cost.',
  },
  {
    id: 'bedrock-inference',
    label: 'Bedrock',
    sublabel: 'Inference',
    service: 'Amazon Bedrock -- ConverseStream API',
    description: 'Claude Haiku 4.5 generates a response using the conversation history and retrieved knowledge base context. Responses stream token-by-token.',
    config: {
      'Model': 'Claude Haiku 4.5',
      'Model ID': 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
      'Max Tokens': '350',
      'Temperature': '0.6',
      'Timeout': '10 seconds',
    },
    reasoning: 'Haiku 4.5 balances speed and quality for conversational use. The 350 token limit and 0.6 temperature keep responses concise and focused.',
  },
  {
    id: 'streaming-response',
    label: 'Stream',
    sublabel: 'Response',
    service: 'Lambda Function URL -- Streaming',
    description: 'The response streams back through the Lambda Function URL to the browser. The frontend reads the stream chunk-by-chunk and renders text progressively.',
    config: {
      'Protocol': 'HTTP chunked transfer',
      'CORS': 'thechrisgrey.com',
      'Client Timeout': '30 seconds',
      'Sliding Window': '20 messages',
    },
    reasoning: 'Streaming provides immediate feedback (sub-second first token) rather than waiting for the full response. The 20-message sliding window bounds context and cost.',
  },
];

export const pipelineEdges: PipelineEdgeData[] = [
  { from: 'user-input', to: 'hmac-signing', estimatedLatencyMs: '~1ms' },
  { from: 'hmac-signing', to: 'lambda-handler', estimatedLatencyMs: '~50ms' },
  { from: 'lambda-handler', to: 'guardrail-check', estimatedLatencyMs: '~120ms' },
  { from: 'guardrail-check', to: 'rag-retrieval', estimatedLatencyMs: '~300ms' },
  { from: 'rag-retrieval', to: 'bedrock-inference', estimatedLatencyMs: '~1.2s' },
  { from: 'bedrock-inference', to: 'streaming-response', estimatedLatencyMs: '~10ms' },
];
```

- [ ] **Step 2: Commit**

```bash
git add src/data/architectureNodes.ts
git commit -m "feat: add Claude page architecture pipeline data"
```

---

## Task 4: Create AWS Page Data File

**Files:**
- Create: `src/data/infrastructureTopology.ts`

- [ ] **Step 1: Create the infrastructure topology data file**

Create `src/data/infrastructureTopology.ts` with cluster metadata, service details, and TypeScript interfaces:

```typescript
export interface ServiceData {
  name: string;
  type: string;
  region: string;
  description: string;
}

export interface ClusterData {
  id: string;
  label: string;
  position: [number, number, number];
  size: number;
  services: ServiceData[];
  connections: string[];
}

export const clusters: ClusterData[] = [
  {
    id: 'cdn-edge',
    label: 'CDN / Edge',
    position: [-3, 1.5, 0],
    size: 0.6,
    services: [
      { name: 'AWS Amplify', type: 'Hosting & CI/CD', region: 'us-east-2', description: 'Builds and deploys the React SPA from the main branch. Serves static assets from dist/.' },
      { name: 'CloudFront', type: 'CDN', region: 'Global', description: 'Edge-cached distribution for static assets. Managed automatically by Amplify.' },
    ],
    connections: ['compute'],
  },
  {
    id: 'compute',
    label: 'Compute',
    position: [-1, -0.5, 1],
    size: 0.8,
    services: [
      { name: 'chat-stream', type: 'Lambda Function', region: 'us-east-1', description: 'Streaming chat handler. Bedrock ConverseStream API with HMAC auth and guardrails.' },
      { name: 'kb-sync', type: 'Lambda Function', region: 'us-east-1', description: 'Triggered by S3 events. Starts Knowledge Base ingestion when source documents change.' },
      { name: 'kb-builder', type: 'Lambda Function', region: 'us-east-1', description: 'Admin CRUD for KB entries. Assembles and publishes knowledge-base.txt to S3.' },
      { name: 'metrics', type: 'Lambda Function', region: 'us-east-1', description: 'Receives Web Vitals and CSP reports. Publishes to CloudWatch custom metrics.' },
    ],
    connections: ['ai-ml', 'data', 'auth-security', 'observability'],
  },
  {
    id: 'ai-ml',
    label: 'AI / ML',
    position: [2, 1, 0.5],
    size: 0.9,
    services: [
      { name: 'Claude Haiku 4.5', type: 'Foundation Model', region: 'us-east-1', description: 'Primary inference model for Alti chat. 350 max tokens, 0.6 temperature.' },
      { name: 'Titan Embeddings v2', type: 'Embeddings Model', region: 'us-east-1', description: '1024-dimension embeddings for RAG. Cosine distance similarity.' },
      { name: 'Knowledge Base', type: 'Bedrock KB', region: 'us-east-1', description: 'RAG pipeline. Retrieves 5 most relevant chunks per query from S3 Vectors.' },
      { name: 'Guardrails', type: 'Content Filter', region: 'us-east-1', description: 'Pre-inference content screening. Blocks prompt attacks, off-topic, and harmful content.' },
    ],
    connections: ['data'],
  },
  {
    id: 'data',
    label: 'Data',
    position: [1, -1.5, -0.5],
    size: 0.7,
    services: [
      { name: 'DynamoDB', type: 'NoSQL Database', region: 'us-east-1', description: 'Rate limiting table. Atomic per-IP tracking with TTL auto-cleanup.' },
      { name: 'S3 (KB Source)', type: 'Object Storage', region: 'us-east-1', description: 'Source bucket for Knowledge Base documents. Triggers kb-sync Lambda on changes.' },
      { name: 'S3 Vectors', type: 'Vector Store', region: 'us-east-1', description: 'S3-based vector index for RAG embeddings. Cost-effective alternative to OpenSearch.' },
    ],
    connections: ['ai-ml'],
  },
  {
    id: 'auth-security',
    label: 'Auth',
    position: [3, -0.5, -1],
    size: 0.55,
    services: [
      { name: 'Cognito', type: 'User Pool', region: 'us-east-1', description: 'Admin authentication for the KB management panel. Single admin user, no self-signup.' },
      { name: 'IAM Roles', type: 'Access Control', region: 'Global', description: 'Least-privilege roles per Lambda. Separate roles for chat, KB sync, KB builder, metrics.' },
      { name: 'HMAC Signing', type: 'Request Auth', region: 'Client-side', description: 'SHA256 request signing prevents unauthorized Lambda invocations. 5-min replay window.' },
    ],
    connections: ['compute'],
  },
  {
    id: 'observability',
    label: 'Observability',
    position: [-2, -1.5, -1],
    size: 0.55,
    services: [
      { name: 'CloudWatch', type: 'Monitoring', region: 'us-east-1', description: 'Custom metrics (Web Vitals, chat pipeline, rate limits), log groups, and alarm triggers.' },
      { name: 'SNS', type: 'Notifications', region: 'us-east-1', description: 'Alert topic for alarm notifications. Routes to chris@altivum.ai.' },
      { name: 'Alarms', type: 'Threshold Alerts', region: 'us-east-1', description: '6 CloudWatch alarms: CLS, KB failures, rate limit surges, CSP violations, Bedrock cost, KB sync.' },
    ],
    connections: ['compute'],
  },
];
```

- [ ] **Step 2: Commit**

```bash
git add src/data/infrastructureTopology.ts
git commit -m "feat: add AWS page infrastructure topology data"
```

---

## Task 5: Build Claude Page Pipeline Components (Static Rendering)

**Files:**
- Create: `src/components/claude/PipelineNode.tsx`
- Create: `src/components/claude/PipelineEdge.tsx`
- Create: `src/components/claude/NodeDetailPanel.tsx`
- Create: `src/components/claude/ArchitectureXRay.tsx`

This task builds the pipeline SVG and node expansion. No animation or API calls yet -- static rendering only.

- [ ] **Step 1: Create PipelineNode component**

Create `src/components/claude/PipelineNode.tsx`. Renders a single SVG group (`<g>`) with a rounded rect, label, and sublabel. Accepts `state: 'dim' | 'active' | 'warning'` and `isExpanded` props. Uses `tabIndex={0}`, `role="button"`, `aria-expanded`, `onKeyDown` for Enter/Space. Styling: dim = `stroke: altivum-slate/50, fill: altivum-navy/20`, active = `stroke: altivum-gold, fill: altivum-gold/10`, warning = `stroke: amber-500, fill: amber-500/10`.

- [ ] **Step 2: Create PipelineEdge component**

Create `src/components/claude/PipelineEdge.tsx`. Renders an SVG `<line>` or `<path>` between two node positions. Shows a latency label (`<text>`) centered on the edge. Initial state: dashed stroke, hidden latency label. Active state: solid stroke, visible latency label. Accepts `state: 'dim' | 'active'` prop.

- [ ] **Step 3: Create NodeDetailPanel component**

Create `src/components/claude/NodeDetailPanel.tsx`. An HTML `<div>` (not SVG) that renders below the pipeline SVG. Shows: service name/type, description, config key-value pairs, and reasoning. Accepts `node: PipelineNodeData | null` and `onClose: () => void`. For height animation on mount: render the panel with `overflow: hidden`, then use `gsap.from(panelRef.current, { height: 0, duration: 0.3, ease: 'power2.out' })` — this works because GSAP measures the element's natural height before animating from 0. On unmount/collapse: `gsap.to(panelRef.current, { height: 0, duration: 0.2, onComplete: () => setExpanded(false) })`. Escape key calls `onClose`. Styled with `bg-altivum-navy/30 border border-altivum-slate/30 rounded-lg`.

- [ ] **Step 4: Create ArchitectureXRay container**

Create `src/components/claude/ArchitectureXRay.tsx`. Main container that:
- Imports `pipelineNodes` and `pipelineEdges` from data file
- Renders an `<svg>` with `viewBox` calculated from node count
- Lays out nodes horizontally on desktop (using flexbox-like SVG positioning), vertically on mobile (detect via `useMediaQuery('(min-width: 768px)')`)
- Manages `expandedNodeId` state (only one node expanded at a time)
- Manages `nodeStates` map (all start as `'dim'`)
- Renders `PipelineNode` for each node, `PipelineEdge` for each edge
- Renders `NodeDetailPanel` conditionally below the SVG
- Section header: "The Architecture" with subtitle "How the Alti chat pipeline works"
- Wraps everything in a `<section>` with gradient divider above

- [ ] **Step 5: Verify static rendering**

```bash
npm run dev
```

Navigate to `/claude`. Verify the pipeline diagram renders with all 7 nodes in dim state, edges as dashed lines, and clicking a node expands the detail panel. Verify mobile layout switches to vertical.

- [ ] **Step 6: Commit**

```bash
git add src/components/claude/
git commit -m "feat: add Architecture X-Ray pipeline components (static rendering)"
```

---

## Task 6: Add Trace Input and Live API Integration

**Files:**
- Create: `src/components/claude/TraceInput.tsx`
- Create: `src/components/claude/TraceResponseBubble.tsx`
- Modify: `src/components/claude/ArchitectureXRay.tsx`

- [ ] **Step 1: Create TraceInput component**

Create `src/components/claude/TraceInput.tsx`. Renders an input field with placeholder "Ask Alti something..." and a "Trace It" gold button. Shows suggestion prompt chips when input is empty (import `PAGE_SUGGESTIONS` from `src/utils/pageContext.ts` and use `PAGE_SUGGESTIONS['/claude']` — this has 4 entries, show all 4). Clicking a suggestion fills the input. Props: `onTrace: (message: string) => void`, `disabled: boolean`.

- [ ] **Step 2: Create TraceResponseBubble component**

Create `src/components/claude/TraceResponseBubble.tsx`. A mini chat bubble below the pipeline that shows the streaming response text. Props: `content: string`, `isStreaming: boolean`, `isSystemMessage: boolean`. Shows a blinking cursor while streaming. If `isSystemMessage`, shows an amber-styled message. Has `aria-live="polite"` for screen reader announcements.

- [ ] **Step 3: Add trace logic to ArchitectureXRay**

Modify `src/components/claude/ArchitectureXRay.tsx` to add:
- `const CHAT_ENDPOINT = import.meta.env.VITE_CHAT_ENDPOINT` at module scope (same pattern as `useChatEngine.ts`)
- `traceState: 'idle' | 'tracing' | 'complete' | 'error'` state
- `responseContent` and `isSystemMessage` state
- `cachedTrace` ref for replay
- `sessionStorage` flag `xray-traced` to enforce 1 live trace per session
- `replayTimeoutRef` ref for the 2-second auto-replay timeout, cleaned up in `useEffect` return
- `handleTrace` function that:
  1. Checks sessionStorage flag. If already traced, replays cached response with animation.
  2. Builds request body with `pageContext: { currentPage: '/claude', pageTitle: 'Claude', section: 'Architecture X-Ray', visitedPages: [] }`
  3. Calls `getSignedHeaders()` from `src/utils/chatSigning.ts`
  4. Fetches `VITE_CHAT_ENDPOINT` with streaming
  5. Reads stream chunks, strips `\x00SYS\x00` prefix if present
  6. On system message: sets `isSystemMessage`, stops animation at current node (amber state), starts 2-second replay timeout
  7. On success: caches response, sets sessionStorage flag
- GSAP timeline that sequences node activations: each node lights up gold in order, with staggered edge activation. Uses `gsap.timeline()` with sequential `.to()` calls. Respects `prefers-reduced-motion` (if `window.matchMedia('(prefers-reduced-motion: reduce)').matches`, skip animation and set all states instantly).

- [ ] **Step 4: Verify live trace**

```bash
npm run dev
```

Navigate to `/claude`. Type a message and click "Trace It". Verify: nodes light up sequentially, latency labels appear, response streams into the bubble. Refresh and click again -- should replay from cache without API call.

- [ ] **Step 5: Commit**

```bash
git add src/components/claude/
git commit -m "feat: add live trace input and streaming API integration to X-Ray"
```

---

## Task 7: Integrate Architecture X-Ray into Claude Page

**Files:**
- Modify: `src/pages/Claude.tsx`

- [ ] **Step 1: Import and insert ArchitectureXRay**

In `src/pages/Claude.tsx`, import `ArchitectureXRay` and insert it between the Introduction section (ends ~line 131) and the Focus Areas section (starts ~line 134). Add a gradient divider `<div>` above the X-Ray section, matching the existing pattern.

```typescript
import { ArchitectureXRay } from '../components/claude/ArchitectureXRay';
```

Insert after the closing `</section>` of the Introduction and before the existing gradient divider + Focus Areas:

```tsx
{/* Architecture X-Ray */}
<div className="h-px bg-gradient-to-r from-transparent via-altivum-gold/15 to-transparent" />
<ArchitectureXRay />
```

This gradient divider follows the existing pattern used between all sections on this page.

- [ ] **Step 2: Verify full page**

```bash
npm run dev
```

Navigate to `/claude`. Verify: hero, intro paragraphs, X-Ray pipeline, Focus Areas cards, How I Work timeline, and Anthropic Academy certs all render in order. The X-Ray should be the visual focal point.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Claude.tsx
git commit -m "feat: integrate Architecture X-Ray into Claude page"
```

---

## Task 8: Build AWS 2D Fallback Components

**Files:**
- Create: `src/components/aws/FallbackCluster.tsx`
- Create: `src/components/aws/FallbackDetail.tsx`
- Create: `src/components/aws/TopologyFallback2D.tsx`

Build the mobile/no-WebGL fallback first since it's simpler and testable without WebGL.

- [ ] **Step 1: Create FallbackCluster component**

Create `src/components/aws/FallbackCluster.tsx`. An SVG `<g>` containing a circle, label text, and service count badge. Props: `cluster: ClusterData`, `isExpanded: boolean`, `onClick: () => void`. Styled similar to pipeline nodes: `stroke: altivum-gold/30`, expanded state gets `stroke: altivum-gold, fill: altivum-gold/10`. Uses `role="button"`, `tabIndex={0}`, `aria-expanded`, `aria-label` with cluster label + service names.

- [ ] **Step 2: Create FallbackDetail component**

Create `src/components/aws/FallbackDetail.tsx`. An HTML `<div>` that renders below the SVG when a cluster is expanded. Shows cluster name, service count, 2-column grid of services (name, type, region, description), and connection info. Escape key to close. For height animation: render with `overflow: hidden`, use `gsap.from(panelRef.current, { height: 0, duration: 0.3, ease: 'power2.out' })` on mount (same pattern as `NodeDetailPanel`). Reuses `useFocusTrap` hook from `src/hooks/useFocusTrap.ts` for keyboard trapping. Props: `cluster: ClusterData | null`, `allClusters: ClusterData[]`, `onClose: () => void`.

- [ ] **Step 3: Create TopologyFallback2D component**

Create `src/components/aws/TopologyFallback2D.tsx`. Main 2D container that:
- Imports `clusters` from data file
- Renders an `<svg>` with clusters positioned in a 2D layout (map 3D positions to 2D by ignoring Z axis and scaling X/Y)
- Draws connection lines between related clusters (dashed gold strokes)
- Manages `expandedClusterId` state
- Renders `FallbackCluster` for each cluster, `FallbackDetail` conditionally

- [ ] **Step 4: Verify 2D rendering**

Create a temporary test by rendering `TopologyFallback2D` directly. Verify all 6 clusters render, clicking expands the detail panel, connections draw correctly.

- [ ] **Step 5: Commit**

```bash
git add src/components/aws/FallbackCluster.tsx src/components/aws/FallbackDetail.tsx src/components/aws/TopologyFallback2D.tsx
git commit -m "feat: add 2D SVG fallback for AWS topology map"
```

---

## Task 9: Build AWS 3D Scene Components

**Files:**
- Create: `src/components/aws/ServiceCluster.tsx`
- Create: `src/components/aws/ClusterEdge.tsx`
- Create: `src/components/aws/ClusterDetail.tsx`
- Create: `src/components/aws/TopologyScene.tsx`

- [ ] **Step 1: Create ServiceCluster component**

Create `src/components/aws/ServiceCluster.tsx`. An R3F component (`@react-three/fiber`) that renders a sphere mesh with wireframe material (gold color). Uses drei `Text` for the label. Props: `cluster: ClusterData`, `isSelected: boolean`, `onClick: () => void`. Selected state: brighter gold, subtle emissive glow. Size based on `cluster.size`. Uses `useFrame` for gentle floating idle animation (small Y sine wave, only when not selected).

- [ ] **Step 2: Create ClusterEdge component**

Create `src/components/aws/ClusterEdge.tsx`. An R3F component that draws a `<Line>` (drei) between two cluster positions. Gold particles travel along the line using a `Points` geometry with positions updated in `useFrame`. Particle count: ~10 per edge. Respects `prefers-reduced-motion` (particles static if reduced motion). **Must check `document.hidden` in `useFrame` and skip position updates when the tab is not visible** — this prevents wasted GPU cycles when the user has switched tabs.

- [ ] **Step 3: Create ClusterDetail component**

Create `src/components/aws/ClusterDetail.tsx`. Uses drei `Html` component positioned near the selected cluster. Shows the same content as `FallbackDetail`: cluster name, services grid, connections. Styled with the Altivum design system colors. **Important:** This component is for visual display only — set `pointer-events: none` on the `Html` wrapper so it doesn't interfere with the accessible keyboard overlay (Task 10). All keyboard interaction flows through the overlay buttons, not through this component. Props: `cluster: ClusterData`, `allClusters: ClusterData[]`, `onClose: () => void`.

- [ ] **Step 4: Create TopologyScene component**

Create `src/components/aws/TopologyScene.tsx`. The main R3F `<Canvas>` wrapper:
- `frameloop="always"` with `document.hidden` check in `useFrame` to pause when tab not visible
- Perspective camera at `[0, 2, 8]` looking at origin
- Ambient light (0.4) + point light ([0, 4, 0], gold tint, 0.6)
- drei `OrbitControls` with `autoRotate` (0.2 speed), `enableZoom={false}`, `enablePan={false}`
- Renders `ServiceCluster` for each cluster
- Renders `ClusterEdge` for each connection pair
- Manages `selectedClusterId` state and `frameloopMode` state (`useState<'always' | 'demand'>('always')`) — pass `frameloopMode` as `<Canvas frameloop={frameloopMode}>` so React re-renders the Canvas prop when it changes
- **Must check `document.hidden` in the auto-rotation `useFrame` callback** and skip rotation updates when the tab is not visible (prevents GPU waste on background tabs)
- On cluster click: sets `frameloopMode` to `'demand'`, disables auto-rotate on `OrbitControls`, animates camera to zoom in on cluster (GSAP tweening `camera.position` and `controls.target`), renders `ClusterDetail`
- On deselect (click empty / Escape): animates camera back, re-enables auto-rotate, sets `frameloopMode` back to `'always'`

- [ ] **Step 5: Commit**

```bash
git add src/components/aws/ServiceCluster.tsx src/components/aws/ClusterEdge.tsx src/components/aws/ClusterDetail.tsx src/components/aws/TopologyScene.tsx
git commit -m "feat: add 3D R3F topology scene components for AWS page"
```

---

## Task 10: Build InfraTopology Container and Keyboard Overlay

**Files:**
- Create: `src/components/aws/InfraTopology.tsx`

- [ ] **Step 1: Create InfraTopology container**

Create `src/components/aws/InfraTopology.tsx`. The main container that:
- Imports `checkWebGLSupport` from `src/utils/checkWebGL.ts`
- Imports `useMediaQuery` from `src/hooks/useMediaQuery.ts`
- Checks `const isDesktop = useMediaQuery('(min-width: 768px)')` and `const webglOk = checkWebGLSupport()`
- If `isDesktop && webglOk`: renders `TopologyScene` wrapped in `ErrorBoundary` with explicit JSX: `<ErrorBoundary fallback={<TopologyFallback2D />}><TopologyScene ... /></ErrorBoundary>` (note: `fallback` prop accepts `ReactNode`, so pass JSX element, not component reference)
- Otherwise: renders `<TopologyFallback2D />`
- Includes the accessible HTML button overlay for 3D mode: a `<div>` positioned absolutely over the canvas with `pointer-events: none`, containing `<button>` elements with `pointer-events: auto` for each cluster. **To sync button positions with 3D clusters:** use `three.Vector3.project(camera)` inside a `useFrame` callback to convert each cluster's world position to normalized device coordinates (NDC: -1 to 1), then map to CSS pixel coordinates: `left = (ndc.x + 1) / 2 * canvasWidth`, `top = (-ndc.y + 1) / 2 * canvasHeight`. Store projected positions in a ref array and update the overlay buttons' `style.transform` on each frame. Expose this via a callback ref or shared state between the R3F scene and the HTML overlay.
- Section header: "The Stack" with subtitle "Infrastructure powering thechrisgrey.com"
- Wraps in a `<section>` with gradient divider above

- [ ] **Step 2: Commit**

```bash
git add src/components/aws/InfraTopology.tsx
git commit -m "feat: add InfraTopology container with 3D/2D switching and a11y overlay"
```

---

## Task 11: Integrate Topology Map into AWS Page

**Files:**
- Modify: `src/pages/AWS.tsx`

- [ ] **Step 1: Modify AWS page**

In `src/pages/AWS.tsx`:
1. Import `InfraTopology` from `../components/aws/InfraTopology`
2. Remove the Focus Areas section (the `<section>` containing the 3-column `focusAreas` grid, roughly lines 119-163)
3. Remove the What This Means section (the `<section>` with the timeline items, roughly lines 165-221)
4. Remove the `focusAreas` constant (lines 8-24) since it's no longer used
5. Insert `<InfraTopology />` after the Introduction section (after the closing `</section>` around line 117)

- [ ] **Step 2: Verify full page**

```bash
npm run dev
```

Navigate to `/aws`. Verify: hero, Community Builder banner, intro paragraphs, then the topology map (3D on desktop, 2D on mobile). The old Focus Areas cards and What This Means timeline should be gone.

- [ ] **Step 3: Commit**

```bash
git add src/pages/AWS.tsx
git commit -m "feat: integrate Infrastructure Topology Map into AWS page, remove old template sections"
```

---

## Task 12: Accessibility and Reduced Motion

**Files:**
- Modify: `src/components/claude/ArchitectureXRay.tsx`
- Modify: `src/components/aws/TopologyScene.tsx`
- Modify: `src/components/aws/ClusterEdge.tsx`

- [ ] **Step 1: Add reduced motion support to Claude X-Ray**

In `ArchitectureXRay.tsx`, check `window.matchMedia('(prefers-reduced-motion: reduce)').matches` at the start of `handleTrace`. If true, skip GSAP timeline and set all node states to active instantly, show all latency labels, display response immediately. No sequential animation.

- [ ] **Step 2: Add reduced motion support to AWS topology**

In `TopologyScene.tsx`, pass a `reducedMotion` prop based on the media query. When true: disable auto-rotate on `OrbitControls`, camera fly-to is instant (no GSAP tween). In `ClusterEdge.tsx`, when `reducedMotion` is true, render particles at static positions along the edge (no movement in `useFrame`).

- [ ] **Step 3: Verify accessibility**

Enable "Reduce motion" in macOS System Settings > Accessibility > Display. Navigate to both pages. Verify: no animations play, all content is immediately visible, keyboard navigation works.

- [ ] **Step 4: Commit**

```bash
git add src/components/claude/ArchitectureXRay.tsx src/components/aws/TopologyScene.tsx src/components/aws/ClusterEdge.tsx
git commit -m "feat: add prefers-reduced-motion support to both interactive pages"
```

---

## Task 13: Tests

**Files:**
- Create tests for key components

**Test file locations and Three.js mock pattern:**

All test files follow the `__tests__` convention:
- `src/data/__tests__/architectureNodes.test.ts`
- `src/data/__tests__/infrastructureTopology.test.ts`
- `src/components/claude/__tests__/PipelineNode.test.tsx`
- `src/components/claude/__tests__/ArchitectureXRay.test.tsx`
- `src/components/claude/__tests__/TraceInput.test.tsx`
- `src/components/aws/__tests__/InfraTopology.test.tsx`
- `src/components/aws/__tests__/TopologyFallback2D.test.tsx`

**Three.js/R3F mock pattern** (required for any test rendering R3F components in jsdom):
```typescript
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => <div data-testid="r3f-canvas">{children}</div>,
  useFrame: vi.fn(),
  useThree: vi.fn(() => ({ camera: {}, gl: {} })),
}));
vi.mock('@react-three/drei', () => ({
  OrbitControls: () => null,
  Text: ({ children }: { children: string }) => <span>{children}</span>,
  Html: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Line: () => null,
}));
```

- [ ] **Step 1: Test architecture data integrity**

Create `src/data/__tests__/architectureNodes.test.ts`. Import `pipelineNodes` and `pipelineEdges` and verify: 7 nodes exist, 6 edges exist, every edge references valid node IDs, every node has non-empty config and reasoning.

- [ ] **Step 2: Test infrastructure data integrity**

Create `src/data/__tests__/infrastructureTopology.test.ts`. Import `clusters` and verify: 6 clusters exist, all connections reference valid cluster IDs, every cluster has at least 1 service, positions are unique.

- [ ] **Step 3: Test PipelineNode rendering and states**

Create `src/components/claude/__tests__/PipelineNode.test.tsx`. Tests: renders label/sublabel, dim state has correct styling class, active state has gold styling, keyboard Enter triggers onClick, aria-expanded reflects isExpanded prop.

- [ ] **Step 4: Test ArchitectureXRay node expansion**

Create `src/components/claude/__tests__/ArchitectureXRay.test.tsx`. Tests: renders all 7 node labels, clicking a node shows the detail panel with that node's service name and config, clicking another node swaps the detail panel, pressing Escape closes the panel. Mock GSAP: `vi.mock('gsap', () => ({ default: { from: vi.fn(), to: vi.fn(), timeline: vi.fn(() => ({ to: vi.fn().mockReturnThis(), play: vi.fn() })) }, gsap: { from: vi.fn(), to: vi.fn(), timeline: vi.fn(() => ({ to: vi.fn().mockReturnThis(), play: vi.fn() })) } }))`.

- [ ] **Step 5: Test TraceInput**

Create `src/components/claude/__tests__/TraceInput.test.tsx`. Tests: renders input and button, button disabled when input empty, clicking suggestion fills input and calls onTrace, button enabled when input has text.

- [ ] **Step 6: Test InfraTopology 3D/2D switching**

Create `src/components/aws/__tests__/InfraTopology.test.tsx`. Use the Three.js/R3F mock pattern above. Mock `src/utils/checkWebGL` with `vi.mock('../../../utils/checkWebGL', () => ({ checkWebGLSupport: vi.fn() }))`. Test 1: set `checkWebGLSupport` to return `false`, verify `TopologyFallback2D` renders (look for SVG clusters). Test 2: set to return `true` with desktop media query mocked, verify `TopologyScene` renders (look for `data-testid="r3f-canvas"`).

- [ ] **Step 7: Test TopologyFallback2D cluster expansion**

Create `src/components/aws/__tests__/TopologyFallback2D.test.tsx`. Tests: renders 6 cluster labels, clicking a cluster shows detail panel with service names, clicking another swaps the panel, Escape closes.

- [ ] **Step 8: Run all tests**

```bash
npm run test
```

Expected: All tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/components/claude/__tests__/ src/components/aws/__tests__/ src/data/__tests__/
git commit -m "test: add tests for Architecture X-Ray and Infrastructure Topology"
```

---

## Task 14: Build Verification

- [ ] **Step 1: Run full production build**

```bash
npm run build
```

Expected: Build succeeds with no errors. Check `dist/assets/` for `gsap-vendor-[hash].js` chunk.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: No warnings or errors.

- [ ] **Step 3: Preview production build**

```bash
npm run preview
```

Navigate to `/claude` and `/aws`. Verify both pages work correctly in the production build. Test the live trace on Claude page. Test 3D scene on AWS page.

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address build verification issues"
```
