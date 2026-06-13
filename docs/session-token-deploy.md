# Session-token migration — deploy & cutover runbook

Replaces the browser-bundled HMAC signing keys (`VITE_CHAT_SIGNING_KEY` /
`VITE_BLUEPRINT_SIGNING_KEY` — which authenticated nothing, since any visitor
could read them from the bundle) with **server-issued, short-lived, scoped
session tokens** minted by a dedicated issuer Lambda after a Cloudflare Turnstile
check. Rollout is **dual-accept** (token OR legacy signature) so cached old
bundles keep working during the transition.

> The code is merged and green (1099 frontend tests, 416 lambda tests). NOTHING
> below has been run against AWS yet — green tests are not proof. Treat every step
> as unverified until you run the live checks in §7.

Account `205930636302`, region `us-east-1`. Function name = `thechrisgrey-<dir>`.

## 0. Secrets (never commit these)

- **`SESSION_TOKEN_KEY`** — the server-only token signing secret. Generate one:
  `openssl rand -hex 32`. The SAME value goes on three Lambdas (issuer + chat-stream + blueprint).
- **`TURNSTILE_SECRET`** — the Cloudflare Turnstile *secret* key (server-only).
- **Turnstile *site* key** (public, safe in the bundle): `0x4AAAAAADkGOL2LtE3mqBSL`.

## 1. Create the issuer Lambda role

```bash
cd lambda/session-token
aws iam create-role --role-name thechrisgrey-session-token-role \
  --assume-role-policy-document file://trust-policy.json
aws iam put-role-policy --role-name thechrisgrey-session-token-role \
  --policy-name session-token-policy --policy-document file://iam-policy.json
```

## 2. Create the issuer function + Function URL

```bash
# Build the bundle WITHOUT uploading (verifies the module graph), then create.
npm run deploy:lambda -- session-token --dry-run    # builds lambda/session-token/function.zip

aws lambda create-function --function-name thechrisgrey-session-token \
  --runtime nodejs20.x --handler index.handler \
  --role arn:aws:iam::205930636302:role/thechrisgrey-session-token-role \
  --zip-file fileb://lambda/session-token/function.zip --region us-east-1 \
  --timeout 10 --memory-size 256 \
  --environment "Variables={SESSION_TOKEN_KEY=<PASTE_KEY>,TURNSTILE_SECRET=<PASTE_TURNSTILE_SECRET>,CORS_ORIGIN=https://thechrisgrey.com}"

aws lambda create-function-url-config --function-name thechrisgrey-session-token \
  --auth-type NONE --region us-east-1 \
  --cors '{"AllowOrigins":["https://thechrisgrey.com"],"AllowMethods":["POST"],"AllowHeaders":["content-type"]}'
aws lambda add-permission --function-name thechrisgrey-session-token \
  --statement-id FunctionURLAllowPublicAccess --action lambda:InvokeFunctionUrl \
  --principal "*" --function-url-auth-type NONE --region us-east-1
```

Record the returned **FunctionUrl** — call it `SESSION_URL`.

## 3. Give chat-stream + blueprint the token key, then redeploy them

The new `lambda-shared/sessionToken` + `requestAuth` modules ship automatically
(the deploy script dereferences `lambda-shared` fresh). They just need the key:

```bash
for fn in thechrisgrey-chat-stream thechrisgrey-blueprint; do
  aws lambda update-function-configuration --function-name "$fn" --region us-east-1 \
    --environment "Variables={...existing...,SESSION_TOKEN_KEY=<PASTE_KEY>}"   # MERGE, don't drop existing vars
done
npm run deploy:lambda -- chat-stream
npm run deploy:lambda -- blueprint
```

> ⚠️ `update-function-configuration` REPLACES the whole environment map. Fetch the
> current vars first (`aws lambda get-function-configuration --function-name <fn>`)
> and merge `SESSION_TOKEN_KEY` in — do not clobber `CHAT_SIGNING_KEY`, `KB_ID`, etc.

## 4. Point the frontend at the issuer + Turnstile (Amplify env, us-east-2)

```bash
aws amplify update-branch --app-id d3du8eg39a9peo --branch-name main --region us-east-2 \
  --environment-variables "VITE_SESSION_ENDPOINT=<SESSION_URL>,VITE_TURNSTILE_SITE_KEY=0x4AAAAAADkGOL2LtE3mqBSL"
```

## 5. CSP — replace the placeholder (REQUIRED, or the browser blocks the issuer)

`amplify.yml` `connect-src` currently contains the literal placeholder
`https://YOUR-SESSION-FUNCTION-URL.lambda-url.us-east-1.on.aws`. Replace it with
the host of `SESSION_URL`. Turnstile origins (`challenges.cloudflare.com`) are
already in `script-src`/`frame-src`/`connect-src`. Commit + push → Amplify builds.

## 6. Deploy order

Lambdas (steps 1–3) **before** the frontend (steps 4–5). Until the frontend
ships, old bundles authenticate via the retained legacy HMAC path (dual-accept).

## 7. Verify the real thing (do NOT skip)

```bash
# Liveness + auth-enforcement + (with the key) real token verification:
SMOKE_SESSION_ENDPOINT="<SESSION_URL>" \
SMOKE_CHAT_ENDPOINT="<chat Function URL>" \
SMOKE_SESSION_TOKEN_KEY="<PASTE_KEY>" \
SMOKE_LEGACY_CHAT_KEY="<current CHAT_SIGNING_KEY>" \
npm run smoke:lambda
```
Then in a real browser on https://thechrisgrey.com: open the chat widget, send a
message (Turnstile runs invisibly, a token is minted, the reply streams), and run
a blueprint generation. Watch CloudWatch: `AuthSessionToken` should rise and
`AuthLegacySignature` should fall as bundles refresh.

Opt-in guardrail false-positive contract test (real Bedrock):
```bash
BEDROCK_CONTRACT_TESTS=1 AWS_REGION=us-east-1 \
  node --test lambda/blueprint/__tests__/guardrail-contract.test.mjs
```

## 8. Step-5 cutover (after ~1 week, once `AuthLegacySignature` ≈ 0)

Only after metrics confirm the legacy path has drained:

1. Remove the legacy fallback branch in `lambda/shared/requestAuth.mjs` callers
   (require a valid token); drop `legacyKey`/`legacySigOptions`.
2. Delete `src/utils/chatSigning.ts`, `src/utils/blueprintSigning.ts` + their tests.
3. Remove `VITE_CHAT_SIGNING_KEY` / `VITE_BLUEPRINT_SIGNING_KEY` from Amplify env
   and from `scripts/validate-env.js`'s `required` list; add `VITE_SESSION_ENDPOINT`
   + `VITE_TURNSTILE_SITE_KEY` there instead.
4. Retire `CHAT_SIGNING_KEY` / `BLUEPRINT_SIGNING_KEY` Lambda env (confirm no other
   caller — e.g. mcp-server — depends on the body-HMAC path first).
