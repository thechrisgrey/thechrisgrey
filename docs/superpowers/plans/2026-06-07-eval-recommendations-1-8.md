# Eval Recommendations 1–8 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the eight verified improvements from the codebase evaluation — fix a chat-bricking conversation bug, close a silent rate-limit/IAM security gap, make the SEO/structured-data layer crawlable, stop shipping the Cognito SDK on every page, unit-test the rate limiter + close CI gaps, contain WebGL failures, harden the chat streaming channel, and fix the prose linkifier.

**Architecture:** Each recommendation is an independent, separately-committable change. The frontend changes are React 19 + Vite client logic with vitest coverage; the backend changes are Node-20 ESM Lambda code with `node --test` coverage; one change (Rec 3) adds a Puppeteer prerender step to the build pipeline. Every fix is grounded in real, line-verified current code and uses strict TDD ordering where a test is meaningful, and "change → verify with an explicit command" where it is not (IAM, env, docs, CI yaml, build scripts).

**Tech Stack:** React 19, TypeScript, Vite 5, Tailwind, react-helmet-async, GSAP/Lenis, Three.js/R3F; AWS Lambda (Node 20 ESM) on Bedrock (Strands SDK), DynamoDB, Cognito, Amplify; Sanity CMS; vitest + @testing-library, `node:test`, Cypress; Puppeteer (new, Rec 3).

---

## How to use this plan

1. **Read this front-matter first — it is authoritative.** Where it conflicts with a numbered section below, this front-matter wins. It exists because the eight sections were drafted in parallel and several edit the same files; a plan-integrity review found the collisions and the corrections collected here.
2. Implement in the **Execution Order** below, not numeric order. The sections are printed in numeric order (1→8) for reference, but several must land in a specific sequence to avoid stale-context edits.
3. Before each edit to a **shared file** (`src/hooks/useChatEngine.ts`, `lambda/metrics/index.mjs`, `package.json`, `src/pages/Home.tsx`, `src/components/chat/ChatWidgetButton.tsx`, `src/components/aws/TopologyScene.tsx`), **re-Read the file** — an earlier recommendation may have shifted line numbers.
4. Apply the **Per-Recommendation Corrections** before/while executing the affected section.

---

## Execution Order

Implement in this order (rationale from the integrity review):

| Step | Rec   | Title                         | Why here                                                                                     | Hard dependency |
| ---- | ----- | ----------------------------- | -------------------------------------------------------------------------------------------- | --------------- |
| 1    | **1** | Empty-assistant-message bug   | Highest impact/effort; live bug; pure client logic; must precede Rec 7 (shared `handleSend`) | none            |
| 2    | **2** | Metrics IAM gap + drift check | HIGH security, LOW effort; land before Rec 5 (both edit `metrics/index.mjs`)                 | none            |
| 3    | **8** | Linkifier word-boundary       | Smallest self-contained win; no shared files                                                 | none            |
| 4    | **7** | Streaming hardening (×3)      | Shares `useChatEngine.ts` with Rec 1 — must follow it                                        | **Rec 1**       |
| 5    | **5** | Rate-limiter tests + CI       | Follows Rec 2 (both touch `metrics/index.mjs`); extends `package.json`                       | **Rec 2**       |
| 6    | **6** | SafeCanvas + WebGL gate       | Lands the reconciled `Home.tsx`/`ChatWidgetButton.tsx` first                                 | none            |
| 7    | **3** | Prerender step                | Highest effort/risk; layers `isPrerender()` onto Rec 6's reconciled files                    | **Rec 6**       |
| 8    | **4** | Cognito bundle + doc drift    | Lowest urgency; touches `package.json` last (after 2,3,5)                                    | none            |

**`package.json` is edited by Recs 2, 3, 5, and (optionally) 4.** Re-Read it before each edit. The edits are to different keys (`iam:drift` add, `build` line, `test:lambda` glob, optional `sideEffects`) so they do not overlap, but stale context will break an Edit.

---

## Cross-Section Reconciliations (authoritative)

### CR-1 — `src/components/chat/ChatWidgetButton.tsx`: merge Rec 6 + Rec 3 (do NOT apply both verbatim)

Rec 6 (Task 6.2) and Rec 3 (Task 3.2) both fully rewrite this 25-line file with **incompatible** results. Because Rec 6 runs first (Step 6) and Rec 3 second (Step 7), apply **Rec 6's full rewrite** (SafeCanvas + `checkWebGLSupport()` gate + a clickable `MascotFallback`), then when you reach Rec 3, do **NOT** re-apply Rec 3's standalone `{!isPrerender() && <Suspense>…}` version. Instead make this single additive change to the Rec-6 file:

- Add the import: `import { isPrerender } from '../../utils/prerender';` (the util created in Rec 3 Task 3.1).
- Fold `!isPrerender()` into the gate Rec 6 established. The reconciled gate (using `SafeCanvas` + `MascotFallback` exactly as Rec 6 Task 6.1/6.2 defines them) is:

```tsx
const ChatWidgetButton = ({ isOpen, onClick }: ChatWidgetButtonProps) => {
  const showMascot = checkWebGLSupport() && !isPrerender();
  return (
    <button
      onClick={onClick}
      aria-label={isOpen ? 'Close chat' : 'Open chat'}
      aria-expanded={isOpen}
      className="fixed bottom-6 right-6 z-40 flex items-center justify-center cursor-pointer bg-transparent border-none p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-altivum-gold focus-visible:ring-offset-2 focus-visible:ring-offset-altivum-dark"
    >
      {showMascot ? (
        <SafeCanvas fallback={<MascotFallback isOpen={isOpen} />}>
          <Suspense fallback={null}>
            <AltiMascot isOpen={isOpen} />
          </Suspense>
        </SafeCanvas>
      ) : (
        <MascotFallback isOpen={isOpen} />
      )}
    </button>
  );
};
```

(If `MascotFallback` in Rec 6 takes no `isOpen` prop, drop it — match Rec 6 Task 6.2's exact signature.) The fallback is the clickable static icon from **Rec 6**, not Rec 3's `null`.

### CR-2 — `src/pages/Home.tsx` hero region (current lines 117–126): merge Rec 6 + Rec 3

Same collision. Apply Rec 6's version first, then add `!isPrerender()`. The reconciled hero backdrop block (replacing current lines 117–126) is:

```tsx
{
  /* Living "signal field" backdrop. Mounted only when motion is allowed,
            WebGL is supported, and we are not prerendering. */
}
{
  !reducedMotion && checkWebGLSupport() && !isPrerender() && (
    <div className="absolute inset-0" aria-hidden="true">
      <SafeCanvas fallback={null}>
        <Suspense fallback={null}>
          <HeroCanvas heroRef={heroRef} />
        </Suspense>
      </SafeCanvas>
    </div>
  );
}
```

Required imports at the top of `Home.tsx` (combine — do not let Rec 3 drop `Suspense`): keep `Suspense` from `react`, and add `import SafeCanvas from '../components/SafeCanvas';` (Rec 6), `import { checkWebGLSupport } from '../utils/checkWebGL';` (Rec 6), `import { isPrerender } from '../utils/prerender';` (Rec 3). `HeroCanvas`'s fallback stays `null` because the base gradient at line 115 is the resting look (verified).

### CR-3 — `src/components/aws/TopologyScene.tsx`: do the recon once

Rec 3 (Task 3.2 Step 3) adds `if (isPrerender()) return null;` and Rec 6 (Task 6.5, optional) widens the `frameloop` union to include `'never'` + a visibility listener. They do not overlap line-for-line, but **read the file once** and apply both during Rec 6's pass; in Rec 3, only add the `isPrerender()` guard. Resolve the placeholder flagged in PRC-3a below before writing the guard.

### CR-4 — `src/hooks/useChatEngine.ts`: Rec 1 fully before Rec 7

Rec 1 edits the history builder (147–157) and the `firstOutput` block (303–314); Rec 7 (Task 7.2) edits the `finally` (348–353) and captures `myController`/`myId` near 133–135/159–161. They do not overlap, but **land all of Rec 1 first (including optional Task 1.3 if you take the `crypto.randomUUID()` id change), then re-Read the file and re-confirm Rec 7's line numbers** before applying the `finally` guard. Rec 7 already declares this dependency.

### CR-5 — `lambda/metrics/index.mjs`: Rec 2 before Rec 5

Rec 2 adds `requestId,` to the two `checkRateLimit` call sites (228–234, 248–254). Rec 5 extracts validation helpers and rewrites `handleVitals`/`handleCspReport`. The regions differ, but land Rec 2's small diff first; Rec 5 then re-quotes the requestId-bearing call sites. (Rec 5's `handleVitals` "before" block does not include the call sites, so it is unaffected — but re-Read before editing.)

### CR-6 — Combined imports on the reconciled files

After CR-1/CR-2, both `ChatWidgetButton.tsx` and `Home.tsx` import **both** `checkWebGLSupport` (Rec 6, `src/utils/checkWebGL.ts`) **and** `isPrerender` (Rec 3, `src/utils/prerender.ts`). They are distinct concerns (GPU capability vs build-time prerender). Use the import lists given in CR-1/CR-2 verbatim.

---

## Per-Recommendation Corrections (apply before/while executing)

These fix concrete defects the integrity review found. **Apply them — the affected section's prose is otherwise wrong on these points.**

**PRC-2a (Rec 2, `scripts/iam-drift.sh` MAP):** The section's `MAP` array hardcodes `metrics → thechrisgrey-metrics-role / metrics-policy`, which is **unverified in-repo**, yet Task 2.3 Step 4's "Expected output" asserts an `OK` line for it. Before trusting that output, discover the real role/policy names with `aws lambda get-function-configuration --function-name thechrisgrey-metrics --query 'Role' --output text` (the role ARN tail) and `aws iam list-role-policies --role-name <thatRole>`. Until verified, treat a `metrics` ERROR/`drift` line as expected, not a failure. Apply the same verify-first rule to `kb-sync` and `mcp-server` rows.

**PRC-3a (Rec 3, TopologyScene prerender guard):** The section says "wrap the `<Canvas>` so that when `isPrerender()` is true the component returns `null` … verify it is already conditionally rendered … if TopologyScene is the only mount, return the fallback instead." Resolve the ambiguity concretely: `src/components/aws/InfraTopology.tsx` already gates on `checkWebGLSupport()` and renders `TopologyFallback2D` otherwise. Add the same fallback for prerender by editing **`InfraTopology.tsx`** (the mount/decision point), not `TopologyScene.tsx`: change its gate to render `TopologyFallback2D` when `!checkWebGLSupport() || isPrerender()`. Read `InfraTopology.tsx` to confirm the exact gate expression, then make one literal before→after edit.

**PRC-3b (Rec 3, false DRY claim):** The section claims `scripts/prerender.js` "reuses the EXACT Sanity GROQ query and staticPages list" from `generate-sitemap.js`, but as written it **hardcodes its own copies** (`generate-sitemap.js` exports neither). Pick one: **(preferred)** refactor `scripts/generate-sitemap.js` to `export const STATIC_ROUTES` and `export const BLOG_SLUGS_QUERY`, and have both `generate-sitemap.js` and `prerender.js` import them — then add a one-line assertion/test that the two consumers use the shared constants; **or** delete the DRY claim and add a code comment in both files: `// KEEP IN SYNC with scripts/prerender.js (no shared export yet)`. Do not ship the plan asserting DRY it does not implement.

**PRC-3c (Rec 3, non-deterministic rAF guidance):** Replace the "if the title is still generic, bump the double-rAF or the timeout" trial-and-error step with a deterministic ready signal: in `src/main.tsx`, after mount, set `window.__PRERENDER_READY__ = true` from a `react-helmet-async` `onChangeClientState` callback (fires after Helmet flushes to `<head>`), and have `prerender.js` `await page.waitForFunction('window.__PRERENDER_READY__ === true', { timeout: 15000 })`. No rAF guessing.

**PRC-3d (Rec 3, amplify.yml customRules):** Task 3.7 says "update amplify.yml to the same three-rule order above" without the literal content. The Amplify rewrite must serve real files first, then fall through to the SPA shell. Provide the literal `customRules` (mirror `public/_redirects` exactly): a rule that excludes paths with a file extension / existing assets from the `/index.html 200` catch-all so prerendered `dist/<route>/index.html` is served. Read the current `amplify.yml` rewrite block (and `public/_redirects`) and give the exact before→after for both, not "same as above."

**PRC-3e (Rec 3, window-stub test isolation):** Task 3.1's third test stubs the whole `window` object via `vi.stubGlobal('window', {})`, which can poison the shared jsdom global for later files. Stub only the needed properties (`vi.stubGlobal('location', { search: '' })` etc.) and call `vi.unstubAllGlobals()` in `afterEach`. Verify all three `isPrerender()` tests pass after implementation and that no later test file regresses.

**PRC-5a (Rec 5, unused `value` → lint failure):** The `handleVitals` rewrite destructures `const { name, value } = body;` but only uses `name`. `npm run lint:lambda` runs with `--max-warnings 0`, so the unused `value` fails the lint step. Use `const { name } = body;` (or read `name` inline). Confirm `npm run lint:lambda` is clean before the commit step.

**PRC-5b (Rec 5, vite preview env + teardown):** Task 5.5's local smoke command backgrounds `vite preview` with no teardown in the chained command and runs `npm run build`, which requires all `VITE_*` vars via `scripts/validate-env.js`. State the prerequisite: a populated `.env.local` (or exported vars) must exist, and add an explicit `kill %1` / trap so a mid-chain failure doesn't leak the preview server. The CI job itself (the real deliverable) is fine; this is only the local smoke step.

**PRC-6a (Rec 6, contradictory `beforeEach`):** Task 6.2 Step 1 gives two conflicting `beforeEach` bodies ("add one line" vs "reorder if needed"). The real `ChatWidgetButton.test.tsx` already has `reducedMotionRef` set then `vi.clearAllMocks()`. Make ONE exact edit: place `mockedCheckWebGL.mockReturnValue(true)` **after** `vi.clearAllMocks()` (because `clearAllMocks` resets the return value). Final `beforeEach`:

```ts
beforeEach(() => {
  vi.clearAllMocks();
  mockedCheckWebGL.mockReturnValue(true);
});
```

(Adapt to the file's existing `reducedMotionRef` line if present — keep it, just ensure the `mockReturnValue` is the last statement.)

**PRC notes (low severity, no action required but be aware):** Rec 1's second test asserts `body.messages` deep-equals exactly two user turns (brittle if a future change adds message fields — fine today). Rec 2's Task 2.2 test is a source-grep guard, not a behavioral test (acceptable given the module-singleton constraint). Rec 6 Task 6.2 already has `userEvent` imported at line 3 — do not re-import.

---

## Detailed Task Sections (numeric order — see Execution Order above for sequence)

Each section below is the granular, line-verified task list for one recommendation. Remember: the front-matter above overrides any section where they conflict (CR-* and PRC-*).

---

## Recommendation 1: Fix the empty-assistant-message conversation-poisoning bug

**Why it matters:** When a turn produces no assistant text (guardrail/empty-response path), `useChatEngine` leaves an empty `content:''` assistant placeholder in state; it is replayed in the next request body and the Lambda's `validateInput` rejects any empty-content message, so `response.ok` is false and every subsequent message fails until the user manually clears the conversation. The same builder also replays system/error bubbles (`role:'assistant'`, non-empty content) back into model context, polluting it.

**Impact:** High (chat bricks for the visitor) · **Effort:** Low (~2 small edits + tests) · **Risk:** Low (pure client logic, fully unit-testable)

**Depends on:** none

**Files**

- Modify: `src/hooks/useChatEngine.ts`
  - History builder, lines 147–157 (filter both empty-content and `isSystem` messages)
  - End-of-turn `firstOutput` cleanup, lines 303–314 (remove the dead empty placeholder)
  - (Optional) id generation, lines 138 & 159 (`crypto.randomUUID()`)
- Test: `src/hooks/useChatEngine.test.ts` (new regression tests; existing coverage at line 505 and 576–614 remains valid)

Reference — current code being changed (verified line numbers):

```ts
// src/hooks/useChatEngine.ts:147-157  (history builder)
const allMessages = [...messagesRef.current.filter((m) => m.id !== 'welcome'), userMessage];
const windowed = allMessages.length > MAX_HISTORY ? allMessages.slice(allMessages.length - MAX_HISTORY) : allMessages;
const conversationHistory = windowed.map((msg) => ({
  role: msg.role,
  content: msg.content,
}));
```

```ts
// src/hooks/useChatEngine.ts:303-314  (end-of-turn, no output produced)
if (firstOutput) {
  setIsTyping(false);
  setMessages((prev) => [
    ...prev,
    {
      id: assistantMessageId,
      role: 'assistant' as const,
      content: 'I received an empty response. Please try again.',
      timestamp: new Date(),
    },
  ]);
}
```

Note for the implementer: the Lambda's guardrail/empty-text path (`lambda/chat-stream/index.mjs:310-332`) does NOT emit raw text — it sends a `GUARDRAIL` event plus a `\x00SYS\x00`-framed system message. The client's stream parser turns the SYS frame into a `part.kind === 'system'`, which `applyText(text, true)` (line 208) appends as a NEW message with `isSystem:true` (it does not fill the `assistantMessageId` placeholder). So on a guardrail turn, `firstOutput` becomes `false` (the SYS part counts as output), the `assistantMessageId` placeholder is created empty by `ensureMessage()` at line 274, and it lingers — that is the exact bubble we must drop. The history filter fix (Task 1.1) prevents replay; the cleanup fix (Task 1.2) removes the dead empty bubble from view.

---

### Task 1.1: Filter empty-content and system messages out of the outgoing history (TDD)

- [ ] **Step 1: Write a failing regression test for the lingering empty placeholder.** Append this `describe` block at the end of `src/hooks/useChatEngine.test.ts`, immediately before the file's final closing `});` of the top-level `describe('useChatEngine', ...)`. It simulates a guardrail turn (SYS system message only, no text) for message #1, then sends message #2 and asserts the request body contains NO empty-content message.

```ts
describe('conversation-poisoning regression', () => {
  it('should not replay a lingering empty assistant placeholder in the next request', async () => {
    const encoder = new TextEncoder();
    const SYSTEM_PREFIX = '\x00SYS\x00';

    // Turn 1: backend empty-response path — only a SYS system message, no text.
    const guardrailReader = {
      read: vi
        .fn()
        .mockResolvedValueOnce({
          done: false,
          value: encoder.encode(`${SYSTEM_PREFIX}I couldn't put together a response just now. Mind rephrasing?`),
        })
        .mockResolvedValue({ done: true, value: undefined }),
    };
    // Turn 2: normal text reply.
    const normalReader = {
      read: vi
        .fn()
        .mockResolvedValueOnce({ done: false, value: encoder.encode('Sure thing') })
        .mockResolvedValue({ done: true, value: undefined }),
    };

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, body: { getReader: () => guardrailReader } })
      .mockResolvedValueOnce({ ok: true, body: { getReader: () => normalReader } });
    vi.stubGlobal('fetch', mockFetch);

    const { result } = renderHook(() => useChatEngine());

    await act(async () => {
      await result.current.handleSend('first');
    });
    await act(async () => {
      await result.current.handleSend('second');
    });

    // The SECOND request body must not carry any empty-content message,
    // and must not carry the system/error string as a fake assistant turn.
    const secondBody = JSON.parse(mockFetch.mock.calls[1][1].body);
    expect(secondBody.messages.some((m: { content: string }) => m.content.trim().length === 0)).toBe(false);
    expect(
      secondBody.messages.some((m: { content: string }) => m.content.includes("couldn't put together a response")),
    ).toBe(false);
  });

  it('should not replay isSystem error bubbles as assistant turns', async () => {
    const mockReader = {
      read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
    };
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      body: { getReader: () => mockReader },
    });
    vi.stubGlobal('fetch', mockFetch);

    // Seed sessionStorage with a non-empty isSystem assistant bubble.
    window.sessionStorage.setItem(
      CHAT_STORAGE_KEY,
      JSON.stringify([
        initialWelcomeMessage,
        { id: 'user-1', role: 'user', content: 'earlier', timestamp: new Date() },
        {
          id: 'system-1',
          role: 'assistant',
          content: 'Rate limit exceeded.',
          timestamp: new Date(),
          isSystem: true,
        },
      ]),
    );

    const { result } = renderHook(() => useChatEngine());

    await act(async () => {
      await result.current.handleSend('again');
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.messages.some((m: { content: string }) => m.content === 'Rate limit exceeded.')).toBe(false);
    // The real prior user turn is preserved.
    expect(body.messages).toEqual([
      { role: 'user', content: 'earlier' },
      { role: 'user', content: 'again' },
    ]);
  });
});
```

- [ ] **Step 2: Run the new tests, expect FAIL.** The history builder currently only strips `id === 'welcome'`, so the empty placeholder and the `Rate limit exceeded.` bubble both leak into the body.

```bash
npx vitest run src/hooks/useChatEngine.test.ts -t "conversation-poisoning regression"
```

Expected: 2 failing tests (e.g. `expected true to be false` on the empty-content / system-bubble assertions).

- [ ] **Step 3: Implement the sharpened filter.** Edit the history builder at `src/hooks/useChatEngine.ts:147-150` to also drop empty-trimmed-content messages and any `isSystem` message.

```ts
const allMessages = [
  ...messagesRef.current.filter((m) => m.id !== 'welcome' && !m.isSystem && m.content.trim().length > 0),
  userMessage,
];
```

- [ ] **Step 4: Run the new tests, expect PASS.**

```bash
npx vitest run src/hooks/useChatEngine.test.ts -t "conversation-poisoning regression"
```

Expected: `2 passed`.

- [ ] **Step 5: Run the full file to confirm no regression** (welcome-strip test at line 505, system-message tests at 576–614, and MAX_HISTORY windowing must still pass).

```bash
npx vitest run src/hooks/useChatEngine.test.ts
```

Expected: all tests pass (the suite count goes up by 2).

- [ ] **Step 6: Commit.**

```bash
git add src/hooks/useChatEngine.ts src/hooks/useChatEngine.test.ts && git commit -m "fix(chat): drop empty + system messages from outgoing history to prevent conversation poisoning

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 1.2: Remove the dead empty assistant placeholder at end of a no-text turn (TDD)

