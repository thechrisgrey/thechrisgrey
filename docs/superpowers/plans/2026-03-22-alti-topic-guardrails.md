# Alti Topic Guardrails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent Alti from answering off-topic questions by adding topic boundaries to the system prompt and hard-blocking never-relevant categories via Bedrock guardrails.

**Architecture:** Dual-layer approach — system prompt handles nuanced contextual judgment (warm redirects for grey-area questions), Bedrock guardrails hard-block categories that are never relevant (coding, trivia, creative writing, other public figures). The Lambda handler is the only code change; the guardrail update is an AWS infrastructure change.

**Tech Stack:** AWS Lambda (Node.js ESM), Amazon Bedrock Guardrails, AWS CLI

**Spec:** `docs/superpowers/specs/2026-03-22-alti-topic-guardrails-design.md`

---

### Task 1: Update Bedrock Guardrail — Remove Old Denied Topic

**Context:** The existing guardrail (`5kofhp46ssob`, version 1) has a vague "Off-topic technical support" denied topic that isn't catching relevant queries. We need to remove it before adding the four new specific topics.

- [ ] **Step 1: List the current guardrail configuration to confirm current state**

```bash
aws bedrock get-guardrail --guardrail-identifier 5kofhp46ssob --guardrail-version 1 --region us-east-1
```

Expected: JSON output showing the guardrail config with the "Off-topic technical support" topic in `topicPolicyConfig.topicsConfig`.

- [ ] **Step 2: Update the guardrail — remove "Off-topic technical support" and add four new denied topics**

Use `aws bedrock update-guardrail` with the full topic policy. The command must include ALL topics (both existing ones to keep and new ones to add). The four new denied topics are:

1. **Programming and code assistance** — "Requests to write, debug, review, or explain code in any programming language"
2. **General knowledge and trivia** — "Questions about science, history, geography, math, or academic subjects with no connection to Christian Perez's background, career, or areas of expertise"
3. **Creative content generation** — "Requests to write poems, stories, essays, emails, resumes, cover letters, or other documents"
4. **Other public figures** — "Questions about celebrities, politicians, business leaders, or public figures other than Christian Perez"

Keep these existing topics unchanged:
- Illegal activities
- Professional advice

The exact CLI command depends on the current guardrail's full config (content filters, word filters, etc.) — those must be preserved in the update call. Use the output from Step 1 to construct the full `update-guardrail` command, keeping all existing content filters, word policy, and sensitive information config intact.

The `--topic-policy-config` JSON must use this structure (each topic needs `name`, `definition`, `examples`, and `type`):

```json
{
  "topicsConfig": [
    {
      "name": "Programming and code assistance",
      "definition": "Requests to write, debug, review, or explain code in any programming language",
      "examples": ["Write me a Python function", "Debug this JavaScript error", "Explain how recursion works", "Help me with my React component"],
      "type": "DENY"
    },
    {
      "name": "General knowledge and trivia",
      "definition": "Questions about science, history, geography, math, or academic subjects with no connection to Christian Perez's background, career, or areas of expertise",
      "examples": ["What is the capital of France", "Explain quantum computing", "How does photosynthesis work", "What year did World War 1 start"],
      "type": "DENY"
    },
    {
      "name": "Creative content generation",
      "definition": "Requests to write poems, stories, essays, emails, resumes, cover letters, or other documents",
      "examples": ["Write me a poem", "Help me with my resume", "Draft an email to my boss", "Write a short story about space"],
      "type": "DENY"
    },
    {
      "name": "Other public figures",
      "definition": "Questions about celebrities, politicians, business leaders, or public figures other than Christian Perez",
      "examples": ["Tell me about Elon Musk", "Who is the president", "What does Jeff Bezos do", "Compare Christian to Mark Zuckerberg"],
      "type": "DENY"
    },
    {
      "name": "Illegal activities",
      "definition": "Requests for information about illegal activities, hacking, or causing harm",
      "examples": ["How to hack a website", "How to make illegal substances", "How to bypass security"],
      "type": "DENY"
    },
    {
      "name": "Professional advice",
      "definition": "Requests for professional legal, medical, or financial advice",
      "examples": ["Should I invest in stocks", "What medication should I take", "Is this legal", "Give me tax advice"],
      "type": "DENY"
    }
  ]
}
```

