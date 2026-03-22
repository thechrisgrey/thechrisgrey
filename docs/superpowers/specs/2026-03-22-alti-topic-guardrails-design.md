# Alti Topic Guardrails — Design Spec

## Problem

Alti (the AI chat assistant on thechrisgrey.com) answers questions that are completely unrelated to Christian Perez. For example, a visitor can ask "What is a Route 53 resolver on AWS?" and get a full answer. While rate limiting prevents cost abuse, it looks unprofessional for a personal-brand chatbot to function as a general-purpose assistant.

The root cause is a permissive line in the system prompt:

> "You can use your general knowledge to explain concepts (like what an AWS User Group is) while keeping Christian-specific details accurate to the context provided."

This gives the model a green light to answer any general knowledge question.

## Design Decision: Contextual Leash

Alti should not refuse all general knowledge — that would hurt the UX. Instead, it operates on a **contextual leash**:

- **In context:** If a visitor asks a general concept as a natural follow-up in an ongoing conversation about Christian (e.g., "What is an AWS User Group?" while discussing his Community Builder role), Alti can briefly explain it.
- **Out of context:** If a question has no thread back to Christian, Alti redirects warmly — acknowledging what they asked, then pivoting back to its domain.

## Redirect Tone

Warm personality redirect. Alti acknowledges the question without being dismissive, then pivots naturally like a good host:

> "Route 53 is definitely interesting stuff, but I'm really best at talking about Christian and what he's building. Anything about Altivum or his background I can help with?"

## Architecture: Dual-Layer Enforcement

Two layers handle topic relevance with different responsibilities:

| Layer | Role | Handles |
|---|---|---|
| **System prompt** (soft, contextual) | Nuanced judgment about conversational context | Grey areas where the same question might be allowed or redirected depending on conversation flow |
| **Bedrock guardrails** (hard, categorical) | Hard floor for categories that are never relevant | Obviously off-topic requests like coding help, trivia, creative writing |

The system prompt does the heavy lifting. The guardrails catch what should never reach the model's judgment at all.

## Change 1: System Prompt Rewrite

**File:** `lambda/chat-stream/index.mjs` — `BASE_SYSTEM_PROMPT` constant

**Current prompt (replace entirely):**

```
You are Christian Perez's AI assistant. Help visitors learn about him in a natural, conversational way.

HOW TO RESPOND:
- Talk like a professional colleague who knows Christian well - warm but polished
- Answer the question directly, then stop - don't volunteer extra information unless asked
- Pick the most interesting or relevant detail, not every detail you know
- Sound knowledgeable and approachable, not like a Wikipedia article or a bar conversation
- It's okay to be brief - if they want more, they'll ask follow-up questions

FORMATTING:
- Plain text only, no markdown formatting
- No bullet points or lists in your responses
- Write naturally, not in structured paragraphs

WHAT TO AVOID:
- Don't over-explain or pad your responses
- Don't use phrases like "What makes this meaningful is..." or "Beyond the technical work..."
- Don't include multiple topic areas in one response unless directly asked
- Never fabricate specifics about Christian

You can use your general knowledge to explain concepts (like what an AWS User Group is) while keeping Christian-specific details accurate to the context provided.
```

**New prompt:**

```
You are Alti, Christian Perez's AI assistant on thechrisgrey.com. Your purpose is to help visitors learn about Christian — his background, career, companies, content, and perspective.

TOPIC BOUNDARIES:
- Your domain is Christian Perez — everything you know about him and all the information specifically about him that you have access to.
- If a visitor asks about a general concept that connects naturally to the current conversation about Christian, you can briefly explain it to keep the conversation flowing. For example, if you're discussing his AWS Community Builder role and they ask "What is an AWS User Group?", a short explanation in that context is fine.
- If a question has no connection to Christian or the current conversation, do not answer it. Instead, redirect warmly — acknowledge what they asked, then pivot back to what you know best. For example: "Route 53 is definitely interesting stuff, but I'm really best at talking about Christian and what he's building. Anything about Altivum or his background I can help with?"
- Never act as a general-purpose assistant, tutor, coder, or search engine.

HOW TO RESPOND:
- Talk like a professional colleague who knows Christian well — warm but polished
- Answer the question directly, then stop — don't volunteer extra information unless asked
- Pick the most interesting or relevant detail, not every detail you know
- Sound knowledgeable and approachable, not like a Wikipedia article or a bar conversation
- It's okay to be brief — if they want more, they'll ask follow-up questions

FORMATTING:
- Plain text only, no markdown formatting
- No bullet points or lists in your responses
- Write naturally, not in structured paragraphs

WHAT TO AVOID:
- Don't over-explain or pad your responses
- Don't use phrases like "What makes this meaningful is..." or "Beyond the technical work..."
- Don't include multiple topic areas in one response unless directly asked
- Never fabricate specifics about Christian
- Don't answer questions about other public figures, general trivia, coding help, or topics unrelated to Christian
```

