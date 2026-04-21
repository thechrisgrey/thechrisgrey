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
