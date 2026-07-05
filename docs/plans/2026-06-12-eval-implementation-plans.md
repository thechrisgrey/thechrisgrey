# Eval Implementation Plans

> Generated 2026-06-12 from the `/eval` analysis: 3 confirmed/refined recommendations (#1-#3) + 4 honorable mentions (#4-#7).
> Each plan was produced by an agent that read the actual source files; effort/impact reflect the adversarial verification pass that followed the eval.
> See the **Mission Brief** at the end for execution order and decision points.

## 1. Attach the Bedrock Guardrail to the Blueprint (Opus) path

### Objective

Wrap every Bedrock invocation the Blueprint Lambda makes — the streaming Opus 4.6 generation path (`streamOpus`), the blocking Opus path (`invokeOpus`), and the Haiku 4.5 quality-verdict path (`invokeClaude` via `invokeHaiku`) — with the existing Bedrock Guardrail (`5kofhp46ssob` v5) that `chat-stream` and `mcp-server` already enforce. When a visitor's free-text spec (`goal`, `integrations`, `scale.*`, etc.) trips the guardrail's PROMPT_ATTACK / HATE / VIOLENCE / MISCONDUCT filters, generation terminates with a new `guardrail_intervened` terminal error code that the handler maps to a calm, user-facing NDJSON `error` event and a `BlueprintGuardrailIntervention` metric — closing the one Bedrock surface on the site that currently invokes a model with no content guardrail.

### Prerequisites

- AWS CLI configured with credentials that can call `lambda update-function-configuration`, `lambda get-function-configuration`, and `iam put-role-policy` against account `205930636302` (us-east-1).
- The guardrail `5kofhp46ssob` version `5` already exists (it is the live guardrail used by `chat-stream/index.mjs:48-49` and `mcp-server`). No new guardrail is created.
- Confirmed IAM gotcha: `lambda/blueprint/iam-policy.json` has **no** `bedrock:ApplyGuardrail` statement (verified — it only has `BedrockInvokeFoundationModels`, `BedrockInvokeInferenceProfiles`, `DynamoDBRateLimit`, `CloudWatchLogs`, `CloudWatchMetrics`). Adding `guardrailConfig`/`guardrailIdentifier` to the Bedrock calls **without** this grant makes every Opus/Haiku call fail with `AccessDeniedException`. The IAM update is mandatory and must be deployed to the role `thechrisgrey-blueprint-role`.
- Docs to skim: the reference implementations already read in this repo — `lambda/chat-stream/agent.mjs` (`buildBedrockModel` guardrail wiring, lines 22-50; stream `guardrailIntervened` detection, lines 131-187), `lambda/chat-stream/index.mjs` (env constants 48-49, apply 263-270, intervention handling 310-321, pre-stream `ValidationException`-includes-`guardrail` handling 354-361), and `lambda/mcp-server/tools/askAlti.mjs` (non-streaming `stop_reason === "guardrail_intervened"` handling, lines 129-135). The non-streaming InvokeModel guardrail param shape (`guardrailIdentifier` + `guardrailVersion` as top-level command fields) is mirrored from `askAlti.mjs:110-118`.
- Existing-code assumptions confirmed by reading:
  - `bedrock.mjs` builds InvokeModel body in `invokeClaude` (lines 179-185, send at 188-196) and the streaming body in `streamOpus` (lines 267-273, send at 281-289). Neither sets a guardrail.
  - `streamOpus` already parses the raw `InvokeModelWithResponseStream` event envelope (`message_start`/`content_block_delta`/`message_delta`/`message_stop`, lines 299-326) and tracks `stopReason` from `message_delta` (line 317). This is the exact place to detect a guardrail stop on the streaming path.
  - `engine.mjs` already has the `opus_timeout`/`opus_error` terminal-code pattern (lines 199-216) and the `validation_failed` pattern (246-260) — the new `guardrail_intervened` code slots in beside them.
  - `index.mjs` already maps `result.error` to a user message + metric in an `if/else` ladder (lines 275-301) — the new branch slots in there.
  - Tests use plain fakes via `__tests__/harness.mjs` (`scriptedBedrockClient`, `bedrockStreamResponse`, `bedrockResponseBody`); no `aws-sdk-client-mock`. The streaming fake emits the `message_delta` event where a guardrail `stop_reason` would appear (harness lines 96-100).

### Step-by-Step Implementation

**1. Add guardrail constants + thread them through `bedrock.mjs` (both paths).**

1.1 Open `lambda/blueprint/bedrock.mjs`. Below the existing model-id exports (after line 30) add the guardrail config, sourced from env with the live defaults so behavior is correct even before env vars are set on the function (mirroring how `chat-stream/index.mjs` hardcodes `5kofhp46ssob`/`5`, but env-overridable like `mcp-server`):

```js
// Bedrock Guardrail (same guardrail chat-stream + mcp-server enforce). Applied
// to every model call so visitor free-text in the spec is filtered for
// PROMPT_ATTACK / HATE / INSULTS / SEXUAL / VIOLENCE / MISCONDUCT before it
// reaches Opus or Haiku. Env-overridable; defaults are the live prod guardrail.
export const GUARDRAIL_ID = process.env.GUARDRAIL_ID || '5kofhp46ssob';
export const GUARDRAIL_VERSION = process.env.GUARDRAIL_VERSION || '5';

/**
 * Returns the guardrail config fragment for an InvokeModel*-style command input,
 * or {} when no guardrail is configured. Both Opus paths and the Haiku path
 * spread this into the command input.
 */
export function guardrailParams(guardrailId = GUARDRAIL_ID, guardrailVersion = GUARDRAIL_VERSION) {
  return guardrailId && guardrailVersion ? { guardrailIdentifier: guardrailId, guardrailVersion } : {};
}
```

1.2 Add a typed terminal error for a streaming guardrail stop, next to `BedrockTimeoutError`/`BedrockInvocationError` (after line 129):

```js
export class BedrockGuardrailError extends Error {
  constructor(modelId) {
    super(`Bedrock guardrail intervened (${modelId})`);
    this.name = 'BedrockGuardrailError';
    this.modelId = modelId;
  }
}
```

1.3 In `invokeClaude` (the Haiku/blocking helper), add the guardrail params to the `InvokeModelCommand` input. Edit the `new InvokeModelCommand({...})` at lines 189-194 to spread `guardrailParams()`:

```js
      new InvokeModelCommand({
        modelId,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify(body),
        ...guardrailParams(),
      }),
```

Then, after parsing the response (`const { text, usage } = parseBedrockResponse(response.body);`, line 198), detect a non-streaming guardrail stop the same way `askAlti.mjs:129` does. `parseBedrockResponse` currently discards `stop_reason`, so extend it minimally: change `parseBedrockResponse` (lines 138-150) to also return `stop_reason: payload.stop_reason ?? null`, and in `invokeClaude` add after line 198:

```js
const { text, usage, stop_reason } = parseBedrockResponse(response.body);
if (stop_reason === 'guardrail_intervened') {
  if (requestId) {
    console.warn(
      JSON.stringify({
        requestId,
        event: 'bedrock_guardrail_intervened',
        modelId,
        latencyMs: Date.now() - start,
      }),
    );
  }
  throw new BedrockGuardrailError(modelId);
}
return { text, usage, latencyMs: Date.now() - start };
```

Edge case: a guardrail block on a non-streaming InvokeModel may instead surface as a `ValidationException` whose message contains `"guardrail"` (the pre-stream case `chat-stream/index.mjs:354-361` handles). Catch that in the existing `catch (error)` block of `invokeClaude` (after the `AbortError` branch, before the generic `BedrockInvocationError` throw at line 217):

```js
if (error?.name === 'ValidationException' && error?.message?.toLowerCase().includes('guardrail')) {
  throw new BedrockGuardrailError(modelId);
}
```

1.4 In `streamOpus`, add the guardrail params to the `InvokeModelWithResponseStreamCommand` input (lines 282-287):

```js
      new InvokeModelWithResponseStreamCommand({
        modelId: OPUS_MODEL_ID,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify(body),
        ...guardrailParams(),
      }),
```

On the streaming path, an async-mode guardrail intervention arrives as a `message_delta` whose `stop_reason === "guardrail_intervened"` (and/or an `amazon-bedrock-guardrailAction: "INTERVENED"` field on the chunk). The loop already captures `stopReason` from `message_delta` (line 317). After the `for await` loop ends and `clearTimeout(timeoutId)` runs (line 329), but before the `return`, add the detection:

```js
clearTimeout(timeoutId);
if (stopReason === 'guardrail_intervened') {
  if (requestId) {
    console.warn(
      JSON.stringify({
        requestId,
        event: 'bedrock_stream_guardrail_intervened',
        modelId: OPUS_MODEL_ID,
        latencyMs: Date.now() - start,
        partialChars: accumulated.length,
      }),
    );
  }
  throw new BedrockGuardrailError(OPUS_MODEL_ID);
}
return { text: accumulated /* …unchanged… */ };
```

Also handle the rarer pre-stream `ValidationException` form in the `catch (error)` block (after the `AbortError` branch, before the generic throw at line 362), identical shape to 1.3.
Edge case: the streaming guardrail-block may still have streamed partial token deltas to the client via `onChunk` before the `message_delta` arrives. Throwing here means the engine returns the terminal `guardrail_intervened` event; the client's terminal-event handling (it distinguishes outcome by the final NDJSON event, per `index.mjs:240-242`) supersedes any partial text. No code change needed for that, but note it in the handler message so the partial render is replaced.

1.5 Export the new symbols in the default export object (lines 382-394): add `BedrockGuardrailError`, `GUARDRAIL_ID`, `GUARDRAIL_VERSION`, `guardrailParams`.

**2. Add the `guardrail_intervened` terminal code in `engine.mjs`.**

2.1 Open `lambda/blueprint/engine.mjs`. Import the new error class — extend the import from `./bedrock.mjs` (lines 26-31) to include `BedrockGuardrailError`.

2.2 In the Opus try/catch (lines 199-216), the current `catch` maps `BedrockTimeoutError → "opus_timeout"` else `"opus_error"`. Replace the `code` derivation (line 200) so a guardrail error becomes its own terminal code, surfaced to the user exactly like `opus_timeout`:

```js
let code = 'opus_error';
if (error instanceof BedrockTimeoutError) code = 'opus_timeout';
else if (error instanceof BedrockGuardrailError) code = 'guardrail_intervened';
```

The existing `return { ok: false, error: code, ... }` block already carries this through with the same meta shape (tier, total_ms, opus_tokens, attempt, examples_used). A guardrail block must **not** retry (it is deterministic for the same input) — returning immediately from the catch already guarantees that, since the catch `return`s rather than `continue`s.

2.3 Cover the Haiku pass (lines 262-287). Currently `validateWithHaiku` throwing is swallowed into a soft `{ ok: true, confidence: "low" }` verdict (the `catch` at 282-287). A guardrail intervention on the Haiku verdict call (running user-derived blueprint content) should **not** be silently downgraded to a passing verdict — but it also must not fail an already schema-valid blueprint that the user is entitled to. Decision: treat a Haiku-path `BedrockGuardrailError` as a flagged-but-non-fatal verdict so the blueprint still returns (the schema already validated it), while recording the signal. In the `catch (error)` at line 282, special-case it:

```js
  } catch (error) {
    if (error instanceof BedrockGuardrailError) {
      logger.warn?.("haiku_guardrail_intervened", { requestId });
      haikuVerdict = { ok: false, confidence: "low", issues: [
        { field: "_meta", severity: "warn", note: "Quality check could not complete (content filter)." },
      ] };
    } else {
      logger.warn?.("haiku_validator_error", {
        requestId, error: error?.name, message: error?.message,
      });
      haikuVerdict = { ok: true, confidence: "low", issues: [] };
    }
  }
```

This keeps the engine's "Haiku is a soft signal" contract intact (the existing test `generateBlueprint tolerates Haiku validator throwing` still passes for non-guardrail errors).

**3. Map the terminal code to a user message + metric in `index.mjs`.**

3.1 Open `lambda/blueprint/index.mjs`. In the `if (!result.ok)` ladder (lines 275-301), add a branch for the new code beside `opus_timeout` (after line 288, before the trailing `else`):

```js
      } else if (result.error === "guardrail_intervened") {
        metrics.record("BlueprintGuardrailIntervention");
        message = "That request couldn't be processed. Try describing a different system to architect.";
        logStructured(requestId, "blueprint_guardrail_intervened", {});
      } else {
```

The user-facing string is professional, non-accusatory, no emoji (per project UI rules), and consistent in tone with the existing `opus_timeout` message. The `writeEvent({ type: "error", error: result.error, message, ... })` block at lines 292-298 already emits it as the terminal NDJSON event and ends the stream — no further change needed there.

3.2 Add the new env constants so the function can override the guardrail if rotated (defaults already baked into `bedrock.mjs`, so this is optional-but-documented). No code change is strictly required in `index.mjs` for the guardrail to work, because `bedrock.mjs` reads `process.env.GUARDRAIL_ID/VERSION` directly with defaults. The env vars in step 5 simply make the override explicit and align with `chat-stream`/`mcp-server`.

**4. Add the `bedrock:ApplyGuardrail` IAM statement and deploy it to the role.**

4.1 Open `lambda/blueprint/iam-policy.json`. Insert a new statement (mirroring `chat-stream/iam-policy.json:16-24`) into the `Statement` array — place it right after the `BedrockInvokeInferenceProfiles` statement (after line 31):

```json
    {
      "Sid": "BedrockGuardrail",
      "Effect": "Allow",
      "Action": [
        "bedrock:ApplyGuardrail"
      ],
      "Resource": [
        "arn:aws:bedrock:us-east-1:205930636302:guardrail/5kofhp46ssob"
      ]
    },
```

4.2 The in-repo `iam-policy.json` is a reference copy; the deployed role policy must be updated separately (the deploy script does **not** touch IAM). Apply it to the role `thechrisgrey-blueprint-role`. First confirm the inline policy name on the role:

```bash
aws iam list-role-policies --role-name thechrisgrey-blueprint-role
```

Then push the updated document (replace `<POLICY_NAME>` with the name returned above, typically `thechrisgrey-blueprint-policy`):

```bash
aws iam put-role-policy \
  --role-name thechrisgrey-blueprint-role \
  --policy-name <POLICY_NAME> \
  --policy-document file:///Users/cperez/dev/altivum-dev/thechrisgrey/lambda/blueprint/iam-policy.json
```

Verify:

```bash
aws iam get-role-policy --role-name thechrisgrey-blueprint-role --policy-name <POLICY_NAME> \
  --query 'PolicyDocument.Statement[?Sid==`BedrockGuardrail`]'
```

Edge case: if the role uses **managed** (attached) policies instead of an inline policy, `list-role-policies` returns empty — run `aws iam list-attached-role-policies --role-name thechrisgrey-blueprint-role`, then create a new policy version for that managed ARN instead. The in-repo convention is inline, so the inline path is expected.

**5. Set the guardrail env vars on the deployed function (explicit override).**

```bash
# Read the current env to avoid clobbering existing vars
aws lambda get-function-configuration \
  --function-name thechrisgrey-blueprint --region us-east-1 \
  --query 'Environment.Variables'
```

Then merge `GUARDRAIL_ID`/`GUARDRAIL_VERSION` into the existing map (Lambda replaces the whole `Variables` object, so include all current keys plus the two new ones):

```bash
aws lambda update-function-configuration \
  --function-name thechrisgrey-blueprint --region us-east-1 \
  --environment "Variables={<existing key=value pairs>,GUARDRAIL_ID=5kofhp46ssob,GUARDRAIL_VERSION=5}"
```

This is optional for correctness (defaults are in code) but mandatory for parity with the other Lambdas and to allow rotation without a redeploy.

**6. Build, verify, deploy code.**

```bash
npm run deploy:lambda -- blueprint --dry-run   # build + module-graph + stubbed-import smoke check
npm run deploy:lambda -- blueprint             # us-east-1 default; uploads function.zip
```

Order matters: apply the IAM grant (step 4) **before** the code deploy (step 6), so the first invocation after the new code lands already has `ApplyGuardrail` permission and cannot fail with `AccessDenied`. The env vars (step 5) can be applied any time since code has safe defaults.

### File & Code Changes

| Action | File Path                                                                                                                | Description of Change                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------ | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Modify | `/Users/cperez/dev/altivum-dev/thechrisgrey/lambda/blueprint/bedrock.mjs`                                                | Add `GUARDRAIL_ID`/`GUARDRAIL_VERSION` consts + `guardrailParams()`; add `BedrockGuardrailError`; spread guardrail params into both `InvokeModelCommand` (`invokeClaude`) and `InvokeModelWithResponseStreamCommand` (`streamOpus`); extend `parseBedrockResponse` to return `stop_reason`; detect `guardrail_intervened` stop + `ValidationException`-includes-`guardrail` on both paths and throw `BedrockGuardrailError`; export new symbols. |
| Modify | `/Users/cperez/dev/altivum-dev/thechrisgrey/lambda/blueprint/engine.mjs`                                                 | Import `BedrockGuardrailError`; map it to terminal `error: "guardrail_intervened"` in the Opus catch (no retry); special-case it in the Haiku catch as a flagged non-fatal verdict.                                                                                                                                                                                                                                                              |
| Modify | `/Users/cperez/dev/altivum-dev/thechrisgrey/lambda/blueprint/index.mjs`                                                  | Add `guardrail_intervened` branch to the `if (!result.ok)` ladder → `BlueprintGuardrailIntervention` metric + user-facing message + structured log.                                                                                                                                                                                                                                                                                              |
| Modify | `/Users/cperez/dev/altivum-dev/thechrisgrey/lambda/blueprint/iam-policy.json`                                            | Add `BedrockGuardrail` statement granting `bedrock:ApplyGuardrail` on `arn:aws:bedrock:us-east-1:205930636302:guardrail/5kofhp46ssob`.                                                                                                                                                                                                                                                                                                           |
| Modify | `/Users/cperez/dev/altivum-dev/thechrisgrey/lambda/blueprint/__tests__/harness.mjs`                                      | Add a guardrail-stop variant to the fakes: a `guardrailStream` helper (`bedrockStreamResponse` with `message_delta.stop_reason = "guardrail_intervened"`) and a blocking `guardrailResponseBody` (`stop_reason: "guardrail_intervened"`).                                                                                                                                                                                                        |
| Modify | `/Users/cperez/dev/altivum-dev/thechrisgrey/lambda/blueprint/__tests__/engine.test.mjs`                                  | Add cases: streaming Opus guardrail stop → `error === "guardrail_intervened"`, no retry (1 Bedrock call); blocking Opus guardrail stop → same; Haiku guardrail stop → `ok === true` with flagged `haiku_verdict.ok === false`.                                                                                                                                                                                                                   |
| Modify | `/Users/cperez/dev/altivum-dev/thechrisgrey/lambda/blueprint/__tests__/timeout.test.mjs` _(or new `guardrail.test.mjs`)_ | Optional: assert `streamOpus`/`invokeOpus` throw `BedrockGuardrailError` on a guardrail `stop_reason`, mirroring the timeout-threading tests. Prefer a new `__tests__/guardrail.test.mjs` to keep timeout tests focused.                                                                                                                                                                                                                         |
| Create | `/Users/cperez/dev/altivum-dev/thechrisgrey/lambda/blueprint/__tests__/guardrail.test.mjs`                               | Unit tests for `bedrock.mjs` guardrail detection (both paths throw `BedrockGuardrailError`) + `guardrailParams()` shape (returns the two fields when both set, `{}` when unset).                                                                                                                                                                                                                                                                 |
| Modify | `/Users/cperez/dev/altivum-dev/thechrisgrey/CLAUDE.md`                                                                   | Under "Lambda Fleet → `lambda/blueprint/`", note the guardrail is now applied to Opus + Haiku calls; add `GUARDRAIL_ID`/`GUARDRAIL_VERSION` to the Blueprint env-vars list; add the `guardrail_intervened` terminal code + `BlueprintGuardrailIntervention` metric to the relevant lines.                                                                                                                                                        |

### Testing & Validation

- **Unit (`bedrock.mjs`) — new `guardrail.test.mjs`:**
  - `guardrailParams()` returns `{ guardrailIdentifier, guardrailVersion }` with both set; returns `{}` when either is empty.
  - `streamOpus` throws `BedrockGuardrailError` when the canned stream's `message_delta` carries `stop_reason: "guardrail_intervened"`; asserts the command sent was `InvokeModelWithResponseStreamCommand` and its input includes `guardrailIdentifier`.
  - `invokeClaude`/`invokeOpus` throws `BedrockGuardrailError` when the blocking response body has `stop_reason: "guardrail_intervened"`, and also when `send` rejects with a `ValidationException` whose message includes `"guardrail"`.
- **Unit (`engine.test.mjs`):**
  - Streaming guardrail stop → `res.ok === false`, `res.error === "guardrail_intervened"`, `bedrock.calls.length === 1` (proves no retry).
  - Blocking guardrail stop (no `onProgress`) → same terminal code.
  - Haiku guardrail stop after a valid Opus output → `res.ok === true`, `res.meta.haiku_verdict.ok === false`, `confidence === "low"` (proves the blueprint still returns).
  - Re-run existing `tolerates Haiku validator throwing` to confirm a generic Haiku error still yields `ok: true, confidence: "low"` (no regression from the catch refactor).
- **Commands (run from repo root):**
  ```bash
  npm run lint:lambda
  npm run test:lambda          # runs blueprint/__tests__/*.test.mjs (incl. new guardrail.test.mjs)
  npm run deploy:lambda -- blueprint --dry-run
  ```
- **Manual / integration after deploy:** From the live `/blueprint` flow (or a signed `curl` to the Function URL), submit a benign spec → expect a normal `complete` event (regression check that the guardrail does not false-block legitimate architecture prompts). Then submit a spec whose `goal` contains an obvious prompt-injection / disallowed-content string → expect a terminal `{"type":"error","error":"guardrail_intervened","message":"That request couldn't be processed…"}` event and a `BlueprintGuardrailIntervention` datapoint in CloudWatch namespace `TheChrisGrey/Blueprint`. Confirm CloudWatch logs show `blueprint_guardrail_intervened` and **no** `AccessDeniedException` (the latter would mean the IAM grant didn't apply).
- **Rollback confirmation:** Revert the code commit and re-run `npm run deploy:lambda -- blueprint` to redeploy the prior artifact; the guardrail params disappear from the calls and behavior returns to pre-change. The IAM `ApplyGuardrail` grant and the two env vars are additive and harmless to leave in place after a code rollback (no call uses them), so a full rollback is code-only. To fully revert IAM, `put-role-policy` the prior `iam-policy.json` from git history.

### Risk & Mitigation

| Risk                                                                                                                                                                          | Likelihood | Impact | Mitigation                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `guardrailConfig` added but `bedrock:ApplyGuardrail` not granted → every Opus/Haiku call fails `AccessDeniedException`, breaking all generation                               | Medium     | High   | Apply IAM step 4 **before** code deploy step 6; verify with `get-role-policy` query; dry-run + post-deploy smoke test asserts no `AccessDenied` in logs.                                                                                                                                                                                                            |
| Streaming async-mode guardrail does not set `stop_reason: "guardrail_intervened"` in the exact shape assumed (could be `amazon-bedrock-guardrailAction` on the chunk instead) | Medium     | Medium | Detection keys on `stopReason` captured from `message_delta` AND the pre-stream `ValidationException`-includes-`guardrail` fallback; verify against the check-aws-docs skill / live log of a real intervention before final sign-off; the `ValidationException` fallback (proven in `chat-stream`) catches blocking-style blocks regardless of stream-event naming. |
| Guardrail false-positives block legitimate architecture specs (e.g., "VPN", "exploit detection" security systems)                                                             | Low-Medium | Medium | Same guardrail already runs site-wide on chat with acceptable FP rate; the v5 thresholds are MED/HIGH, not LOW; user message invites rephrasing; `BlueprintGuardrailIntervention` metric makes FP spikes observable for threshold tuning.                                                                                                                           |
| Haiku catch refactor accidentally changes the existing soft-signal contract (a generic Haiku error now fails the request)                                                     | Low        | Medium | The `else` branch preserves the exact prior `{ ok: true, confidence: "low", issues: [] }` behavior; existing `tolerates Haiku validator throwing` test re-run guards it.                                                                                                                                                                                            |
| Partial token deltas already streamed to client before a streaming guardrail block leave a half-rendered blueprint                                                            | Medium     | Low    | Client distinguishes outcome by the terminal NDJSON event (per `index.mjs` contract); the `guardrail_intervened` error event supersedes partial text; user message tells them to retry/rephrase.                                                                                                                                                                    |
| `update-function-configuration` env merge clobbers existing Blueprint env vars (`BLUEPRINT_SIGNING_KEY`, `SANITY_*`, etc.)                                                    | Medium     | High   | Read current `Environment.Variables` first (step 5) and include every existing key in the new map; env step is optional since code has defaults — skip it entirely if uncertain.                                                                                                                                                                                    |

### Dependencies & Order of Operations

- **Code edits** are sequential within a file but independent across files: `bedrock.mjs` (step 1) must land before `engine.mjs` (step 2, imports `BedrockGuardrailError`) which must land before the `index.mjs` mapping (step 3) is meaningful. Tests (harness + engine + new guardrail test) depend on the `bedrock.mjs`/`engine.mjs` changes.
- **IAM (step 4)** is independent of the code edits and can be done in parallel, but its **deployment to the role must precede the code deploy (step 6)** to avoid an AccessDenied window.
- **Env vars (step 5)** are independent and optional (defaults baked in); can run any time.
- **Blocking factor:** confirming the exact streaming-intervention event shape against current Bedrock docs/a live intervention — the `ValidationException` fallback de-risks this but the `stop_reason` path should be verified before sign-off.
- **Suggested sequence:** 1 → 2 → 3 (code) → write tests (harness/engine/guardrail) → `lint:lambda` + `test:lambda` green → 4 (IAM, push to role) → 6 dry-run → 6 deploy → 5 (env) → manual benign + malicious verification.

### Estimated Effort

- **Complexity:** Medium
- **Time estimate:** 3–5 hours (≈2h code + tests, ≈1h IAM/env/deploy + AWS-doc verification of the streaming intervention shape, ≈1h live benign/malicious validation and metric confirmation)
- **Files affected:** 8 (1 created: `__tests__/guardrail.test.mjs`; 7 modified: `bedrock.mjs`, `engine.mjs`, `index.mjs`, `iam-policy.json`, `__tests__/harness.mjs`, `__tests__/engine.test.mjs`, `CLAUDE.md`)

---

## 2. Sync the chat Lambda VALID_PATHS allowlist with the canonical route table (+ navigate tool + drift test)

### Objective

The chat Lambda's `VALID_PATHS` Set in `lambda/chat-stream/validation.mjs` is missing `/foundation` and `/blueprint`, two real routes that exist in `src/routes.ts` and `App.tsx`. As a result, when a visitor is on either page, Alti silently loses its visitor-grounding block, skips section-biased KB retrieval, and the `navigate_to` tool rejects ever suggesting those pages. This change adds the two missing paths, removes a second stale hardcoded copy of the allowlist inside the navigate tool's description string, and adds a Lambda-side drift test that regex-parses `src/routes.ts` as text so the allowlist can never silently fall behind the canonical route table again.

### Prerequisites

- Node 20 (`.nvmrc`) and repo deps installed (`npm ci` already done for local dev).
- Read and confirmed (done in this pass): `lambda/chat-stream/validation.mjs` (`VALID_PATHS` at lines 5-9, currently 13 paths), `lambda/chat-stream/tools/navigate.mjs` (description allowlist hardcoded at lines 10-14, runtime guard at lines 20-27), `src/routes.ts` (`ROUTES` table lines 73-231 + `HOME_CONTEXT` lines 62-71; `/foundation` at 96-106, `/blueprint` at 220-230), `lambda/chat-stream/index.mjs` (consumers at line 189 `validatePageContext` and lines 230-232 `biasedQuery`), `lambda/chat-stream/prompts.mjs` (`buildVisitorContext` lines 48-62 returns `""` on null).
- Blast-radius consumers confirmed (3): `index.mjs:189` → null pageContext → `prompts.mjs:48` drops the visitor-context block; `index.mjs:230-232` → section-bias skipped because `pageContext` is null; `tools/navigate.mjs:24` → `isValidPath` returns false → tool rejects with "not a known route."
- Verified the Lambda test runner (`node --test`) can resolve `src/routes.ts` from `lambda/chat-stream/__tests__/` via `resolve(HERE, '../../../src/routes.ts')` and that the regex `path:\s*'([^']+)'` extracts all 16 path literals (including `/` from `HOME_CONTEXT` and `/blog/:slug`). The Lambda runtime CANNOT `import` the TS file — it MUST be read as text (`readFileSync`).
- Verified the `test:lambda` glob in `package.json:16` already includes `lambda/chat-stream/__tests__/*.test.mjs`, so a new `validation-drift.test.mjs` at that level is picked up with no glob edit.
- Deploy uses the verified script: `npm run deploy:lambda -- chat-stream` (default region `us-east-1`). Never hand-build `function.zip`.

### Step-by-Step Implementation

**1. Add the two missing paths to `VALID_PATHS` (the runtime allowlist).**

1.1. In `lambda/chat-stream/validation.mjs`, the Set at lines 5-9 currently lists 13 paths and omits `/foundation` and `/blueprint`. Both are gating paths for `isValidPath()` (line 13-15), which `validatePageContext()` (line 56, 60) and `navigate.mjs` (line 24) consume. Add the two paths so the Set matches the canonical route table's static (non-param) paths.

1.2. Keep the existing two-rows-of-strings formatting; insert `/foundation` next to its sibling `/altivum` and `/blueprint` next to `/admin` to mirror `routes.ts` ordering, so a future reader can eyeball the correspondence. The Set becomes 15 entries. `/` stays (it's the Home path, valid for pageContext even though Home grounding is overridden), `/chat` and `/admin` stay (valid for pageContext validation even though navigate bars them).

**2. Fix the SECOND stale copy — the allowlist baked into the navigate tool's description string.**

2.1. In `lambda/chat-stream/tools/navigate.mjs`, the `description` string at lines 10-14 hard-codes the allowed paths a second time and also omits `/foundation` and `/blueprint`. Editing only the `VALID_PATHS` Set leaves the LLM-facing description wrong, so the model still won't be told these are navigable. Update the `"Allowed paths:"` line to include `/foundation` (after `/altivum`) and `/blueprint` (before `/privacy`), keeping the existing single-string concatenation shape and the trailing `"Do NOT use for /admin or /chat."` line unchanged.

2.2. Do NOT attempt to derive the description from the `VALID_PATHS` Set programmatically — the Set contains `/`, `/chat`, and `/admin` which must NOT appear in the "Allowed paths" copy, and `/blog/<slug>` in the description is a human-readable placeholder (not the `:slug` param form), so a derived string would be wrong. A hand-maintained description string guarded by the drift test (Step 3) is the correct shape here. The runtime guard at lines 20-27 already enforces correctness regardless of the description prose; the description only steers the model's suggestions.

**3. Add a Lambda-side drift test that asserts `VALID_PATHS` is a superset of the canonical route paths.**

3.1. Create `lambda/chat-stream/__tests__/validation-drift.test.mjs`. It runs under `node --test`, so it CANNOT import `src/routes.ts` (TypeScript). It MUST read the file as text via `readFileSync` and regex-extract the path literals, mirroring how `src/routes.test.ts` regex-reads `App.tsx`.

3.2. Logic to implement:

- Resolve `src/routes.ts` relative to the test file: `resolve(dirname(fileURLToPath(import.meta.url)), '../../../src/routes.ts')` (verified to resolve to `/Users/.../thechrisgrey/src/routes.ts`).
- Extract every `path: '...'` literal with `/path:\s*'([^']+)'/g`. This yields all 16: `/`, the 13 ROUTES static paths, `/foundation`, `/blueprint`, plus `/blog/:slug`.
- Build the set of paths the allowlist MUST contain by filtering out the two that are legitimately represented differently at runtime: drop `/blog/:slug` (its runtime form is matched by `BLOG_SLUG_PATTERN`, not `VALID_PATHS`). `/` is kept (it IS in `VALID_PATHS`). This leaves the 15 static paths that must each be in `VALID_PATHS`.
- Assert `VALID_PATHS.has(p)` for each. Import `VALID_PATHS` and `BLOG_SLUG_PATTERN` from `../validation.mjs` (the test file CAN import the `.mjs`).
- Add a guard assertion that the regex actually matched (extracted count > 10) so a future rename of the `path:` key or quote style fails loudly instead of vacuously passing with an empty set.
- Add a positive assertion that `BLOG_SLUG_PATTERN.test('/blog/some-post')` is true and `isValidPath('/blog/:slug')` style param paths are intentionally excluded (assert `VALID_PATHS.has('/blog/:slug') === false`), documenting why `:slug` is dropped.
- Add explicit assertions that the two historically-missing paths are present: `assert.ok(VALID_PATHS.has('/foundation'))` and `assert.ok(VALID_PATHS.has('/blueprint'))` — these are the regression guards for THIS change.

3.3. Match the existing Lambda test style exactly: `import { test } from "node:test";`, `import assert from "node:assert/strict";`, top-level `test("...", () => { ... })` blocks (as in `validation.test.mjs`). No describe blocks, no extra deps.

3.4. Optionally add ONE test to the existing `lambda/chat-stream/__tests__/tools/navigate.test.mjs` asserting the description string advertises the new paths, so the second stale copy is also guarded: `assert.match(tool.description, /\/foundation/)` and `assert.match(tool.description, /\/blueprint/)`. This catches a future edit to `VALID_PATHS` that forgets the description.

**4. Run the Lambda test suite to confirm green.**

4.1. `npm run test:lambda` — the new drift test and the navigate description test must pass; nothing else should regress.

**5. Dry-run, then deploy the chat-stream Lambda.**

5.1. `npm run deploy:lambda -- chat-stream --dry-run` — builds the bundle, dereferences `lambda-shared`, runs the stubbed-`awslambda` import smoke check. Must abort on zero unresolved imports (it will, since no new imports were added).

5.2. `npm run deploy:lambda -- chat-stream` — deploys to the default region `us-east-1` and calls `update-function-code`. No env-var, IAM, guardrail, rate-limit, or HMAC changes are required; this is a pure code change.

**6. Update CLAUDE.md routing note if the maintainer wants the allowlist documented as derived-but-not-imported (optional).**

6.1. The CLAUDE.md "Routing" section already states `src/routes.ts` is the single source of truth and lists drift tests. Optionally add a one-line note that the Lambda allowlist (`validation.mjs` `VALID_PATHS` + `navigate.mjs` description) is kept in sync by `lambda/chat-stream/__tests__/validation-drift.test.mjs`. This keeps the documented invariant complete.

### File & Code Changes

| Action            | File Path                                                                                           | Description of Change                                                                                                                                                                                                                                                                         |
| ----------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Modify            | `/Users/cperez/dev/altivum-dev/thechrisgrey/lambda/chat-stream/validation.mjs`                      | Add `"/foundation"` and `"/blueprint"` to the `VALID_PATHS` Set (lines 5-9), bringing it from 13 to 15 entries, ordered to mirror `routes.ts`.                                                                                                                                                |
| Modify            | `/Users/cperez/dev/altivum-dev/thechrisgrey/lambda/chat-stream/tools/navigate.mjs`                  | Update the `description` string's "Allowed paths:" line (lines 12-13) to include `/foundation` and `/blueprint`. Runtime guard unchanged.                                                                                                                                                     |
| Create            | `/Users/cperez/dev/altivum-dev/thechrisgrey/lambda/chat-stream/__tests__/validation-drift.test.mjs` | New `node --test` drift test: regex-parses `src/routes.ts` as text, asserts every static route path is in `VALID_PATHS`, excludes `/blog/:slug` (covered by `BLOG_SLUG_PATTERN`), explicit regression guards for `/foundation` and `/blueprint`, and a "regex actually matched" sanity guard. |
| Modify            | `/Users/cperez/dev/altivum-dev/thechrisgrey/lambda/chat-stream/__tests__/tools/navigate.test.mjs`   | Add one test asserting `tool.description` advertises `/foundation` and `/blueprint`, guarding the second (description-string) copy of the allowlist.                                                                                                                                          |
| Modify (optional) | `/Users/cperez/dev/altivum-dev/thechrisgrey/CLAUDE.md`                                              | One-line note under Routing that the Lambda path allowlist is drift-tested against `src/routes.ts`.                                                                                                                                                                                           |

No changes to `package.json` (the `test:lambda` glob at line 16 already covers `lambda/chat-stream/__tests__/*.test.mjs`). No changes to `iam-policy.json`, env vars, guardrail, or rate-limit config.

### Testing & Validation

**Unit tests to write:**

- `validation-drift.test.mjs` — (a) every static path parsed from `src/routes.ts` is in `VALID_PATHS`; (b) `/foundation` and `/blueprint` explicitly present (regression guards for this fix); (c) `/blog/:slug` explicitly NOT in `VALID_PATHS` but `BLOG_SLUG_PATTERN.test('/blog/real-post')` is true (documents the param-path exclusion); (d) the path-extraction regex matched > 10 literals (fails loudly if `routes.ts` shape changes).
- `navigate.test.mjs` (added test) — `tool.description` contains `/foundation` and `/blueprint` (guards the description-string copy).

**Integration / manual verification:**

- Confirm the existing `validatePageContext` test for unknown paths still rejects `/evil`, and confirm a NEW positive path validates: locally, `validatePageContext({ currentPage: "/foundation", section: "The Altivum Foundation", visitedPages: [] })` returns a non-null object (can be checked by adding an ad-hoc assertion or via REPL; not strictly required if the drift test passes).
- Post-deploy smoke: open the live `/foundation` and `/blueprint` pages, open Alti, and confirm (via CloudWatch log group `tcg-AI-chat`) that the request's `pageContext` is non-null and the section-biased query is used. Ask Alti a Foundation-specific question and confirm it can suggest navigating to `/foundation` (the `navigate_to` tool no longer rejects it).

**Exact commands:**

```bash
# from repo root
npm run test:lambda
npm run lint:lambda
npm run deploy:lambda -- chat-stream --dry-run
npm run deploy:lambda -- chat-stream
```

**Rollback confirmation:**

- Code-only change; rollback = `git revert` of the commit (or redeploy the prior artifact). Confirm rollback by reverting `validation.mjs` to 13 paths and re-running `npm run test:lambda` — the drift test MUST now FAIL (proving it actually guards the invariant). Re-apply the fix and confirm green. To roll back the deployed function without a code revert: redeploy from the previous commit via `npm run deploy:lambda -- chat-stream` on that checkout.

### Risk & Mitigation

| Risk                                                                                   | Likelihood | Impact | Mitigation                                                                                                                                                                                   |
| -------------------------------------------------------------------------------------- | ---------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Drift test resolves the wrong relative path to `src/routes.ts` (test passes vacuously) | Low        | Medium | "Regex matched > 10 literals" guard assertion fails loudly if the file isn't found/empty; path resolution verified in this pass to land on the real file.                                    |
| `routes.ts` `path:` key or quote style changes later, breaking the regex               | Low        | Medium | The match-count guard turns the test red on a vacuous parse, prompting a regex update — same failure mode as the existing `App.tsx` regex in `routes.test.ts`.                               |
| Forgetting the second (description) copy when adding a future route                    | Medium     | Low    | New `navigate.test.mjs` assertion checks the description advertises the new paths; the drift test forces the Set in sync. Both copies are now test-guarded.                                  |
| Deploy ships a crash-on-cold-start artifact                                            | Very Low   | High   | Mandatory `--dry-run` first runs the stubbed-import smoke check; no new imports added, so module graph is unchanged.                                                                         |
| Over-broadening the allowlist accidentally exposes a restricted path to navigate       | Very Low   | Medium | `/admin` and `/chat` remain explicitly barred by the runtime guard in `navigate.mjs:20-22` independent of `VALID_PATHS`; only `/foundation` and `/blueprint` (both public routes) are added. |

### Dependencies & Order of Operations

- Steps 1 and 2 are independent of each other and can be done in either order (or together) — both are prerequisites for the tests in Step 3/4.
- Step 3 (drift test) depends on Step 1 (it asserts the Set contains the new paths; writing it before Step 1 would red the suite — acceptable if doing TDD: write the test first, watch it fail, then apply Step 1).
- Step 3.4 (navigate description test) depends on Step 2.
- Step 4 (run tests) depends on Steps 1-3.
- Step 5 (deploy) depends on Step 4 being green. Dry-run (5.1) strictly precedes deploy (5.2).
- Step 6 (CLAUDE.md) is independent and can be done any time; it documents the others.
- No external/blocking factors: no AWS infra, IAM, env-var, or Amplify changes. Deploy targets `us-east-1` (chat-stream's region), independent of the Amplify (us-east-2) frontend pipeline.

### Estimated Effort

- **Complexity:** Low (allowlist + description) / Medium (drift test with text-parse + exclusion logic).
- **Time estimate:** 30-50 minutes (including local test run + dry-run + deploy).
- **Files affected:** 2 modified (core) + 1 created + 1 modified (test) + 1 optional modified (docs) = 3-5 files (3 create/modify minimum, 5 with the navigate test and CLAUDE.md note).

---

## 3. Add a server-side PII guard to sanitizeFactContent before persisting visitor memory

### Objective

Today the "PII disallowed" policy for visitor memory is enforced only by prompt instructions (`rememberFact.mjs:13`, `prompts.mjs:37`) — the model is _asked_ not to store emails/phones, but `sanitizeFactContent` (`memory.mjs:19-25`) has no code path that rejects them, and the Bedrock Guardrail never inspects DynamoDB tool arguments. This change makes `sanitizeFactContent` return `''` (which `putFact` already converts into a thrown rejection that `rememberFact` narrates as `{ok:false}`) when a fact contains an email address, a phone-number-shaped string, or a long digit run, turning the documented policy into an actual server-side control. When done, a fact like `"call me at chris@altivum.io"` or `"my number is 512-555-0199"` is silently dropped before it ever reaches the 90-day-TTL memory table, with no new infrastructure and no change to the tool's public contract.

### Prerequisites

- Repo at `/Users/cperez/dev/altivum-dev/thechrisgrey`, Node 20 (`.nvmrc`).
- Familiarity with the existing `sanitizeFactContent` pipeline: type-guard → whitespace collapse → empty check → `SENTINEL_PATTERN` reject → truncate (`lambda/chat-stream/memory.mjs:19-25`).
- Understanding that `putFact` (`memory.mjs:72-73`) already throws `"content is empty or rejected after sanitization"` when sanitize returns `''`, and `buildRememberFactTool`'s `callback` (`tools/rememberFact.mjs:37-47`) already catches that, records `ToolFailure_RememberFact`, and returns `{ok:false, error:...}` — so no new error plumbing is needed.
- Lambda test runner: `npm run test:lambda` (the glob already includes `lambda/chat-stream/__tests__/*.test.mjs`, so `memory.test.mjs` additions are picked up automatically — no package.json change).
- Lambda lint gate: `npm run lint:lambda` (`--max-warnings 0`).
- Deploy: `npm run deploy:lambda -- chat-stream --dry-run` then `npm run deploy:lambda -- chat-stream` (default region `us-east-1`; verify the function's region matches before deploying — pass `--region` if it differs).
- No IAM, env-var, or table-schema change is required (pure compute-layer logic on an existing function).

### Step-by-Step Implementation

**1. Add the PII detection regexes to `memory.mjs` (module scope, next to `SENTINEL_PATTERN`).**

1.1 Open `lambda/chat-stream/memory.mjs`. Immediately after line 10 (`const SENTINEL_PATTERN = ...`), add two module-level constants. Keep them conservative so legitimate facts (years like `2024`, ZIP codes, "served 18 years") are not false-rejected, while real emails and phone-shaped strings are caught.

```js
// PII guards — visitor memory must never persist contact identifiers (CLAUDE.md "PII disallowed").
// Email: a token containing '@' with a dotted domain. Conservative: requires a '.' after the '@'.
const EMAIL_PATTERN = /[^\s@]+@[^\s@]+\.[^\s@]+/;
// Phone / long digit run: a digit followed by 9+ more "phone-ish" chars (digits, spaces, () . - +),
// requiring at least 10 total digits so years (2024), ZIPs (78701), and "18D"/"18 years" don't trip it.
const PHONE_PATTERN = /(?:\+?\d[\s().-]?){10,}/;
```

1.2 Rationale for the thresholds (handled edge cases — describe in the test names too):

- `EMAIL_PATTERN` requires a dot _after_ the `@`, so a bare handle like `@thechrisgrey` (no domain dot) does NOT match — but `chris@altivum.io` does. This avoids rejecting facts that legitimately mention a social handle.
- `PHONE_PATTERN` uses `{10,}` repetitions of "a digit optionally followed by one separator", which means **at least 10 digits** must appear in a phone-shaped run. A 4-digit year (`2024`), a 5-digit ZIP (`78701`), a count like `served 18 years`, and the MOS `18D` all stay under the threshold and pass. US/international numbers (`512-555-0199`, `+1 (512) 555-0199`, `5125550199`) all exceed it and are rejected.

**2. Apply the guards inside `sanitizeFactContent`, after the sentinel check.**

2.1 Locate the current body (`memory.mjs:19-25`):

```js
export function sanitizeFactContent(raw) {
  if (!raw || typeof raw !== 'string') return '';
  const collapsed = raw.replace(/\s+/g, ' ').trim();
  if (!collapsed) return '';
  if (SENTINEL_PATTERN.test(collapsed)) return '';
  return collapsed.slice(0, MAX_FACT_LENGTH);
}
```

2.2 Insert the two PII checks between the `SENTINEL_PATTERN` line and the `return collapsed.slice(...)` line so the new body reads:

```js
export function sanitizeFactContent(raw) {
  if (!raw || typeof raw !== 'string') return '';
  const collapsed = raw.replace(/\s+/g, ' ').trim();
  if (!collapsed) return '';
  if (SENTINEL_PATTERN.test(collapsed)) return '';
  if (EMAIL_PATTERN.test(collapsed)) return '';
  if (PHONE_PATTERN.test(collapsed)) return '';
  return collapsed.slice(0, MAX_FACT_LENGTH);
}
```

2.3 Edge case ordering: the PII tests run on the **whitespace-collapsed** string (so `"512   555   0199"` and `"512-555-0199"` are both normalized to single spaces before matching — `PHONE_PATTERN` allows a single separator char between digits, and the collapse guarantees at most one space). They run _before_ truncation so a fact whose first 240 chars are clean but whose tail carries an email is still rejected. Both `return ""` paths funnel into the exact same downstream behavior already exercised by the existing sentinel test (`memory.test.mjs:197-204`): `putFact` throws, `rememberFact` returns `{ok:false}`.

**3. Add regression tests to `memory.test.mjs` covering accept/reject cases.**

3.1 Open `lambda/chat-stream/__tests__/memory.test.mjs`. After the existing sentinel test block (ends `memory.test.mjs:81`, the `"sanitizeFactContent allows normal equals signs"` test), add new `sanitizeFactContent` tests:

```js
test('sanitizeFactContent rejects facts containing an email address', () => {
  assert.equal(sanitizeFactContent('reach me at chris@altivum.io'), '');
  assert.equal(sanitizeFactContent('Email: jane.doe+tag@example.co.uk'), '');
});

test('sanitizeFactContent allows social handles without a domain dot', () => {
  assert.equal(sanitizeFactContent('goes by @thechrisgrey on X'), 'goes by @thechrisgrey on X');
});

test('sanitizeFactContent rejects phone-number-shaped facts', () => {
  assert.equal(sanitizeFactContent('call me at 512-555-0199'), '');
  assert.equal(sanitizeFactContent('number is +1 (512) 555-0199'), '');
  assert.equal(sanitizeFactContent('reach 5125550199 anytime'), '');
});

test('sanitizeFactContent does not false-reject short digit runs', () => {
  assert.equal(sanitizeFactContent('served as an 18D for 12 years'), 'served as an 18D for 12 years');
  assert.equal(sanitizeFactContent('lives near ZIP 78701'), 'lives near ZIP 78701');
  assert.equal(sanitizeFactContent('graduated in 2014'), 'graduated in 2014');
});
```

3.2 After the existing `"putFact rejects prompt-injection sentinel content"` test (`memory.test.mjs:197-204`), add a `putFact`-level test confirming the end-to-end rejection (no DynamoDB write) for PII, mirroring the sentinel test's structure:

```js
test('putFact rejects PII content without writing to DynamoDB', async () => {
  const client = fakeClient();
  await assert.rejects(
    () => putFact(client, PutCommand, 'd', 'email me at chris@altivum.io'),
    /empty or rejected after sanitization/,
  );
  await assert.rejects(
    () => putFact(client, PutCommand, 'd', 'my cell is 512-555-0199'),
    /empty or rejected after sanitization/,
  );
  assert.equal(client.calls.length, 0);
});
```

3.3 These tests assert both the unit behavior (`sanitizeFactContent` returns `''`) and the integration behavior (`putFact` throws and issues zero `send` calls — `client.calls.length === 0`), so the guard is verified at both layers without touching live AWS.

**4. (Optional, recommended) Tighten the inline doc to match reality.**

4.1 No prompt change is functionally required, but since CLAUDE.md documents "PII disallowed" as a policy and this change makes it a _control_, update the chat-stream Alti section of `CLAUDE.md` to reflect that enforcement is now server-side. In the "Visitor Memory" line, append: `Server-side guard in sanitizeFactContent (memory.mjs) rejects facts containing emails/phone-shaped digit runs before persistence.` This keeps the architecture doc honest about where enforcement lives.

**5. Lint, test, dry-run, deploy.**

5.1 Lint the Lambda tree (CI gate, zero warnings):

```bash
npm run lint:lambda
```

5.2 Run the Lambda test suite (includes the new `memory.test.mjs` cases):

```bash
npm run test:lambda
```

5.3 Build + verify module graph + stubbed-import smoke check (no upload):

```bash
npm run deploy:lambda -- chat-stream --dry-run
```

5.4 Deploy (confirm the deployed function's region first; chat-stream is in `us-east-1` per CLAUDE.md, which is the script default):

```bash
npm run deploy:lambda -- chat-stream
```

### File & Code Changes

| Action | File Path                                                                                 | Description of Change                                                                                                                                                                               |
| ------ | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Modify | `/Users/cperez/dev/altivum-dev/thechrisgrey/lambda/chat-stream/memory.mjs`                | Add `EMAIL_PATTERN` + `PHONE_PATTERN` module constants after `SENTINEL_PATTERN` (line 10); add two `if (...) return ""` checks inside `sanitizeFactContent` after the sentinel check (lines 23-24). |
| Modify | `/Users/cperez/dev/altivum-dev/thechrisgrey/lambda/chat-stream/__tests__/memory.test.mjs` | Add 4 `sanitizeFactContent` tests (email reject, handle allow, phone reject, short-digit allow) after line 81; add 1 `putFact` PII-rejection test (zero writes) after line 204.                     |
| Modify | `/Users/cperez/dev/altivum-dev/thechrisgrey/CLAUDE.md`                                    | (Optional) Update Visitor Memory line to note server-side PII guard now enforces the "PII disallowed" policy.                                                                                       |

No new files, no deletions. No `iam-policy.json` change (no new AWS permissions). No env-var change. No frontend change. No `package.json` change (test glob already covers the file).

### Testing & Validation

- **Unit tests (in `memory.test.mjs`):**
  - `"sanitizeFactContent rejects facts containing an email address"` — confirms `chris@altivum.io` and `jane.doe+tag@example.co.uk` return `''`.
  - `"sanitizeFactContent allows social handles without a domain dot"` — confirms `@thechrisgrey` (no dotted domain) is NOT rejected (false-positive guard).
  - `"sanitizeFactContent rejects phone-number-shaped facts"` — confirms dashed, international/parenthesized, and bare-10-digit numbers return `''`.
  - `"sanitizeFactContent does not false-reject short digit runs"` — confirms `18D`/`12 years`, ZIP `78701`, and year `2014` pass through unchanged (false-positive guard).
  - `"putFact rejects PII content without writing to DynamoDB"` — integration-level: `putFact` throws `/empty or rejected after sanitization/` and `client.calls.length === 0` (no DynamoDB write attempted).
- **Existing tests must stay green:** the sentinel, whitespace, truncation, empty-input, and all `putFact`/`getFacts`/`forgetDevice` tests (`memory.test.mjs:36-319`) are unaffected.
- **Exact commands to confirm end-to-end:**
  ```bash
  npm run lint:lambda
  npm run test:lambda
  npm run deploy:lambda -- chat-stream --dry-run
  ```
  All three must pass before deploying. After `npm run deploy:lambda -- chat-stream`, optionally validate live: in the deployed environment send a chat message like "remember my email is test@example.com" and confirm the `MEMORY_UPDATE` event does NOT fire (Alti will narrate inability to save), then verify the `thechrisgrey-chat-memory` table has no new item for that device hash.
- **Confirm rollback works:** the change is a pure additive code edit to one function plus tests. To roll back, `git revert` the commit (or remove the two `if` lines + two constants) and re-run `npm run deploy:lambda -- chat-stream`. `sanitizeFactContent` returns to its prior accept-all-non-sentinel behavior immediately; no data migration, no schema/TTL change, existing stored facts are untouched.

### Risk & Mitigation

| Risk                                                                                                                           | Likelihood | Impact | Mitigation                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PHONE_PATTERN` false-rejects a legitimate non-phone fact with a long digit run (e.g. a serial/ID number a visitor volunteers) | Low        | Low    | `{10,}`-digit threshold is high enough that only phone-length runs match; the "short-digit allow" test pins years/ZIPs/MOS as safe; failure is graceful (fact silently dropped, Alti narrates `{ok:false}`), never a crash. |
| `EMAIL_PATTERN` rejects a fact that legitimately contains an `@`-with-dot token that isn't an email                            | Very Low   | Low    | Storing contact-identifier-shaped tokens is exactly the policy target; acceptable conservative trade-off. Handle-without-dot case explicitly preserved and tested.                                                          |
| ReDoS from the new regexes on adversarial input                                                                                | Very Low   | Low    | Both patterns are linear with no nested quantifiers over overlapping classes; input is already capped at 4000 chars/msg upstream and collapsed before matching.                                                             |
| Behavior change silently surprises the model/UX (a fact the user expected stored isn't)                                        | Low        | Low    | Existing `rememberFact` catch already surfaces `{ok:false}` so Alti tells the visitor it couldn't save; `ToolFailure_RememberFact` metric makes drops observable in CloudWatch.                                             |
| Deploy hits wrong region                                                                                                       | Low        | Medium | Script defaults to `us-east-1` (matches chat-stream); `--dry-run` smoke check runs first; pass `--region` explicitly if the function moved.                                                                                 |

### Dependencies & Order of Operations

- Step 1 (add constants) must precede Step 2 (use them in `sanitizeFactContent`) — same file, sequential.
- Step 3 (tests) depends on Steps 1-2 being in place to pass, but the test _code_ can be written in parallel with the implementation.
- Step 4 (CLAUDE.md doc) is independent and optional — can be done anytime, no code dependency.
- Step 5 is strictly last and ordered internally: lint → test → dry-run → deploy. Do not deploy until lint and tests are green and the dry-run smoke check passes.
- No external/blocking factors: no new IAM, no env vars, no table changes, no frontend coordination. The downstream rejection plumbing (`putFact` throw + `rememberFact` catch) already exists, so nothing else must change first.

### Estimated Effort

- **Complexity:** Low
- **Time estimate:** 30-45 minutes (including writing tests and a verified deploy).
- **Files affected:** 2 modify (memory.mjs, memory.test.mjs) + 1 optional modify (CLAUDE.md) = 2-3 modify, 0 create, 0 delete.

---

## 4. Reset the top-level ErrorBoundary on navigation (drop the false Blog-retry premise)

### Objective

Today a genuine render-time throw inside the top-level `<ErrorBoundary>` in `App.tsx` (most plausibly a lazy chunk load failure after a stale-deploy, or a downstream render crash on a non-Blog page) latches `hasError = true` and traps the visitor on the full-screen "Something went wrong" page until they perform a full `window.location.reload()`. After this change the boundary is keyed by `location.pathname`, so any client-side navigation (nav links, "Go Home", browser back) remounts a fresh boundary with `hasError = false`, letting the user recover by simply navigating to another route. This is purely the pathname-keying of the boundary — the Blog/BlogPost CMS-fetch errors are already handled in-component with working in-place retry (`onClick={fetchBlogData}` / `onClick={fetchPost}`) and never reach the boundary, so nothing about re-fetching Sanity is in scope.

### Prerequisites

- No new packages, services, or AWS resources. Pure frontend React change.
- Existing-code assumptions (all confirmed by reading the files):
  - `src/App.tsx:38` already calls `const location = useLocation();` and `App` is rendered inside the Router context (`ScrollToTop` / `<Routes>` confirm routing context is present). The top-level `<ErrorBoundary>` is at `src/App.tsx:46` and currently has **no** `key`.
  - The two Blog boundaries at `src/App.tsx:58` and `src/App.tsx:66` are separate per-route instances wrapping `<Blog />` / `<BlogPost />` — they are unaffected by this change (and React already remounts them on route element change).
  - `src/components/ErrorBoundary.tsx` is a class component with state `{ hasError, error }`, `getDerivedStateFromError` (line 24), `componentDidCatch` (line 28), and `handleReset` (lines 32-35). It has **no** `componentDidUpdate`, `getDerivedStateFromProps`, or `resetKeys` mechanism — so today the only way `hasError` clears without a full reload is the `handleReset` call wired to the Refresh button (which also reloads) and the "Go Home" `Link onClick`.
  - **Trap to avoid (confirmed at `src/pages/Chat.tsx:144-162`):** `handleChatErrorReset` only clears `sessionStorage` keys; it is passed as both `onReset` and `ChatErrorFallback`'s `onRetry`, but `onRetry` does **not** call the boundary's `handleReset`, so clicking it would not clear `hasError`. Our reset mechanism must actually clear the boundary's `hasError` state — which is exactly why we use React's remount-on-key-change (Option A) rather than an in-place handler.
- Tooling: `npm test` (vitest run), `npm run lint`, `npm run build` available per repo conventions.

### Step-by-Step Implementation

**Decision — Option A (key the boundary) over Option B (add a resetKeys prop).** Option A is the smallest, most idiomatic React pattern for "discard error state when X changes": rendering `<ErrorBoundary key={location.pathname}>` makes React unmount the old boundary subtree and mount a brand-new one on every pathname change, so `hasError` resets to its constructor value `false` with zero new lifecycle code in `ErrorBoundary.tsx`. Option B (a `resetKeys`/`componentDidUpdate` comparator) is more reusable but adds a code path, a new prop to the public `Props` interface, and array-identity edge cases — unnecessary here since only the App-level boundary needs reset-on-nav and it already has a single stable discriminator (`location.pathname`). The one consequence of Option A — the wrapped `<Suspense>`/`<Routes>` subtree remounts on each navigation — is acceptable and in fact already the de-facto behavior: route elements swap per path, `ScrollToTop` resets scroll on every navigation, and lazy chunks are cached by the bundler so a remounted `<Suspense>` re-resolves instantly without a network round-trip. The persistent shell (`Navigation`, `Footer`, `ChatWidget`) lives **outside** this boundary in `App.tsx` and is untouched, so cross-page persistence (chat widget `sessionStorage` sync, nav state) is unaffected.

1. **Key the top-level ErrorBoundary by pathname in `App.tsx`.**

   1.1. Open `src/App.tsx`. The handler component already destructures `location` at line 38 (`const location = useLocation();`), so no new hook is needed.

   1.2. Change the opening tag at line 46 from `<ErrorBoundary>` to `<ErrorBoundary key={location.pathname}>`. Concretely, the JSX block becomes:

   ```tsx
   <ErrorBoundary key={location.pathname}>
     <Suspense fallback={<PageLoadingFallback />}>
       <Routes>{/* ...unchanged... */}</Routes>
     </Suspense>
   </ErrorBoundary>
   ```

   Leave the two inner Blog boundaries (lines 58, 66) and everything else exactly as-is.

   1.3. Edge cases handled by this shape:
   - **Catch-all 404 / hash-only changes:** `location.pathname` is stable for a given route and excludes search/hash, so navigating within the same page (e.g. `?series=` filter changes on `/blog`, or `#anchor` jumps) does **not** remount the boundary — only true path changes do. That is the desired granularity (a Blog filter change should not nuke the subtree).
   - **First load / no error:** When `hasError` is `false`, remounting on navigation is behaviorally identical to today (children re-render anyway on route change), so there is no regression for the happy path.
   - **Error then navigate:** A latched error on `/foo` is discarded the instant the user clicks any internal link to `/bar` (new `key`, new boundary, `hasError = false`), which is the entire point of the fix.

2. **Confirm no change is needed in `ErrorBoundary.tsx`.** Option A requires zero edits to `src/components/ErrorBoundary.tsx` — React's reconciler handles the reset via key-driven remount. Do **not** add `componentDidUpdate`/`getDerivedStateFromProps`/`resetKeys` (that is Option B, explicitly not chosen). Verify the file is unmodified before committing.

3. **Add a focused regression test that proves recovery-on-navigation.** Because there is no `App.test.tsx`, the cleanest, fastest assertion lives alongside the existing boundary tests in `src/components/ErrorBoundary.test.tsx`, reusing its `ThrowingComponent` and router-render helpers. The test reproduces the App pattern in miniature: an `ErrorBoundary` keyed by a path value, where flipping the key remounts a fresh boundary and a now-passing child renders instead of the error UI.

   3.1. Add a new `describe('reset on key change (navigation recovery)', ...)` block to `src/components/ErrorBoundary.test.tsx`. Use a small wrapper that renders `<ErrorBoundary key={path}>` around a child that throws only for the initial path:

   ```tsx
   describe('reset on key change (navigation recovery)', () => {
     // Mirrors App.tsx: <ErrorBoundary key={location.pathname}>. Re-keying
     // the boundary remounts a fresh instance with hasError=false, so a
     // genuine render throw on one route is discarded on client-side nav.
     it('discards a latched error when the key (pathname) changes', () => {
       const Harness = ({ path }: { path: string }) => (
         <MemoryRouter>
           <ErrorBoundary key={path}>
             <ThrowingComponent shouldThrow={path === '/throws'} />
           </ErrorBoundary>
         </MemoryRouter>
       );

       const { rerender } = render(<Harness path="/throws" />);
       // Error UI is shown on the throwing route.
       expect(screen.getByText('Something went wrong')).toBeInTheDocument();

       // Simulate navigating to a different path: new key -> fresh boundary.
       rerender(<Harness path="/safe" />);
       expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
       expect(screen.getByText('Child content rendered')).toBeInTheDocument();
     });

     it('keeps showing the error UI when the key does not change', () => {
       const Harness = ({ path }: { path: string }) => (
         <MemoryRouter>
           <ErrorBoundary key={path}>
             <ThrowingComponent shouldThrow />
           </ErrorBoundary>
         </MemoryRouter>
       );
       const { rerender } = render(<Harness path="/throws" />);
       expect(screen.getByText('Something went wrong')).toBeInTheDocument();
       // Same key -> same boundary instance -> error stays latched (proves the
       // recovery in the previous test comes from re-keying, not a re-render).
       rerender(<Harness path="/throws" />);
       expect(screen.getByText('Something went wrong')).toBeInTheDocument();
     });
   });
   ```

   This relies only on symbols already in the file (`ThrowingComponent` with its `shouldThrow` prop at lines 8-13, `MemoryRouter`, `render`/`screen`, the `console.error = vi.fn()` suppression already set in `beforeEach`). `rerender` from RTL's `render` is destructured locally; no new imports beyond what is present. The second test is the negative control that proves the key — not an incidental re-render — is what drives recovery.

4. **(Optional, lightweight) document the behavior in CLAUDE.md.** The routing/`App.tsx` section already describes the layout. Add a one-clause note under the routing bullet so future contributors know the boundary intentionally remounts per path. See File & Code Changes table; this is documentation-only and can be skipped if the user prefers a minimal diff.

### File & Code Changes

| Action            | File Path                                                                          | Description of Change                                                                                                                                                                                                                                                                            |
| ----------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Modify            | `/Users/cperez/dev/altivum-dev/thechrisgrey/src/App.tsx`                           | Line 46: add `key={location.pathname}` to the top-level `<ErrorBoundary>` so it remounts (clearing `hasError`) on every client-side path change. `location` is already in scope (line 38). No other lines change.                                                                                |
| Modify            | `/Users/cperez/dev/altivum-dev/thechrisgrey/src/components/ErrorBoundary.test.tsx` | Add a `describe('reset on key change (navigation recovery)')` block with two tests: (1) re-keying the boundary discards the error and renders the recovered child; (2) negative control — same key keeps the error latched. Reuses existing `ThrowingComponent`/`MemoryRouter`/`render` helpers. |
| Modify (optional) | `/Users/cperez/dev/altivum-dev/thechrisgrey/CLAUDE.md`                             | One clause in the Routing section: "Top-level `<ErrorBoundary>` is keyed by `location.pathname` so a render-time throw (e.g. a stale lazy chunk) clears on navigation instead of trapping the user until a full reload."                                                                         |
| Unchanged         | `/Users/cperez/dev/altivum-dev/thechrisgrey/src/components/ErrorBoundary.tsx`      | No edits — Option A requires none. Listed to make explicit that the class component is intentionally untouched (no `resetKeys`/`componentDidUpdate`).                                                                                                                                            |
| Unchanged         | `/Users/cperez/dev/altivum-dev/thechrisgrey/src/pages/Chat.tsx`                    | No edits — its `onReset`/`onRetry` handlers are out of scope; this plan does not attempt to fix the `onRetry`-doesn't-clear-`hasError` trap noted in the evidence (that boundary is per-page and already recovers when the user navigates away once this change lands).                          |

### Testing & Validation

- **Unit tests (new, in `ErrorBoundary.test.tsx`):**
  - "discards a latched error when the key (pathname) changes" — asserts the error UI appears for the throwing route, then disappears (and the recovered child appears) after the key flips. This is the core regression test for the fix.
  - "keeps showing the error UI when the key does not change" — negative control proving recovery is driven by the key change, not an unrelated re-render. Guards against a future refactor accidentally clearing errors on every render.
- **Existing tests:** The full `ErrorBoundary.test.tsx` suite (default title, pageName, Refresh button, Go Home link, custom fallback, onReset callback) must continue to pass unchanged — Option A touches none of that behavior.
- **Commands to run (copy-pasteable):**
  ```bash
  cd /Users/cperez/dev/altivum-dev/thechrisgrey
  npm test -- src/components/ErrorBoundary.test.tsx   # fast, targeted run of the boundary suite
  npm test                                             # full vitest run — confirms no collateral breakage
  npm run lint                                          # CI gate, --max-warnings 0
  npm run build                                         # full pipeline incl. tsc typecheck + vite + prerender
  ```
- **Manual end-to-end verification (dev server):**
  ```bash
  cd /Users/cperez/dev/altivum-dev/thechrisgrey
  npm run dev
  ```
  Temporarily force a throw inside a non-Blog lazy page (e.g. add `throw new Error('boom')` at the top of `src/pages/About.tsx`'s component body), then in the browser: (1) navigate to `/about` → confirm the full-screen "Something went wrong" page renders; (2) click any nav link (e.g. Home/Links) → confirm the app recovers and renders the target page **without** a full reload (watch the Network tab: no full document reload). Remove the temporary `throw` afterward. Without the `key` change this navigation would leave you stuck on the error page.
- **Rollback confirmation:** Revert the single line in `App.tsx` (drop `key={location.pathname}`) and re-run `npm test` — the two new tests still pass (they construct the keyed pattern locally, independent of `App.tsx`), and the manual repro above would then trap on the error page again, confirming the `key` is the load-bearing change. To fully back out, also delete the new `describe` block. No data, infra, env var, or Lambda state is involved, so rollback is a pure code revert with no migration.

### Risk & Mitigation

| Risk                                                                                                                                             | Likelihood | Impact | Mitigation                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Remounting the `<Suspense>`/`<Routes>` subtree on every navigation causes a visible flash or re-fetch                                            | Low        | Low    | Lazy chunks are bundler-cached so re-resolution is instant (no network); route elements already swap per path today. Verify visually in the manual dev-server check — confirm no `PageLoadingFallback` spinner flashes on normal nav between already-visited routes. |
| Boundary fails to reset because something other than `pathname` should be the discriminator (e.g. error on a route that doesn't change pathname) | Low        | Low    | `pathname` covers all 17 distinct routes and the catch-all; same-page state changes (search/hash) intentionally don't reset (desired). If a future need arises for finer reset, Option B (resetKeys) can be added without conflicting with this change.              |
| New test is flaky due to React error-boundary console noise or async timing                                                                      | Low        | Low    | Tests are synchronous (`rerender` is sync) and reuse the file's existing `console.error = vi.fn()` suppression in `beforeEach`; no `await`/timers introduced.                                                                                                        |
| `key` on a JSX element flagged by react-hooks/react-compiler lint rules                                                                          | Very Low   | Low    | `key` is a standard React reserved prop, not a hook concern; the four enforced react-hooks rules (set-state-in-effect, refs, immutability, static-components) do not apply. `npm run lint` gate in the test plan catches any surprise.                               |
| Future contributor removes the `key` not realizing it's load-bearing                                                                             | Low        | Low    | The negative-control test documents intent in code; the optional CLAUDE.md note records the rationale.                                                                                                                                                               |

### Dependencies & Order of Operations

- **Step 1 (App.tsx key)** and **Step 3 (tests)** are independent and can be done in either order or in parallel — the tests construct the keyed-boundary pattern locally and do not import `App`, so they validate the mechanism regardless of when Step 1 lands. Recommended sequence for a clean TDD-flavored commit: write Step 3 tests first, watch the "discards a latched error…" test pass (it passes immediately because the harness itself supplies the key), then apply Step 1 to wire the same pattern into the real App.
- **Step 2** is a verification step (confirm `ErrorBoundary.tsx` is untouched) — do it before committing.
- **Step 4 (CLAUDE.md)** is optional and has no code dependency; do it last or omit.
- **External/blocking factors:** none. No env vars, no Lambda deploy, no AWS resources, no Sanity. Merging to `main` triggers Amplify per repo convention — create a feature branch and open a PR only when the user asks (per project rules).
- **Suggested internal sequence:** Step 3 → Step 1 → Step 2 → run `npm test` + `npm run lint` + `npm run build` → optional Step 4 → (on request) branch + PR.

### Estimated Effort

- **Complexity:** Low
- **Time estimate:** 30-45 minutes (including the manual dev-server repro and the full `npm run build` pipeline run).
- **Files affected:** 2 modified required (`App.tsx`, `ErrorBoundary.test.tsx`) + 1 optional modified (`CLAUDE.md`); 0 created; 0 deleted. `ErrorBoundary.tsx` and `Chat.tsx` intentionally unchanged.

---

## 5. Fix the CI Lambda install/test drift and the mcp-server barrel import

### Objective

The CI "Install Lambda dependencies" step installs only five of the seven Lambda services (it omits `lambda/kb-builder` and `lambda/kb-sync`) and uses `npm install` for `shared`/`mcp-server` instead of the reproducible `npm ci`, even though all seven dirs ship a committed `package-lock.json`. After this change, the install step iterates the same canonical six-Lambda loop the `lambda-audit` job already uses, every dir installs from its lockfile via `npm ci`, and the list can no longer drift out of sync with `npm run test:lambda`. Separately, `lambda/mcp-server/index.mjs` imports `checkRateLimit` from the bare `lambda-shared` barrel, which statically re-exports `MetricsCollector` → eagerly loads `@aws-sdk/client-cloudwatch` into the public MCP server's cold start; switching to the existing `lambda-shared/rateLimit` subpath (already used by `lambda/metrics`) removes that eager load.

### Prerequisites

- Tools: Node 20 (`.nvmrc`), `git`, `gh` CLI, AWS CLI configured for `us-east-1` (only for the optional mcp-server deploy). No new packages.
- Access: write to the repo on a feature branch; AWS credentials with `lambda:UpdateFunctionCode` for `thechrisgrey-mcp-server` (only if deploying the import change).
- Docs/code to review (already confirmed in this pass):
  - `.github/workflows/ci.yml` — install step at lines 43–49; canonical loop precedent in `lambda-audit` at lines 141–153 (`for dir in lambda/chat-stream lambda/blueprint lambda/kb-builder lambda/metrics lambda/kb-sync lambda/mcp-server`).
  - `package.json` line 16 — `test:lambda` runs `lambda/kb-builder/__tests__/*.test.mjs` (currently passes only because `validation.test.mjs` imports just `../validation.mjs`, a pure module with zero third-party imports).
  - `lambda/mcp-server/index.mjs` line 7 — `import { checkRateLimit } from "lambda-shared";`
  - `lambda/shared/index.mjs` line 5 — static `export { MetricsCollector, MAX_METRICS_PER_CALL } from "./metrics.mjs";`
  - `lambda/shared/metrics.mjs` line 1 — `import { CloudWatchClient, ... } from "@aws-sdk/client-cloudwatch";`
  - `lambda/shared/package.json` line 9 — `"./rateLimit": "./rateLimit.mjs"` subpath export already declared.
  - `lambda/metrics/index.mjs` line 13 — precedent: `import { checkRateLimit } from "lambda-shared/rateLimit";`
- Existing-code assumptions (all verified this pass):
  - All seven lambda dirs (`chat-stream`, `blueprint`, `kb-builder`, `metrics`, `kb-sync`, `mcp-server`, `shared`) have a committed `package-lock.json`.
  - `npm ci --no-audit --no-fund` succeeds cleanly with the `lambda-shared` `file:../shared` dependency for both `shared` (added 41 packages, exit 0) and `mcp-server` (added 76 packages, exit 0) — verified in an isolated `/tmp` copy.
  - `mcp-server/package.json` already declares `@aws-sdk/client-cloudwatch` as a direct dep (line in deps), so the subpath fix removes the eager cold-start load but does NOT shrink the deployed bundle.
  - `lambda/kb-sync` has no `__tests__/` dir (not in `test:lambda`), but IS in the audit loop and SHOULD be in the install loop for parity/future-proofing.

### Step-by-Step Implementation

**1. Create the feature branch.**

1.1. From repo root, branch off `main` (work on `main` triggers Amplify):

```bash
cd /Users/cperez/dev/altivum-dev/thechrisgrey
git checkout -b fix/ci-lambda-install-drift-and-mcp-barrel
```

**2. Replace the CI install step with the driftproof loop.**

2.1. Open `.github/workflows/ci.yml`. The current step (lines 43–49) is:

```yaml
- name: Install Lambda dependencies
  run: |
    cd lambda/chat-stream && npm ci --no-audit --no-fund
    cd ../blueprint && npm ci --no-audit --no-fund
    cd ../metrics && npm ci --no-audit --no-fund
    cd ../shared && npm install --no-audit --no-fund
    cd ../mcp-server && npm install --no-audit --no-fund
```

2.2. Replace it with a loop that mirrors the `lambda-audit` job's canonical list (lines 141–153), but installs `shared` FIRST (so the `file:../shared` dependents resolve a freshly-installed shared) and uses `npm ci` everywhere. Logic: iterate `lambda/shared` plus the six runtime Lambdas; for each, `cd` in a subshell and run `npm ci` since every dir has a committed lockfile. Edge case handled: a future dir missing a lockfile would fail `npm ci` loudly (desired — lockfiles are mandatory here) rather than silently falling back, but to match the deploy script's tolerance we guard with a lockfile check and fall back to `npm install` only when no lockfile exists. `set -e` makes any real install failure fatal. The new step:

```yaml
- name: Install Lambda dependencies
  run: |
    set -e
    # Canonical list mirrors the lambda-audit job below — keep in sync.
    # shared installed first so file:../shared dependents resolve a fresh copy.
    for dir in lambda/shared lambda/chat-stream lambda/blueprint lambda/kb-builder lambda/metrics lambda/kb-sync lambda/mcp-server; do
      echo "=== Installing $dir ==="
      if [ -f "$dir/package-lock.json" ]; then
        (cd "$dir" && npm ci --no-audit --no-fund)
      else
        (cd "$dir" && npm install --no-audit --no-fund)
      fi
    done
```

2.3. (Optional hardening, recommended) Add a short comment above the `lambda-audit` loop at line 143 noting the two lists must stay in sync, so a future editor updates both:

```yaml
# Keep this dir list in sync with the "Install Lambda dependencies" step above.
for dir in lambda/chat-stream lambda/blueprint lambda/kb-builder lambda/metrics lambda/kb-sync lambda/mcp-server; do
```

**3. Switch the mcp-server import to the rateLimit subpath.**

3.1. Open `lambda/mcp-server/index.mjs`. Line 7 currently reads:

```js
import { checkRateLimit } from 'lambda-shared';
```

3.2. Change it to the subpath form (matching `lambda/metrics/index.mjs` line 13). `rateLimit.mjs` imports only node `crypto`, so this breaks the static path to `metrics.mjs` → `@aws-sdk/client-cloudwatch` for this import:

```js
import { checkRateLimit } from 'lambda-shared/rateLimit';
```

3.3. Confirm no other `lambda-shared` barrel imports exist in mcp-server that would re-introduce the eager load:

```bash
grep -rn "from \"lambda-shared\"" /Users/cperez/dev/altivum-dev/thechrisgrey/lambda/mcp-server/
```

Expect zero matches after the edit. (`server.mjs` and the `tools/` files do not import `lambda-shared`; the in-module `metrics` object in `index.mjs` lines 45–51 is a local placeholder, not `MetricsCollector`.)

**4. Document the convention.**

4.1. The CLAUDE.md "Lambda Fleet" section already lists `lambda/shared` exposing `checkRateLimit` and notes subpath usage; no doc change is strictly required. If desired, add one line under the Lambda Fleet bullet for `mcp-server` noting it imports `checkRateLimit` via `lambda-shared/rateLimit` to keep CloudWatch out of cold start (optional, low-value — skip unless the maintainer wants it).

**5. Validate locally (see Testing section), commit, push, open PR — only when the user asks.**

5.1. Stage and commit:

```bash
cd /Users/cperez/dev/altivum-dev/thechrisgrey
git add .github/workflows/ci.yml lambda/mcp-server/index.mjs
git commit -m "fix(ci): driftproof Lambda install loop (npm ci, all 7 dirs) + mcp-server rateLimit subpath

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
git push -u origin fix/ci-lambda-install-drift-and-mcp-barrel
```

**6. Deploy the mcp-server import change (CI change needs no deploy; import change should be deployed).**

6.1. Dry-run first (module graph + stubbed-import smoke check):

```bash
npm run deploy:lambda -- mcp-server --dry-run
```

6.2. On a clean dry-run, deploy (default region us-east-1):

```bash
npm run deploy:lambda -- mcp-server
```

### File & Code Changes

| Action            | File Path                                                                | Description of Change                                                                                                                                                                                                                                                                         |
| ----------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Modify            | `/Users/cperez/dev/altivum-dev/thechrisgrey/.github/workflows/ci.yml`    | Replace the hardcoded 5-line "Install Lambda dependencies" step (lines 43–49) with a `for`-loop over `lambda/shared` + the six runtime Lambdas using `npm ci` (lockfile-guarded fallback to `npm install`). Optionally add a "keep in sync" comment above the `lambda-audit` loop (line 143). |
| Modify            | `/Users/cperez/dev/altivum-dev/thechrisgrey/lambda/mcp-server/index.mjs` | Change line 7 import from `"lambda-shared"` to `"lambda-shared/rateLimit"` so the public MCP server no longer eagerly loads `@aws-sdk/client-cloudwatch` at cold start.                                                                                                                       |
| Modify (optional) | `/Users/cperez/dev/altivum-dev/thechrisgrey/CLAUDE.md`                   | One line under the `mcp-server` Lambda Fleet bullet noting the rateLimit subpath import keeps CloudWatch out of cold start. Skip unless maintainer wants it.                                                                                                                                  |

No test files, IAM policies, or env vars change. `lambda/mcp-server/iam-policy.json` is unaffected (no new AWS calls; CloudWatch was never invoked by mcp-server — it was only being eagerly _imported_). No `package.json`/lockfile changes (the cloudwatch dep stays declared in mcp-server for the documented future wiring).

### Testing & Validation

- **Local Lambda test suite (proves the kb-builder drift is masked today and stays green):**

  ```bash
  cd /Users/cperez/dev/altivum-dev/thechrisgrey
  npm run test:lambda
  ```

  Expect all suites pass, including `lambda/kb-builder/__tests__/validation.test.mjs` and `lambda/mcp-server/__tests__/*.test.mjs`.

- **Lambda lint gate (unchanged but confirm the import edit is clean, `--max-warnings 0`):**

  ```bash
  npm run lint:lambda
  ```

- **mcp-server module-graph + stubbed-import smoke check (proves the subpath resolves and nothing else broke):**

  ```bash
  npm run deploy:lambda -- mcp-server --dry-run
  ```

  Expect "Verifying full module graph resolves" to pass with no module-resolution error.

- **Reproduce the CI install loop locally (proves `npm ci` works for all seven incl. the `file:` dep — already verified this pass, exit 0 for shared and mcp-server):**

  ```bash
  cd /Users/cperez/dev/altivum-dev/thechrisgrey
  set -e
  for dir in lambda/shared lambda/chat-stream lambda/blueprint lambda/kb-builder lambda/metrics lambda/kb-sync lambda/mcp-server; do
    echo "=== $dir ==="
    if [ -f "$dir/package-lock.json" ]; then (cd "$dir" && npm ci --no-audit --no-fund); else (cd "$dir" && npm install --no-audit --no-fund); fi
  done
  ```

  Each dir should report "added N packages" with exit 0. (Run from a copy or expect `node_modules/` to be created locally; never commit them.)

- **Optional: prove the eager-load is actually gone** — confirm `rateLimit.mjs` pulls in no AWS SDK while the barrel does:

  ```bash
  node --input-type=module -e "await import('./lambda/shared/rateLimit.mjs'); console.log('rateLimit deps OK, no cloudwatch import');"
  ```

  This imports cleanly (only node `crypto`); importing the barrel (`./lambda/shared/index.mjs`) would instead require `@aws-sdk/client-cloudwatch` to be installed.

- **Integration / CI verification:** Push the branch and open a PR; confirm the `test-and-build` job's "Install Lambda dependencies" step logs all seven `=== Installing ... ===` lines (including `lambda/kb-builder` and `lambda/kb-sync`) and that "Run Lambda tests" passes. Confirm `cypress-mocked` and `lambda-audit` jobs are unaffected.

- **Post-deploy verification (mcp-server):** Hit the health probe (GET `/health`, index.mjs lines 97–99) and one `tools/call` to confirm rate limiting still works:

  ```bash
  curl -s -X POST "$MCP_ENDPOINT" -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
  ```

  Expect a 200 JSON-RPC response; rate-limit path still uses `checkRateLimit` (index.mjs line 112).

- **Rollback confirmation:** Revert is a clean two-file diff. `git revert <commit>` (or `git checkout main -- .github/workflows/ci.yml lambda/mcp-server/index.mjs`) restores the prior install step and barrel import; re-run `npm run deploy:lambda -- mcp-server` to redeploy the previous mcp-server artifact. No state, schema, or env change to undo.

### Risk & Mitigation

| Risk                                                                                           | Likelihood | Impact                    | Mitigation                                                                                                                                                                                                                          |
| ---------------------------------------------------------------------------------------------- | ---------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci` fails in CI for `shared`/`mcp-server` due to the `file:../shared` dep                 | Low        | Medium (red CI)           | Already verified locally that `npm ci` succeeds (exit 0) for both with the `file:` dep; lockfile-guarded fallback to `npm install` covers a hypothetical missing-lockfile dir.                                                      |
| Install order breaks `file:../shared` resolution (mcp-server/kb-builder install before shared) | Low        | Low                       | Loop installs `lambda/shared` FIRST; `npm ci` resolves `file:../shared` from the source dir regardless, but ordering removes any ambiguity.                                                                                         |
| The rateLimit subpath does not exist / typo                                                    | Very Low   | Medium (cold-start crash) | Subpath `"./rateLimit"` is already declared in `lambda/shared/package.json` (line 9) and proven in production by `lambda/metrics/index.mjs` (line 13); `--dry-run` stubbed-import check catches any resolution error before deploy. |
| Reviewer assumes the import change shrinks the bundle                                          | Low        | Low (confusion)           | PR description and this plan state explicitly: cloudwatch stays a declared mcp-server dep for documented future wiring (index.mjs lines 43–51); the fix only removes eager cold-start _evaluation_, not the dependency.             |
| The two CI dir lists drift again later                                                         | Medium     | Low                       | "Keep in sync" comments added above both loops; install loop now mirrors the audit loop's exact list, making divergence visually obvious in review.                                                                                 |
| mcp-server deploy picks up unrelated drift                                                     | Low        | Medium                    | `--dry-run` first; deploy script installs from lockfile and dereferences `lambda-shared` fresh, so the artifact reflects exactly the committed source.                                                                              |

### Dependencies & Order of Operations

- **Independent, parallelizable:** Step 2 (CI install loop) and Step 3 (mcp-server import) touch different files and have no dependency on each other. Either can land first; they're bundled in one PR for a single review.
- **Sequencing within the change:** Step 1 (branch) → Steps 2 & 3 (in any order) → Step 5 (validate/commit/push) → Step 6 (deploy mcp-server). Step 6 depends only on Step 3.
- **CI change needs no deploy.** The mcp-server import change SHOULD be deployed (Step 6) but is gated on a clean `--dry-run`.
- **External/blocking factors:** None for the CI change. The mcp-server deploy needs AWS credentials for `us-east-1` and `lambda:UpdateFunctionCode` on `thechrisgrey-mcp-server`. Merging to `main` triggers Amplify (frontend) but the changed files are CI/Lambda-only, so no frontend rebuild risk beyond the normal pipeline.

### Estimated Effort

- **Complexity:** Low
- **Time estimate:** 30–45 minutes (including local validation runs and the mcp-server dry-run/deploy)
- **Files affected:** 2 modified (`.github/workflows/ci.yml`, `lambda/mcp-server/index.mjs`); +1 optional modify (`CLAUDE.md`). 0 created, 0 deleted.

---

## 6. Add intrinsic dimensions to the Home hero LCP image to bound CLS (hero only)

### Objective

Give the Home hero LCP `<img>` (`src/pages/Home.tsx:138-143`) explicit intrinsic `width={1500}` / `height={1500}` attributes so the browser computes the image's aspect ratio and reserves its layout box before the bitmap decodes. This eliminates the small first-paint reflow on `/` (the most-visited route) and, because the prerender step serializes the live React DOM, the same dimensions ship in the prerendered `dist/index.html` that crawlers and social scrapers read. The profile image is explicitly **out of scope** — its box is already fully reserved by CSS (`object-cover` inside a fixed `h-screen` sticky container), so dimensions there are a no-op.

### Prerequisites

- No new tools, packages, or services. This is a one-attribute change plus one test assertion.
- Existing-code assumptions confirmed by reading the files:
  - Hero `<img>` lives at `src/pages/Home.tsx:138-143`: `src={heroImage}`, `alt="Leadership Forged in Service"`, `className="w-full max-w-3xl mx-auto"`, `fetchPriority="high"` — and currently has **no** `width`/`height`.
  - `heroImage` is imported at line 7 from `../assets/hero2.png`; the asset is exactly **1500×1500** (confirmed via `sips -g pixelWidth -g pixelHeight src/assets/hero2.png`).
  - The profile `<img>` at `src/pages/Home.tsx:154-159` (`className="w-full h-full object-cover ..."`, inside `<div class="absolute inset-0">` inside `<div class="sticky top-0 h-screen overflow-hidden">`) **must NOT be touched** — its box is reserved by CSS and `object-cover` crops to it.
  - The prerender step (`scripts/prerender.js`) does **not** hand-write the hero `<img>`. It serves the built `dist/`, opens each route headless with puppeteer, waits for `window.__PRERENDER_READY__`, and serializes the live DOM via `page.content()` (line 267). Therefore the prerendered `<img>` is byte-for-byte the one React renders from `Home.tsx` — **no separate prerender edit is required**, the fix carries automatically.
  - Existing test: `src/__tests__/integration/Home.integration.test.tsx` has a `describe('Hero section')` block (lines 34-50) that already grabs the hero image via `screen.getByAltText('Leadership Forged in Service')` and mocks `../../assets/hero2.png` (line 8). This is where the new attribute assertion goes.
- **Decision point to review BEFORE implementing** (see Risk & Mitigation): `docs/superpowers/plans/2026-06-11-editorial-redesign-phase-1.md` plans to **delete** `src/assets/hero2.png` and rebuild Home with an `EditorialImage` component carrying an explicit `aspect` prop. That plan is checked in but **unimplemented** (hero2.png still present, Home.tsx unchanged) and partly stale (references Tailwind v3; repo is on v4). Decide: ship this trivial fix now, or fold the dimension reservation into that redesign. Recommended: ship now (one line, immediate CLS benefit, the redesign will replace it cleanly when it lands).

### Step-by-Step Implementation

1. **Confirm the intrinsic size of the LCP asset (already verified; re-run if the asset may have changed).**
   1.1. Run from the working directory:

   ```bash
   sips -g pixelWidth -g pixelHeight /Users/cperez/dev/altivum-dev/thechrisgrey/src/assets/hero2.png
   ```

   1.2. Expected output (already confirmed): `pixelWidth: 1500`, `pixelHeight: 1500`. If these differ, substitute the actual values into `width`/`height` in step 2. The square 1500×1500 aspect ratio is what the browser will use to reserve the box; the values do not need to equal the rendered CSS size (CSS `w-full max-w-3xl` still controls displayed size — `width`/`height` attributes only declare the aspect ratio).

2. **Add `width` and `height` to the hero `<img>` only.**
   2.1. In `src/pages/Home.tsx`, edit the hero `<img>` element at lines 138-143. Add `width={1500}` and `height={1500}` while preserving every existing attribute and the className verbatim. The resulting element:

   ```jsx
   <img
     src={heroImage}
     alt="Leadership Forged in Service"
     className="w-full max-w-3xl mx-auto"
     width={1500}
     height={1500}
     fetchPriority="high"
   />
   ```

   2.2. **Logic / behavior:** With `width`/`height` present, the browser knows the 1:1 aspect ratio at parse time and reserves a placeholder box sized to `min(100%, 48rem)` width × matching height before the bitmap decodes — preventing the ~0-height → full-height expansion that causes the first-paint shift. The `className="w-full max-w-3xl mx-auto"` is unchanged, so rendered size and responsiveness are identical; CSS `height` resolves via the implied `aspect-ratio` the attributes establish. The default UA `img { height: auto }` is already overridden by Tailwind's preflight (`max-w-3xl` constrains width; height follows the attribute-derived aspect ratio), so no extra CSS is needed.
   2.3. **Do NOT modify** the profile `<img>` at lines 154-159. Verified no-op for CLS (box reserved by the `h-screen` sticky container + `object-cover`). Adding dimensions there is wasted.
   2.4. Edge case — Tailwind preflight: Tailwind v4 preflight sets `img { display: block; ... }` but does not force `height: auto !important`, so the aspect-ratio reservation holds. If a future global rule reintroduces `height: auto` on bare `img`, the reservation would degrade gracefully back to current behavior (the attributes are a hint, not a regression risk).

3. **Add a regression assertion for the new attributes.**
   3.1. In `src/__tests__/integration/Home.integration.test.tsx`, inside the existing `describe('Hero section')` block (after the test at lines 35-40), add a test that asserts the hero image carries the intrinsic dimensions. Use the same `getByAltText('Leadership Forged in Service')` query already in the file:

   ```tsx
   it('reserves the hero image box with intrinsic width and height (CLS)', () => {
     renderHome();
     const heroImage = screen.getByAltText('Leadership Forged in Service');
     expect(heroImage).toHaveAttribute('width', '1500');
     expect(heroImage).toHaveAttribute('height', '1500');
   });
   ```

   3.2. **Logic:** jsdom renders the numeric JSX props `width={1500}`/`height={1500}` as string attributes `"1500"`, so `toHaveAttribute('width', '1500')` is the correct matcher. `toHaveAttribute` is already available via the project's `@testing-library/jest-dom` setup (used elsewhere in this same file, e.g. line 90 `toHaveAttribute('src', ...)`). The `../../assets/hero2.png` mock at line 8 keeps the test build-independent.
   3.3. Edge case — guard against silent regression from the redesign: this test will fail loudly if a future change drops the attributes (or if the `EditorialImage` swap lands without preserving them), which is the desired signal.

4. **Run the lint + type + unit gates locally before any commit.**
   4.1. From the working directory:
   ```bash
   npm run lint
   npx tsc --noEmit
   npm test -- src/__tests__/integration/Home.integration.test.tsx
   ```
   4.2. All three must pass with zero warnings (`--max-warnings 0` is CI-enforced). The new numeric props introduce no new types or imports, so `tsc` is unaffected; lint sees no new rule surface.

### File & Code Changes

| Action | File Path                                                                                        | Description of Change                                                                                                                                                                                          |
| ------ | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Modify | `/Users/cperez/dev/altivum-dev/thechrisgrey/src/pages/Home.tsx`                                  | Add `width={1500}` and `height={1500}` to the hero `<img>` at lines 138-143 (the `src={heroImage}` LCP element). No other attribute, className, or element changed. Profile `<img>` at 154-159 left untouched. |
| Modify | `/Users/cperez/dev/altivum-dev/thechrisgrey/src/__tests__/integration/Home.integration.test.tsx` | Add one `it()` in the existing `describe('Hero section')` block asserting the hero image has `width="1500"` and `height="1500"`.                                                                               |

No changes required to: `scripts/prerender.js` (serializes live DOM — carries the fix automatically), `amplify.yml` (no new external resources), any `iam-policy.json` (no infra), env vars, or `CLAUDE.md` (a one-attribute markup tweak does not warrant a doc entry; the design-system section already documents the blog `aspectRatio 4/3` CLS pattern this mirrors).

### Testing & Validation

- **Unit test (added in step 3):** asserts the hero `<img>` renders with `width="1500"` and `height="1500"` — a permanent regression guard that fires if the attributes are ever dropped (including by the planned redesign).
- **Existing suite stays green:** the existing "renders the hero image with correct alt text" and "renders the profile image" tests are unaffected; run the whole Home file to confirm no collateral breakage.
- **Commands to confirm end-to-end:**
  ```bash
  npm test -- src/__tests__/integration/Home.integration.test.tsx   # new + existing assertions
  npm run lint                                                        # CI lint gate, max-warnings 0
  npx tsc --noEmit                                                    # type gate
  npm run build                                                       # full pipeline incl. prerender
  ```
  After `npm run build`, confirm the prerendered hero carries the dimensions:
  ```bash
  grep -o 'alt="Leadership Forged in Service"[^>]*' dist/index.html
  grep -c 'width="1500" height="1500"' dist/index.html   # expect >=1
  ```
  (Note: in the serialized HTML, attribute order may differ from source; if the single-grep above returns 0, inspect the hero `<img>` tag in `dist/index.html` directly and confirm both `width="1500"` and `height="1500"` are present.)
- **Manual / Lighthouse CLS verification (the real validation, per the recommendation):**
  ```bash
  npm run preview   # serves the production build at http://localhost:4173
  ```
  Then run a Lighthouse audit (Chrome DevTools → Lighthouse, or the chrome-devtools `lighthouse_audit` tool) against `http://localhost:4173/` with mobile throttling. Compare the **Cumulative Layout Shift** metric and the "Image elements do not have explicit width and height" audit before vs. after — the hero image should no longer appear in that audit's failing list, and CLS attributable to the hero region should drop to ~0.
- **Production confirmation (post-deploy, optional):** CLS is already measured in prod via `src/utils/webVitals.ts` (`onCLS → /vitals`) and the `high-cls` CloudWatch alarm (>0.25/1hr) documented in `CLAUDE.md`. Watch the `TheChrisGrey/SiteMetrics` CLS metric trend after the next Amplify deploy.
- **Rollback confirmation:** revert is a single-file diff — `git revert <sha>` or manually delete the two attribute lines restores the prior `<img>`. Re-run `npm test -- src/__tests__/integration/Home.integration.test.tsx`; the new assertion fails (expected — confirms the revert removed the attributes), and removing the added `it()` returns the suite to green. No data, infra, or env state to unwind.

### Risk & Mitigation

| Risk                                                                                                                                                                 | Likelihood | Impact | Mitigation                                                                                                                                                                                                                                                                                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Superseded by the editorial redesign plan (`docs/superpowers/plans/2026-06-11-editorial-redesign-phase-1.md`) that deletes `hero2.png` and swaps in `EditorialImage` | Medium     | Low    | Plan is unimplemented + partly stale (references Tailwind v3; repo is v4). Ship now as a one-line fix; the redesign's `EditorialImage aspect` prop achieves the same reservation and will cleanly replace this. The new unit test surfaces if the redesign drops dimensions. Flag this decision point to the owner before committing. |
| Wrong intrinsic values distort the hero (e.g., non-square)                                                                                                           | Very Low   | Medium | Values come directly from `sips` (1500×1500, confirmed). Aspect ratio is square; `className="w-full max-w-3xl mx-auto"` still governs rendered size, so even a stale value only affects the reserved aspect, not final layout once decoded. Re-run the `sips` command in step 1 if the asset is ever re-exported.                     |
| A future global `img { height: auto }` rule overrides the aspect reservation                                                                                         | Low        | Low    | Tailwind v4 preflight does not force this today; if reintroduced, behavior degrades gracefully to the current (pre-fix) state — no new breakage. The unit test still passes (attributes present in markup regardless of CSS).                                                                                                         |
| Visual regression on the hero at some breakpoint                                                                                                                     | Very Low   | Low    | `width`/`height` attributes only declare aspect ratio; CSS unchanged. Verify visually in `npm run preview` across mobile/desktop widths before merge.                                                                                                                                                                                 |
| CLS benefit is marginal (recommendation rates impact Low)                                                                                                            | High       | Low    | Accept — the change is one line + one test, zero risk, and the most-visited route benefits. Honorable-mention scope; do not over-invest.                                                                                                                                                                                              |

### Dependencies & Order of Operations

- **Sequential within this change:** Step 1 (confirm size — already done) → Step 2 (edit `Home.tsx`) → Step 3 (add test) → Step 4 (run gates). Steps 2 and 3 touch different files and could be written in parallel, but the test in step 3 asserts the exact values chosen in step 2, so author step 2 first.
- **No external/blocking dependencies:** no infra, no deploy script, no env var, no Lambda. The prerender carry-through is automatic (no `scripts/prerender.js` work).
- **One upstream decision gate:** resolve the supersession question (Prerequisites / Risk row 1) against the editorial-redesign plan **before** committing. This is the only blocking factor and is a human decision, not a code dependency.
- **Deploy:** standard frontend flow — merge to `main` triggers Amplify; no manual Lambda deploy (`deploy:lambda`) involved.

### Estimated Effort

- **Complexity:** Low
- **Time estimate:** 15-30 minutes (most of it running the build + Lighthouse before/after comparison; the code change is ~2 lines plus one ~6-line test)
- **Files affected:** 2 modified (`src/pages/Home.tsx`, `src/__tests__/integration/Home.integration.test.tsx`); 0 created; 0 deleted

---

## 7. Re-tighten coverage thresholds toward actual coverage (honoring the documented buffer)

### Objective

The vitest coverage thresholds in `vitest.config.ts` (lines 62 / statements 60 / branches 59 / functions 55) sit ~8–12 points below the live measured coverage (lines 71.28 / statements 69.74 / branches 67.22 / functions 65.23), which means an ~8–10 point coverage regression could land on `main` while CI stays green. This change ratchets the floors up to sit ~5 points below live — consistent with the project's _own_ documented buffer convention (`docs/ci.md`: "Current floor is ~5 points below baseline at the time this gate was introduced") rather than a brittle ~2-point buffer. When done, the gate again catches meaningful coverage regressions without flipping red on legitimate non-load-bearing refactors, and `docs/ci.md` records the re-tighten and the convention.

### Prerequisites

- Tools: Node 20 (`.nvmrc`), repo dependencies installed (`npm ci`). No new packages.
- Access: write access to the repo; ability to open a feature branch + PR (commits/PR only when the user explicitly asks).
- Docs to review (already read during planning):
  - `vitest.config.ts` — thresholds live at lines 24–29 inside `test.coverage.thresholds`.
  - `docs/ci.md` — the "Coverage" section, lines 17–21, documents the buffer convention and threshold location.
  - `.github/workflows/ci.yml` — line 33, "Run tests with coverage" runs `npx vitest run --coverage --reporter=verbose`; v8 thresholds fail the run on breach.
- Existing-code assumptions:
  - `package.json` exposes `test:coverage` = `vitest run --coverage` (confirmed, line 15) and `test` = `vitest run` (line 13).
  - The v8 provider enforces `thresholds` (a breach exits non-zero). No `thresholds.autoUpdate` / ratchet automation exists today (confirmed).
  - Coverage `include`/`exclude` (lines 16–23) already scopes out tests, `__tests__`, `main.tsx`, `vite-env.d.ts`, and `src/data/**`. The "All files" numbers in the task reflect that scope; we do not change scope here.
- DECISION POINT (resolve before executing — see Risk & Dependencies): this recommendation is REFINED to **Low impact / Low effort**. The buffer is _deliberate_ and the gap widened only because coverage organically rose, not because coverage dropped. So this is "re-tighten an intentionally-buffered floor that drifted," not "fix a broken gate." Proceed only if the team wants the floor to track live coverage at the documented ~5-point distance; otherwise HOLD is a legitimate outcome and no change ships.

### Step-by-Step Implementation

1. **Re-measure live coverage on a clean tree (do not trust stale numbers).**
   The exact threshold values are _derived_ from a fresh measurement, so always recompute rather than hardcoding the numbers from this plan.
   1.1. Create the working branch (avoid committing on `main`, which triggers Amplify):

   ```bash
   cd /Users/cperez/dev/altivum-dev/thechrisgrey
   git checkout -b chore/ratchet-coverage-thresholds
   ```

   1.2. Run the coverage suite and capture the "All files" summary row:

   ```bash
   npm run test:coverage
   ```

   1.3. Read the final `text` reporter table (the `% Stmts | % Branch | % Funcs | % Lines` columns on the `All files` row). Expected, per the verification pass, approximately: statements 69.74, branches 67.22, functions 65.23, lines 71.28. If the live numbers differ materially from these, use the _live_ numbers as the basis for step 2 — the methodology (round down, subtract ~5) is what matters, not the literal targets below.

2. **Compute the new floors: ~5 points below live, rounded down to a whole number.**
   2.1. Apply the convention `floor = floor(live) - 5` per metric, then sanity-floor at the nearest whole number that stays strictly below live:
   - lines: `71.28 → 71 − 5 = 66`
   - statements: `69.74 → 69 − 5 = 64` → round to **65** to match the historical lines:statements:branches:functions ordering and keep a clean spread (statements has tracked ~1–2 below lines). Use **65** if statements live ≥ 70; if live statements is 69.74 as measured, **64** is the strict ~5pt value. **Pick 64 if you want a true 5-point buffer; pick 65 only if step 1 shows live statements ≥ 70.** Default to **64** to honor the documented buffer literally.
   - branches: `67.22 → 67 − 5 = 62`
   - functions: `65.23 → 65 − 5 = 60`
     2.2. Final recommended target set (the conservative, docs-consistent ~5pt buffer):

   ```
   lines: 66
   statements: 64
   branches: 62
   functions: 60
   ```

   These each sit 5.23–5.28 points below the measured live values — within the project's documented ~5-point convention, and decisively _not_ the analyst's contradicting ~2-point set (70/68/66/64). If step 1 returns higher live numbers, bump each floor by the same delta so the ~5-point gap is preserved.
   2.3. Hard guard: every chosen floor MUST be `< live` for that metric (otherwise the very next CI run fails on the current tree). Verify each of the four before editing.

3. **Edit `vitest.config.ts` thresholds (lines 24–29).**
   3.1. Replace the four numeric values in the `thresholds` block. Current shape:

   ```ts
   thresholds: {
     lines: 62,
     statements: 60,
     branches: 59,
     functions: 55,
   },
   ```

   becomes:

   ```ts
   thresholds: {
     lines: 66,
     statements: 64,
     branches: 62,
     functions: 60,
   },
   ```

   3.2. Do not touch `provider`, `reporter`, `include`, or `exclude` — scope changes are out of band for this ratchet and would muddy the measurement basis.
   3.3. Edge case — the four values are still in their historical descending-ish relationship (lines ≥ statements ≥ branches ≥ functions), matching the original baseline ordering, so no reviewer surprise.

4. **Record the re-tighten + the convention in `docs/ci.md` (Coverage section, lines 17–21).**
   4.1. Update the bullet at line 20 so it states the _new_ floor and reaffirms the ~5-point convention (so the next person who sees the gap doesn't "fix" it to a 2-point buffer):
   - Current: `Thresholds live in vitest.config.ts under test.coverage.thresholds. Current floor is ~5 points below baseline at the time this gate was introduced.`
   - New: `Thresholds live in vitest.config.ts under test.coverage.thresholds. The floor is intentionally held ~5 points below live measured coverage — it is a regression catch, not a high-water mark. Re-tightened 2026-06 from 62/60/59/55 to 66/64/62/60 after coverage organically rose; re-ratchet to ~5 below live when the gap exceeds ~8 points. There is no autoUpdate automation; ratchet manually via npm run test:coverage.`
     4.2. Leave line 21 (the "add to exclude rather than lower thresholds" guidance) intact — it still applies and reinforces that lowering the whole-repo floor is the wrong lever.

5. **Decide on `thresholds.autoUpdate` — evaluate, default to NOT adopting.**
   5.1. v8/vitest supports `coverage.thresholds.autoUpdate: true`, which rewrites the config's threshold values upward on each run when coverage exceeds them. Evaluate but **do not adopt by default** in this Low-impact change, because:
   - It mutates the tracked `vitest.config.ts` on local dev runs, producing noisy, unintended diffs and merge conflicts.
   - It would silently collapse the deliberate ~5-point buffer down to ~0, contradicting `docs/ci.md`.
   - It does nothing in CI (CI runs are ephemeral; the rewrite is discarded), so it provides no regression-catching benefit there.
     5.2. If the team later wants automation, the correct pattern is a _manual, reviewed_ ratchet (this exact process) or a scheduled job that opens a PR — not `autoUpdate` on every dev run. Note this conclusion in the PR description; no code change for `autoUpdate`.

6. **Validate locally before any push (see Testing & Validation).**
   6.1. Re-run `npm run test:coverage` and confirm it exits 0 (green) with the new floors.
   6.2. Confirm the threshold-breach path still works by a throwaway local check (revert immediately) — see Testing & Validation step 3.

### File & Code Changes

| Action | File Path                                                     | Description of Change                                                                                                                                                                                                    |
| ------ | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Modify | `/Users/cperez/dev/altivum-dev/thechrisgrey/vitest.config.ts` | Raise `test.coverage.thresholds` (lines 24–29) from `lines:62 / statements:60 / branches:59 / functions:55` to `lines:66 / statements:64 / branches:62 / functions:60` (recompute to ~5pt below live if step 1 differs). |
| Modify | `/Users/cperez/dev/altivum-dev/thechrisgrey/docs/ci.md`       | Update the Coverage bullet (line 20) to state the new floor, reaffirm the deliberate ~5-point buffer convention, record the 2026-06 re-tighten, and note no `autoUpdate` automation.                                     |

Notes:

- No test files change: thresholds are config, not behavior; no unit test asserts the numbers, and adding one would be brittle (it would need updating on every legitimate ratchet). The validation is the CI run itself.
- No `iam-policy.json`, env var, Lambda, or `amplify.yml` change — this is frontend-test-config only and adds no external resource.
- `CLAUDE.md` does not currently document coverage thresholds, so no `CLAUDE.md` edit is required; `docs/ci.md` is the canonical home for CI gate documentation.

### Testing & Validation

- Unit tests to write: none. (Rationale above — a test asserting literal threshold numbers would be self-referential and brittle against future legitimate ratchets.)
- Primary validation — the new floors must pass on the current tree:
  ```bash
  cd /Users/cperez/dev/altivum-dev/thechrisgrey
  npm run test:coverage
  ```
  Expect exit code 0 and no `ERROR: Coverage for <metric> (XX%) does not meet global threshold (YY%)` lines. If any metric prints that error, a chosen floor exceeded live — lower that single floor by the overage + buffer and re-run.
- Confirm CI-equivalence — run exactly what CI runs (`.github/workflows/ci.yml` line 33):
  ```bash
  npx vitest run --coverage --reporter=verbose
  ```
  Verify it exits 0. This is the precise command the "Run tests with coverage" gate executes, so a green local run here predicts a green gate.
- Confirm the gate still bites (the floor actually catches a regression) — temporary, revert immediately:
  1. Temporarily bump one floor above live, e.g. set `lines: 95` in `vitest.config.ts`.
  2. Run `npm run test:coverage` → it MUST exit non-zero with a threshold error for `lines`. This proves the gate is live and enforcing.
  3. `git checkout vitest.config.ts` (or restore `lines: 66`) to undo the throwaway bump. Re-run `npm run test:coverage` → back to green.
- Rollback confirmation: this change is a 4-number config edit plus a docs paragraph. To roll back, revert the two files to the prior values (`lines:62 / statements:60 / branches:59 / functions:55`); `git revert <sha>` of the merge commit, or `git checkout main -- vitest.config.ts docs/ci.md`, fully restores prior behavior with zero side effects (no migrations, no infra, no deployed artifact).

### Risk & Mitigation

| Risk                                                                                                                                                                                      | Likelihood | Impact | Mitigation                                                                                                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A chosen floor is set at/above live coverage, turning the next CI run red on an unrelated PR.                                                                                             | Low        | Medium | Step 1 re-measures live first; step 2.3 hard-guards every floor `< live`; step 6.1 confirms green on the current tree before push.                                                                                      |
| Live coverage dips slightly between measurement and a future PR (e.g., a small file added uncovered), pushing a metric just under its new tighter floor and blocking an unrelated change. | Medium     | Low    | The deliberate ~5-point buffer (vs. the analyst's ~2-point) absorbs ~5 points of organic dip; `docs/ci.md` line 21 directs adding intentionally-uncovered files to `exclude` rather than lowering the whole-repo floor. |
| Someone later "corrects" the buffer to ~2 points (the analyst's brittle 70/68/66/64), re-introducing flakiness on non-load-bearing refactors.                                             | Medium     | Low    | Step 4 writes the convention explicitly into `docs/ci.md` ("intentionally held ~5 points below live… regression catch, not a high-water mark"), so the rationale is discoverable at the edit site.                      |
| Adopting `thresholds.autoUpdate` would silently erase the buffer and produce noisy config diffs on every dev run.                                                                         | Low        | Medium | Step 5 explicitly evaluates and rejects `autoUpdate`; no code enables it; rationale is recorded in the PR description and docs.                                                                                         |
| The whole change is unnecessary churn given Low impact (the gate is not broken, just buffered).                                                                                           | Medium     | Low    | This is framed as a DECISION POINT in Prerequisites + Dependencies; HOLD is an explicitly valid outcome. If held, no files change.                                                                                      |
| Coverage thresholds and the live numbers drift apart again over time with no automation.                                                                                                  | High       | Low    | `docs/ci.md` records the manual ratchet procedure and the "re-ratchet when the gap exceeds ~8 points" trigger, making the next ratchet a known, cheap operation.                                                        |

### Dependencies & Order of Operations

- Strictly sequential within the change: **Step 1 (measure) → Step 2 (compute) → Step 3 (edit config) → Step 4 (edit docs) → Step 5 (autoUpdate decision) → Step 6 (validate)**. Step 2 cannot be done before Step 1 (the floors are derived from the live measurement); Step 6 must follow Steps 3–4.
- Parallelizable: Step 4 (docs edit) and Step 3 (config edit) are independent of each other once Step 2's numbers are fixed — they can be written in either order or together. Step 5 is a decision with no code dependency and can be settled at any point.
- Blocking external factor / gating decision: the **DECISION POINT** (Prerequisites + Risk) must be resolved first — proceed vs. HOLD. There are no external service, IAM, or deploy dependencies; this never touches AWS, Lambda, or Amplify env config.
- No dependency on any other recommendation in this set: this change is fully self-contained and can ship independently of the broader plan.
- Suggested sequence end-to-end: resolve DECISION POINT → branch → measure → compute → edit both files → validate green → (if user asks) commit + PR with the convention/rationale in the body.

### Estimated Effort

- **Complexity:** Low
- **Time estimate:** 20–40 minutes (most of it is the `npm run test:coverage` runtime ×2 and the gate-bites verification; the edits are minutes).
- **Files affected:** 2 modified (`vitest.config.ts`, `docs/ci.md`), 0 created, 0 deleted.
