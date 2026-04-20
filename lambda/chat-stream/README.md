# chat-stream Lambda

Streaming Lambda for the Alti chat widget. Orchestrates HMAC verification, rate limiting, input validation, Bedrock Knowledge Base retrieval, and Bedrock ConverseStream with guardrails.

## Module Layout

| File | Responsibility |
|------|----------------|
| `index.mjs` | Handler orchestration: SDK clients, request flow, streaming response |
| `hmac.mjs` | HMAC-SHA256 signature verification (`verifySignature`) |
| `validation.mjs` | Input/message/pageContext validation |
| `prompts.mjs` | System prompt assembly (base persona + visitor context + retrieved context) |
| `metrics.mjs` | `MetricsCollector` class, batched CloudWatch flush |
| `kbRetrieve.mjs` | Bedrock KB retrieval with timeout + metrics |
| `__tests__/` | `node:test` unit tests for each module |
| `__fixtures__/events/` | Sample Lambda Function URL events |

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
zip -r function.zip index.mjs hmac.mjs validation.mjs prompts.mjs metrics.mjs kbRetrieve.mjs package.json node_modules
aws lambda update-function-code \
  --function-name thechrisgrey-chat-stream \
  --zip-file fileb://function.zip \
  --region us-east-1
```
