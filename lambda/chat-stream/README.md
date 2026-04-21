# chat-stream Lambda

Streaming Lambda for the Alti chat widget. Orchestrates HMAC verification, rate limiting, input validation, Bedrock Knowledge Base retrieval, and Bedrock ConverseStream with guardrails.

## Module Layout

| File | Responsibility |
|------|----------------|
| `index.mjs` | Handler orchestration: SDK clients, request flow, streaming response |
| `agent.mjs` | Strands `BedrockModel` + `Agent` factory + `streamAgentResponse` |
| `events.mjs` | Framed-event writer (`\x00EVT\x00{json}\x00EVT\x00`) |
| `memory.mjs` | DynamoDB helpers for `thechrisgrey-chat-memory` |
| `hmac.mjs` | HMAC-SHA256 signature verification (`verifySignature`) |
| `validation.mjs` | Input/message/pageContext validation |
| `prompts.mjs` | System prompt assembly (base persona + visitor context + memory + retrieved context) |
| `metrics.mjs` | `MetricsCollector` class, batched CloudWatch flush |
| `kbRetrieve.mjs` | Bedrock KB retrieval with timeout + metrics |
| `tools/` | Strands tool factories (see Tools below) |
| `__tests__/` | `node:test` unit tests for each module |
| `__fixtures__/events/` | Sample Lambda Function URL events |

## Tools

| Tool | Enabled when | Description |
|------|--------------|-------------|
| `navigate_to` | always | Suggests a whitelisted route; emits `draft_action{action:"navigate"}` |
| `draft_message` | always | Drafts a contact form prefill (speaking, podcast, consulting, collaboration, media, general) |
| `draft_newsletter_subscription` | always | Suggests newsletter subscription; emits `draft_action{action:"newsletter"}` |
| `cite_blog_passage` | `sanityClient` configured | Fetches a specific blog post by slug and emits a citation card |
| `search_blog` | `sanityClient` configured | Searches posts by keyword across title/excerpt/body/tags; emits `draft_action{action:"blog_search_results"}` with up to 5 matches |
| `remember_fact` | `docClient` + `deviceId` | Persists a short fact per-device in DynamoDB (90-day TTL) |

External AWS SDK clients (`BedrockRuntimeClient`, `BedrockAgentRuntimeClient`, `DynamoDBDocumentClient`, `CloudWatchClient`) are constructed in `index.mjs` and injected into the module functions. Modules never import the SDK command classes directly — they receive them as arguments. This keeps modules testable with plain fakes.

## Running Tests

```bash
npm run test:lambda
```

Runs `node --test` against `lambda/chat-stream/__tests__/*.test.mjs`. No external AWS calls.

## Deployment

```bash
cd lambda/chat-stream
npm install
zip -r function.zip index.mjs agent.mjs events.mjs memory.mjs hmac.mjs validation.mjs prompts.mjs metrics.mjs kbRetrieve.mjs tools package.json node_modules
aws lambda update-function-code \
  --function-name thechrisgrey-chat-stream \
  --zip-file fileb://function.zip \
  --region us-east-1
```
