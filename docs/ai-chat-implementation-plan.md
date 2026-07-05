# AI Chat Implementation Plan

## Amazon Bedrock + Claude Haiku 4.5 via ConverseStream

**Created:** January 2025
**Status:** Implemented
**Model:** Claude Haiku 4.5 via inference profile (`us.anthropic.claude-haiku-4-5-20251001-v1:0`)
**Lambda Function URL:** `https://mrrpf6f34n7vpkolurdc24c5fu0jruad.lambda-url.us-east-1.on.aws/`

---

## Overview

This plan implements a conversational AI chat experience for thechrisgrey.com using **Amazon Bedrock's ConverseStream API** with **Claude Haiku 4.5**, delivered through a **streaming Lambda function URL** to provide real-time word-by-word responses.

The chat allows visitors to conversationally learn about Christian Perez's background, Altivum Inc, The Vector Podcast, and his book "Beyond the Assessment."

---

## Architecture

```
┌─────────────────────┐     ┌─────────────────────────┐     ┌─────────────────┐
│   React Frontend    │────▶│  Lambda Function URL    │────▶│  Amazon Bedrock │
│   (Chat.tsx)        │◀────│  (Response Streaming)   │◀────│  ConverseStream │
└─────────────────────┘     └─────────────────────────┘     └─────────────────┘
         │                            │
         │  Fetch + ReadableStream    │  streamifyResponse()
         │  (real-time streaming)     │  (Node.js 20.x)
         └────────────────────────────┘
```

---

## Key Technical Decisions

| Decision               | Choice                                                           | Rationale                                                                                                   |
| ---------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Bedrock API**        | ConverseStream (not InvokeModel)                                 | Consistent API for conversations, handles message history natively, supports system prompts                 |
| **Model**              | Claude Haiku 4.5 (`us.anthropic.claude-haiku-4-5-20251001-v1:0`) | Latest Haiku model via inference profile - fast responses, cost-effective, excellent for conversational use |
| **Lambda Runtime**     | Node.js 20.x                                                     | Native streaming support via `awslambda.streamifyResponse()`                                                |
| **Invocation Method**  | Lambda Function URL with `RESPONSE_STREAM`                       | Direct streaming without API Gateway complexity                                                             |
| **Frontend Streaming** | Fetch API with ReadableStream                                    | Native browser streaming support, no dependencies                                                           |

---

## Phase 1: Lambda Function (Backend)

### File Structure

```
lambda/
└── chat-stream/
    ├── index.mjs
    └── package.json
```

### Lambda Handler Code (`index.mjs`)

```javascript
import { BedrockRuntimeClient, ConverseStreamCommand } from '@aws-sdk/client-bedrock-runtime';

const client = new BedrockRuntimeClient({ region: 'us-east-1' });
const MODEL_ID = 'us.anthropic.claude-haiku-4-5-20251001-v1:0'; // Inference profile ID

// System prompt defining the AI persona
const SYSTEM_PROMPT = `You are an AI assistant representing Christian Perez (also known as @thechrisgrey). You help visitors learn about his background, work, and expertise.

Key facts about Christian:
- Former U.S. Army Green Beret (Special Forces Medical Sergeant - 18D)
- Founder & CEO of Altivum Inc., a cloud migration and AI integration company
- Host of The Vector Podcast, featuring conversations with veterans and entrepreneurs
- Author of "Beyond the Assessment" - lessons from Special Forces selection and assessment
- Nashville-based veteran entrepreneur

Your tone should be:
- Professional yet approachable
- Conversational and engaging
- Knowledgeable but not boastful
- Helpful and informative