### Key changes from current prompt

1. **Removed** the permissive general-knowledge line that caused the problem
2. **Added** `TOPIC BOUNDARIES` section with the contextual leash rule
3. **Added** explicit redirect example with warm personality tone
4. **Added** hard "never" line at the bottom of WHAT TO AVOID for off-topic categories
5. **Renamed** identity from generic "Christian Perez's AI assistant" to "Alti"

## Change 2: Bedrock Guardrail Update

**Guardrail:** `5kofhp46ssob`

### Remove

- "Off-topic technical support" (too vague, not catching relevant queries)

### Add denied topics

| Denied Topic | Definition |
|---|---|
| **Programming and code assistance** | Requests to write, debug, review, or explain code in any programming language |
| **General knowledge and trivia** | Questions about science, history, geography, math, or academic subjects with no connection to Christian Perez's background, career, or areas of expertise |
| **Creative content generation** | Requests to write poems, stories, essays, emails, resumes, cover letters, or other documents |
| **Other public figures** | Questions about celebrities, politicians, business leaders, or public figures other than Christian Perez |

### Keep unchanged

- Illegal activities
- Professional advice (legal, medical, financial)
- All content filters (PROMPT_ATTACK HIGH, HATE HIGH, INSULTS HIGH, SEXUAL HIGH, VIOLENCE MEDIUM, MISCONDUCT MEDIUM)
- Profanity word filter

### Version bump

- Publish updated guardrail as **version 2**
- Update `GUARDRAIL_VERSION` in `lambda/chat-stream/index.mjs` from `"1"` to `"2"`

### Why these categories are safe to hard-block

These four topics have zero overlap with legitimate conversations about Christian Perez. There is no scenario where "Write me a Python sort function" or "Who is Elon Musk?" is a natural follow-up in a conversation about Christian's background. Grey areas (like general AWS concepts in context) are handled by the system prompt, not the guardrails.

## Rollback

If the new guardrails are too aggressive in production, rollback requires only reverting `GUARDRAIL_VERSION` to `"1"` and restoring the previous `BASE_SYSTEM_PROMPT` in `index.mjs`, then redeploying the Lambda. Guardrail version 1 remains in Bedrock and does not need to be recreated.

## Deployment

Two changes, combinable into a single Lambda deploy:

1. **Bedrock guardrail** — Update via AWS console or CLI, publish as version 2
2. **Lambda** — Edit `BASE_SYSTEM_PROMPT` and `GUARDRAIL_VERSION` in `index.mjs`, redeploy:

```bash
cd lambda/chat-stream
npm install
zip -r function.zip index.mjs package.json node_modules
aws lambda update-function-code --function-name thechrisgrey-chat-stream --zip-file fileb://function.zip --region us-east-1
```

## No frontend changes required

- Suggested prompts in `ChatSuggestions.tsx` are already on-topic
- The guardrail intervention message in the Lambda already has a good redirect
- No UI changes needed
- No existing tests are affected by these changes (frontend `useChatEngine.test.ts` is unrelated; Lambda has no unit tests)

## Post-Deployment Documentation

Update `CLAUDE.md` to reflect:
- New guardrail version (`2` instead of `1`)
- Revised denied topics list (remove "Off-topic technical support", add the four new categories)
- The contextual leash behavior in the system prompt description

## Testing

Manual validation against the live Lambda after deployment:

| Test Case | Expected Behavior | Layer |
|---|---|---|
| "What is a Route 53 resolver?" (standalone) | Warm redirect | System prompt |
| "What is an AWS User Group?" (standalone) | Warm redirect | System prompt |
| "What is an AWS User Group?" (after discussing his AWS work) | Brief explanation in context | System prompt allows |
| "Write me a Python function to sort a list" | Hard block | Guardrail |
| "What is the capital of France?" | Hard block | Guardrail |
| "Tell me about Elon Musk" | Hard block | Guardrail |
| "Write me a cover letter" | Hard block | Guardrail |
| "How did Christian go from Green Beret to tech CEO?" | Normal answer | Both allow |
| "What drives Altivum's mission?" | Normal answer | Both allow |
| "What's his take on AI and veterans?" | Normal answer | Both allow |
| "What happened during the Global War on Terror?" (standalone) | Warm redirect | System prompt (guardrail should not over-trigger on military history adjacent to Christian's service) |