For `--content-policy-config` and `--word-policy-config`, copy the exact JSON structure from the Step 1 `get-guardrail` output, preserving all existing filters.

**Note:** The `--blocked-input-messaging` and `--blocked-outputs-messaging` values are intentionally kept in sync with the Lambda's guardrail intervention handler at line 469 of `index.mjs`. In practice, the Lambda handler catches guardrail interventions first via the stream metadata and sends its own message — the guardrail's blocked messaging is a fallback for edge cases where the Lambda handler doesn't intercept the intervention.

```bash
aws bedrock update-guardrail \
  --guardrail-identifier 5kofhp46ssob \
  --name <current-name-from-step-1> \
  --description <current-description-from-step-1> \
  --blocked-input-messaging "I'm here to help you learn about Christian Perez and his work. I'm not able to help with that particular request. Is there something about his background or career I can help you with?" \
  --blocked-outputs-messaging "I'm here to help you learn about Christian Perez and his work. I'm not able to help with that particular request. Is there something about his background or career I can help you with?" \
  --topic-policy-config file://topic-policy.json \
  --content-policy-config '<preserve from Step 1 output>' \
  --word-policy-config '<preserve from Step 1 output>' \
  --region us-east-1
```

Expected: Success response with the updated guardrail ARN.

- [ ] **Step 3: Publish the updated guardrail as version 2**

```bash
aws bedrock create-guardrail-version --guardrail-identifier 5kofhp46ssob --region us-east-1
```

Expected: Response showing `"version": "2"`.

- [ ] **Step 4: Verify the new version**

```bash
aws bedrock get-guardrail --guardrail-identifier 5kofhp46ssob --guardrail-version 2 --region us-east-1
```

Expected: JSON showing all six denied topics (4 new + 2 kept), no "Off-topic technical support", all content filters preserved.

- [ ] **Step 5: Commit — no code changes in this task, but note completion**

No files changed. This is an infrastructure-only task.

---

### Task 2: Update Lambda System Prompt

**Files:**
- Modify: `lambda/chat-stream/index.mjs:130-150` (BASE_SYSTEM_PROMPT)

- [ ] **Step 1: Replace the BASE_SYSTEM_PROMPT**

In `lambda/chat-stream/index.mjs`, replace the entire `BASE_SYSTEM_PROMPT` constant (lines 130-150) with:

```javascript
const BASE_SYSTEM_PROMPT = `You are Alti, Christian Perez's AI assistant on thechrisgrey.com. Your purpose is to help visitors learn about Christian — his background, career, companies, content, and perspective.

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
- Don't answer questions about other public figures, general trivia, coding help, or topics unrelated to Christian`;
```

- [ ] **Step 2: Verify the edit**

Read back the file to confirm the new prompt is correctly placed and the surrounding code (`SYSTEM_MESSAGE_PREFIX`, `SIGNING_KEY`) is untouched.

- [ ] **Step 3: Commit**

```bash
git add lambda/chat-stream/index.mjs
git commit -m "feat: add topic boundaries to Alti system prompt

Replace permissive general-knowledge instruction with contextual leash:
Alti can explain concepts in context of Christian's story but redirects
standalone off-topic questions with a warm personality redirect."
```

---

### Task 3: Update Lambda Guardrail Version

**Files:**
- Modify: `lambda/chat-stream/index.mjs:67` (GUARDRAIL_VERSION)

**Depends on:** Task 1 (guardrail version 2 must exist in Bedrock)

- [ ] **Step 1: Update GUARDRAIL_VERSION from "1" to "2"**

In `lambda/chat-stream/index.mjs` line 67, change:

```javascript
// Before
const GUARDRAIL_VERSION = "1";