On a guardrail turn the SYS frame flips `firstOutput` to `false`, so the `firstOutput` recovery block at lines 303–314 never runs — yet `ensureMessage()` already created an empty `assistantMessageId` bubble (line 274) that now renders as a blank assistant message. Add a defensive cleanup so no dead empty bubble remains in React state.

- [ ] **Step 1: Write a failing test for the rendered dead bubble.** Append this test inside the `describe('conversation-poisoning regression', ...)` block added in Task 1.1.

```ts
it('should not leave a blank assistant bubble after a system-only turn', async () => {
  const encoder = new TextEncoder();
  const SYSTEM_PREFIX = '\x00SYS\x00';
  const reader = {
    read: vi
      .fn()
      .mockResolvedValueOnce({
        done: false,
        value: encoder.encode(`${SYSTEM_PREFIX}Rate limit exceeded.`),
      })
      .mockResolvedValue({ done: true, value: undefined }),
  };
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, body: { getReader: () => reader } }));

  const { result } = renderHook(() => useChatEngine());

  await act(async () => {
    await result.current.handleSend('hello');
  });

  // No assistant message should have empty content.
  const blankAssistant = result.current.messages.filter(
    (m: Message) => m.role === 'assistant' && m.content.trim().length === 0,
  );
  expect(blankAssistant).toHaveLength(0);
  // The visible system message is still present.
  expect(result.current.messages.some((m: Message) => m.content === 'Rate limit exceeded.')).toBe(true);
});
```

- [ ] **Step 2: Run the test, expect FAIL.** The empty `assistantMessageId` placeholder created by `ensureMessage()` lingers.

```bash
npx vitest run src/hooks/useChatEngine.test.ts -t "should not leave a blank assistant bubble"
```

Expected: `expected length 1 to be 0` (the blank placeholder is present).

- [ ] **Step 3: Implement the end-of-turn cleanup.** Replace the `if (firstOutput)` block at `src/hooks/useChatEngine.ts:303-314` with one that ALSO prunes the empty placeholder when output WAS produced (the system-only / events-only case). The `assistantMessageId` is in closure scope here.

```ts
if (firstOutput) {
  setIsTyping(false);
  setMessages((prev) => [
    ...prev,
    {
      id: assistantMessageId,
      role: 'assistant' as const,
      content: 'I received an empty response. Please try again.',
      timestamp: new Date(),
    },
  ]);
} else {
  // Output WAS produced (e.g. a SYS system message or events only) but the
  // assistant placeholder created by ensureMessage() never received any text.
  // Drop the dead empty bubble so it neither renders nor poisons history.
  setMessages((prev) => prev.filter((m) => !(m.id === assistantMessageId && m.content.trim().length === 0)));
}
```

- [ ] **Step 4: Run the new test, expect PASS.**

```bash
npx vitest run src/hooks/useChatEngine.test.ts -t "should not leave a blank assistant bubble"
```

Expected: `1 passed`.

- [ ] **Step 5: Run the full file to confirm the streaming, empty-stream, and system-prefix tests still pass.** The `else` branch only removes an EMPTY placeholder, so normal text turns (placeholder filled) and the system-prefix tests (placeholder filled or separate system message) are unaffected.

```bash
npx vitest run src/hooks/useChatEngine.test.ts
```

Expected: all tests pass.

- [ ] **Step 6: Commit.**

```bash
git add src/hooks/useChatEngine.ts src/hooks/useChatEngine.test.ts && git commit -m "fix(chat): prune dead empty assistant placeholder after system-only turns

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 1.3 (Optional): Use crypto.randomUUID() for message ids

Not load-bearing for the poisoning bug — the Task 1.1/1.2 fixes resolve it regardless. The current ids at lines 138 and 159 derive from `Date.now()`; a user turn and assistant turn fired in the same millisecond produce `user-<t>` / `assistant-<t>` (distinct prefixes, so no collision today), but two rapid sends could in principle collide on the same prefix. `crypto.randomUUID()` is available in all evergreen browsers and jsdom.

- [ ] **Step 1: Write a test asserting unique, non-timestamp ids across two sends.** Append inside the `conversation-poisoning regression` block.

```ts
it('should assign unique message ids across rapid sends', async () => {
  const mockReader = {
    read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
  };
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, body: { getReader: () => mockReader } }));

  const { result } = renderHook(() => useChatEngine());

  await act(async () => {
    await result.current.handleSend('one');
  });
  await act(async () => {
    await result.current.handleSend('two');
  });

  const ids = result.current.messages.map((m: Message) => m.id);
  expect(new Set(ids).size).toBe(ids.length); // all unique
});
```

- [ ] **Step 2: Run it (likely already PASSES with timestamp ids).**

```bash
npx vitest run src/hooks/useChatEngine.test.ts -t "should assign unique message ids"
```

Expected: passes today; this test guards against future regressions and documents intent.

- [ ] **Step 3: Switch both id generators to crypto.randomUUID().** Edit `src/hooks/useChatEngine.ts:138`.

```ts
        id: `user-${crypto.randomUUID()}`,
```

And `src/hooks/useChatEngine.ts:159`.

```ts
const assistantMessageId = `assistant-${crypto.randomUUID()}`;
```

- [ ] **Step 4: Run the full file, expect PASS.**

```bash
npx vitest run src/hooks/useChatEngine.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit.**

```bash
git add src/hooks/useChatEngine.ts src/hooks/useChatEngine.test.ts && git commit -m "refactor(chat): generate message ids with crypto.randomUUID

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 1.4: Verify the full build and lint pass

- [ ] **Step 1: Lint.**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 2: Full build (typecheck + vite build pipeline).**

```bash
npm run build
```

Expected: build completes successfully (tsc passes, vite emits `dist/`). No commit needed if Tasks 1.1–1.3 already committed; if the build surfaces any incidental fix, commit it with a `chore(chat): ...` message.

---

## Recommendation 2: Patch the metrics Lambda DynamoDB IAM gap and add an IAM-drift check

**Why it matters:** The metrics Lambda calls `checkRateLimit` (a DynamoDB `UpdateItem`) on two unauthenticated endpoints (`POST /vitals`, `POST /csp-report`), but its IAM policy grants zero DynamoDB actions. Because `checkRateLimit` _fails open_ on any error, rate limiting is silently disabled on both public endpoints today — leaving them open to flooding (200/min and 100/min limits never enforced).

**Impact:** HIGH (security — unauthenticated endpoints with no working rate limit) · **Effort:** LOW · **Risk:** LOW (adds a single scoped IAM action; mirrors a sibling Lambda's proven statement)

**Depends on:** none

**Files:**

- **Modify** `lambda/metrics/iam-policy.json` (currently lines 1–24 — add a third statement)
- **Modify** `lambda/metrics/index.mjs` (lines 228–234 and 248–254 — add `requestId`)
- **Create** `scripts/iam-drift.sh` (new)
- **Modify** `package.json` (scripts block, lines 6–20 — add `iam:drift`)
- **Test** `lambda/metrics/__tests__/iam-policy.test.mjs` (new — validates the merged JSON contract)

**Verified facts (read before authoring):**

- `lambda/metrics/iam-policy.json` has exactly two statements: `CloudWatchMetrics` and `CloudWatchLogs`. No `dynamodb:*`.
- `lambda/kb-builder/iam-policy.json` lines 18–23 contain the correct mirror statement: `Sid: "RateLimitDynamoDB"`, `Action: "dynamodb:UpdateItem"`, `Resource: "arn:aws:dynamodb:us-east-1:205930636302:table/thechrisgrey-chat-ratelimit"`.
- `lambda/shared/rateLimit.mjs` line 82 returns `{ allowed: true, remaining: -1 }` on any non-conditional error (fail-open), and lines 77–81 log structured JSON **only when `requestId` is truthy** (param defined at line 28, `requestId = null`).
- `lambda/metrics/index.mjs` lines 228–234 and 248–254 call `checkRateLimit` _without_ `requestId`. The handler already mints `const requestId = randomUUID();` at line 221 — it's in scope but unused at both call sites.
- `lambda/chat-stream/index.mjs` line 161–168 is the reference pattern: it passes `requestId` into `checkRateLimit`.
- **AWS CLI verified** (docs.aws.amazon.com, AWS CLI 2.34.63 reference): `aws iam get-role-policy --role-name <v> --policy-name <v>` and `aws iam put-role-policy --role-name <v> --policy-name <v> --policy-document <v>` (all three `put` flags required).
- **Role-name trap (confirmed):** docs say chat-stream's role is `chat-stream-lambda-role` but CLAUDE.md (line 95) says the _real_ role is `thechrisgrey-chat-stream-role`. Documented policy names also vary (`kb-builder-policy`, `thechrisgrey-blueprint-policy`, `chat-stream-permissions`). The `metrics`, `kb-sync`, and `mcp-server` role/policy names are **not documented anywhere in the repo**. A naive `thechrisgrey-<dir>-role` loop would mis-target. The drift script therefore uses an explicit, hand-verified map and **skips** any unmapped Lambda instead of guessing.

---

### Task 2.1: Patch `lambda/metrics/iam-policy.json` to add the scoped DynamoDB statement

This is a static JSON contract file (the desired-state source of truth that Task 2.3 diffs against), so use the change → verify pattern, not TDD.

- [ ] **Step 1: Add the `RateLimitDynamoDB` statement (mirror of kb-builder).** Edit `lambda/metrics/iam-policy.json`. Change the close of the `CloudWatchLogs` statement to append a third statement:

```json
    {
      "Sid": "CloudWatchLogs",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:us-east-1:205930636302:log-group:/aws/lambda/thechrisgrey-metrics:*"
    },
    {
      "Sid": "RateLimitDynamoDB",
      "Effect": "Allow",
      "Action": "dynamodb:UpdateItem",
      "Resource": "arn:aws:dynamodb:us-east-1:205930636302:table/thechrisgrey-chat-ratelimit"
    }
  ]
}
```

The full merged file must read exactly:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CloudWatchMetrics",
      "Effect": "Allow",
      "Action": ["cloudwatch:PutMetricData", "cloudwatch:GetMetricStatistics"],
      "Resource": "*"
    },
    {
      "Sid": "CloudWatchLogs",
      "Effect": "Allow",
      "Action": ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
      "Resource": "arn:aws:logs:us-east-1:205930636302:log-group:/aws/lambda/thechrisgrey-metrics:*"
    },
    {
      "Sid": "RateLimitDynamoDB",
      "Effect": "Allow",
      "Action": "dynamodb:UpdateItem",
      "Resource": "arn:aws:dynamodb:us-east-1:205930636302:table/thechrisgrey-chat-ratelimit"
    }
  ]
}
```

- [ ] **Step 2: Verify the file is valid JSON and contains the new statement.** Run:

```bash
node -e "const p=require('./lambda/metrics/iam-policy.json'); const s=p.Statement.find(x=>x.Sid==='RateLimitDynamoDB'); if(!s) throw new Error('missing'); console.log(JSON.stringify({action:s.Action, resource:s.Resource}))"
```

Expected output (exactly):

```
{"action":"dynamodb:UpdateItem","resource":"arn:aws:dynamodb:us-east-1:205930636302:table/thechrisgrey-chat-ratelimit"}
```

- [ ] **Step 3: Confirm it matches the kb-builder mirror byte-for-byte (action + resource).** Run:

```bash
node -e "const a=require('./lambda/metrics/iam-policy.json').Statement.find(x=>x.Sid==='RateLimitDynamoDB'); const b=require('./lambda/kb-builder/iam-policy.json').Statement.find(x=>x.Sid==='RateLimitDynamoDB'); console.log(a.Action===b.Action && a.Resource===b.Resource ? 'MATCH' : 'MISMATCH')"
```

Expected output:

```
MATCH
```

- [ ] **Step 4: Commit.**

```bash
git add lambda/metrics/iam-policy.json && git commit -m "fix(metrics): grant dynamodb:UpdateItem so rate limiting actually enforces

The metrics Lambda calls checkRateLimit (DynamoDB UpdateItem on
thechrisgrey-chat-ratelimit) for POST /vitals and POST /csp-report, but
its IAM policy granted only CloudWatch + Logs. checkRateLimit fails open
on error, so rate limiting was silently disabled on two unauthenticated
endpoints. Mirror the RateLimitDynamoDB statement from kb-builder.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2.2: Pass `requestId` into both metrics `checkRateLimit` calls (TDD)

`requestId` makes DynamoDB errors structured-log as JSON (`{ requestId, event: "rate_limit_error", error }`) instead of plain `console.error`, matching chat-stream. The handler already declares `requestId` at line 221.

- [ ] **Step 1: Write a failing test that asserts both call sites forward `requestId`.** Create `lambda/metrics/__tests__/requestId-propagation.test.mjs`. It mocks `checkRateLimit` via a captured spy through dependency injection — but since `index.mjs` imports `checkRateLimit` directly (not injected), the cheapest reliable check is a static-source assertion that both call sites include `requestId,`. Write:

```mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, '..', 'index.mjs'), 'utf8');

test('both checkRateLimit calls forward requestId', () => {
  // Each call block ends with "});" — count blocks that contain "requestId,"
  const callBlocks = src.split('checkRateLimit(docClient, UpdateCommand, {').slice(1);
  assert.equal(callBlocks.length, 2, 'expected exactly 2 checkRateLimit call sites');
  for (const [i, block] of callBlocks.entries()) {
    const body = block.slice(0, block.indexOf('});'));
    assert.ok(/\brequestId,/.test(body), `checkRateLimit call #${i + 1} must pass requestId,`);
  }
});
```

- [ ] **Step 2: Run the test, expect FAIL.**

```bash
node --test lambda/metrics/__tests__/requestId-propagation.test.mjs
```

Expected: a failing assertion like `checkRateLimit call #1 must pass requestId,` (exit code 1, `# fail 1`).

- [ ] **Step 3: Add `requestId` to the `/vitals` call site.** In `lambda/metrics/index.mjs`, change the block at lines 228–234:

```mjs
const { allowed: vitalsAllowed } = await checkRateLimit(docClient, UpdateCommand, {
  table: 'thechrisgrey-chat-ratelimit',
  ip: clientIp,
  prefix: 'metrics-vitals-',
  maxRequests: 200,
  windowSeconds: 60,
});
```

to:

```mjs
const { allowed: vitalsAllowed } = await checkRateLimit(docClient, UpdateCommand, {
  table: 'thechrisgrey-chat-ratelimit',
  ip: clientIp,
  prefix: 'metrics-vitals-',
  maxRequests: 200,
  windowSeconds: 60,
  requestId,
});
```

- [ ] **Step 4: Add `requestId` to the `/csp-report` call site.** In the same file, change the block at lines 248–254:

```mjs
const { allowed: cspAllowed } = await checkRateLimit(docClient, UpdateCommand, {
  table: 'thechrisgrey-chat-ratelimit',
  ip: clientIp,
  prefix: 'metrics-csp-',
  maxRequests: 100,
  windowSeconds: 60,
});
```

to:

```mjs
const { allowed: cspAllowed } = await checkRateLimit(docClient, UpdateCommand, {
  table: 'thechrisgrey-chat-ratelimit',
  ip: clientIp,
  prefix: 'metrics-csp-',
  maxRequests: 100,
  windowSeconds: 60,
  requestId,
});
```

- [ ] **Step 5: Run the test, expect PASS.**

```bash
node --test lambda/metrics/__tests__/requestId-propagation.test.mjs
```

Expected: `# pass 1` `# fail 0` (exit code 0).

- [ ] **Step 6: Lint the Lambda to confirm no regressions.**

```bash
npm run lint:lambda
```

Expected: no output / exit code 0 (ESLint passes with `--max-warnings 0`).

- [ ] **Step 7: Commit.**

```bash
git add lambda/metrics/index.mjs lambda/metrics/__tests__/requestId-propagation.test.mjs && git commit -m "fix(metrics): forward requestId into rate-limit checks for structured logs

Mirrors chat-stream so DynamoDB rate-limit errors on /vitals and
/csp-report log as {requestId, event:rate_limit_error, error} instead of
plain console.error, enabling log correlation.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2.3: Add a safe, non-auto-applying IAM-drift check

The script DIFFs each Lambda's committed `iam-policy.json` (desired state) against the live inline policy fetched with `aws iam get-role-policy`. It **never** calls `put-role-policy` and **never** derives role names from directory names. Role/policy names come from an explicit, hand-verified map; unmapped Lambdas are reported and skipped.

- [ ] **Step 1: Create `scripts/iam-drift.sh`.** Write exactly:

```bash
#!/usr/bin/env bash
#
# Detect drift between each Lambda's committed iam-policy.json (desired state)
# and the live INLINE policy on its IAM role. READ-ONLY: never calls
# put-role-policy. Role/policy names are an explicit, hand-verified map — we do
# NOT derive them from directory names (e.g. chat-stream's role is
# `thechrisgrey-chat-stream-role`, not `thechrisgrey-chat-stream-role` derivable
# safely, and docs disagree). Unmapped Lambdas are reported and skipped.
#
# Usage:
#   bash scripts/iam-drift.sh              # check all mapped Lambdas
#   npm run iam:drift
#
# Exit code 0 = no drift across all checked Lambdas; 1 = drift or fetch error.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# dir|role-name|policy-name   (verified against docs/ runbooks + CLAUDE.md)
MAP=(
  "metrics|thechrisgrey-metrics-role|metrics-policy"
  "kb-builder|thechrisgrey-kb-builder-role|kb-builder-policy"
  "chat-stream|thechrisgrey-chat-stream-role|chat-stream-permissions"
  "blueprint|thechrisgrey-blueprint-role|thechrisgrey-blueprint-policy"
)

# Lambdas with iam-policy.json but NO verified role/policy mapping yet.
# Listed explicitly so we report (not silently ignore) them.
UNMAPPED=("kb-sync" "mcp-server")

lookup() {  # $1=dir field -> echoes "role|policy" or empty
  local dir="$1" entry
  for entry in "${MAP[@]}"; do
    [ "${entry%%|*}" = "$dir" ] && { echo "${entry#*|}"; return 0; }
  done
  return 1
}

