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