// After
const GUARDRAIL_VERSION = "2";
```

- [ ] **Step 2: Commit**

```bash
git add lambda/chat-stream/index.mjs
git commit -m "feat: bump guardrail version to 2

Points Lambda at the updated Bedrock guardrail with four new denied
topic categories replacing the vague 'Off-topic technical support'."
```

---

### Task 4: Deploy Lambda

**Depends on:** Tasks 1, 2, 3

- [ ] **Step 1: Install dependencies (ensures lambda-shared is bundled)**

```bash
cd lambda/chat-stream && npm install
```

Expected: Clean install, `node_modules/lambda-shared/` present.

- [ ] **Step 2: Create deployment zip**

```bash
cd lambda/chat-stream && zip -r function.zip index.mjs package.json node_modules
```

Expected: `function.zip` created.

- [ ] **Step 3: Deploy to AWS Lambda**

```bash
aws lambda update-function-code --function-name thechrisgrey-chat-stream --zip-file fileb://lambda/chat-stream/function.zip --region us-east-1
```

Expected: Success response with updated `LastModified` timestamp.

- [ ] **Step 4: Clean up deployment artifact**

```bash
rm lambda/chat-stream/function.zip
```

---

### Task 5: Manual Testing

**Depends on:** Task 4

Run these tests against the live chat at `https://thechrisgrey.com/chat` (or via direct Lambda invocation). Wait ~30 seconds after deploy for the Lambda to pick up the new code.

- [ ] **Step 1: Test system-prompt redirects (standalone off-topic)**

Ask: "What is a Route 53 resolver?"
Expected: Warm redirect — Alti acknowledges the topic and pivots back to Christian.

Ask: "What is an AWS User Group?" (no prior conversation about AWS)
Expected: Warm redirect.

- [ ] **Step 2: Test contextual leash (in-context general knowledge)**

First ask: "Tell me about Christian's AWS work"
Then ask: "What is an AWS User Group?"
Expected: Brief explanation in context of the conversation, since it connects to Christian's AWS Community Builder role.

- [ ] **Step 3: Test guardrail hard blocks**

Ask: "Write me a Python function to sort a list"
Expected: Hard block — guardrail intervention message.

Ask: "What is the capital of France?"
Expected: Hard block.

Ask: "Tell me about Elon Musk"
Expected: Hard block.

Ask: "Write me a cover letter"
Expected: Hard block.

- [ ] **Step 4: Test happy path (on-topic questions)**

Ask: "How did Christian go from Green Beret to tech CEO?"
Expected: Normal conversational answer.

Ask: "What drives Altivum's mission?"
Expected: Normal conversational answer.

- [ ] **Step 5: Test borderline case**

Ask: "What happened during the Global War on Terror?" (standalone)
Expected: Warm redirect from system prompt. Guardrail should NOT hard-block this (it's adjacent to Christian's military service). If the guardrail blocks it, this indicates the "General knowledge" topic definition needs narrowing.

---

### Task 6: Update CLAUDE.md Documentation

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the guardrail version reference**

Find the line referencing guardrail version 1 and update to version 2.

- [ ] **Step 2: Update the denied topics list**

Replace the current denied topics list:
```
- Denied topics: Off-topic technical support, illegal activities, professional advice
```

With:
```
- Denied topics: Programming and code assistance, general knowledge and trivia, creative content generation, other public figures, illegal activities, professional advice
```

- [ ] **Step 3: Update the system prompt description**

In the "Response Guidelines" section under the Alti chat documentation, add a note about the contextual leash behavior:
```
- Topic boundaries: Alti answers questions about Christian Perez only; general concepts are allowed in conversational context but standalone off-topic questions get a warm redirect
```

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for guardrail v2 and topic boundaries

Reflect new denied topic categories, guardrail version bump, and
contextual leash behavior in system prompt documentation."
```