DRIFT=0
for dir in "$ROOT"/lambda/*/; do
  name="$(basename "$dir")"
  policy_file="$dir/iam-policy.json"
  [ -f "$policy_file" ] || continue

  if rolepol="$(lookup "$name")"; then
    role="${rolepol%%|*}"; policy="${rolepol#*|}"
  else
    echo "SKIP   $name — no verified role/policy mapping (add to MAP after confirming the real role name)"
    continue
  fi

  echo "==> $name  (role=$role policy=$policy)"
  live="$(aws iam get-role-policy --role-name "$role" --policy-name "$policy" \
            --query 'PolicyDocument' --output json 2>/tmp/iam-drift.err)"
  if [ $? -ne 0 ]; then
    echo "ERROR  $name — get-role-policy failed: $(cat /tmp/iam-drift.err)"
    DRIFT=1; continue
  fi

  # Normalize both sides (sorted keys) so formatting differences don't show as drift.
  desired="$(node -e "process.stdout.write(JSON.stringify(require('$policy_file'),Object.keys(require('$policy_file')).sort()))")"
  livenorm="$(printf '%s' "$live" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const o=JSON.parse(s);process.stdout.write(JSON.stringify(o,Object.keys(o).sort()))})")"

  if [ "$desired" = "$livenorm" ]; then
    echo "OK     $name — live inline policy matches iam-policy.json"
  else
    echo "DRIFT  $name — live inline policy differs from iam-policy.json"
    diff <(printf '%s' "$desired"  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.stringify(JSON.parse(s),null,2)))") \
         <(printf '%s' "$livenorm" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.stringify(JSON.parse(s),null,2)))") \
      || true
    DRIFT=1
  fi
done

for u in "${UNMAPPED[@]}"; do
  echo "SKIP   $u — has iam-policy.json but role name unverified; not checked"
done

[ "$DRIFT" -eq 0 ] && echo "All checked Lambdas: no drift." || echo "Drift or errors detected."
exit "$DRIFT"
```

> Note: the `metrics-policy`, `metrics`, `kb-sync`, and `mcp-server` role/policy names are unverified in-repo. Before the first real run, confirm the metrics role/policy via `aws lambda get-function-configuration --function-name thechrisgrey-metrics --region us-east-1 --query Role` (gives the role ARN) and `aws iam list-role-policies --role-name <role>` (gives the inline policy name), then correct the `MAP` entry. Until verified, leaving the wrong name simply produces an `ERROR ... get-role-policy failed` line — never a silent mis-target and never a write.

- [ ] **Step 2: Make it executable and confirm it parses (no live AWS call).** Run:

```bash
chmod +x scripts/iam-drift.sh && bash -n scripts/iam-drift.sh && echo "SYNTAX OK"
```

Expected output:

```
SYNTAX OK
```

- [ ] **Step 3: Add the `iam:drift` npm script.** In `package.json`, inside `"scripts"` (lines 6–20), add the line after `"deploy:lambda"`:

```json
    "deploy:lambda": "bash scripts/deploy-lambda.sh",
    "iam:drift": "bash scripts/iam-drift.sh"
```

- [ ] **Step 4: Verify the script is wired and lists the right targets (dry, no AWS needed for the skip path).** Run:

```bash
npm run iam:drift 2>&1 | grep -E "^(SKIP|==>|ERROR)" | head
```

Expected (the `==>` lines appear for mapped Lambdas; AWS errors are fine here if creds/role names aren't live yet — the point is the script reaches each target without mis-deriving names):

```
==> blueprint  (role=thechrisgrey-blueprint-role policy=thechrisgrey-blueprint-policy)
==> chat-stream  (role=thechrisgrey-chat-stream-role policy=chat-stream-permissions)
==> kb-builder  (role=thechrisgrey-kb-builder-role policy=kb-builder-policy)
==> metrics  (role=thechrisgrey-metrics-role policy=metrics-policy)
SKIP   kb-sync — has iam-policy.json but role name unverified; not checked
SKIP   mcp-server — has iam-policy.json but role name unverified; not checked
```

- [ ] **Step 5: Commit.**

```bash
git add scripts/iam-drift.sh package.json && git commit -m "chore(iam): add read-only iam:drift check (no auto put-role-policy)

Diffs each Lambda's committed iam-policy.json against the live inline
policy via aws iam get-role-policy. Role/policy names come from an
explicit verified map — never derived from directory names — and
unmapped Lambdas (kb-sync, mcp-server) are reported and skipped. Never
writes IAM.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2.4: Apply the metrics IAM fix to the live role (one-time MANUAL step)

This is the only step that mutates AWS. It is intentionally NOT in the default `iam:drift` path. `aws iam put-role-policy` flags verified against the AWS CLI 2.34.63 reference: `--role-name`, `--policy-name`, `--policy-document` are all required.

- [ ] **Step 1: Discover the metrics Lambda's real role name and inline policy name (do not assume).** Run:

```bash
aws lambda get-function-configuration --function-name thechrisgrey-metrics --region us-east-1 --query 'Role' --output text
```

Expected output (an ARN; capture the trailing role name, e.g. `thechrisgrey-metrics-role`):

```
arn:aws:iam::205930636302:role/thechrisgrey-metrics-role
```

Then list its inline policy name:

```bash
aws iam list-role-policies --role-name thechrisgrey-metrics-role --query 'PolicyNames' --output text
```

Expected output (the inline policy name to reuse, e.g.):

```
metrics-policy
```

> If either real name differs from `thechrisgrey-metrics-role` / `metrics-policy`, substitute it in Steps 2–3 below **and** correct the `MAP` entry in `scripts/iam-drift.sh` before re-running drift.

- [ ] **Step 2: Apply the patched policy to the live role.** Using the names confirmed in Step 1, run (`file://` reads the committed JSON so live state == repo state):

```bash
aws iam put-role-policy \
  --role-name thechrisgrey-metrics-role \
  --policy-name metrics-policy \
  --policy-document file://lambda/metrics/iam-policy.json
```

Expected output: **no output** and exit code 0 (`put-role-policy` returns empty on success).

- [ ] **Step 3: Verify the live role now grants `dynamodb:UpdateItem` and that drift is clean.** Run:

```bash
aws iam get-role-policy \
  --role-name thechrisgrey-metrics-role \
  --policy-name metrics-policy \
  --query "PolicyDocument.Statement[?Sid=='RateLimitDynamoDB'].[Action,Resource]" \
  --output text
```

Expected output:

```
dynamodb:UpdateItem	arn:aws:dynamodb:us-east-1:205930636302:table/thechrisgrey-chat-ratelimit
```

Then confirm the drift check reports OK for metrics:

```bash
npm run iam:drift 2>&1 | grep metrics
```

Expected output:

```
==> metrics  (role=thechrisgrey-metrics-role policy=metrics-policy)
OK     metrics — live inline policy matches iam-policy.json
```

- [ ] **Step 4: Smoke-test rate limiting is now live (optional but recommended).** Hit `POST /vitals` past the 200/min limit and confirm the 201st returns HTTP 429 (substitute the real `VITE_METRICS_ENDPOINT` value):

```bash
for i in $(seq 1 201); do
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$VITE_METRICS_ENDPOINT/vitals" \
    -H "Content-Type: application/json" -d '{"name":"LCP","value":1}')
done
echo "last request status: $code"
```

Expected output (the final request is throttled now that the DynamoDB grant exists):

```
last request status: 429
```

> No commit for this task — it is a live AWS mutation, not a repo change. The repo source of truth (`iam-policy.json`) was already committed in Task 2.1.

---

**Done-when:** `lambda/metrics/iam-policy.json` carries the `RateLimitDynamoDB` statement; both `checkRateLimit` calls in `lambda/metrics/index.mjs` pass `requestId`; `node --test lambda/metrics/__tests__/requestId-propagation.test.mjs` passes; `npm run iam:drift` reports `OK metrics`; and a 201-request burst against `/vitals` returns 429.

---

## Recommendation 3: Add a post-build prerender step for crawler / social / LLM visibility

**Why it matters:** This is a pure client-side-rendered SPA — `public/_redirects` serves the generic `index.html` for every route (its hardcoded `og:url`/`og:title` point at the homepage), and all per-route SEO is injected at runtime by `react-helmet-async` (`src/components/SEO.tsx`). Non-JS consumers (Open Graph scrapers, the X cardbot, LLM crawlers, first-wave Googlebot) therefore see homepage metadata for _every_ URL, including each `/blog/:slug`, wasting the strong per-page JSON-LD `@graph` (the `BlogPosting` node built in `src/pages/BlogPost.tsx` lines 283-304).

**Impact:** HIGH · **Effort:** MEDIUM (highest in this plan) · **Risk:** MEDIUM (the `_redirects` rewrite shadows prerendered HTML if mis-configured — its own step below).

**Depends on:** none. (Independent of the other recommendations; touches `package.json`'s `build` chain and the 3D mount components.)

**Files:**

- **Create:** `scripts/prerender.js` (new, full content below)
- **Modify:** `package.json` line 8 (insert `prerender` step into `build`)
- **Modify:** `public/_redirects` line 1 (narrow the SPA catch-all so real files win)
- **Modify:** `src/main.tsx` (signal Helmet-ready after first paint, for the crawler to await)
- **Modify:** `src/pages/Home.tsx` line 17 + line ~123 (gate `HeroCanvas` behind prerender flag)
- **Modify:** `src/components/chat/ChatWidgetButton.tsx` lines 18-20 (gate `AltiMascot` behind prerender flag)
- **Modify:** `src/components/aws/TopologyScene.tsx` (gate the AWS topology 3D — verify export shape first)
- **Create:** `src/utils/prerender.ts` (tiny shared `isPrerender()` reader — DRY, one source of truth)
- **Modify:** `package.json` devDependencies (add `puppeteer`)
- **Test:** `src/utils/__tests__/prerender.test.ts` (new)

> Note on the brief: the brief said to insert prerender "before generate-sitemap" — correct, but it must also run **after** `generate-rss` is _not_ required; sitemap/RSS only write XML files and don't depend on per-route HTML, so the safe insertion point is immediately after `vite build` and before `generate-sitemap` (so a prerender failure aborts before we publish a sitemap that points at un-prerendered routes). Also: the brief named `/foundation` is a real static route (sitemap line 28) but `/aws` and `/claude` are _not_ in `generate-sitemap.js`'s `staticPages` — to stay DRY we reuse the sitemap's exact route list, so prerender will cover exactly the 11 static routes + all blog slugs the sitemap already enumerates. `/admin` and `/blueprint` are intentionally excluded (not in the sitemap).

---

### Task 3.1: Add a single-source `isPrerender()` flag the app can read (TDD)

The crawler appends `?prerender=1` to every URL it opens. One helper reads it so the 3D/GSAP mounts can bail. DRY: every gate imports this, no scattered `location.search` parsing.

- [ ] **Step 1: Write the failing test.** Create `src/utils/__tests__/prerender.test.ts`:

```ts
import { describe, it, expect, afterEach, vi } from 'vitest';
import { isPrerender } from '../prerender';

describe('isPrerender', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns true when ?prerender=1 is present', () => {
    vi.stubGlobal('location', { search: '?prerender=1' } as Location);
    expect(isPrerender()).toBe(true);
  });

  it('returns true when window.__PRERENDER__ is set', () => {
    vi.stubGlobal('location', { search: '' } as Location);
    vi.stubGlobal('window', { __PRERENDER__: true } as unknown as Window);
    expect(isPrerender()).toBe(true);
  });

  it('returns false in a normal browser session', () => {
    vi.stubGlobal('location', { search: '?utm_source=x' } as Location);
    vi.stubGlobal('window', {} as unknown as Window);
    expect(isPrerender()).toBe(false);
  });
});
```

- [ ] **Step 2: Run it, expect FAIL** (module does not exist yet):

```bash
npx vitest run src/utils/__tests__/prerender.test.ts
```

Expected: `Error: Failed to resolve import "../prerender"` → test file fails to run / `FAIL`.

- [ ] **Step 3: Implement `src/utils/prerender.ts`:**

```ts
/**
 * True when the page is being rendered by the build-time Puppeteer crawler
 * (scripts/prerender.js). The crawler opens every route with ?prerender=1.
 * Heavy WebGL / GSAP-ScrollTrigger work is skipped under this flag so the
 * headless render reaches a stable DOM instead of spinning on a render loop.
 */
export function isPrerender(): boolean {
  if (typeof window !== 'undefined' && (window as unknown as { __PRERENDER__?: boolean }).__PRERENDER__) {
    return true;
  }
  if (typeof location !== 'undefined' && location.search) {
    return new URLSearchParams(location.search).has('prerender');
  }
  return false;
}
```

- [ ] **Step 4: Run it, expect PASS:**

```bash
npx vitest run src/utils/__tests__/prerender.test.ts
```

Expected: `Test Files  1 passed (1)` / `Tests  3 passed (3)`.

- [ ] **Step 5: Commit:**

```bash
git add src/utils/prerender.ts src/utils/__tests__/prerender.test.ts && git commit -m "feat(seo): add isPrerender() flag for build-time crawl gating"
```

---

### Task 3.2: Gate the three WebGL/R3F mounts behind `isPrerender()`

Headless Chrome with R3F `frameloop="always"` (HeroCanvas line 189) never goes idle and the GSAP ScrollTrigger pins keep the page "busy" — the crawler must not wait on them. We skip the Canvas entirely under the flag; the static `hero2.png` already renders on top (Home.tsx comment lines 14-16), so the prerendered DOM is visually complete without the backdrop.

- [ ] **Step 1: Gate `HeroCanvas` in `src/pages/Home.tsx`.** Add the import after line 17, then guard the render. Current line 17:

```tsx
const HeroCanvas = lazy(() => import('../components/home/HeroCanvas'));
```

Edit to:

```tsx
const HeroCanvas = lazy(() => import('../components/home/HeroCanvas'));
import { isPrerender } from '../utils/prerender';
```

Then inside the component (after line 22, `const reducedMotion = ...`), add:

```tsx
const skip3D = isPrerender();
```

Find the existing usage at line ~123 and guard it:

```tsx
<HeroCanvas heroRef={heroRef} />
```

becomes:

```tsx
{
  !skip3D && <HeroCanvas heroRef={heroRef} />;
}
```

- [ ] **Step 2: Gate `AltiMascot` in `src/components/chat/ChatWidgetButton.tsx`.** Current lines 1-3 and 18-20:

```tsx
import { lazy, Suspense } from 'react';

const AltiMascot = lazy(() => import('./AltiMascot'));
```

```tsx
<Suspense fallback={null}>
  <AltiMascot isOpen={isOpen} />
</Suspense>
```

Edit the import block to:

```tsx
import { lazy, Suspense } from 'react';
import { isPrerender } from '../../utils/prerender';

const AltiMascot = lazy(() => import('./AltiMascot'));
```

Edit the render to (render nothing 3D under prerender — the button stays in the DOM, just empty):

```tsx
{
  !isPrerender() && (
    <Suspense fallback={null}>
      <AltiMascot isOpen={isOpen} />
    </Suspense>
  );
}
```

- [ ] **Step 3: Gate the AWS topology 3D.** First confirm the mount + export shape (do not guess):

```bash
grep -n "Canvas\|export default\|export function\|export const\|isPrerender" src/components/aws/TopologyScene.tsx | head
```

Expected: a line with `<Canvas` and an `export default` (or named) for `TopologyScene`. Then add `import { isPrerender } from '../../utils/prerender';` at the top and wrap the returned `<Canvas ...>` JSX so that when `isPrerender()` is true the component returns `null` (the AWS page's existing 2D fallback `TopologyFallback2D` is what crawlers should see — verify it is already conditionally rendered alongside TopologyScene; if TopologyScene is the only mount, return the fallback instead of `null`). Example minimal guard at the top of the component body:

```tsx
if (isPrerender()) return null;
```

- [ ] **Step 4: Lint + typecheck the gated files:**

```bash
npm run lint && npx tsc --noEmit
```

Expected: no errors (exit 0). If `tsc` flags an unused `skip3D`, ensure the JSX guard from Step 1 is in place.

- [ ] **Step 5: Run the existing 3D component tests to confirm no regression** (these mock R3F already, per CLAUDE.md testing gotchas):

```bash
npx vitest run src/components/home/HeroCanvas.test.tsx
```

Expected: `PASS` (the gate only adds a branch that is false in jsdom — `isPrerender()` returns false with no `?prerender=1`).

- [ ] **Step 6: Commit:**

```bash
git add src/pages/Home.tsx src/components/chat/ChatWidgetButton.tsx src/components/aws/TopologyScene.tsx && git commit -m "feat(seo): skip WebGL/R3F mounts during build-time prerender crawl"
```

---

### Task 3.3: Emit a Helmet-ready signal the crawler can await

The crawler must NOT wait on network idle (3D/GSAP keep the connection-equivalent busy). Instead it polls for a DOM flag set after React's first commit + a microtask, by which point `react-helmet-async` has flushed per-route `<title>`/`<meta>`/JSON-LD into `<head>`.

- [ ] **Step 1: Edit `src/main.tsx`.** Current render call (lines 14-24):

```tsx
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LenisProvider>
      <BrowserRouter>
        <HelmetProvider>
          <App />
        </HelmetProvider>
      </BrowserRouter>
    </LenisProvider>
  </React.StrictMode>,
);
```

Append, after that closing `)`, a deferred flag set (two `rAF`s guarantee at least one paint + Helmet flush):

```tsx
// Signal to the build-time prerender crawler (scripts/prerender.js) that React
// has committed and react-helmet-async has flushed per-route <head> tags.
// Crawler polls window.__PRERENDER_READY__ instead of network idle, because the
// WebGL/GSAP work never lets the page reach a true idle state.
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    (window as unknown as { __PRERENDER_READY__?: boolean }).__PRERENDER_READY__ = true;
  });
});
```

- [ ] **Step 2: Typecheck:**

```bash
npx tsc --noEmit
```

Expected: exit 0, no errors.

- [ ] **Step 3: Commit:**

```bash
git add src/main.tsx && git commit -m "feat(seo): emit __PRERENDER_READY__ signal after Helmet flush"
```

---

### Task 3.4: Add Puppeteer as a devDependency

- [ ] **Step 1: Install puppeteer (downloads a pinned Chromium):**

```bash
npm install --save-dev puppeteer@^24.0.0
```

- [ ] **Step 2: Verify it landed in `devDependencies` and Chromium resolves:**

```bash
node -e "const p=require('puppeteer'); console.log('puppeteer ok, chromium:', p.executablePath())"
```

Expected: `puppeteer ok, chromium: /Users/.../.cache/puppeteer/chrome/.../chrome` (a real path, not empty).

- [ ] **Step 3: Confirm `package.json` updated:**

```bash
grep -n '"puppeteer"' package.json
```

Expected: a line under `devDependencies`, e.g. `"puppeteer": "^24.x.x",`.

- [ ] **Step 4: Commit (lockfile + manifest):**

```bash
git add package.json package-lock.json && git commit -m "build(seo): add puppeteer devDependency for prerender step"
```

---

### Task 3.5: Create `scripts/prerender.js`

Reuses the EXACT Sanity GROQ query from `scripts/generate-sitemap.js` (lines 44-47) and its `staticPages` list (lines 24-36) so the crawl set never drifts from the sitemap. Serves `dist/` with Node's built-in `http` + a minimal static handler (no extra dep, no `vite preview` subprocess to manage). For each route it opens `<url>?prerender=1`, waits on `window.__PRERENDER_READY__`, serializes the DOM, and writes `dist/<route>/index.html`.

- [ ] **Step 1: Write the full file** `scripts/prerender.js`:

```js
/**
 * Build-time prerender.
 * Runs AFTER `vite build`, BEFORE generate-sitemap. Serves dist/ locally,
 * opens each static route + blog slug headless with ?prerender=1, waits for the
 * Helmet-ready signal (NOT network idle — WebGL/GSAP never go idle), and writes
 * the serialized DOM to dist/<route>/index.html so crawlers/scrapers/LLMs get
 * per-route <title>, OG tags, and JSON-LD without executing JS.
 *
 * Route set is the SAME source as scripts/generate-sitemap.js (DRY).
 */
import { createServer } from 'http';
import { createReadStream, existsSync, mkdirSync, writeFileSync, statSync } from 'fs';
import { resolve, dirname, join, extname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@sanity/client';
import puppeteer from 'puppeteer';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(__dirname, '../dist');

// --- Sanity: SAME config + query as generate-sitemap.js ----------------------
const client = createClient({
  projectId: 'k5950b3w',
  dataset: 'production',
  apiVersion: '2024-01-01',
  useCdn: false,
  timeout: 15000,
});

// Mirror generate-sitemap.js staticPages (urls only).
const STATIC_ROUTES = [
  '/',
  '/about',
  '/altivum',
  '/foundation',
  '/podcast',
  '/blog',
  '/contact',
  '/links',
  '/beyond-the-assessment',
  '/chat',
  '/privacy',
];

async function fetchBlogSlugs() {
  // Identical projection to generate-sitemap.js fetchBlogPosts().
  const query = `*[_type == "post" && defined(slug.current)] | order(publishedAt desc) {
    "slug": slug.current
  }`;
  const posts = await client.fetch(query);
  return posts.map((p) => `/blog/${p.slug}`);
}

// --- Tiny static file server over dist/ --------------------------------------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.glb': 'model/gltf-binary',
  '.woff2': 'font/woff2',
};

function startServer() {
  return new Promise((resolveServer) => {
    const server = createServer((req, res) => {
      const urlPath = decodeURIComponent(req.url.split('?')[0]);
      let filePath = join(DIST, urlPath);
      // Directory or extensionless route -> serve index.html (SPA fallback).
      if (!extname(filePath) || (existsSync(filePath) && statSync(filePath).isDirectory())) {
        filePath = join(DIST, 'index.html');
      }
      if (!existsSync(filePath)) {
        filePath = join(DIST, 'index.html');
      }
      res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' });
      createReadStream(filePath).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolveServer({ server, port });
    });
  });
}