Guidelines:
- Answer questions about Christian's background, Altivum, the podcast, and his book
- If asked about topics you don't have information on, politely redirect to what you do know
- Keep responses concise but informative (2-4 sentences for simple questions)
- For complex topics, provide more detail but stay focused`;

export const handler = awslambda.streamifyResponse(async (event, responseStream, _context) => {
  // Set CORS headers
  const headers = {
    'Content-Type': 'text/plain',
    'Access-Control-Allow-Origin': 'https://thechrisgrey.com',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // Handle preflight
  if (event.requestContext?.http?.method === 'OPTIONS') {
    responseStream.write('');
    responseStream.end();
    return;
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const messages = body.messages || [];

    // Convert messages to Bedrock format
    const bedrockMessages = messages.map((msg) => ({
      role: msg.role,
      content: [{ text: msg.content }],
    }));

    const command = new ConverseStreamCommand({
      modelId: MODEL_ID,
      messages: bedrockMessages,
      system: [{ text: SYSTEM_PROMPT }],
      inferenceConfig: {
        maxTokens: 1024,
        temperature: 0.7,
        topP: 0.9,
      },
    });

    const response = await client.send(command);

    // Stream the response
    for await (const event of response.stream) {
      if (event.contentBlockDelta) {
        const text = event.contentBlockDelta.delta?.text;
        if (text) {
          responseStream.write(text);
        }
      }
    }

    responseStream.end();
  } catch (error) {
    console.error('Error:', error);
    responseStream.write('I apologize, but I encountered an error. Please try again.');
    responseStream.end();
  }
});
```

### Package Dependencies (`package.json`)

```json
{
  "name": "chat-stream-lambda",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "@aws-sdk/client-bedrock-runtime": "^3.x"
  }
}
```

---

## Phase 2: AWS Infrastructure

### Resources to Create

#### 1. IAM Role for Lambda

**Trust Policy:**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

**Permissions Policy:**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
      "Resource": "arn:aws:logs:*:*:*"
    },
    {
      "Effect": "Allow",
      "Action": "bedrock:InvokeModelWithResponseStream",
      "Resource": "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-haiku-4-5-*"
    }
  ]
}
```

#### 2. Lambda Function Configuration

| Setting      | Value         |
| ------------ | ------------- |
| Runtime      | Node.js 20.x  |
| Architecture | arm64         |
| Memory       | 512 MB        |
| Timeout      | 60 seconds    |
| Handler      | index.handler |

#### 3. Lambda Function URL

| Setting            | Value                      |
| ------------------ | -------------------------- |
| Auth Type          | NONE (public)              |
| Invoke Mode        | `RESPONSE_STREAM`          |
| CORS Allow Origin  | `https://thechrisgrey.com` |
| CORS Allow Methods | `POST, OPTIONS`            |
| CORS Allow Headers | `Content-Type`             |

### Deployment Commands

```bash
# Create IAM role
aws iam create-role \
  --role-name chat-stream-lambda-role \
  --assume-role-policy-document file://trust-policy.json

# Attach permissions
aws iam put-role-policy \
  --role-name chat-stream-lambda-role \
  --policy-name chat-stream-permissions \
  --policy-document file://permissions-policy.json

# Create Lambda function
cd lambda/chat-stream
npm install
zip -r function.zip .

aws lambda create-function \
  --function-name thechrisgrey-chat-stream \
  --runtime nodejs20.x \
  --architecture arm64 \
  --handler index.handler \
  --role arn:aws:iam::ACCOUNT_ID:role/chat-stream-lambda-role \
  --zip-file fileb://function.zip \
  --memory-size 512 \
  --timeout 60

# Create Function URL with streaming
aws lambda create-function-url-config \
  --function-name thechrisgrey-chat-stream \
  --auth-type NONE \
  --invoke-mode RESPONSE_STREAM \
  --cors '{
    "AllowOrigins": ["https://thechrisgrey.com"],
    "AllowMethods": ["POST", "OPTIONS"],
    "AllowHeaders": ["Content-Type"]
  }'

# Add resource-based policy for public access
aws lambda add-permission \
  --function-name thechrisgrey-chat-stream \
  --statement-id FunctionURLAllowPublicAccess \
  --action lambda:InvokeFunctionUrl \
  --principal "*" \
  --function-url-auth-type NONE
```

---

## Phase 3: Frontend Integration

### Update `src/pages/Chat.tsx`

Replace mock responses with actual Bedrock streaming:

```typescript
const CHAT_ENDPOINT = import.meta.env.VITE_CHAT_ENDPOINT;

const handleSend = async (content: string) => {
  // Add user message to state
  const userMessage: Message = {
    id: `user-${Date.now()}`,
    role: 'user',
    content,
    timestamp: new Date(),
  };

  setMessages((prev) => [...prev, userMessage]);
  setShowSuggestions(false);
  setIsTyping(true);

  // Prepare conversation history for API
  const conversationHistory = [...messages, userMessage].map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));

  // Create placeholder for assistant response
  const assistantMessageId = `assistant-${Date.now()}`;
  setMessages((prev) => [
    ...prev,
    {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    },
  ]);
  setIsTyping(false);

  try {
    const response = await fetch(CHAT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: conversationHistory }),
    });

    if (!response.ok) throw new Error('Failed to get response');

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });

        // Append chunk to the assistant message
        setMessages((prev) =>
          prev.map((msg) => (msg.id === assistantMessageId ? { ...msg, content: msg.content + chunk } : msg)),
        );
      }
    }
  } catch (error) {
    console.error('Chat error:', error);
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === assistantMessageId
          ? { ...msg, content: 'I apologize, but I encountered an error. Please try again.' }
          : msg,
      ),
    );
  }
};
```

### Environment Variable

Add to AWS Amplify Console environment variables:

```
VITE_CHAT_ENDPOINT=https://xxxxxxxx.lambda-url.us-east-1.on.aws/
```

---

## Phase 4: System Prompt Refinement

The system prompt should be refined based on testing. Key areas to include:

### Christian Perez Background

- Military service details (Green Beret, 18D Medical Sergeant)
- Transition from military to tech entrepreneurship
- Current role as Altivum CEO

### Altivum Inc

- Cloud migration services
- AI integration capabilities
- Target clients and industries
- Company mission and values

### The Vector Podcast

- Show format and typical guests
- Key themes discussed
- Where to listen

### Beyond the Assessment

- Book overview and themes
- Key lessons from Special Forces selection
- Target audience

---

## Implementation Order

| Step | Task                                        | Estimated Effort |
| ---- | ------------------------------------------- | ---------------- |
| 1    | Create Lambda function code locally         | 30 min           |
| 2    | Create IAM role with required permissions   | 15 min           |
| 3    | Deploy Lambda function                      | 15 min           |
| 4    | Configure Function URL with RESPONSE_STREAM | 10 min           |
| 5    | Test Lambda endpoint with curl              | 15 min           |
| 6    | Add VITE_CHAT_ENDPOINT to Amplify           | 5 min            |
| 7    | Update Chat.tsx with streaming fetch        | 45 min           |
| 8    | Test end-to-end streaming                   | 30 min           |
| 9    | Refine system prompt based on testing       | 1 hour           |
| 10   | Deploy and verify production                | 15 min           |

---

## Cost Estimates

### Claude Haiku 4.5 Pricing (Bedrock)

- Input: $0.80 / 1M tokens
- Output: $4.00 / 1M tokens

### Example Usage

- Average conversation: ~500 input tokens, ~300 output tokens
- Cost per conversation: ~$0.0016
- 1,000 conversations/month: ~$1.60

### Lambda Costs

- 512 MB, ~5 seconds per request
- 1,000 requests/month: ~$0.05

**Total estimated monthly cost for 1,000 conversations: ~$2**

---

## Security Considerations

1. **No authentication on Lambda URL** - acceptable for public chat feature
2. **CORS restricted** to `https://thechrisgrey.com` only
3. **No sensitive data** in system prompt or responses
4. **Rate limiting** - consider adding if abuse occurs
5. **Input validation** - Lambda validates message format

---

## Testing Checklist

- [ ] Lambda function deploys successfully
- [ ] Function URL returns streaming response
- [ ] CORS headers work from production domain
- [ ] Frontend displays streaming text in real-time
- [ ] Conversation history maintained across turns
- [ ] Error handling displays user-friendly messages
- [ ] Mobile responsive layout works
- [ ] System prompt produces appropriate responses

---

## Future Enhancements

1. **Rate limiting** - Add per-IP rate limiting if needed
2. **Analytics** - Track conversation topics and user engagement
3. **Feedback** - Allow users to rate responses
4. **Extended knowledge** - Add more detailed information to system prompt
5. **Guardrails** - Consider Bedrock Guardrails for content filtering