// route '/' -> dist/index.html ; route '/blog/x' -> dist/blog/x/index.html
function outPathFor(route) {
  if (route === '/') return join(DIST, 'index.html');
  return join(DIST, route.replace(/^\//, ''), 'index.html');
}

async function prerender() {
  console.log('Prerendering routes...');
  const blogRoutes = await fetchBlogSlugs();
  const routes = [...STATIC_ROUTES, ...blogRoutes];
  console.log(`Routes to prerender: ${routes.length} (${STATIC_ROUTES.length} static + ${blogRoutes.length} blog)`);

  const { server, port } = await startServer();
  const base = `http://127.0.0.1:${port}`;

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  try {
    for (const route of routes) {
      const page = await browser.newPage();
      // Hard fail-safe: never let one hung route stall the whole build.
      page.setDefaultTimeout(30000);
      const url = `${base}${route}${route.includes('?') ? '&' : '?'}prerender=1`;
      // domcontentloaded only — we do NOT wait for network idle (3D never idles).
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      // Wait for React commit + Helmet flush.
      await page.waitForFunction('window.__PRERENDER_READY__ === true', { timeout: 20000 });
      const html = await page.content();
      const outFile = outPathFor(route);
      mkdirSync(dirname(outFile), { recursive: true });
      writeFileSync(outFile, html, 'utf-8');
      console.log(`  ✓ ${route} -> ${outFile.replace(DIST, 'dist')}`);
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }

  console.log(`Prerendered ${routes.length} routes.`);
}

prerender().catch((err) => {
  console.error('Prerender failed:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Smoke-test the script against an existing build** (build once without prerender first so `dist/` exists):

```bash
npx tsc && npx vite build && node scripts/prerender.js
```

Expected tail:

```
  ✓ / -> dist/index.html
  ✓ /about -> dist/about/index.html
  ...
  ✓ /blog/<some-slug> -> dist/blog/<some-slug>/index.html
Prerendered NN routes.
```

- [ ] **Step 3: Verify a blog route got per-page metadata + BlogPosting JSON-LD** (this is the acceptance check):

```bash
SLUG=$(ls dist/blog | head -1) && echo "checking: $SLUG" \
  && grep -o '<title>[^<]*</title>' "dist/blog/$SLUG/index.html" \
  && grep -c '"BlogPosting"' "dist/blog/$SLUG/index.html" \
  && grep -c '"@type":"Person"' "dist/blog/$SLUG/index.html"
```

Expected: a real article `<title>` (NOT `Christian Perez - thechrisgrey`), `1` for `BlogPosting`, and `>=1` for `Person`. If the title is still the generic homepage one, the `__PRERENDER_READY__` wait fired before Helmet flushed — bump the double-`rAF` in `main.tsx` (Task 3.3) or the `waitForFunction` timeout.

- [ ] **Step 4: Commit:**

```bash
git add scripts/prerender.js && git commit -m "feat(seo): prerender static + blog routes to per-route index.html"
```

---

### Task 3.6: Wire prerender into the build chain

- [ ] **Step 1: Edit `package.json` line 8.** Current:

```json
    "build": "node scripts/validate-env.js && node scripts/generate-podcast-episodes.js && npm run lint && tsc && vite build && node scripts/generate-sitemap.js && node scripts/generate-rss.js",
```

Insert `node scripts/prerender.js &&` immediately after `vite build &&`:

```json
    "build": "node scripts/validate-env.js && node scripts/generate-podcast-episodes.js && npm run lint && tsc && vite build && node scripts/prerender.js && node scripts/generate-sitemap.js && node scripts/generate-rss.js",
```

- [ ] **Step 2: Run the full pipeline locally:**

```bash
npm run build
```

Expected: the existing steps run, then `Prerendering routes...` → `✓` lines → `Prerendered NN routes.` → `Generating sitemap...` → `Sitemap generated successfully` → RSS. Exit 0.

- [ ] **Step 3: Re-confirm the prerendered artifact survived the full build** (sitemap/RSS run after prerender and must not clobber HTML):

```bash
SLUG=$(ls dist/blog | head -1) && grep -q '"BlogPosting"' "dist/blog/$SLUG/index.html" && echo "PRERENDER OK: $SLUG"
```

Expected: `PRERENDER OK: <slug>`.

- [ ] **Step 4: Commit:**

```bash
git add package.json && git commit -m "build(seo): run prerender after vite build, before sitemap"
```

---

### Task 3.7: Narrow the `_redirects` catch-all so prerendered HTML is actually served (THE gotcha)

This is the single non-obvious failure mode. `public/_redirects` currently contains exactly:

```
/*    /index.html   200
```

On AWS Amplify this rewrite is evaluated for **every** request and rewrites the response to the homepage `index.html` — so even though `dist/blog/<slug>/index.html` now exists, a request to `/blog/<slug>` is rewritten to the root `index.html` and the prerendered file is **never delivered**. The fix is a fall-through: serve real files first, and only rewrite paths that have no file extension (the SPA client-routed paths) to their own directory index. Amplify's redirect engine supports the `</^...$/>` regex target form and an explicit asset-passthrough rule.

- [ ] **Step 1: Replace `public/_redirects` contents.** Old (entire file):

```
/*    /index.html   200
```

New:

```
# 1. Let real files (hashed JS/CSS, images, prerendered */index.html, xml) win.
#    Anything containing a "." (file extension) is served as-is.
/<*>.<*>          /<*>.<*>          200

# 2. Prerendered route HTML: serve the route's own index.html, not the root one.
#    e.g. /blog/foo -> /blog/foo/index.html (written by scripts/prerender.js).
/<*>              /<*>/index.html  200

# 3. SPA fallback for anything still unmatched (e.g. deep client-only routes).
/*                /index.html      200
```

> Why this works: Amplify processes rules top-to-bottom and stops at the first match. Rule 1 matches any request whose path has an extension (`.js`, `.css`, `.png`, `.xml`, `.html`) and serves the literal file — this preserves `sitemap.xml`, hashed `assets/*`, `og.png`, etc. Rule 2 matches extensionless route paths and serves the prerendered `<route>/index.html`. Rule 3 is the safety net for any route that wasn't prerendered (e.g. `/admin`, `/blueprint`, an unknown deep path) so client routing + the SPA `NotFound` still work.

- [ ] **Step 2: Validate the file is well-formed** (Amplify rewrites are tab/space tolerant; just confirm three rules, no stray homepage-only catch-all on line 1):

```bash
grep -vc '^#' public/_redirects && grep -n 'index.html' public/_redirects
```

Expected: a count of `3` (three non-comment rules) and three lines referencing `index.html`, with the bare `/*` rule appearing LAST.

- [ ] **Step 3: (Belt-and-suspenders) mirror the rule order in `amplify.yml` only if Amplify console rules override the file.** `_redirects` is honored by Amplify when present, so no `amplify.yml` change is strictly required — but if the Amplify app already has console-defined rewrites they take precedence over `_redirects`. Verify which is in effect:

```bash
aws amplify get-app --app-id d3du8eg39a9peo --region us-east-2 --query 'app.customRules' --output json
```

Expected: either `null`/`[]` (then `_redirects` governs — done) or an array containing a `{"source":"</^[^.]+$/>","target":"/index.html","status":"200"}`-style catch-all. If a homepage catch-all exists in the console, update it (Amplify Console → App settings → Rewrites and redirects) to the same three-rule order above; the `_redirects` file alone will otherwise be shadowed. This is a console/IaC action, not a code edit — note it in the PR for the deployer.

- [ ] **Step 4: Commit:**

```bash
git add public/_redirects && git commit -m "fix(seo): narrow SPA rewrite so prerendered route HTML is served first"
```

---

### Task 3.8 (Optional): Cypress smoke test that prerendered HTML carries per-route metadata

Lightweight regression guard so a future change that re-breaks the `__PRERENDER_READY__` signal (and reverts every route to homepage metadata) fails CI rather than silently shipping. Optional because it requires a built `dist/` in CI.

- [ ] **Step 1: Add a node test** `scripts/__tests__/prerender.smoke.test.mjs` (runs against `dist/` produced by `npm run build`):

```mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { resolve } from 'path';

const DIST = resolve(import.meta.dirname, '../../dist');

test('blog routes are prerendered with BlogPosting JSON-LD and a non-home title', () => {
  const blogDir = resolve(DIST, 'blog');
  if (!existsSync(blogDir)) {
    // dist not built (e.g. unit-test-only CI lane) — skip rather than fail.
    return;
  }
  const slugs = readdirSync(blogDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  assert.ok(slugs.length > 0, 'expected at least one prerendered blog slug');

  const html = readFileSync(resolve(blogDir, slugs[0], 'index.html'), 'utf-8');
  assert.match(html, /"BlogPosting"/, 'missing BlogPosting JSON-LD');
  assert.doesNotMatch(
    html,
    /<title>Christian Perez - thechrisgrey<\/title>/,
    'blog route still shows homepage title — Helmet did not flush before prerender',
  );
});
```

- [ ] **Step 2: Run it after a build:**

```bash
npm run build && node --test scripts/__tests__/prerender.smoke.test.mjs
```

Expected: `tests 1` / `pass 1`.

- [ ] **Step 3: Commit:**

```bash
git add scripts/__tests__/prerender.smoke.test.mjs && git commit -m "test(seo): assert blog routes prerender with per-route metadata"
```

---

**Deployment note for the PR body:** This adds a Puppeteer/Chromium download to the Amplify build (us-east-2). Sanity is already reachable during the build (it powers `generate-sitemap`/`generate-rss`), so the GROQ enumeration works unchanged. If the Amplify build image lacks the libs Chromium needs, add to `amplify.yml` `preBuild.commands` (after `npm ci`): `yum install -y atk cups-libs gtk3 libXcomposite libXcursor libXdamage libXext libXi libXrandr libXScrnSaver libXtst pango alsa-lib 2>/dev/null || true` — verify in the first Amplify build log that `node scripts/prerender.js` reaches `Prerendered NN routes.` rather than a Chromium launch error.

---

## Recommendation 4: Stop shipping the Cognito SDK on every page; fix .env.example and doc drift

**Why it matters:** The Cognito Identity Provider SDK (~42 KB gzip / ~138 KB raw) is statically reachable from the always-mounted ChatWidget and Footer newsletter form via the `src/hooks/index.ts` barrel, so `dist/index.html` `modulepreload`s it on EVERY page even though only the lazy `/admin` route uses it. A fresh clone also can't build because `.env.example` is missing two vars its own validator requires, and three docs are stale.

**Impact:** Medium (removes a ~42 KB-gzip chunk from the critical path on every page; unblocks fresh-clone builds) · **Effort:** Low · **Risk:** Low (surgical import change + doc/.env edits; no behavior change)

**Depends on:** none

**Files:**

- **Modify** `src/hooks/index.ts` (line 5 — remove `export { useAuth }`)
- **Modify** `src/pages/Admin.tsx` (line 3 — split `useAuth` import to direct path)
- **Modify** `.env.example` (add `VITE_CHAT_SIGNING_KEY` + `VITE_METRICS_ENDPOINT`)
- **Modify** `docs/ci.md` (line 36 — correct Dependabot directory count/list)
- **Modify** `README.md` (line 148 — Node 20 only)
- **Test (new)** `src/hooks/__tests__/barrel-no-cognito.test.ts` (guard test)
- **Verify (read-only)** `vite.config.ts` (line 26 — `cognito` manualChunk), `dist/index.html` (build artifact)

**Verified facts (corrections to brief):**

- `dist/index.html` currently contains `<link rel="modulepreload" crossorigin href="/assets/cognito-DF_N2Cak.js">` — issue confirmed against the real artifact.
- `useAuth` is reached via the barrel ONLY by `src/pages/Admin.tsx`. `AskTheVector.tsx`, `Chat.tsx`, `ChatWidgetPanel.tsx`, and `NewsletterForm.tsx` import the barrel but pull `useChatEngine`/`usePageContext`/`useFocusTrap` — none import `useAuth`. So removing the one re-export fully isolates Cognito.
- `useAuth.test.ts` already imports from `./useAuth` directly (not the barrel), so removing the re-export does NOT break existing tests.
- Dependabot configures **7** `npm` lambda directories — `lambda/chat-stream`, `lambda/kb-builder`, `lambda/metrics`, `lambda/kb-sync`, `lambda/blueprint`, `lambda/mcp-server`, `lambda/shared` — i.e. six functional Lambdas + `shared`. The doc's "the four Lambda directories" is wrong; the brief's "six lambda dirs + shared" is correct.

---

### Task 4.1: Add a guard test that the hooks barrel does NOT statically pull in Cognito

This is the failing test that drives the primary fix. It asserts the barrel's source text does not re-export `useAuth` (the only path by which Cognito reaches the entry chunk).

- [ ] **Step 1: Create the failing guard test.** The barrel currently has `export { useAuth } from './useAuth';` on line 5, so this test FAILS now.

```ts
// src/hooks/__tests__/barrel-no-cognito.test.ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const barrelPath = resolve(here, '../index.ts');
const useAuthPath = resolve(here, '../useAuth.ts');

describe('hooks barrel does not drag in the Cognito SDK', () => {
  it('does not re-export useAuth from the barrel', () => {
    const barrel = readFileSync(barrelPath, 'utf8');
    // useAuth statically imports @aws-sdk/client-cognito-identity-provider,
    // so it must NOT be reachable from the always-mounted-component barrel.
    expect(barrel).not.toMatch(/useAuth/);
  });

  it('useAuth.ts is still the lone owner of the Cognito SDK import', () => {
    const useAuth = readFileSync(useAuthPath, 'utf8');
    expect(useAuth).toContain('@aws-sdk/client-cognito-identity-provider');
  });
});
```

- [ ] **Step 2: Run the test, expect FAIL.**

```bash
npx vitest run src/hooks/__tests__/barrel-no-cognito.test.ts
```

Expected: the first case fails —

```
FAIL  src/hooks/__tests__/barrel-no-cognito.test.ts > ... > does not re-export useAuth from the barrel
AssertionError: expected 'export { useFocusTrap } ...' not to match /useAuth/
```

- [ ] **Step 3: Remove the `useAuth` re-export from the barrel.** Current `src/hooks/index.ts` line 5 (verified) is `export { useAuth } from './useAuth';`. Delete it. (There is no `useAuth` type re-export to remove — line 5 is the only `useAuth` reference.)

```ts
// src/hooks/index.ts  —  BEFORE (lines 3-6)
export { useChatEngine, CHAT_STORAGE_KEY } from './useChatEngine';
export type { Message } from './useChatEngine';
export { useAuth } from './useAuth';
export { useKbAdmin } from './useKbAdmin';
```

```ts
// src/hooks/index.ts  —  AFTER (lines 3-5)
export { useChatEngine, CHAT_STORAGE_KEY } from './useChatEngine';
export type { Message } from './useChatEngine';
export { useKbAdmin } from './useKbAdmin';
```

- [ ] **Step 4: Run the guard test, expect PASS.**

```bash
npx vitest run src/hooks/__tests__/barrel-no-cognito.test.ts
```

Expected:

```
✓ src/hooks/__tests__/barrel-no-cognito.test.ts (2 tests)
Test Files  1 passed (1)
```

- [ ] **Step 5: Commit.**

```bash
git add src/hooks/index.ts src/hooks/__tests__/barrel-no-cognito.test.ts && git commit -m "perf(hooks): drop useAuth from barrel so Cognito SDK leaves the entry chunk"
```

---

### Task 4.2: Point Admin.tsx at useAuth directly so /admin still compiles

Removing the barrel re-export breaks `src/pages/Admin.tsx`, which imports `useAuth` from `../hooks` on line 3 (used at line 9 in `AdminDashboard` and line 184 in `Admin`). Fix the import; `useKbAdmin`/`useSiteHealth` stay on the barrel (neither touches Cognito).

- [ ] **Step 1: Confirm Admin.tsx fails to type-check now.** With the barrel re-export gone, `tsc` should error on the `useAuth` named import.

```bash
npx tsc --noEmit
```

Expected: an error referencing `Admin.tsx` and `useAuth`, e.g.

```
src/pages/Admin.tsx:3:10 - error TS2305: Module '"../hooks"' has no exported member 'useAuth'.
```

- [ ] **Step 2: Split the import in Admin.tsx.** Current line 3 (verified): `import { useAuth, useKbAdmin, useSiteHealth } from '../hooks';`.

```tsx
// src/pages/Admin.tsx  —  BEFORE (lines 1-5)
import { useState, useEffect } from 'react';
import { typography } from '../utils/typography';
import { useAuth, useKbAdmin, useSiteHealth } from '../hooks';
import type { KbEntry } from '../hooks';
import { AdminLogin, EntryForm, EntryList, SiteHealthPanel } from '../components/admin';
```

```tsx
// src/pages/Admin.tsx  —  AFTER (lines 1-6)
import { useState, useEffect } from 'react';
import { typography } from '../utils/typography';
import { useAuth } from '../hooks/useAuth';
import { useKbAdmin, useSiteHealth } from '../hooks';
import type { KbEntry } from '../hooks';
import { AdminLogin, EntryForm, EntryList, SiteHealthPanel } from '../components/admin';
```

- [ ] **Step 3: Type-check + lint, expect PASS.** (Lint matters: ESLint runs with `--max-warnings 0` and would flag an unused/incorrect import.)

```bash
npx tsc --noEmit && npm run lint
```

Expected: no errors; lint exits 0.

- [ ] **Step 4: Run the production build and verify the Cognito chunk is no longer preloaded.** This is the brief's primary verification. The build emits `cognito-*.js` (still produced by the `vite.config.ts` line-26 manualChunk) but `index.html` must NOT `modulepreload` it, and the entry chunk must NOT statically `from "./cognito-*.js"`.

```bash
npm run build
echo "--- modulepreload of cognito in index.html (expect NO match) ---"
grep -c 'modulepreload[^>]*cognito' dist/index.html || echo "0 (good: no preload)"
echo "--- entry chunk static import of cognito (expect NO match) ---"
grep -lE 'from"\./cognito-[A-Za-z0-9_-]+\.js"' dist/assets/index-*.js || echo "none (good)"
echo "--- cognito chunk still emitted lazily (expect a file) ---"
ls dist/assets/cognito-*.js
```

Expected output:

```
--- modulepreload of cognito in index.html (expect NO match) ---
0 (good: no preload)
--- entry chunk static import of cognito (expect NO match) ---
none (good)
--- cognito chunk still emitted lazily (expect a file) ---
dist/assets/cognito-<hash>.js
```

(Before this change the same `grep` matched `<link rel="modulepreload" crossorigin href="/assets/cognito-DF_N2Cak.js">` — verified against the current `dist/index.html`.)

- [ ] **Step 5: Commit.**

```bash
git add src/pages/Admin.tsx && git commit -m "perf(admin): import useAuth directly so Cognito stays out of the critical path"
```

---

### Task 4.3 (Optional, mutually exclusive with 4.1/4.2): one-line `sideEffects: false` alternative

If you prefer not to touch import sites, add `"sideEffects": false` to `package.json` so Rollup tree-shakes the unused `useAuth` re-export. Caveat: broader blast radius — it tells the bundler EVERY module is side-effect-free, so any import-for-side-effect would be dropped. **Do NOT do this in addition to 4.1/4.2; pick one.** The surgical fix (4.1/4.2) is recommended because its blast radius is exactly one symbol.

- [ ] **Step 1: Add the field to `package.json`.** Current top of file (verified, lines 1-5): `"name"`, `"private"`, `"version"`, `"type": "module"`. Insert after `"version"`.

```json
  "version": "1.0.0",
  "sideEffects": false,
  "type": "module",
```

- [ ] **Step 2: Build and confirm no side-effect import broke + Cognito is no longer preloaded.**

```bash
npm run build
grep -c 'modulepreload[^>]*cognito' dist/index.html || echo "0 (good)"
npm run preview &  # smoke-load http://localhost:4173 in a browser; confirm chat widget, newsletter, /admin all render
```

Expected: `0 (good)`, and the app (chat widget, footer newsletter, `/admin` login) renders with no missing-stylesheet/console errors. If anything breaks, revert this field and use Tasks 4.1/4.2 instead.

- [ ] **Step 3: Commit (only if you took this path).**

```bash
git add package.json && git commit -m "perf(build): mark package sideEffects:false to tree-shake unused Cognito re-export"
```

---

### Task 4.4: Add the two missing vars to `.env.example`

`scripts/validate-env.js` (verified, lines 12-13) requires `VITE_METRICS_ENDPOINT` and `VITE_CHAT_SIGNING_KEY`, but `.env.example` (verified) lists neither — so a fresh clone's `npm run build` fails its own validator. Add them with placeholders matching the file's existing style.

- [ ] **Step 1: Append the chat signing key under the chat endpoint, and a metrics block.** Current `.env.example` lines 4 and 12-13 shown for anchoring.

```bash
# .env.example  —  current line 4
VITE_CHAT_ENDPOINT=https://YOUR-FUNCTION-URL.lambda-url.us-east-1.on.aws/
```

Edit to add the signing key right after line 4:

```bash
VITE_CHAT_ENDPOINT=https://YOUR-FUNCTION-URL.lambda-url.us-east-1.on.aws/
# HMAC shared secret for signing chat requests (must match the chat-stream Lambda's CHAT_SIGNING_KEY)
VITE_CHAT_SIGNING_KEY=your-hmac-shared-secret
```

Then append a metrics endpoint after the KB Admin block (current lines 12 is `VITE_KB_BUILDER_ENDPOINT=...`):

```bash
VITE_KB_BUILDER_ENDPOINT=https://YOUR-FUNCTION-URL.lambda-url.us-east-1.on.aws/

# Site metrics / web-vitals + CSP-report Lambda (us-east-1)
VITE_METRICS_ENDPOINT=https://YOUR-FUNCTION-URL.lambda-url.us-east-1.on.aws/
```

- [ ] **Step 2: Verify the example now covers every required var.** Compare the validator's `required` array against `.env.example` keys.

```bash
diff <(grep -oE 'VITE_[A-Z_]+' scripts/validate-env.js | sort -u) \
     <(grep -oE 'VITE_[A-Z_]+' .env.example | sort -u) \
  && echo "OK: .env.example covers every required VITE_ var"
```

Expected: no diff lines for the required set (the example may list MORE keys, e.g. Cognito user-pool and Blueprint vars, which is fine — `diff` will only flag a required var that is absent; if it prints lines prefixed `<` for a required var, that var is still missing).

- [ ] **Step 3: Commit.**

```bash
git add .env.example && git commit -m "docs(env): add VITE_CHAT_SIGNING_KEY + VITE_METRICS_ENDPOINT so fresh-clone build passes validate-env"
```

---

### Task 4.5: Fix the stale Dependabot count in `docs/ci.md`

`docs/ci.md` line 36 (verified) claims "the four Lambda directories (`lambda/chat-stream`, `lambda/kb-builder`, `lambda/metrics`, `lambda/kb-sync`)". The real `.github/dependabot.yml` (verified) configures seven lambda directories: those four PLUS `lambda/blueprint`, `lambda/mcp-server`, and `lambda/shared`.

- [ ] **Step 1: Edit line 36.**

```markdown
<!-- docs/ci.md  —  BEFORE (line 36) -->

- `.github/dependabot.yml` scans root `/` plus the four Lambda directories (`lambda/chat-stream`, `lambda/kb-builder`, `lambda/metrics`, `lambda/kb-sync`) weekly on Mondays.
```

```markdown
<!-- docs/ci.md  —  AFTER (line 36) -->

- `.github/dependabot.yml` scans root `/` plus the six Lambda directories (`lambda/chat-stream`, `lambda/kb-builder`, `lambda/metrics`, `lambda/kb-sync`, `lambda/blueprint`, `lambda/mcp-server`) and the shared `lambda/shared` package weekly on Mondays.
```

- [ ] **Step 2: Verify the doc now matches the config's directory count.** Count `directory: "/lambda/...` entries in the YAML (expect 7) and confirm the doc no longer says "four".

```bash
echo "lambda dirs in dependabot.yml:"; grep -c 'directory: "/lambda/' .github/dependabot.yml
echo "doc still says 'four Lambda'?"; grep -c 'four Lambda' docs/ci.md
```

Expected:

```
lambda dirs in dependabot.yml:
7
doc still says 'four Lambda'?
0
```

- [ ] **Step 3: Commit.**

```bash
git add docs/ci.md && git commit -m "docs(ci): correct Dependabot directory list (six Lambdas + shared, not four)"
```

---

### Task 4.6: Pin README to Node 20 only

`README.md` line 148 (verified) says "Node.js 18.x or 20.x (see `.nvmrc`)", but `.nvmrc` pins 20 and `CLAUDE.md` says Node 20. Drop the 18.x.

- [ ] **Step 1: Confirm `.nvmrc` pins 20.**

```bash
cat .nvmrc
```

Expected: `20` (a single major version).

- [ ] **Step 2: Edit line 148.**

```markdown
<!-- README.md  —  BEFORE (line 148) -->

- Node.js 18.x or 20.x (see `.nvmrc`)
```

```markdown
<!-- README.md  —  AFTER (line 148) -->

- Node.js 20.x (see `.nvmrc`)
```

- [ ] **Step 3: Verify the 18.x reference is gone.**

```bash
grep -n 'Node.js' README.md
```

Expected: the prerequisites line now reads `- Node.js 20.x (see \`.nvmrc\`)` and no longer mentions 18.x.

- [ ] **Step 4: Commit.**

```bash
git add README.md && git commit -m "docs(readme): pin Node version to 20.x to match .nvmrc"
```

---

## Recommendation 5: Unit-test the rate limiter and close handler / CI test gaps

**Why it matters:** `lambda/shared/rateLimit.mjs` is the single shared throttle imported by 6 production handlers yet has zero tests, the `test:lambda` glob skips the `metrics` and `kb-builder` handlers entirely, and all 11 Cypress E2E specs run nowhere in CI — so a regression in the rate limiter (fail-open logic, the strict `>` boundary, or the stale-window reset) or in mock-stubbable user flows ships undetected.

**Impact:** HIGH · **Effort:** MEDIUM · **Risk:** LOW (tests + CI only; no production code changes except small pure-function extractions guarded by tests)

**Depends on:** none

**Files**

- **Create** `lambda/shared/__tests__/rateLimit.test.mjs` (new, ~120 lines)
- **Create** `lambda/metrics/validation.mjs` (new, pure helpers extracted from `index.mjs`)
- **Create** `lambda/metrics/__tests__/validation.test.mjs` (new)
- **Create** `lambda/kb-builder/validation.mjs` (new, pure helper extracted from `index.mjs`)
- **Create** `lambda/kb-builder/__tests__/validation.test.mjs` (new)
- **Modify** `lambda/metrics/index.mjs` (lines 46–57 → import the extracted validators)
- **Modify** `lambda/kb-builder/index.mjs` (lines 64–89 → import the extracted validator)
- **Modify** `package.json` line 16 (`test:lambda` glob)
- **Modify** `.github/workflows/ci.yml` (add a new `cypress-mocked` job)
- **Create** `cypress/e2e/` — no new specs; existing 7 mock-stubbed specs are selected via the CI run

Confirmed facts from reading the code:

- `checkRateLimit` (`lambda/shared/rateLimit.mjs:21`) takes an **injected** `docClient` + `UpdateCommand`, exactly like `MetricsCollector` takes an injected client — so it tests with the same stubbed-`send` pattern as `lambda/shared/__tests__/metrics.test.mjs`.
- Over-limit is **strict `>`** (`rateLimit.mjs:52`: `if (count > maxRequests)`). So `count === maxRequests` returns `{allowed:true, remaining:0}` and `count === maxRequests+1` returns `{allowed:false, remaining:0}`.
- `ConditionalCheckFailedException` (line 58) triggers the stale-window reset → second `send` succeeds → `{allowed:true, remaining:maxRequests-1}`; if that reset `send` also throws → `{allowed:true, remaining:-1}` (line 74).
- Any other thrown error fails **open**: `{allowed:true, remaining:-1}` (line 82).
- `lambda/shared/__tests__` is already inside the `test:lambda` glob (`package.json:16`), so Task 5.1 needs **no** script change. Confirmed: `node --test lambda/shared/__tests__/*.test.mjs` passes (39 tests).
- `lambda/metrics/` and `lambda/kb-builder/` have **no** `__tests__` dir. Both `package.json`s have `"type": "module"` and depend on `lambda-shared` via `file:../shared`; neither has a test runner dependency (none is needed — `node --test` is built into Node 20).
- **Gotcha:** `lambda/metrics/index.mjs` and `lambda/kb-builder/index.mjs` build their AWS SDK clients as **module-level singletons** (metrics lines 17–20, kb-builder lines 14–17), and `kb-builder/index.mjs:25` `throw`s at import time if `SANITY_WRITE_TOKEN` is unset. Importing these handlers in a unit test would instantiate real clients / crash. The DRY, low-risk path is to **extract the pure validation logic** (which has no AWS dependency) into a sibling module and test that — mirroring how `metrics.mjs` is a pure, separately-tested module in `shared/`.

---

### Task 5.1: Unit-test the shared rate limiter (CORE — do first)

- [ ] **Step 1: Write the failing test file** `lambda/shared/__tests__/rateLimit.test.mjs`. It mirrors the injected-client / stubbed-`send` pattern from `metrics.test.mjs`. The fake `UpdateCommand` records `input` (so we can assert on the two distinct expressions), and the fake client returns a scripted `Attributes.requestCount` for the first call and `{}` for the reset call.

```mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkRateLimit } from '../rateLimit.mjs';

// Minimal stand-in for UpdateCommand: records input so we can assert on the
// expression used (the over-limit reset uses a different UpdateExpression).
class FakeUpdateCommand {
  constructor(input) {
    this.input = input;
  }
}

// Client that returns a fixed requestCount on the FIRST send, then {} on the
// reset send. Records every command's input for assertions.
function countingClient(count) {
  const calls = [];
  let n = 0;
  return {
    calls,
    send: async (cmd) => {
      calls.push(cmd.input);
      n += 1;
      if (n === 1) return { Attributes: { requestCount: count } };
      return {};
    },
  };
}

// Client whose first send throws `error`; if `resetThrows` is true the reset
// send (used by the ConditionalCheckFailed branch) also throws.
function throwingClient(error, { resetThrows = false } = {}) {
  const calls = [];
  let n = 0;
  return {
    calls,
    send: async (cmd) => {
      calls.push(cmd.input);
      n += 1;
      if (n === 1) throw error;
      if (resetThrows) throw new Error('reset-also-failed');
      return {};
    },
  };
}

const OPTS = { table: 'rl', ip: '1.2.3.4', maxRequests: 20, windowSeconds: 3600 };
const conditionalFail = () => Object.assign(new Error('stale'), { name: 'ConditionalCheckFailedException' });

test('allows the maxRequests-th request (strict >, boundary is allowed)', async () => {
  const client = countingClient(20);
  const result = await checkRateLimit(client, FakeUpdateCommand, OPTS);
  assert.deepEqual(result, { allowed: true, remaining: 0 });
  assert.equal(client.calls.length, 1);
});

test('denies the maxRequests+1-th request', async () => {
  const client = countingClient(21);
  const result = await checkRateLimit(client, FakeUpdateCommand, OPTS);
  assert.deepEqual(result, { allowed: false, remaining: 0 });
});

test('reports remaining = maxRequests - count below the limit', async () => {
  const client = countingClient(5);
  const result = await checkRateLimit(client, FakeUpdateCommand, OPTS);
  assert.deepEqual(result, { allowed: true, remaining: 15 });
});

test('defaults count to 1 when Attributes is absent', async () => {
  const client = { calls: [], send: async () => ({}) };
  const result = await checkRateLimit(client, FakeUpdateCommand, OPTS);
  assert.deepEqual(result, { allowed: true, remaining: 19 });
});

test('ConditionalCheckFailed resets the stale window and re-allows', async () => {
  const client = throwingClient(conditionalFail());
  const result = await checkRateLimit(client, FakeUpdateCommand, OPTS);
  assert.deepEqual(result, { allowed: true, remaining: 19 });
  assert.equal(client.calls.length, 2, 'expected a reset send after the conditional failure');
  // The reset uses SET requestCount = :one, not the ADD increment.
  assert.match(client.calls[1].UpdateExpression, /SET requestCount = :one/);
});

test('ConditionalCheckFailed whose reset also throws fails open with remaining -1', async () => {
  const client = throwingClient(conditionalFail(), { resetThrows: true });
  const result = await checkRateLimit(client, FakeUpdateCommand, OPTS);
  assert.deepEqual(result, { allowed: true, remaining: -1 });
});

test('any other DynamoDB error fails open with remaining -1', async () => {
  const client = throwingClient(Object.assign(new Error('boom'), { name: 'ProvisionedThroughputExceededException' }));
  const result = await checkRateLimit(client, FakeUpdateCommand, OPTS);
  assert.deepEqual(result, { allowed: true, remaining: -1 });
  assert.equal(client.calls.length, 1, 'non-conditional errors must NOT trigger a reset send');
});

test('applies the prefix to the partition key', async () => {
  const client = countingClient(1);
  await checkRateLimit(client, FakeUpdateCommand, { ...OPTS, prefix: 'metrics-vitals-' });
  assert.ok(client.calls[0].Key.pk.startsWith('metrics-vitals-'));
});
```

- [ ] **Step 2: Run the test, expect PASS** (the implementation already exists — this is characterization/regression coverage of current behavior, so it should pass immediately and lock the behavior in).

```bash
node --test lambda/shared/__tests__/rateLimit.test.mjs
```

Expected tail:

```
ℹ pass 8
ℹ fail 0
```

If any assertion FAILS, the behavior diverges from the documented contract — stop and reconcile against `rateLimit.mjs:52` / `:58` / `:82` before continuing.

- [ ] **Step 3: Confirm the existing glob already picks it up** (no `package.json` change needed for this task).

```bash
npm run test:lambda 2>&1 | grep -E "rateLimit|pass|fail"
```

Expected: the run includes the 8 new rateLimit tests and overall `fail 0`.

- [ ] **Step 4: Commit**

```bash
git add lambda/shared/__tests__/rateLimit.test.mjs && git commit -m "test(lambda): cover shared rate limiter boundary, stale-window reset, and fail-open"
```

---

### Task 5.2: Extract + unit-test the metrics handler's pure validation logic

The metrics handler's AWS clients are module-level singletons, so we extract the no-AWS validation/routing decisions into `validation.mjs` and test those. This keeps `index.mjs` thin and matches the "pure module" precedent (`shared/metrics.mjs`).

- [ ] **Step 1: Write the failing test file** `lambda/metrics/__tests__/validation.test.mjs` (imports a module that does not exist yet → FAIL).

```mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateVitals, validateCspUri } from '../validation.mjs';

test('validateVitals rejects a missing name', () => {
  assert.equal(validateVitals({ value: 10 }).ok, false);
});

test('validateVitals rejects a non-numeric value', () => {
  assert.equal(validateVitals({ name: 'LCP', value: '10' }).ok, false);
});

test('validateVitals rejects an out-of-range value', () => {
  assert.equal(validateVitals({ name: 'LCP', value: 60001 }).ok, false);
  assert.equal(validateVitals({ name: 'LCP', value: -1 }).ok, false);
});

test('validateVitals rejects an unknown metric name', () => {
  assert.equal(validateVitals({ name: 'BOGUS', value: 10 }).ok, false);
});

test('validateVitals accepts a valid CLS sample with no rating', () => {
  const r = validateVitals({ name: 'CLS', value: 0.1 });
  assert.equal(r.ok, true);
  assert.deepEqual(r.dimensions, []);
});

test('validateVitals attaches a Rating dimension only for valid ratings', () => {
  assert.deepEqual(validateVitals({ name: 'INP', value: 200, rating: 'good' }).dimensions, [
    { Name: 'Rating', Value: 'good' },
  ]);
  assert.deepEqual(validateVitals({ name: 'INP', value: 200, rating: 'bogus' }).dimensions, []);
});

test('validateCspUri accepts known keywords and http(s) origins', () => {
  assert.equal(validateCspUri('inline'), true);
  assert.equal(validateCspUri('https://evil.example.com'), true);
});

test('validateCspUri rejects malformed blocked-uri values', () => {
  assert.equal(validateCspUri('javascript:alert(1)'), false);
  assert.equal(validateCspUri(''), false);
});
```

- [ ] **Step 2: Run, expect FAIL** (module not found).

```bash
node --test lambda/metrics/__tests__/validation.test.mjs
```

Expected: `Cannot find module '.../lambda/metrics/validation.mjs'`.

- [ ] **Step 3: Create `lambda/metrics/validation.mjs`** with the logic lifted verbatim from `index.mjs:23–28` and `:46–62` and `:84` (no AWS imports).

```mjs
// Pure, AWS-free validation helpers for the metrics handler.
// Extracted from index.mjs so they can be unit-tested without the
// module-level CloudWatch/DynamoDB singletons.

export const VALID_VITALS = new Set(['CLS', 'INP', 'FCP', 'LCP', 'TTFB']);
export const VALID_RATINGS = new Set(['good', 'needs-improvement', 'poor']);
export const VALID_CSP_KEYWORDS = new Set(['inline', 'eval', 'self', 'data', 'blob', 'unknown']);
const CSP_URI_PATTERN = /^https?:\/\/[\w.-]+$/;

/**
 * @param {{name?: unknown, value?: unknown, rating?: unknown}} body
 * @returns {{ok:true, dimensions:Array}|{ok:false, status:number, error:string}}
 */
export function validateVitals(body) {
  const { name, value, rating } = body;
  if (!name || typeof value !== 'number') {
    return { ok: false, status: 400, error: 'name and numeric value are required' };
  }
  if (!Number.isFinite(value) || value < 0 || value > 60000) {
    return { ok: false, status: 400, error: 'value must be a finite number between 0 and 60000' };
  }
  if (!VALID_VITALS.has(name)) {
    return { ok: false, status: 400, error: `Invalid metric name. Must be one of: ${[...VALID_VITALS].join(', ')}` };
  }
  const dimensions = [];
  if (rating && VALID_RATINGS.has(rating)) {
    dimensions.push({ Name: 'Rating', Value: rating });
  }
  return { ok: true, dimensions };
}

/** @param {string} blockedUri @returns {boolean} */
export function validateCspUri(blockedUri) {
  return VALID_CSP_KEYWORDS.has(blockedUri) || CSP_URI_PATTERN.test(blockedUri);
}
```

- [ ] **Step 4: Rewire `lambda/metrics/index.mjs` to consume the extracted module** (DRY — one source of truth). Edit the constants block at lines 23–28:

```mjs
// BEFORE (index.mjs:23-28)
const VALID_VITALS = new Set(['CLS', 'INP', 'FCP', 'LCP', 'TTFB']);
const VALID_RATINGS = new Set(['good', 'needs-improvement', 'poor']);

// Standard CSP blocked-uri values reported by browsers
const VALID_CSP_KEYWORDS = new Set(['inline', 'eval', 'self', 'data', 'blob', 'unknown']);
const CSP_URI_PATTERN = /^https?:\/\/[\w.-]+$/;

// AFTER
import { validateVitals, validateCspUri } from './validation.mjs';
```

Then replace the body of `handleVitals` (lines 46–62) so it delegates:

```mjs
// BEFORE (index.mjs:46-62)
async function handleVitals(body) {
  const { name, value, rating } = body;

  if (!name || typeof value !== "number") {
    return respond(400, { error: "name and numeric value are required" });
  }
  if (!Number.isFinite(value) || value < 0 || value > 60000) {
    return respond(400, { error: "value must be a finite number between 0 and 60000" });
  }
  if (!VALID_VITALS.has(name)) {
    return respond(400, { error: `Invalid metric name. Must be one of: ${[...VALID_VITALS].join(", ")}` });
  }

  const dimensions = [];
  if (rating && VALID_RATINGS.has(rating)) {
    dimensions.push({ Name: "Rating", Value: rating });
  }

// AFTER
async function handleVitals(body) {
  const { name, value } = body;
  const v = validateVitals(body);
  if (!v.ok) {
    return respond(v.status, { error: v.error });
  }
  const dimensions = v.dimensions;
```

And replace the CSP check at lines 84–86:

```mjs
// BEFORE (index.mjs:84-86)
if (!VALID_CSP_KEYWORDS.has(blockedUri) && !CSP_URI_PATTERN.test(blockedUri)) {
  return respond(400, { error: 'Invalid blocked-uri format' });
}

// AFTER
if (!validateCspUri(blockedUri)) {
  return respond(400, { error: 'Invalid blocked-uri format' });
}
```

- [ ] **Step 5: Run the new test, expect PASS, and lint the lambda.**

```bash
node --test lambda/metrics/__tests__/validation.test.mjs && npm run lint:lambda
```

Expected: `pass 8`, `fail 0`; lint exits 0. (Lint over `lambda` catches any now-unused import such as a leftover `value` binding.)

- [ ] **Step 6: Commit**

```bash
git add lambda/metrics/validation.mjs lambda/metrics/__tests__/validation.test.mjs lambda/metrics/index.mjs && git commit -m "refactor(metrics): extract pure validation into validation.mjs and unit-test it"
```

---

### Task 5.3: Extract + unit-test the kb-builder entry validator

`kb-builder/index.mjs:25` throws at import time if `SANITY_WRITE_TOKEN` is unset, so we cannot import the handler in a unit test without faking env + Sanity. `validateEntryFields` (lines 69–89) is pure — extract and test it.

- [ ] **Step 1: Write the failing test file** `lambda/kb-builder/__tests__/validation.test.mjs`.

```mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateEntryFields, CATEGORY_ORDER } from '../validation.mjs';

test('requireAll rejects a missing title/category/content', () => {
  assert.match(validateEntryFields({ category: 'biography', content: 'x' }, true), /required/);
  assert.equal(validateEntryFields({ title: 'T', category: 'biography', content: 'x' }, true), null);
});

test('rejects an over-length title', () => {
  assert.match(validateEntryFields({ title: 'a'.repeat(201) }), /at most 200/);
});

test('rejects a category outside the allowlist', () => {
  assert.match(validateEntryFields({ category: 'bogus' }), /must be one of/);
  assert.equal(validateEntryFields({ category: CATEGORY_ORDER[0] }), null);
});

test('rejects over-length content', () => {
  assert.match(validateEntryFields({ content: 'a'.repeat(50001) }), /at most 50000/);
});

test('rejects an unparseable date but accepts a valid one', () => {
  assert.match(validateEntryFields({ date: 'not-a-date' }), /valid date/);
  assert.equal(validateEntryFields({ date: '2026-01-15' }), null);
});

test('rejects sortOrder outside 0..1000', () => {
  assert.match(validateEntryFields({ sortOrder: -1 }), /between 0 and 1000/);
  assert.match(validateEntryFields({ sortOrder: 1001 }), /between 0 and 1000/);
  assert.equal(validateEntryFields({ sortOrder: 500 }), null);
});

test('empty patch (no fields, requireAll=false) is valid', () => {
  assert.equal(validateEntryFields({}, false), null);
});
```

- [ ] **Step 2: Run, expect FAIL** (module not found).

```bash
node --test lambda/kb-builder/__tests__/validation.test.mjs
```

Expected: `Cannot find module '.../lambda/kb-builder/validation.mjs'`.

- [ ] **Step 3: Create `lambda/kb-builder/validation.mjs`** with `CATEGORY_ORDER` (from `index.mjs:38–49`) and `validateEntryFields` (from `index.mjs:64–89`) lifted verbatim.

```mjs
// Pure, AWS/Sanity-free validation for kb-builder entries.
// Extracted from index.mjs so it can be unit-tested without the module-level
// Sanity client (which throws at import when SANITY_WRITE_TOKEN is unset).

export const CATEGORY_ORDER = [
  'biography',
  'military',
  'education',
  'career',
  'business',
  'skills',
  'awards',
  'philosophy',
  'podcast',
  'book',
];

const MAX_TITLE_LENGTH = 200;
const MAX_CONTENT_LENGTH = 50000;
const MAX_DATE_LENGTH = 20;
const MAX_SORT_ORDER = 1000;

export function validateEntryFields({ title, category, content, date, sortOrder }, requireAll = false) {
  if (requireAll && (!title || !category || !content)) {
    return 'title, category, and content are required';
  }
  if (title !== undefined && (typeof title !== 'string' || title.length > MAX_TITLE_LENGTH)) {
    return `title must be a string of at most ${MAX_TITLE_LENGTH} characters`;
  }
  if (category !== undefined && !CATEGORY_ORDER.includes(category)) {
    return `category must be one of: ${CATEGORY_ORDER.join(', ')}`;
  }
  if (content !== undefined && (typeof content !== 'string' || content.length > MAX_CONTENT_LENGTH)) {
    return `content must be a string of at most ${MAX_CONTENT_LENGTH} characters`;
  }
  if (
    date !== undefined &&
    date !== null &&
    (typeof date !== 'string' || date.length > MAX_DATE_LENGTH || isNaN(Date.parse(date)))
  ) {
    return 'date must be a valid date string';
  }
  if (
    sortOrder !== undefined &&
    sortOrder !== null &&
    (typeof sortOrder !== 'number' || sortOrder < 0 || sortOrder > MAX_SORT_ORDER)
  ) {
    return `sortOrder must be a number between 0 and ${MAX_SORT_ORDER}`;
  }
  return null;
}
```

- [ ] **Step 4: Rewire `lambda/kb-builder/index.mjs`** to import from the new module. Replace the constants + function at lines 64–89 (and note `CATEGORY_ORDER` at lines 38–49 is still used by `assembleDocument`, so import it from `validation.mjs` and delete the local copy to keep one source of truth).

Replace the local `CATEGORY_ORDER` declaration (lines 38–49) and the `MAX_*` constants + `validateEntryFields` (lines 64–89) with an import near the top (after the existing imports, e.g. after line 12):

```mjs
// ADD after the existing lambda-shared imports (index.mjs:12)
import { CATEGORY_ORDER, validateEntryFields } from './validation.mjs';
```

```mjs
// DELETE the local copy at index.mjs:38-49
const CATEGORY_ORDER = [
  "biography",
  ... (10 entries) ...
  "book",
];
```

```mjs
// DELETE the constants + function at index.mjs:64-89
const MAX_TITLE_LENGTH = 200;
const MAX_CONTENT_LENGTH = 50000;
const MAX_DATE_LENGTH = 20;
const MAX_SORT_ORDER = 1000;

function validateEntryFields({ title, category, content, date, sortOrder }, requireAll = false) {
  ... (full body) ...
  return null;
}
```

(`CATEGORY_LABELS` at lines 51–62 stays in `index.mjs` — it is document-assembly presentation, not validation.)

- [ ] **Step 5: Run the test + lint, expect PASS.**

```bash
node --test lambda/kb-builder/__tests__/validation.test.mjs && npm run lint:lambda
```

Expected: `pass 7`, `fail 0`; lint exits 0 (catches any duplicate/unused `CATEGORY_ORDER`).

- [ ] **Step 6: Commit**

```bash
git add lambda/kb-builder/validation.mjs lambda/kb-builder/__tests__/validation.test.mjs lambda/kb-builder/index.mjs && git commit -m "refactor(kb-builder): extract entry validation into validation.mjs and unit-test it"
```

---

### Task 5.4: Extend the `test:lambda` glob to include the two new test dirs

- [ ] **Step 1: Edit `package.json` line 16.** Append the two new globs to the existing `test:lambda` script.

```json
// BEFORE (package.json:16)
    "test:lambda": "node --test lambda/shared/__tests__/*.test.mjs lambda/blueprint/__tests__/*.test.mjs lambda/chat-stream/__tests__/*.test.mjs lambda/chat-stream/__tests__/tools/*.test.mjs lambda/mcp-server/__tests__/*.test.mjs",

// AFTER
    "test:lambda": "node --test lambda/shared/__tests__/*.test.mjs lambda/blueprint/__tests__/*.test.mjs lambda/chat-stream/__tests__/*.test.mjs lambda/chat-stream/__tests__/tools/*.test.mjs lambda/mcp-server/__tests__/*.test.mjs lambda/metrics/__tests__/*.test.mjs lambda/kb-builder/__tests__/*.test.mjs",
```

- [ ] **Step 2: Run the full lambda suite, expect every dir included and green.**

```bash
npm run test:lambda 2>&1 | tail -8
```

Expected: `fail 0`, and the total includes the 8 rateLimit + 8 metrics + 7 kb-builder tests added above.

- [ ] **Step 3: Confirm CI installs deps for the new dirs.** The new tests import only `node:test`, `node:assert`, and local `./validation.mjs` (zero third-party deps), and `validation.mjs` imports nothing external — so the CI "Install Lambda dependencies" step (`.github/workflows/ci.yml`, which runs `npm ci`/`npm install` only in `chat-stream`, `blueprint`, `shared`, `mcp-server`) does **not** need to add `metrics`/`kb-builder` installs for these tests to run. Verify with a clean check:

```bash
node --test lambda/metrics/__tests__/validation.test.mjs lambda/kb-builder/__tests__/validation.test.mjs 2>&1 | tail -4
```

Expected: `pass 15`, `fail 0` — proving the new tests need no `node_modules` in those dirs. (No CI install change required.)

- [ ] **Step 4: Commit**

```bash
git add package.json && git commit -m "test(lambda): add metrics + kb-builder validation tests to the test:lambda glob"
```

---

### Task 5.5: Add a CI job that runs the mock-stubbed Cypress specs against `vite preview`

Only the 7 specs that use `cy.intercept`/`cy.visit` against the built app (no real WebGL or live network) are gated. The three WebGL/real-Three.js specs (`home`, `navigation`, `mobile-navigation`) are deliberately **excluded** — they have no intercepts and flake headless on CI. `chat-widget` is also excluded here (it relies on the floating R3F `AltiMascot` 3D widget which needs WebGL); the mock-stubbed `chat` and `chat-agentic` specs cover the agent flows on the WebGL-free `/chat` page.

- [ ] **Step 1: Confirm the spec set and base URL.** `cypress.config.ts:5` sets `baseUrl: 'http://localhost:5173'` (the `vite preview` port). The gated specs:

```bash
ls cypress/e2e/{chat,chat-agentic,contact,blog,blog-post,404,about-pages}.cy.ts
```

Expected: all 7 paths listed (no "No such file").

- [ ] **Step 2: Append a `cypress-mocked` job to `.github/workflows/ci.yml`.** It mirrors the existing job's Node/cache setup (`actions/setup-node@v6` with `node-version-file: '.nvmrc'` + `cache: 'npm'`), builds the app with the same placeholder `VITE_*` env block already used by the `Build project` step, serves it with `vite preview --port 5173`, and runs Cypress against only the 7 mock-stubbed specs via `--spec`. Add this as a sibling job (same indentation level as `test-and-build:` and `lambda-audit:`):

```yaml
cypress-mocked:
  runs-on: ubuntu-latest
  steps:
    - name: Checkout code
      uses: actions/checkout@v6

    - name: Setup Node.js
      uses: actions/setup-node@v6
      with:
        node-version-file: '.nvmrc'
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Build project
      run: npm run build
      env:
        VITE_CONTACT_ENDPOINT: https://placeholder.example.com
        VITE_NEWSLETTER_ENDPOINT: https://placeholder.example.com
        VITE_CHAT_ENDPOINT: https://placeholder.example.com
        VITE_CHAT_SIGNING_KEY: ci-placeholder-key
        VITE_COGNITO_USER_POOL_ID: us-east-1_placeholder
        VITE_COGNITO_CLIENT_ID: placeholder
        VITE_KB_BUILDER_ENDPOINT: https://placeholder.example.com
        VITE_METRICS_ENDPOINT: https://placeholder.example.com

    - name: Run mock-stubbed Cypress specs
      uses: cypress-io/github-action@v6
      with:
        install: false
        start: npx vite preview --port 5173
        wait-on: 'http://localhost:5173'
        wait-on-timeout: 60
        # WebGL-dependent specs (home, navigation, mobile-navigation,
        # chat-widget) are intentionally excluded — they use no intercepts and
        # flake headless on CI. Only mock-stubbed flows run here.
        spec: >-
          cypress/e2e/404.cy.ts,
          cypress/e2e/about-pages.cy.ts,
          cypress/e2e/blog.cy.ts,
          cypress/e2e/blog-post.cy.ts,
          cypress/e2e/chat.cy.ts,
          cypress/e2e/chat-agentic.cy.ts,
          cypress/e2e/contact.cy.ts

    - name: Upload Cypress screenshots on failure
      if: failure()
      uses: actions/upload-artifact@v7
      with:
        name: cypress-screenshots
        path: cypress/screenshots/
        retention-days: 7
        if-no-files-found: ignore
```

Notes baked into the yaml:

- `cypress-io/github-action@v6` with `install: false` reuses the `npm ci` already run (Cypress is in `devDependencies` at `package.json:53`), avoiding a double install while still triggering the binary cache + `cypress run`.
- `start` + `wait-on` boots `vite preview` (port 5173, matching `cypress.config.ts:5`) and blocks until it answers, then runs the specs and tears the server down automatically.
- `cypress.config.ts:13` already sets `retries.runMode: 2`, so transient flakes auto-retry without extra config.

- [ ] **Step 3: Verify the workflow YAML parses and selects exactly the intended specs.**

```bash
python3 -c "import yaml,sys; d=yaml.safe_load(open('.github/workflows/ci.yml')); print('jobs:', list(d['jobs'].keys()))"
```

Expected:

```
jobs: ['test-and-build', 'lambda-audit', 'cypress-mocked']
```

- [ ] **Step 4: Smoke-test the exact command sequence locally** (proves the build + preview + spec selection works before pushing to CI). Run in two terminals or background the preview:

```bash
npm run build && (npx vite preview --port 5173 &) && npx wait-on http://localhost:5173 && npx cypress run --spec "cypress/e2e/404.cy.ts,cypress/e2e/about-pages.cy.ts,cypress/e2e/blog.cy.ts,cypress/e2e/blog-post.cy.ts,cypress/e2e/chat.cy.ts,cypress/e2e/chat-agentic.cy.ts,cypress/e2e/contact.cy.ts"
```

Expected: Cypress prints a final run table with all 7 specs and `✔ All specs passed`. (Stop the backgrounded preview afterward: `kill %1` or `pkill -f "vite preview"`.)

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml && git commit -m "ci: run mock-stubbed Cypress specs against vite preview"
```

---

### Task 5.6 (Optional): Document the WebGL-spec exclusion so the gap is intentional, not forgotten

- [ ] **Step 1: Add a one-line note to `cypress.config.ts`** above `setupNodeEvents` explaining which specs CI runs vs. skips, so a future contributor doesn't "fix CI" by adding the flaky WebGL specs.

```ts
// BEFORE (cypress.config.ts:17-19)
    setupNodeEvents() {
      // Node event listeners can be added here
    },

// AFTER
    // CI (.github/workflows/ci.yml `cypress-mocked` job) runs ONLY the
    // mock-stubbed specs (404, about-pages, blog, blog-post, chat,
    // chat-agentic, contact). The WebGL-dependent specs (home, navigation,
    // mobile-navigation, chat-widget) rely on real Three.js and flake headless,
    // so they are dev/local only.
    setupNodeEvents() {
      // Node event listeners can be added here
    },
```

- [ ] **Step 2: Verify it still parses** (TypeScript config is type-checked by the build's `tsc` step, but a quick lint confirms no syntax break).

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i cypress.config || echo "cypress.config.ts OK"
```

Expected: `cypress.config.ts OK`.

- [ ] **Step 3: Commit**

```bash
git add cypress.config.ts && git commit -m "docs(cypress): note which specs CI gates vs. skips for WebGL flakiness"
```

---

## Recommendation 6: Contain WebGL failures behind a reusable SafeCanvas + capability gate

**Why it matters:** `ChatWidget` (with its 3D `AltiMascot`) is mounted in `App.tsx:85` _outside_ the global `ErrorBoundary` (which wraps only `<main>` Routes at `App.tsx:46–82`), so an uncaught render-phase error in `AltiMascot` — a GLB parse failure, R3F init error, or `useGLTF` Suspense rejection — unmounts the entire app to a blank screen. `HeroCanvas` is inside the global boundary but still has no WebGL gate, so unsupported GPUs attempt a Canvas mount that can throw.

**Impact:** High (eliminates a full-app blank-screen failure mode) · **Effort:** Medium · **Risk:** Low (additive wrapper + existing capability util; no behavior change on supported GPUs).

**Depends on:** none.

**Correctness boundary (encode in every reviewer's head):** React error boundaries catch ONLY render / lifecycle / Suspense errors — NOT errors thrown inside the `rAF` loop (`useFrame`) nor from `webglcontextlost` DOM events (there is no `webglcontextlost` handler anywhere in `src/`). So the complete fix is BOTH layers: (a) a reusable `SafeCanvas` wrapper (Suspense + ErrorBoundary + fallback) that catches GLB-parse / R3F-init / `useGLTF`-Suspense errors at mount, AND (b) gating the mount behind the existing `checkWebGLSupport()` (`src/utils/checkWebGL.ts`) so unsupported GPUs never mount the canvas at all. `HeroCanvas` already has a static gradient behind it (`Home.tsx:115`) so its fallback is `null`; `AltiMascot` has NO static fallback today, so it needs a simple static icon/button fallback (NOT `null`).

**Files**

- Create: `src/components/SafeCanvas.tsx`
- Create (test): `src/components/SafeCanvas.test.tsx`
- Modify: `src/components/chat/ChatWidgetButton.tsx` (currently 1–25; `Suspense fallback={null}` at line 18)
- Modify: `src/components/chat/ChatWidgetButton.test.tsx` (1–49)
- Modify: `src/pages/Home.tsx` (hero mount region 117–126)
- Modify: `src/components/home/HeroCanvas.test.tsx` (assertions 56–79)
- (Optional) Modify: `src/components/aws/TopologyScene.tsx` (frameloop type at 43–44, 304; hidden-tab logic at 162–171, 312)

The reusable `SafeCanvas` reuses the existing `ErrorBoundary` (`src/components/ErrorBoundary.tsx`) — which already supports a custom `fallback` prop (line 8, rendered at 42–44) — exactly as `InfraTopology.tsx:76` does (`<ErrorBoundary fallback={<TopologyFallback2D />}>`). DRY: no new boundary class.

---

### Task 6.1: Create the reusable `SafeCanvas` wrapper (TDD)

`SafeCanvas` composes `ErrorBoundary` + `Suspense` so any child that throws during mount (or suspends) is contained and the `fallback` is shown instead of propagating. It is transport-agnostic of the 3D lib — it just wraps `children`.

- [ ] **Step 1: Write the failing test.** Create `src/components/SafeCanvas.test.tsx`. The `Boom` child throws synchronously on render; assert the fallback renders and the throw does NOT propagate out of `SafeCanvas`. Mirror the `cleanup()` / `vi` conventions already used in `HeroCanvas.test.tsx` (lines 1–2, 52–54).

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import SafeCanvas from './SafeCanvas';

// A child that throws during render — simulates a GLB-parse / R3F-init failure.
function Boom(): never {
  throw new Error('webgl mount failed');
}

describe('SafeCanvas', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders children when they mount cleanly', () => {
    render(
      <SafeCanvas fallback={<div data-testid="fallback" />}>
        <div data-testid="child">ok</div>
      </SafeCanvas>,
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.queryByTestId('fallback')).not.toBeInTheDocument();
  });

  it('renders the fallback and does NOT propagate when a child throws on mount', () => {
    // ErrorBoundary.componentDidCatch console.errors; silence it for a clean run.
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() =>
      render(
        <SafeCanvas fallback={<div data-testid="fallback" />}>
          <Boom />
        </SafeCanvas>,
      ),
    ).not.toThrow();

    expect(screen.getByTestId('fallback')).toBeInTheDocument();
    expect(screen.queryByTestId('child')).not.toBeInTheDocument();
    errSpy.mockRestore();
  });

  it('defaults to a null fallback when none is provided (no crash)', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() =>
      render(
        <SafeCanvas>
          <Boom />
        </SafeCanvas>,
      ),
    ).not.toThrow();
    errSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run the test, expect FAIL** (module does not exist yet).

```bash
npx vitest run src/components/SafeCanvas.test.tsx
```

Expected: failure with `Failed to resolve import "./SafeCanvas"` (or `Cannot find module './SafeCanvas'`).

- [ ] **Step 3: Implement `SafeCanvas`.** Create `src/components/SafeCanvas.tsx`. It wraps the existing `ErrorBoundary` (note: `ErrorBoundary` renders a fallback only when one is provided — when `fallback` is `undefined` it shows its full-screen default page, which is wrong for a tiny widget, so default `fallback` to `null`). `showHomeButton={false}` keeps the default boundary UI from ever rendering a "Go Home" page if a `null` fallback path is somehow hit.

```tsx
import { ReactNode, Suspense } from 'react';
import ErrorBoundary from './ErrorBoundary';

interface SafeCanvasProps {
  /** The 3D Canvas tree (R3F <Canvas>...) to render. */
  children: ReactNode;
  /**
   * Shown when the canvas tree throws on mount (GLB parse / R3F init /
   * useGLTF Suspense rejection) OR while it suspends. Defaults to null —
   * callers that have a static visual behind the canvas can omit it; callers
   * with no static fallback (e.g. the chat mascot) MUST pass one.
   *
   * NOTE: an error boundary cannot catch errors thrown from the rAF loop
   * (useFrame) or from webglcontextlost DOM events — only render/lifecycle/
   * Suspense errors. Gate the mount with checkWebGLSupport() to avoid those.
   */
  fallback?: ReactNode;
}

/**
 * Reusable containment wrapper for WebGL canvases: Suspense (for lazy GLB /
 * useGLTF) + ErrorBoundary (for mount-time throws), both resolving to the same
 * fallback so a failed 3D mount degrades gracefully instead of unmounting the
 * surrounding tree.
 */
const SafeCanvas = ({ children, fallback = null }: SafeCanvasProps) => (
  <ErrorBoundary fallback={fallback} showHomeButton={false}>
    <Suspense fallback={fallback}>{children}</Suspense>
  </ErrorBoundary>
);

export default SafeCanvas;
```

- [ ] **Step 4: Run the test, expect PASS.**

```bash
npx vitest run src/components/SafeCanvas.test.tsx
```

Expected: `Test Files 1 passed`, `Tests 3 passed`.

- [ ] **Step 5: Commit.**

```bash
git add src/components/SafeCanvas.tsx src/components/SafeCanvas.test.tsx && git commit -m "feat(3d): add reusable SafeCanvas wrapper (Suspense + ErrorBoundary)"
```

---

### Task 6.2: Gate + contain `AltiMascot` (the high-blast-radius mount, TDD)

`ChatWidgetButton.tsx:18` currently wraps `AltiMascot` in only `<Suspense fallback={null}>`. Because `ChatWidget` is mounted at `App.tsx:85` outside the global boundary, this is the critical fix. We (a) wrap with `SafeCanvas`, (b) gate the 3D mount behind `checkWebGLSupport()`, and (c) provide a static icon fallback (NOT `null`) so the button is still usable without WebGL.

- [ ] **Step 1: Update the test first.** Edit `src/components/chat/ChatWidgetButton.test.tsx`. Keep the existing AltiMascot mock (lines 7–11) and the five existing tests, but add a `checkWebGLSupport` mock and two new assertions: when WebGL is supported the mascot mounts; when unsupported, a static fallback icon renders instead and the button still works. Add this mock block immediately after the existing `vi.mock('./AltiMascot', ...)` block (after line 11):

```tsx
// WebGL capability gate — controllable per test.
import { checkWebGLSupport } from '../../utils/checkWebGL';
vi.mock('../../utils/checkWebGL', () => ({
  checkWebGLSupport: vi.fn(() => true),
}));
const mockedCheckWebGL = vi.mocked(checkWebGLSupport);
```

Then add a `beforeEach` reset and two tests inside the existing `describe('ChatWidgetButton', ...)` block (e.g. after the closing `});` of the last existing test at line 48). Update the imports on line 1 to include `beforeEach`:

```tsx
// line 1 — before:
import { describe, it, expect, vi } from 'vitest';
// line 1 — after:
import { describe, it, expect, vi, beforeEach } from 'vitest';
```

```tsx
beforeEach(() => {
  mockedCheckWebGL.mockReturnValue(true);
});

it('mounts the 3D mascot when WebGL is supported', async () => {
  mockedCheckWebGL.mockReturnValue(true);
  render(<ChatWidgetButton isOpen={false} onClick={vi.fn()} />);
  expect(await screen.findByTestId('alti-mascot')).toBeInTheDocument();
  expect(screen.queryByTestId('alti-fallback')).not.toBeInTheDocument();
});

it('renders a static fallback (not the 3D mascot) when WebGL is unsupported, and stays clickable', async () => {
  mockedCheckWebGL.mockReturnValue(false);
  const onClick = vi.fn();
  render(<ChatWidgetButton isOpen={false} onClick={onClick} />);

  expect(screen.getByTestId('alti-fallback')).toBeInTheDocument();
  expect(screen.queryByTestId('alti-mascot')).not.toBeInTheDocument();

  const user = userEvent.setup();
  await user.click(screen.getByRole('button'));
  expect(onClick).toHaveBeenCalledOnce();
});
```

- [ ] **Step 2: Run the test, expect FAIL** (no `alti-fallback`, gate not yet wired).

```bash
npx vitest run src/components/chat/ChatWidgetButton.test.tsx
```

Expected: the two new tests fail — `Unable to find an element by: [data-testid="alti-fallback"]` and the unsupported-case still finds `alti-mascot`.

- [ ] **Step 3: Implement the gate + SafeCanvas in `ChatWidgetButton.tsx`.** Replace the whole file. The fallback is a static `support_agent` Material Icon (Material Icons are loaded via CDN per CLAUDE.md; no emoji) sized to match the 64px mascot footprint, with the same gold glow language as the mascot platform. The `data-testid` attrs are inert in production.

```tsx
// src/components/chat/ChatWidgetButton.tsx — full replacement
import { lazy } from 'react';
import SafeCanvas from '../SafeCanvas';
import { checkWebGLSupport } from '../../utils/checkWebGL';

const AltiMascot = lazy(() => import('./AltiMascot'));

interface ChatWidgetButtonProps {
  isOpen: boolean;
  onClick: () => void;
}

// Static, WebGL-free stand-in for the 3D mascot: shown on unsupported GPUs
// and if the 3D mount throws. Keeps the button meaningful and clickable.
const MascotFallback = () => (
  <div
    data-testid="alti-fallback"
    className="w-16 h-16 flex items-center justify-center rounded-full"
    style={{
      background: 'radial-gradient(circle at center, rgba(197,165,114,0.18) 0%, transparent 70%)',
    }}
  >
    <span className="material-icons text-altivum-gold text-3xl">support_agent</span>
  </div>
);

const ChatWidgetButton = ({ isOpen, onClick }: ChatWidgetButtonProps) => {
  const webglOk = checkWebGLSupport();

  return (
    <button
      onClick={onClick}
      aria-label={isOpen ? 'Close chat' : 'Open chat'}
      aria-expanded={isOpen}
      className="fixed bottom-6 right-6 z-40 flex items-center justify-center cursor-pointer bg-transparent border-none p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-altivum-gold focus-visible:ring-offset-2 focus-visible:ring-offset-altivum-dark"
    >
      {webglOk ? (
        <SafeCanvas fallback={<MascotFallback />}>
          <AltiMascot isOpen={isOpen} />
        </SafeCanvas>
      ) : (
        <MascotFallback />
      )}
    </button>
  );
};

export default ChatWidgetButton;
```

- [ ] **Step 4: Run the test, expect PASS.**

```bash
npx vitest run src/components/chat/ChatWidgetButton.test.tsx
```

Expected: `Tests 7 passed` (5 original + 2 new). The original tests 28–39 still pass because the default mock returns `true`, so the mascot mounts.

- [ ] **Step 5: Commit.**

```bash
git add src/components/chat/ChatWidgetButton.tsx src/components/chat/ChatWidgetButton.test.tsx && git commit -m "fix(chat): gate + contain AltiMascot WebGL mount behind SafeCanvas

ChatWidget mounts outside the global ErrorBoundary, so an uncaught render
error in AltiMascot unmounted the whole app. Gate on checkWebGLSupport()
and wrap in SafeCanvas with a static support_agent fallback."
```

---

### Task 6.3: Gate + contain `HeroCanvas` (TDD)

`Home.tsx:120–126` mounts `HeroCanvas` behind only `!reducedMotion` + `<Suspense fallback={null}>`. The static gradient at `Home.tsx:115` is always behind it, so the fallback stays `null`. We add the `checkWebGLSupport()` gate and swap the bare `<Suspense>` for `<SafeCanvas>`.

- [ ] **Step 1: Update the HeroCanvas test first.** Edit `src/components/home/HeroCanvas.test.tsx`. Add a `checkWebGLSupport` mock (controllable, default `true`) and a new test asserting the Canvas is NOT mounted when WebGL is unsupported even though motion is allowed. Add this mock immediately after the `useMediaQuery` mock block (after line 22):

```tsx
// WebGL capability gate — controllable per test, default supported.
import { checkWebGLSupport } from '../../utils/checkWebGL';
vi.mock('../../utils/checkWebGL', () => ({
  checkWebGLSupport: vi.fn(() => true),
}));
const mockedCheckWebGL = vi.mocked(checkWebGLSupport);
```

Reset it in the existing `beforeEach` (currently lines 47–50) by adding one line:

```tsx
beforeEach(() => {
  reducedMotionRef.current = false;
  mockedCheckWebGL.mockReturnValue(true);
  vi.clearAllMocks();
});
```

> Note: `vi.clearAllMocks()` resets the `mockReturnValue`, so set it _after_ — reorder if needed:

```tsx
beforeEach(() => {
  vi.clearAllMocks();
  reducedMotionRef.current = false;
  mockedCheckWebGL.mockReturnValue(true);
});
```

Then add a third test after the existing two (after line 79):

```tsx
it('does not mount the Canvas when WebGL is unsupported, even with motion allowed', async () => {
  reducedMotionRef.current = false;
  mockedCheckWebGL.mockReturnValue(false);
  renderHome();

  expect(screen.getByAltText('Leadership Forged in Service')).toBeInTheDocument();
  await Promise.resolve();
  expect(screen.queryByTestId('hero-canvas')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test, expect FAIL** (gate not wired; Canvas still mounts when unsupported).

```bash
npx vitest run src/components/home/HeroCanvas.test.tsx
```

Expected: the new test fails — `hero-canvas` is found despite `checkWebGLSupport` returning `false`.

- [ ] **Step 3: Wire the gate + SafeCanvas in `Home.tsx`.** Add the import near the other component imports (after line 11, `import SocialIcon ...`):

```tsx
// after line 11
import SafeCanvas from '../components/SafeCanvas';
import { checkWebGLSupport } from '../utils/checkWebGL';
```

Compute the gate next to `reducedMotion` (currently line 22):

```tsx
// line 22 — before:
const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
// after:
const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
const webglOk = checkWebGLSupport();
```

Replace the hero backdrop block (currently lines 120–126):

```tsx
// before (Home.tsx:120-126):
{
  !reducedMotion && (
    <div className="absolute inset-0" aria-hidden="true">
      <Suspense fallback={null}>
        <HeroCanvas heroRef={heroRef} />
      </Suspense>
    </div>
  );
}
```

```tsx
// after:
{
  !reducedMotion && webglOk && (
    <div className="absolute inset-0" aria-hidden="true">
      {/* Static gradient behind (above) is the fallback, so null is fine. */}
      <SafeCanvas>
        <HeroCanvas heroRef={heroRef} />
      </SafeCanvas>
    </div>
  );
}
```

> The `Suspense` import on line 1 (`import { lazy, Suspense, useRef }`) is still used elsewhere? Verify: it is only used here. After this edit, drop `Suspense` from the line-1 import to avoid an unused-import lint error.

```tsx
// line 1 — before:
import { lazy, Suspense, useRef } from 'react';
// after:
import { lazy, useRef } from 'react';
```

- [ ] **Step 4: Run the test, expect PASS.**

```bash
npx vitest run src/components/home/HeroCanvas.test.tsx
```

Expected: `Tests 3 passed`.

- [ ] **Step 5: Lint to confirm no unused `Suspense`.**

```bash
npm run lint
```

Expected: exits 0, no `'Suspense' is defined but never used` error from `src/pages/Home.tsx`.

- [ ] **Step 6: Commit.**

```bash
git add src/pages/Home.tsx src/components/home/HeroCanvas.test.tsx && git commit -m "fix(home): gate + contain HeroCanvas WebGL mount behind SafeCanvas"
```

---

### Task 6.4: Full verification gate

- [ ] **Step 1: Run the three affected test files together, expect all PASS.**

```bash
npx vitest run src/components/SafeCanvas.test.tsx src/components/chat/ChatWidgetButton.test.tsx src/components/home/HeroCanvas.test.tsx
```

Expected: `Test Files 3 passed`, `Tests 13 passed` (3 + 7 + 3).

- [ ] **Step 2: Run the full build to confirm tsc + lint + vite all pass with the new wrapper and dropped import.**

```bash
npm run build
```

Expected: pipeline completes through `vite build` with no TypeScript or ESLint errors; `dist/` emitted.

- [ ] **Step 3: Commit (only if build surfaced an incidental fix; otherwise skip).**

```bash
git add -A && git commit -m "chore(3d): verify SafeCanvas integration builds clean"
```

---

### Task 6.5 (Optional): Align `TopologyScene` frameloop with the hide-on-hidden policy

Lower priority — parity only. `TopologyScene.tsx:312` uses `frameloop={frameloopMode}` typed `'always' | 'demand'` (declared at `:43–44` and `:304`) and merely toggles `controls.autoRotate` off when `document.hidden` inside `useFrame` (`:165–171`) — which still runs the rAF loop. `HeroCanvas` (`:181–185`) and `AltiMascot` (`:82–86`) instead set `frameloop='never'` when hidden, fully pausing the loop. This task brings `TopologyScene` to the same battery/GPU policy.

- [ ] **Step 1: Widen the `frameloopMode` type to include `'never'`.** In `src/components/aws/TopologyScene.tsx`, update the `SceneContentProps` type (lines 43–44) and the `useState` declaration (line 304).

```tsx
// lines 43-44 — before:
  frameloopMode: 'always' | 'demand';
  setFrameloopMode: (mode: 'always' | 'demand') => void;
// after:
  frameloopMode: 'always' | 'demand' | 'never';
  setFrameloopMode: (mode: 'always' | 'demand' | 'never') => void;
```

```tsx
// line 304 — before:
const [frameloopMode, setFrameloopMode] = useState<'always' | 'demand'>('always');
// after:
const [frameloopMode, setFrameloopMode] = useState<'always' | 'demand' | 'never'>('always');
```

- [ ] **Step 2: Drive `frameloop='never'` on tab hide in the public component.** Add a `docVisible` state + visibility listener to `TopologyScene` (the public function at `:302`), mirroring `HeroCanvas.tsx:113–120`, and force `'never'` when hidden. Add to the function body just after line 308 (`const onSelectCluster = ...`):

```tsx
const [docVisible, setDocVisible] = useState(() => (typeof document === 'undefined' ? true : !document.hidden));
useEffect(() => {
  const onVisibility = () => setDocVisible(!document.hidden);
  document.addEventListener('visibilitychange', onVisibility);
  return () => document.removeEventListener('visibilitychange', onVisibility);
}, []);
```

> `useEffect` is already imported (line 1). Then change the Canvas frameloop prop (line 312):

```tsx
// line 312 — before:
      frameloop={frameloopMode}
// after:
      frameloop={docVisible ? frameloopMode : 'never'}
```

- [ ] **Step 3: Remove the now-redundant hidden-tab autoRotate branch** in `SceneContent` (lines 165–171), since the loop no longer runs when hidden:

```tsx
// lines 165-171 — before:
useFrame(() => {
  if (document.hidden && controlsRef.current) {
    controlsRef.current.autoRotate = false;
  } else if (controlsRef.current) {
    controlsRef.current.autoRotate = autoRotate;
  }
});
// after:
useFrame(() => {
  if (controlsRef.current) {
    controlsRef.current.autoRotate = autoRotate;
  }
});
```

- [ ] **Step 4: Verify the existing InfraTopology test still passes and the build is clean.**

```bash
npx vitest run src/components/aws/__tests__/InfraTopology.test.tsx && npm run build
```

Expected: `Tests 2 passed`; build completes with no tsc error on the widened `'never'` union.

- [ ] **Step 5: Commit.**

```bash
git add src/components/aws/TopologyScene.tsx && git commit -m "perf(3d): pause TopologyScene frameloop on tab hide for parity"
```

---

## Recommendation 7: Harden the chat streaming channel (3 independent fixes)

**Why it matters** The NUL-framed wire protocol, the cross-request `finally` block, and the unbounded agent loop are three small holes in the chat channel: a forged event frame from model output, a clobbered controller from an out-of-order `finally`, and a tool-call loop bounded only by a 25s wall-clock timeout. Each is cheap defense-in-depth.

**Impact:** Medium · **Effort:** Medium · **Risk:** Medium (touches the live chat hot path; all three are covered by new + existing tests)

**Depends on** Recommendation 1 — fix (2) edits `src/hooks/useChatEngine.ts` in the same `handleSend` region (`~129-356`) that Recommendation 1 touches. **Sequence this AFTER Recommendation 1 and re-verify the quoted line numbers before editing**, since they will have shifted.

**Files**

- Modify `lambda/chat-stream/agent.mjs` — fix (1): NUL-strip at line 110; fix (3): `buildAgent` at lines 43-61 + `streamAgentResponse` cancel wiring at lines 82-100.
- Test `lambda/chat-stream/__tests__/agent.test.mjs` — add fix (1) test after line 124; add fix (3) tests after line 209.
- Modify `src/hooks/useChatEngine.ts` — fix (2): capture identities at lines 133-134 + 159-160; guard `finally` at lines 348-353.
- Test `src/hooks/useChatEngine.test.ts` — add fix (2) test inside the `abort-on-resend` describe block (after line 449) or a new describe block before line 732.
- Reference only (do not edit): `lambda/chat-stream/events.mjs` (delim `\x00EVT\x00` at line 1), `lambda/chat-stream/index.mjs` (intentional NUL writes at 50/63/96), `lambda/chat-stream/prompts.mjs` (prompt-only cap at lines 34-35).

**Verified facts that correct the brief**

- The frontend test file is at `src/hooks/useChatEngine.test.ts` (colocated), **not** `src/hooks/__tests__/useChatEngine.test.ts`.
- **Strands Agents SDK v1.0.0-rc.4 has NO declarative `maxIterations` / recursion-limit option.** I inspected the installed `AgentConfig` type (`node_modules/@strands-agents/sdk/dist/src/agent/agent.d.ts`) and the official agent-loop docs. The only loop-bounding mechanisms are `agent.cancel()` and the `cancelSignal` AbortSignal (already used for the 25s timeout). The canonical way to impose a programmatic tool-iteration cap is to **count loop cycles via the `BeforeModelCallEvent` hook** (which fires once per model invocation = once per loop cycle) and call `agent.cancel()` when the cap is exceeded. Fix (3) is implemented this way. Both `addHook(EventClass, cb)` and the `BeforeModelCallEvent` export are present and verified.

---

### Task 7.1: NUL-strip the model-text write path (fix 1)

The event delimiter is `\x00EVT\x00` (`events.mjs:1`) and the system prefix is `\x00SYS\x00` (`index.mjs:50`). A literal U+0000 inside model output, written raw at `agent.mjs:110` (`responseStream.write(text);`), could forge frame boundaries on the wire. Strip NUL from the model-text path **only** — never from the intentional-delimiter writes in `events.mjs` / `index.mjs`.

- [ ] **Step 1: Write the failing test.** Append this after line 124 (end of the `"streamAgentResponse writes text deltas"` test) in `lambda/chat-stream/__tests__/agent.test.mjs`.

```mjs
test('streamAgentResponse strips NUL from model text but keeps normal text', async () => {
  const agent = makeAgent(
    [
      {
        type: 'modelStreamUpdateEvent',
        event: {
          type: 'modelContentBlockDeltaEvent',
          delta: { type: 'textDelta', text: 'be\x00fore\x00EVT\x00{"x":1}\x00EVT\x00' },
        },
      },
      {
        type: 'modelStreamUpdateEvent',
        event: { type: 'modelContentBlockDeltaEvent', delta: { type: 'textDelta', text: ' clean tail.' } },
      },
    ],
    { stopReason: 'end_turn' },
  );
  const stream = fakeStream();
  const res = await streamAgentResponse({ agent, userMessage: 'x', responseStream: stream });
  assert.equal(res.hadText, true);
  // No NUL byte survives in any text chunk -> no forged frame delimiters.
  const joined = textChunks(stream).join('');
  assert.equal(joined.includes('\x00'), false);
  // Visible characters (minus the stripped NULs) are preserved verbatim.
  assert.equal(joined, 'beforeEVT{"x":1}EVT clean tail.');
  // The agent emitted zero real event frames; the forged ones did not become events.
  assert.equal(eventChunks(stream).length, 0);
});
```

- [ ] **Step 2: Run the test, expect FAIL.**

```bash
node --test lambda/chat-stream/__tests__/agent.test.mjs
```

Expected: the new test fails (the raw `\x00` survives, so `joined.includes("\x00")` is `true`). Example failure line: `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: true !== false`.

- [ ] **Step 3: Implement the strip.** In `lambda/chat-stream/agent.mjs`, edit line 110 (inside the `modelStreamUpdateEvent` case).

Before:

```mjs
        if (text) {
          responseStream.write(text);
          hadText = true;
          onText?.(text);
          break;
        }
```

After:

```mjs
        if (text) {
          // Defense-in-depth: the wire protocol is NUL-framed (events.mjs \x00EVT\x00,
          // index.mjs \x00SYS\x00). A literal U+0000 in MODEL output could forge a frame,
          // so strip NUL from this model-text path only. Never strip the intentional
          // delimiter writes in events.mjs / index.mjs.
          responseStream.write(text.replace(/\x00/g, ""));
          hadText = true;
          onText?.(text);
          break;
        }
```

Note: `onText?.(text)` keeps the original (unstripped) text — `onText` is an internal accumulator callback, not a wire write, so NUL there is harmless and stripping it would diverge from what the model actually produced.

- [ ] **Step 4: Run the test, expect PASS.**

```bash
node --test lambda/chat-stream/__tests__/agent.test.mjs
```

Expected: all tests pass, including `streamAgentResponse strips NUL from model text but keeps normal text`. Look for `# pass` count incremented by 1 and `# fail 0`.

- [ ] **Step 5: Commit.**

```bash
git add lambda/chat-stream/agent.mjs lambda/chat-stream/__tests__/agent.test.mjs && git commit -m "fix(chat): strip NUL from model-text write path to prevent forged event frames"
```

---

### Task 7.2: Identity-guarded `finally` in handleSend (fix 2)

> **Re-verify line numbers first** — Recommendation 1 edits this same function. The quotes below are from the current `src/hooks/useChatEngine.ts`.

Today the `finally` block (lines 348-353) unconditionally nulls `abortControllerRef.current` / `streamingMessageIdRef.current` and calls `setIsStreaming(false)`. If request A's `finally` runs after request B has already started (B replaced the refs at lines 134 + 160), A's cleanup nulls **B's** controller — breaking the unmount-abort at lines 104-106 — and clears B's streaming UI (`streamingMessageId` at line 398). The brief's "30s timer leak" sub-claim is **false**: each `finally` clears its own captured `timeoutId` (line 349), and B's timeout closure (line 135) captures B's own `controller`. Only the ref/state nulling needs guarding.

- [ ] **Step 1: Write the failing test.** Add this new describe block in `src/hooks/useChatEngine.test.ts` immediately before the final closing `});` of the top-level `describe('useChatEngine', ...)` (i.e., before line 732). It drives A then B, lets A's `finally` run last, and asserts B's controller + streaming survive.

```ts
describe('identity-guarded finally (out-of-order completion)', () => {
  it("request A's finally must not clobber request B's controller or streaming state", async () => {
    // A hangs until we release it; it will be aborted by B's send.
    let releaseA: () => void = () => {};
    const aDone = new Promise<void>((resolve) => {
      releaseA = resolve;
    });

    const aborts: AbortSignal[] = [];
    let callCount = 0;

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url, opts) => {
        callCount++;
        aborts.push(opts.signal);
        if (callCount === 1) {
          // Request A: reject with AbortError only AFTER we manually release it,
          // simulating A's promise settling LATE (after B already started).
          return new Promise((_resolve, reject) => {
            aDone.then(() => {
              const err = new Error('Aborted');
              err.name = 'AbortError';
              reject(err);
            });
          });
        }
        // Request B: a stream that stays open so B is "in flight" while A settles.
        let read = 0;
        return Promise.resolve({
          ok: true,
          body: {
            getReader: () => ({
              read: vi.fn().mockImplementation(() => {
                read++;
                if (read === 1) {
                  return new Promise(() => {}); // never resolves -> B stays streaming
                }
                return Promise.resolve({ done: true, value: undefined });
              }),
            }),
          },
        });
      }),
    );

    const { result } = renderHook(() => useChatEngine());

    // Start A (do not await; it hangs).
    act(() => {
      result.current.handleSend('A');
    });
    // Start B; this aborts A's controller but B keeps streaming.
    act(() => {
      result.current.handleSend('B');
    });

    // B is the current in-flight request.
    expect(result.current.isStreaming).toBe(true);
    const bStreamingId = result.current.streamingMessageId;
    expect(bStreamingId).not.toBeNull();

    // Now let A's promise settle LAST -> A's finally runs after B started.
    await act(async () => {
      releaseA();
      await Promise.resolve();
      await Promise.resolve();
    });

    // GUARD: A's finally must NOT have cleared B's streaming UI...
    expect(result.current.isStreaming).toBe(true);
    expect(result.current.streamingMessageId).toBe(bStreamingId);
    // ...and B's controller must survive so unmount-abort still works.
    expect(aborts[1].aborted).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test, expect FAIL.**

```bash
npx vitest run src/hooks/useChatEngine.test.ts -t "must not clobber request B's controller"
```

Expected FAIL: A's unguarded `finally` sets `setIsStreaming(false)` and nulls `streamingMessageIdRef.current`, so `result.current.isStreaming` is `false` and `streamingMessageId` is `null`. Example: `expected false to be true`.

- [ ] **Step 3: Capture per-request identities at request start.** In `src/hooks/useChatEngine.ts`, edit the controller setup (lines 133-135).

Before:

```ts
const controller = new AbortController();
abortControllerRef.current = controller;
const timeoutId = setTimeout(() => controller.abort(), 30_000);
```

After:

```ts
const controller = new AbortController();
abortControllerRef.current = controller;
const myController = controller;
const timeoutId = setTimeout(() => controller.abort(), 30_000);
```

- [ ] **Step 4: Capture the assistant-message identity.** Edit lines 159-161.

Before:

```ts
const assistantMessageId = `assistant-${Date.now()}`;
streamingMessageIdRef.current = assistantMessageId;
setIsStreaming(true);
```

After:

```ts
const assistantMessageId = `assistant-${Date.now()}`;
const myId = assistantMessageId;
streamingMessageIdRef.current = assistantMessageId;
setIsStreaming(true);
```

- [ ] **Step 5: Guard the `finally` block.** Edit lines 348-353.

Before:

```ts
      } finally {
        clearTimeout(timeoutId);
        setIsStreaming(false);
        streamingMessageIdRef.current = null;
        abortControllerRef.current = null;
      }
```

After:

```ts
      } finally {
        clearTimeout(timeoutId);
        // Only clear the shared refs/UI if THIS request is still the active one.
        // A late-settling request must not clobber a newer in-flight request's
        // controller (used by unmount-abort) or its streaming UI state.
        if (abortControllerRef.current === myController) {
          setIsStreaming(false);
          abortControllerRef.current = null;
        }
        if (streamingMessageIdRef.current === myId) {
          streamingMessageIdRef.current = null;
        }
      }
```

- [ ] **Step 6: Run the new test, expect PASS.**

```bash
npx vitest run src/hooks/useChatEngine.test.ts -t "must not clobber request B's controller"
```

Expected: 1 passed.

- [ ] **Step 7: Run the whole file, expect no regressions.** The existing abort tests (`abort-on-resend` ~393-449, `AbortError handling` ~653-701, `request includes signal` ~704-731) must still pass.

```bash
npx vitest run src/hooks/useChatEngine.test.ts
```

Expected: all tests in the file pass (the prior count plus the 1 new test), `0 failed`.

- [ ] **Step 8: Commit.**

```bash
git add src/hooks/useChatEngine.ts src/hooks/useChatEngine.test.ts && git commit -m "fix(chat): identity-guard handleSend finally so a late request can't clobber a newer one"
```

---

### Task 7.3: Programmatic tool-iteration cap (fix 3)

Today the "call tools at most twice" rule is **prompt-only** (`prompts.mjs:34-35`), and `buildAgent` (`agent.mjs:43-61`) sets no programmatic bound — the only runtime limit is the 25s `cancelSignal` timeout wired in `index.mjs:281-292`.

**SDK option verified:** Strands Agents SDK v1.0.0-rc.4 exposes **no** `maxIterations`/recursion config on `AgentConfig`. The canonical, SDK-supported way to bound the loop is `agent.cancel()` / `cancelSignal`. To make it tool-iteration-aware (not just wall-clock), register a `BeforeModelCallEvent` hook that fires once per loop cycle, count cycles, and call `agent.cancel()` once the cap is exceeded. This adds a hard programmatic ceiling on top of the existing 25s timeout. We expose the cap on `buildAgent` and default it to a small value consistent with the "at most twice" prompt rule (initial model call + up to 2 tool-driven follow-up cycles = 3 model invocations max → cap of `3`).

- [ ] **Step 1: Write the failing tests.** Append both tests after line 209 (end of file) in `lambda/chat-stream/__tests__/agent.test.mjs`. Extend the import on line 4 to include `DEFAULT_MAX_MODEL_CALLS` as well.

First, edit the import block (lines 3-11):

Before:

```mjs
import {
  buildBedrockModel,
  buildAgent,
  streamAgentResponse,
  DEFAULT_WINDOW_SIZE,
  DEFAULT_MAX_TOKENS,
  DEFAULT_TEMPERATURE,
  DEFAULT_REGION,
} from '../agent.mjs';
```

After:

```mjs
import {
  buildBedrockModel,
  buildAgent,
  streamAgentResponse,
  DEFAULT_WINDOW_SIZE,
  DEFAULT_MAX_TOKENS,
  DEFAULT_TEMPERATURE,
  DEFAULT_REGION,
  DEFAULT_MAX_MODEL_CALLS,
} from '../agent.mjs';
```

Then append the tests:

```mjs
test('DEFAULT_MAX_MODEL_CALLS caps the agent loop', () => {
  // initial model call + up to 2 tool-driven follow-ups = 3 model invocations.
  assert.equal(DEFAULT_MAX_MODEL_CALLS, 3);
});

test('buildAgent registers a BeforeModelCallEvent cap that cancels past the limit', () => {
  const hooks = [];
  let cancelled = 0;
  // Minimal fake Agent that records addHook registrations and cancel() calls.
  class FakeAgent {
    constructor(config) {
      this.config = config;
      this.name = config.name;
      this.messages = config.messages || [];
    }
    addHook(eventCtor, cb) {
      hooks.push({ eventCtor, cb });
      return () => {};
    }
    cancel() {
      cancelled++;
    }
  }

  const agent = buildAgent({
    model: buildBedrockModel({ modelId: 'm' }),
    tools: [],
    systemPrompt: 'Be Alti.',
    messages: [],
    name: 'Alti',
    maxModelCalls: 2,
    AgentClass: FakeAgent,
  });

  // Exactly one hook was registered.
  assert.equal(hooks.length, 1);
  // Its event constructor name is BeforeModelCallEvent (real SDK export).
  assert.equal(hooks[0].eventCtor.name, 'BeforeModelCallEvent');

  // Fire the hook: cycles 1 and 2 are allowed, cycle 3 trips the cap.
  hooks[0].cb({});
  hooks[0].cb({});
  assert.equal(cancelled, 0, 'first two model calls must not cancel');
  hooks[0].cb({});
  assert.equal(cancelled, 1, 'third model call must trigger cancel()');
  // Idempotent: further calls keep cancelling, never throw.
  hooks[0].cb({});
  assert.equal(cancelled, 2);

  assert.ok(agent);
});
```

- [ ] **Step 2: Run the tests, expect FAIL.**

```bash
node --test lambda/chat-stream/__tests__/agent.test.mjs
```

Expected FAIL: `DEFAULT_MAX_MODEL_CALLS` is `undefined` (not yet exported) and `buildAgent` ignores `maxModelCalls`/`AgentClass`, registers no hook. Example: `AssertionError ... undefined !== 3` and `0 !== 1`.

- [ ] **Step 3: Implement the cap in `buildAgent`.** In `lambda/chat-stream/agent.mjs`:

First extend the SDK import (lines 1-5) to pull in `BeforeModelCallEvent`:

Before:

```mjs
import { Agent, BedrockModel, SlidingWindowConversationManager } from '@strands-agents/sdk';
```

After:

```mjs
import { Agent, BedrockModel, SlidingWindowConversationManager, BeforeModelCallEvent } from '@strands-agents/sdk';
```

Add the constant beside the other defaults (after line 11, `export const DEFAULT_WINDOW_SIZE = 40;`):

```mjs
// Strands SDK v1.0.0-rc.4 exposes NO declarative maxIterations/recursion config.
// We bound the agent loop programmatically: BeforeModelCallEvent fires once per
// loop cycle, so we count cycles and call agent.cancel() past the cap. 3 == the
// initial model call + up to 2 tool-driven follow-ups (matches the "at most
// twice" prompt rule in prompts.mjs). This is a hard ceiling on top of the 25s
// cancelSignal timeout wired in index.mjs.
export const DEFAULT_MAX_MODEL_CALLS = 3;
```

Now replace `buildAgent` (lines 43-61). `AgentClass` is injected for testability (defaults to the real `Agent`), consistent with this repo's "inject SDK clients as params" convention.

Before:

```mjs
export function buildAgent({
  model,
  tools = [],
  systemPrompt,
  messages = [],
  windowSize = DEFAULT_WINDOW_SIZE,
  name = 'Alti',
} = {}) {
  if (!model) throw new Error('buildAgent: model is required');
  return new Agent({
    model,
    tools,
    systemPrompt,
    messages,
    conversationManager: new SlidingWindowConversationManager({ windowSize }),
    printer: false,
    name,
  });
}
```

After:

```mjs
export function buildAgent({
  model,
  tools = [],
  systemPrompt,
  messages = [],
  windowSize = DEFAULT_WINDOW_SIZE,
  name = 'Alti',
  maxModelCalls = DEFAULT_MAX_MODEL_CALLS,
  AgentClass = Agent,
} = {}) {
  if (!model) throw new Error('buildAgent: model is required');
  const agent = new AgentClass({
    model,
    tools,
    systemPrompt,
    messages,
    conversationManager: new SlidingWindowConversationManager({ windowSize }),
    printer: false,
    name,
  });

  // Programmatic loop cap. BeforeModelCallEvent fires once per loop cycle; once
  // the count exceeds maxModelCalls we cancel the agent (idempotent — the SDK
  // returns stopReason 'cancelled' and any text already streamed is kept).
  let modelCalls = 0;
  agent.addHook(BeforeModelCallEvent, () => {
    modelCalls += 1;
    if (modelCalls > maxModelCalls) {
      agent.cancel();
    }
  });

  return agent;
}
```

- [ ] **Step 4: Run the agent tests, expect PASS.**

```bash
node --test lambda/chat-stream/__tests__/agent.test.mjs
```

Expected: all pass, including the 2 new tests. The existing `"buildAgent builds Strands agent with tools and system prompt"` test (lines 84-95) still passes because the real `Agent` (default `AgentClass`) exposes `addHook` and `cancel`.

- [ ] **Step 5: Smoke-verify the Lambda bundle still imports cleanly** (catches a bad `BeforeModelCallEvent` import without uploading).

```bash
npm run deploy:lambda -- chat-stream --dry-run
```

Expected: the stubbed-`awslambda` `import()` smoke check completes with no unresolved-import error and prints a success/verified line (e.g. `module graph OK` / `dry-run complete`); it must NOT abort.

- [ ] **Step 6: Commit.**

```bash
git add lambda/chat-stream/agent.mjs lambda/chat-stream/__tests__/agent.test.mjs && git commit -m "feat(chat): add programmatic agent loop cap via BeforeModelCallEvent + agent.cancel"
```

---

### Task 7.4: Cross-cutting verification (all three fixes)

- [ ] **Step 1: Run both Lambda + frontend test files together.**

```bash
node --test lambda/chat-stream/__tests__/agent.test.mjs && npx vitest run src/hooks/useChatEngine.test.ts
```

Expected: both suites report `0 failed`.

- [ ] **Step 2: Lint and full build to confirm nothing else broke.**

```bash
npm run lint && npm run build
```

Expected: lint exits 0; build runs the full pipeline (env validation → podcast episodes → lint → tsc → vite build → sitemap → RSS) to completion with no TypeScript errors.

- [ ] **(Optional) Step 3: Reconcile the prompt cap with the new programmatic cap.** The prompt still says "Call at most twice per turn" in `prompts.mjs:34` (search_blog) and `prompts.mjs:35` (search_podcast). The programmatic `DEFAULT_MAX_MODEL_CALLS = 3` (initial + 2 follow-ups) is consistent with that, so no prompt change is required. Only adjust if you later raise/lower the cap — keep the prose and the constant in sync. No code change in this step; skip unless the cap value changes.

---

## Recommendation 8: Make the chat prose linkifier word-boundary aware

**Why it matters:** `processContentWithLinks` matches the `'Elo'` keyword with a case-insensitive `indexOf` substring scan that ignores word boundaries, so ordinary words containing "elo" ("developed", "below", "developer", "Velociraptor", "elopement") get a spurious gold hyperlink to `elo.altivum.ai` in every assistant reply.

**Impact:** MEDIUM · **Effort:** LOW · **Risk:** LOW
**Depends on:** none
**Files**

- Modify: `src/components/chat/ChatMessage.tsx` — `linkMap` (lines 40-48) and `processContentWithLinks` matching loop (lines 58-69)
- Test: `src/components/chat/ChatMessage.test.tsx` — add a `describe('word-boundary linking', ...)` block after the existing `auto-linking in assistant messages` block (closes at line 178)

**Confirmation from the code (current behavior):** the loop at lines 62-68 is a flat substring scan with `.toLowerCase()` on both sides and no boundary check:

```ts
for (const { keyword, url } of linkMap) {
  const index = remainingText.toLowerCase().indexOf(keyword.toLowerCase());
  if (index !== -1 && (earliestMatch === null || index < earliestMatch.index)) {
    // Get the actual text from the content (preserves original casing)
    const actualKeyword = remainingText.substring(index, index + keyword.length);
    earliestMatch = { index, keyword: actualKeyword, url };
  }
}
```

With `{ keyword: 'Elo', url: 'https://elo.altivum.ai' }` at line 47, `"developed".toLowerCase().indexOf("elo")` returns `4`, producing a link around the substring `"elo"` inside `"developed"`. The brief's note is confirmed: the "no keywords" fixture at lines 168-177 (`"This is a generic response without any special keywords."`) contains no "elo" substring, so it passes by luck and gives false confidence.

The fix keeps the existing substring path for all the other keywords (which are unique multi-cap product names) and adds a per-keyword opt-in flag so `'Elo'` is matched case-sensitively with `\bElo\b`.

### Task 8.1: Add a regression test proving "developed"/"below" produce no links and standalone "Elo" still links

- [ ] **Step 1: Write the failing regression test.** Insert this new `describe` block in `src/components/chat/ChatMessage.test.tsx` immediately after the closing `});` of the `auto-linking in assistant messages` block (the line currently at 178), before the `generative UI surface gating` block (currently starting at line 180).

```tsx
describe('word-boundary linking', () => {
  it('does NOT link "Elo" inside the word "developed"', () => {
    render(<ChatMessage role="assistant" content="Christian developed several products." />);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(screen.getByText('Christian developed several products.')).toBeInTheDocument();
  });

  it('does NOT link "elo" inside the word "below"', () => {
    render(<ChatMessage role="assistant" content="See the links below for more." />);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('still links a standalone "Elo" to elo.altivum.ai', () => {
    render(<ChatMessage role="assistant" content="Try Elo for AI-assisted learning." />);
    const link = screen.getByRole('link', { name: 'Elo' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://elo.altivum.ai');
  });

  it('is case-sensitive for "Elo" — lowercase "elo." standalone does not link', () => {
    render(<ChatMessage role="assistant" content="The word elo. should not be a link." />);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the new test, expect FAIL.** The `developed`/`below` cases fail because the current substring scan links the "elo" inside them.

```bash
npx vitest run src/components/chat/ChatMessage.test.tsx -t "word-boundary linking"
```

Expected: the suite reports failures, e.g.

```
 FAIL  src/components/chat/ChatMessage.test.tsx > ChatMessage > word-boundary linking > does NOT link "Elo" inside the word "developed"
AssertionError: expected [ <a /> ] to have a length of +0 but got 1
 FAIL  src/components/chat/ChatMessage.test.tsx > ChatMessage > word-boundary linking > does NOT link "elo" inside the word "below"
```

- [ ] **Step 3: Add a `wholeWord` flag to the `linkMap` type and to the `'Elo'` entry.** In `src/components/chat/ChatMessage.tsx`, replace the `linkMap` declaration (lines 39-48). Before:

```ts
// Map of keywords to their URLs (ordered by length desc to match longer phrases first)
const linkMap: { keyword: string; url: string }[] = [
  { keyword: 'Beyond the Assessment', url: 'https://altivum.ai/bta' },
  { keyword: 'The Vector Podcast', url: 'https://www.youtube.com/@thevectorpodcast' },
  { keyword: 'Vector Podcast', url: 'https://www.youtube.com/@thevectorpodcast' },
  { keyword: 'Altivum Inc', url: 'https://altivum.ai' },
  { keyword: 'Altivum', url: 'https://altivum.ai' },
  { keyword: 'VetROI', url: 'https://vetroi.altivum.ai' },
  { keyword: 'Elo', url: 'https://elo.altivum.ai' },
];
```

After:

```ts
// Map of keywords to their URLs (ordered by length desc to match longer phrases first).
// `wholeWord: true` requires \b...\b boundaries AND case-sensitive matching — use it for
// short, dictionary-substring product names like "Elo" to avoid linking "developed"/"below".
const linkMap: { keyword: string; url: string; wholeWord?: boolean }[] = [
  { keyword: 'Beyond the Assessment', url: 'https://altivum.ai/bta' },
  { keyword: 'The Vector Podcast', url: 'https://www.youtube.com/@thevectorpodcast' },
  { keyword: 'Vector Podcast', url: 'https://www.youtube.com/@thevectorpodcast' },
  { keyword: 'Altivum Inc', url: 'https://altivum.ai' },
  { keyword: 'Altivum', url: 'https://altivum.ai' },
  { keyword: 'VetROI', url: 'https://vetroi.altivum.ai' },
  { keyword: 'Elo', url: 'https://elo.altivum.ai', wholeWord: true },
];
```

- [ ] **Step 4: Branch the match logic on `wholeWord` inside the loop.** In the same file, replace the `for (const { keyword, url } of linkMap)` body (lines 62-68). Before:

```ts
for (const { keyword, url } of linkMap) {
  const index = remainingText.toLowerCase().indexOf(keyword.toLowerCase());
  if (index !== -1 && (earliestMatch === null || index < earliestMatch.index)) {
    // Get the actual text from the content (preserves original casing)
    const actualKeyword = remainingText.substring(index, index + keyword.length);
    earliestMatch = { index, keyword: actualKeyword, url };
  }
}
```

After:

```ts
for (const { keyword, url, wholeWord } of linkMap) {
  let index: number;
  if (wholeWord) {
    // Case-sensitive, boundary-anchored match (e.g. "Elo" must not match "developed").
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = new RegExp(`\\b${escaped}\\b`).exec(remainingText);
    index = match ? match.index : -1;
  } else {
    index = remainingText.toLowerCase().indexOf(keyword.toLowerCase());
  }
  if (index !== -1 && (earliestMatch === null || index < earliestMatch.index)) {
    // Get the actual text from the content (preserves original casing)
    const actualKeyword = remainingText.substring(index, index + keyword.length);
    earliestMatch = { index, keyword: actualKeyword, url };
  }
}
```

Notes that make this correct and DRY:

- The destructure adds `wholeWord` only; `keyword`, `url`, `index`, `actualKeyword`, and the `earliestMatch` tie-break are unchanged, so all existing keyword behavior (longest-phrase-first via array order, original-casing preservation, slicing in the outer loop at lines 71-91) is preserved verbatim.
- `\b` next to the capital `E` and trailing `o` gives the desired boundaries; `"developed"` → no `\bElo\b`, `"below"` → no `\belo\b` (and case-sensitive `Elo` would not match `elo` anyway), while `"Elo for ..."` and `"Elo."` both match because `.` and end-of-string are non-word boundaries.
- The `escaped` regex-escape is defensive future-proofing for any later `wholeWord` keyword containing regex metacharacters; for `'Elo'` it is a no-op.

- [ ] **Step 5: Run the new test, expect PASS.**

```bash
npx vitest run src/components/chat/ChatMessage.test.tsx -t "word-boundary linking"
```

Expected: `4 passed` for the `word-boundary linking` group, e.g.

```
 ✓ src/components/chat/ChatMessage.test.tsx > ChatMessage > word-boundary linking > does NOT link "Elo" inside the word "developed"
 ✓ ... > does NOT link "elo" inside the word "below"
 ✓ ... > still links a standalone "Elo" to elo.altivum.ai
 ✓ ... > is case-sensitive for "Elo" — lowercase "elo." standalone does not link
```

- [ ] **Step 6: Run the full ChatMessage suite to confirm no regressions.** This re-verifies the existing `auto-linking in assistant messages` tests (Altivum, Altivum Inc, Beyond the Assessment, The Vector Podcast, VetROI, multi-keyword, new-tab) still pass under the refactored loop.

```bash
npx vitest run src/components/chat/ChatMessage.test.tsx
```

Expected: all tests pass (the original ~20 plus the 4 new), e.g.

```
 Test Files  1 passed (1)
      Tests  24 passed (24)
```

- [ ] **Step 7: Lint to confirm the new `wholeWord` destructure and regex pass ESLint/TS.**

```bash
npm run lint
```

Expected: exits 0 with no errors for `src/components/chat/ChatMessage.tsx`.

- [ ] **Step 8: Commit.**

```bash
git add src/components/chat/ChatMessage.tsx src/components/chat/ChatMessage.test.tsx && git commit -m "fix(chat): word-boundary, case-sensitive match for 'Elo' linkify keyword"
```
