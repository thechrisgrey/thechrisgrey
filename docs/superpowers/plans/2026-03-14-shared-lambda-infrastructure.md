# Shared Lambda Infrastructure Module - Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract duplicated rate-limiting, token validation, and response helpers from three Lambda functions into a shared module so security-critical code has a single source of truth.

**Architecture:** Create `lambda/shared/` as a local npm package imported via `file:../shared` dependency. Each Lambda receives AWS SDK clients as parameters (dependency injection) so the shared module is stateless and testable. All three consuming Lambdas (chat-stream, metrics, kb-builder) are updated to import from the shared package instead of maintaining their own copies.

**Tech Stack:** Node.js ESM (`"type": "module"`), AWS SDK v3 (DynamoDB, Cognito), no new dependencies.

---

## Chunk 1: Shared Module

### File Structure

| Action | File Path                     | Responsibility                                                             |
| ------ | ----------------------------- | -------------------------------------------------------------------------- |
| Create | `lambda/shared/package.json`  | Package metadata for local npm package                                     |
| Create | `lambda/shared/rateLimit.mjs` | Atomic DynamoDB rate limiting with configurable prefix, window, and limits |
| Create | `lambda/shared/auth.mjs`      | Cognito token validation via GetUserCommand                                |
| Create | `lambda/shared/response.mjs`  | JSON response builder with optional CORS headers                           |
| Create | `lambda/shared/index.mjs`     | Re-exports all shared utilities                                            |

---

### Task 1: Create the shared package scaffold

**Files:**

- Create: `lambda/shared/package.json`
- Create: `lambda/shared/index.mjs`

- [ ] **Step 1: Create `lambda/shared/package.json`**

```json
{
  "name": "lambda-shared",
  "version": "1.0.0",
  "type": "module",
  "description": "Shared utilities for thechrisgrey Lambda functions",
  "main": "index.mjs",
  "exports": {
    ".": "./index.mjs",
    "./rateLimit": "./rateLimit.mjs",
    "./auth": "./auth.mjs",
    "./response": "./response.mjs"
  }
}
```

No dependencies -- this module receives AWS SDK clients from callers via dependency injection.

- [ ] **Step 2: Create `lambda/shared/index.mjs` barrel export**

```js
export { checkRateLimit } from './rateLimit.mjs';
export { validateCognitoToken } from './auth.mjs';
export { respond } from './response.mjs';
```

- [ ] **Step 3: Commit**

```bash
git add lambda/shared/package.json lambda/shared/index.mjs
git commit -m "feat: scaffold shared Lambda utilities package"
```

---

### Task 2: Implement `respond()` helper

**Files:**

- Create: `lambda/shared/response.mjs`

This is the simplest utility -- start here.

- [ ] **Step 1: Write `lambda/shared/response.mjs`**

The function merges a base `Content-Type` header with optional CORS headers. `corsOrigin` is `null` by default (metrics Lambda doesn't use CORS), and set to `"https://thechrisgrey.com"` by kb-builder.

```js
/**
 * Build a JSON HTTP response with optional CORS headers.
 *
 * @param {number} statusCode
 * @param {object} body
 * @param {string|null} [corsOrigin=null] - If set, adds Access-Control-Allow-* headers.
 * @returns {{ statusCode: number, headers: object, body: string }}
 */
export function respond(statusCode, body, corsOrigin = null) {
  const headers = { 'Content-Type': 'application/json' };

  if (corsOrigin) {
    headers['Access-Control-Allow-Origin'] = corsOrigin;
    headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
    headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
  }

  return { statusCode, headers, body: JSON.stringify(body) };
}
```

- [ ] **Step 2: Commit**

```bash
git add lambda/shared/response.mjs
git commit -m "feat: add respond() helper to shared Lambda utilities"
```

---

### Task 3: Implement `validateCognitoToken()`

**Files:**

- Create: `lambda/shared/auth.mjs`

Currently duplicated in metrics (returns `true`) and kb-builder (returns response object). Unify to always return the GetUser response (truthy) or `null`. Callers that only need a boolean check can use `if (!user)`.

- [ ] **Step 1: Write `lambda/shared/auth.mjs`**

```js
/**
 * Validate a Cognito access token via the GetUser API.
 *
 * @param {import("@aws-sdk/client-cognito-identity-provider").CognitoIdentityProviderClient} cognitoClient
 * @param {import("@aws-sdk/client-cognito-identity-provider").GetUserCommand} GetUserCommand
 * @param {string|undefined} authHeader - The `Authorization` header value (e.g. "Bearer xxx").
 * @returns {Promise<object|null>} The GetUser response, or null if invalid/missing.
 */
export async function validateCognitoToken(cognitoClient, GetUserCommand, authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

  try {
    const command = new GetUserCommand({ AccessToken: authHeader.slice(7) });
    const response = await cognitoClient.send(command);
    return response;
  } catch (error) {
    console.error('Token validation failed:', error.name);
    return null;
  }
}
```

Design decisions:

- `GetUserCommand` is passed as a parameter so the shared module has zero SDK imports of its own. This avoids any version mismatch issues between Lambda-specific SDK versions.
- Returns the full response (kb-builder needs it). Metrics can just truthiness-check it.

- [ ] **Step 2: Commit**

```bash
git add lambda/shared/auth.mjs
git commit -m "feat: add validateCognitoToken() to shared Lambda utilities"
```

---

### Task 4: Implement `checkRateLimit()`

**Files:**

- Create: `lambda/shared/rateLimit.mjs`

This is the core function. It must handle all three Lambda variants:

| Lambda      | PK prefix                              | Max requests | Window (sec) | TTL buffer (sec) | Returns                  |
| ----------- | -------------------------------------- | ------------ | ------------ | ---------------- | ------------------------ |
| chat-stream | `""` (bare hash)                       | 20           | 3600 (1h)    | 3600             | `{ allowed, remaining }` |
| metrics     | `"metrics-vitals-"` / `"metrics-csp-"` | 200 / 100    | 60 (1min)    | 300              | boolean                  |
| kb-builder  | `"kb-builder-"`                        | 30           | 60 (1min)    | 300              | boolean                  |

The unified function always returns `{ allowed: boolean, remaining: number }`. Callers that only need a boolean destructure `{ allowed }`.

- [ ] **Step 1: Write `lambda/shared/rateLimit.mjs`**

```js
import { createHash } from 'crypto';

/**
 * Atomic DynamoDB-based rate limiter with sliding windows.
 *
 * Uses ADD + ConditionExpression for race-condition-free counting.
 * Fails open on DynamoDB errors (availability > strictness).
 *
 * @param {import("@aws-sdk/lib-dynamodb").DynamoDBDocumentClient} docClient
 * @param {typeof import("@aws-sdk/lib-dynamodb").UpdateCommand} UpdateCommand
 * @param {object} opts
 * @param {string} opts.table        - DynamoDB table name
 * @param {string} opts.ip           - Client IP address
 * @param {string} [opts.prefix=""]  - PK prefix (e.g. "metrics-vitals-", "kb-builder-")
 * @param {number} opts.maxRequests  - Max requests allowed per window
 * @param {number} opts.windowSeconds - Window length in seconds
 * @param {number} [opts.ttlBuffer=300] - Extra seconds before TTL deletes the row
 * @param {string|null} [opts.requestId=null] - If set, errors are logged as structured JSON with this ID
 * @returns {Promise<{ allowed: boolean, remaining: number }>}
 */
export async function checkRateLimit(
  docClient,
  UpdateCommand,
  { table, ip, prefix = '', maxRequests, windowSeconds, ttlBuffer = 300, requestId = null },
) {
  const ipHash = createHash('sha256')
    .update(ip || 'unknown')
    .digest('hex');
  const pk = prefix ? `${prefix}${ipHash}` : ipHash;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - (now % windowSeconds);

  try {
    const result = await docClient.send(
      new UpdateCommand({
        TableName: table,
        Key: { pk },
        UpdateExpression: 'ADD requestCount :inc SET #ttl = :ttl, windowStart = if_not_exists(windowStart, :ws)',
        ConditionExpression: 'attribute_not_exists(pk) OR windowStart = :ws',
        ExpressionAttributeNames: { '#ttl': 'ttl' },
        ExpressionAttributeValues: {
          ':inc': 1,
          ':ws': windowStart,
          ':ttl': windowStart + windowSeconds + ttlBuffer,
        },
        ReturnValues: 'ALL_NEW',
      }),
    );

    const count = result.Attributes?.requestCount ?? 1;
    if (count > maxRequests) {
      return { allowed: false, remaining: 0 };
    }
    return { allowed: true, remaining: maxRequests - count };
  } catch (error) {
    // ConditionalCheckFailedException = stale window, safe to reset
    if (error.name === 'ConditionalCheckFailedException') {
      try {
        await docClient.send(
          new UpdateCommand({
            TableName: table,
            Key: { pk },
            UpdateExpression: 'SET requestCount = :one, windowStart = :ws, #ttl = :ttl',
            ExpressionAttributeNames: { '#ttl': 'ttl' },
            ExpressionAttributeValues: {
              ':one': 1,
              ':ws': windowStart,
              ':ttl': windowStart + windowSeconds + ttlBuffer,
            },
          }),
        );
        return { allowed: true, remaining: maxRequests - 1 };
      } catch {
        return { allowed: true, remaining: -1 };
      }
    }
    if (requestId) {
      console.error(JSON.stringify({ requestId, event: 'rate_limit_error', error: error.name }));
    } else {
      console.error('Rate limit error:', error.name);
    }
    return { allowed: true, remaining: -1 };
  }
}
```

Design decisions:

- `docClient` and `UpdateCommand` are injected so the shared module has no AWS SDK dependencies.
- `prefix` defaults to `""` for chat-stream backward compatibility (bare IP hash as PK).
- `ttlBuffer` defaults to 300 (5 min) matching metrics/kb-builder; chat-stream passes 3600.
- `requestId` is optional. When provided (chat-stream), DynamoDB errors are logged as structured JSON with the request ID for correlation. When omitted (metrics, kb-builder), errors use plain `console.error`.
- Always returns `{ allowed, remaining }` -- metrics/kb-builder just check `allowed`.

- [ ] **Step 2: Commit**

```bash
git add lambda/shared/rateLimit.mjs
git commit -m "feat: add checkRateLimit() to shared Lambda utilities"
```

---

## Chunk 2: Migrate Lambdas to use shared module

### Task 5: Add shared dependency to all three Lambdas

**Files:**

- Modify: `lambda/chat-stream/package.json`
- Modify: `lambda/metrics/package.json`
- Modify: `lambda/kb-builder/package.json`

- [ ] **Step 1: Add `"lambda-shared": "file:../shared"` to each `package.json`**

In `lambda/chat-stream/package.json`, add to `dependencies`:

```json
"lambda-shared": "file:../shared"
```

In `lambda/metrics/package.json`, add to `dependencies`:

```json
"lambda-shared": "file:../shared"
```

In `lambda/kb-builder/package.json`, add to `dependencies`:

```json
"lambda-shared": "file:../shared"
```

- [ ] **Step 2: Install in each Lambda directory**

Run: `cd lambda/chat-stream && npm install && cd ../metrics && npm install && cd ../kb-builder && npm install`

Verify: Each `node_modules/lambda-shared/` directory should contain the shared module files.

- [ ] **Step 3: Commit**

```bash
git add lambda/chat-stream/package.json lambda/chat-stream/package-lock.json
git add lambda/metrics/package.json lambda/metrics/package-lock.json
git add lambda/kb-builder/package.json lambda/kb-builder/package-lock.json
git commit -m "chore: add lambda-shared dependency to all Lambda functions"
```

---

### Task 6: Migrate kb-builder to shared module

**Files:**

- Modify: `lambda/kb-builder/index.mjs`

Start with kb-builder because it uses all three shared utilities (rate limiting, auth, respond) and is the simplest Lambda to validate.

- [ ] **Step 1: Add imports from shared module**

At the top of `lambda/kb-builder/index.mjs`, add:

```js
import { checkRateLimit } from 'lambda-shared/rateLimit';
import { validateCognitoToken } from 'lambda-shared/auth';
import { respond } from 'lambda-shared/response';
```

- [ ] **Step 2: Remove the local `checkRateLimit` function**

Delete lines 21-67 (the entire local `checkRateLimit` function).

- [ ] **Step 3: Remove the local `validateToken` function**

Delete lines 133-148 (the entire local `validateToken` function).

- [ ] **Step 4: Remove the local `respond` function**

Delete lines 217-228 (the entire local `respond` function).

- [ ] **Step 5: Remove now-unnecessary imports and constants**

Remove these lines that are no longer needed (the shared module handles them internally):

```js
// REMOVE these - shared module handles internally:
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { createHash } from 'crypto';

const dynamoClient = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const RATE_LIMIT_TABLE = 'thechrisgrey-chat-ratelimit';
const RATE_LIMIT_WINDOW = 60;
const MAX_REQUESTS_PER_WINDOW = 30;
```

Wait -- the shared module uses dependency injection, so the caller still creates the clients. Keep the DynamoDB client creation and imports. Only remove:

- The local `checkRateLimit` function body (already done in Step 2)
- The local `validateToken` function body (already done in Step 3)
- The local `respond` function body (already done in Step 4)
- `import { createHash } from "crypto"` (only used by rate limiting in kb-builder)
- Constants: `RATE_LIMIT_TABLE`, `RATE_LIMIT_WINDOW`, `MAX_REQUESTS_PER_WINDOW`

- [ ] **Step 6: Update the `checkRateLimit` call in the handler**

Before (line 242):

```js
if (!(await checkRateLimit(clientIp))) {
```

After:

```js
const { allowed } = await checkRateLimit(docClient, UpdateCommand, {
  table: "thechrisgrey-chat-ratelimit",
  ip: clientIp,
  prefix: "kb-builder-",
  maxRequests: 30,
  windowSeconds: 60,
  ttlBuffer: 300,
});
if (!allowed) {
```

- [ ] **Step 7: Update the `validateToken` call in the handler**

Before (line 236):

```js
const user = await validateToken(authHeader);
```

After:

```js
const user = await validateCognitoToken(cognitoClient, GetUserCommand, authHeader);
```

- [ ] **Step 8: Update ALL `respond()` calls to pass CORS origin**

First, define a constant at the top of the file (after imports):

```js
const CORS_ORIGIN = 'https://thechrisgrey.com';
```

Then search for every `respond(` call in the file and add `CORS_ORIGIN` as the third argument. There are **21 total** `respond()` calls across status codes 200, 201, 400, 401, 403, 404, 429, and 500. Every single one must receive `CORS_ORIGIN`:

```js
respond(200, { ok: true }, CORS_ORIGIN)       // OPTIONS handler
respond(401, { ... }, CORS_ORIGIN)             // Auth failure
respond(429, { ... }, CORS_ORIGIN)             // Rate limit
respond(200, { entries }, CORS_ORIGIN)         // GET /entries
respond(400, { error: "..." }, CORS_ORIGIN)    // Validation errors (multiple)
respond(201, { entry: result }, CORS_ORIGIN)   // POST /entries
respond(200, { entry: result }, CORS_ORIGIN)   // PUT /entries/:id
respond(403, { error: "..." }, CORS_ORIGIN)    // Non-kbEntry delete attempt
respond(404, { error: "..." }, CORS_ORIGIN)    // Not found (multiple)
respond(200, { deleted: true }, CORS_ORIGIN)   // DELETE success
respond(200, { message: "..." }, CORS_ORIGIN)  // POST /publish
respond(500, { error: "..." }, CORS_ORIGIN)    // Internal errors
```

**Verify completeness:** After editing, run `grep -c "respond(" lambda/kb-builder/index.mjs` and confirm the count matches the number of calls that include `CORS_ORIGIN`. Missing even one will cause browser CORS errors on that endpoint.

- [ ] **Step 9: Verify kb-builder works by reviewing the final import block**

The import section should now look like:

```js
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { CognitoIdentityProviderClient, GetUserCommand } from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { createClient } from '@sanity/client';
import { checkRateLimit } from 'lambda-shared/rateLimit';
import { validateCognitoToken } from 'lambda-shared/auth';
import { respond } from 'lambda-shared/response';
```

- [ ] **Step 10: Commit**

```bash
git add lambda/kb-builder/index.mjs
git commit -m "refactor: migrate kb-builder to shared Lambda utilities"
```

---

### Task 7: Migrate metrics Lambda to shared module

**Files:**

- Modify: `lambda/metrics/index.mjs`

- [ ] **Step 1: Add imports from shared module**

At the top of `lambda/metrics/index.mjs`, add:

```js
import { checkRateLimit } from 'lambda-shared/rateLimit';
import { validateCognitoToken } from 'lambda-shared/auth';
import { respond } from 'lambda-shared/response';
```

- [ ] **Step 2: Remove the local `checkRateLimit` function**

Delete lines 38-85 (the entire local `checkRateLimit` function).

- [ ] **Step 3: Remove the local `respond` function**

Delete lines 87-95 (the entire local `respond` function).

- [ ] **Step 4: Remove the local `validateToken` function**

Delete lines 204-214 (the entire local `validateToken` function).

- [ ] **Step 5: Remove now-unnecessary constants**

Remove these rate-limit constants and the `RATE_LIMITS` map:

```js
const RATE_LIMIT_TABLE = 'thechrisgrey-chat-ratelimit';
const RATE_LIMIT_WINDOW = 60;
const MAX_VITALS_PER_WINDOW = 200;
const MAX_CSP_PER_WINDOW = 100;

const RATE_LIMITS = {
  vitals: MAX_VITALS_PER_WINDOW,
  csp: MAX_CSP_PER_WINDOW,
};
```

**IMPORTANT:** Do NOT remove `import { createHash } from "crypto"` -- it is still used by the `hashBucket()` function (line 142) in the CSP report handler. Only rate-limit code was extracted; CSP bucketing remains local.

Keep the DynamoDB client creation and `UpdateCommand` import (needed for DI).

- [ ] **Step 6: Update rate limit calls in the handler**

Before (vitals):

```js
if (!(await checkRateLimit("vitals", clientIp))) {
```

After:

```js
const { allowed: vitalsAllowed } = await checkRateLimit(docClient, UpdateCommand, {
  table: "thechrisgrey-chat-ratelimit",
  ip: clientIp,
  prefix: "metrics-vitals-",
  maxRequests: 200,
  windowSeconds: 60,
});
if (!vitalsAllowed) {
```

Before (CSP):

```js
if (!(await checkRateLimit("csp", clientIp))) {
```

After:

```js
const { allowed: cspAllowed } = await checkRateLimit(docClient, UpdateCommand, {
  table: "thechrisgrey-chat-ratelimit",
  ip: clientIp,
  prefix: "metrics-csp-",
  maxRequests: 100,
  windowSeconds: 60,
});
if (!cspAllowed) {
```

- [ ] **Step 7: Update the `validateToken` call inside `handleHealth()`**

Inside the `handleHealth` function body (line 223), change:

```js
const user = await validateToken(authHeader);
```

To:

```js
const user = await validateCognitoToken(cognitoClient, GetUserCommand, authHeader);
```

Note: The return value changes from `true` to the full GetUser response object. This is safe because `handleHealth` only uses truthiness checking (`if (!user)`).

- [ ] **Step 8: `respond()` calls stay unchanged**

Metrics Lambda doesn't use CORS headers. Since `respond(statusCode, body)` defaults `corsOrigin` to `null`, all existing calls work without modification.

- [ ] **Step 9: Commit**

```bash
git add lambda/metrics/index.mjs
git commit -m "refactor: migrate metrics Lambda to shared Lambda utilities"
```

---

### Task 8: Migrate chat-stream Lambda to shared module

**Files:**

- Modify: `lambda/chat-stream/index.mjs`

Chat-stream is the most complex Lambda. It only uses rate limiting from the shared module (it has its own HMAC signing, streaming response, and MetricsCollector that are unique).

- [ ] **Step 1: Add import from shared module**

At the top of `lambda/chat-stream/index.mjs`, add:

```js
import { checkRateLimit } from 'lambda-shared/rateLimit';
```

- [ ] **Step 2: Remove the local `checkRateLimit` function**

Delete lines 150-198 (the entire local `checkRateLimit` function).

- [ ] **Step 3: Remove rate limit constants and update crypto import**

Remove these constants:

```js
const RATE_LIMIT_TABLE = 'thechrisgrey-chat-ratelimit';
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW = 3600;
```

Update the crypto import to remove `createHash` (no longer used after rate limit extraction):

Before:

```js
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'crypto';
```

After:

```js
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
```

Keep DynamoDB client creation and `UpdateCommand` import.

- [ ] **Step 4: Update the `checkRateLimit` call in the handler**

Before (line 411 area):

```js
const rateLimit = await checkRateLimit(clientIp, requestId);
```

After:

```js
const rateLimit = await checkRateLimit(docClient, UpdateCommand, {
  table: 'thechrisgrey-chat-ratelimit',
  ip: clientIp,
  maxRequests: 20,
  windowSeconds: 3600,
  ttlBuffer: 3600,
  requestId,
});
```

The `requestId` parameter preserves chat-stream's structured JSON error logging for rate-limit failures (other Lambdas omit it and get plain `console.error`).

The rest of the handler code that checks `rateLimit.allowed` and `rateLimit.remaining` stays unchanged because the shared function returns the same `{ allowed, remaining }` shape.

- [ ] **Step 5: Commit**

```bash
git add lambda/chat-stream/index.mjs
git commit -m "refactor: migrate chat-stream to shared rate limiting"
```

---

## Chunk 3: Testing & Deployment

### Task 9: Manual verification

**Files:** None (verification only)

- [ ] **Step 1: Verify each Lambda's imports resolve**

Run in each Lambda directory to confirm the shared module resolves:

```bash
cd lambda/chat-stream && node -e "import('lambda-shared/rateLimit').then(m => console.log('chat-stream OK:', Object.keys(m)))"
cd ../metrics && node -e "import('lambda-shared/rateLimit').then(m => console.log('metrics OK:', Object.keys(m)))"
cd ../kb-builder && node -e "import('lambda-shared/rateLimit').then(m => console.log('kb-builder OK:', Object.keys(m)))"
```

Expected output for each: `OK: [ 'checkRateLimit' ]`

- [ ] **Step 2: Verify the shared module has no AWS SDK dependencies**

```bash
cat lambda/shared/package.json | grep -c "aws-sdk"
```

Expected: `0`

- [ ] **Step 3: Verify zip packaging works**

Test that the deployment zip includes the shared module:

```bash
cd lambda/kb-builder
zip -r /tmp/test-function.zip index.mjs package.json node_modules
unzip -l /tmp/test-function.zip | grep lambda-shared
rm /tmp/test-function.zip
```

Expected: Files from `node_modules/lambda-shared/` should appear in the listing.

- [ ] **Step 4: Verify all kb-builder respond() calls include CORS origin**

```bash
grep -c "CORS_ORIGIN" lambda/kb-builder/index.mjs
```

Expected: count should match total `respond(` calls in the file. If any `respond()` call is missing `CORS_ORIGIN`, that endpoint will return responses without CORS headers, causing silent browser-side failures.

- [ ] **Step 5: Verify no behavior change by comparing function signatures**

Manually confirm these equivalences:

| Original call                                        | Migrated call                                                                                                             | Same behavior?                                   |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `checkRateLimit(clientIp)` in kb-builder             | `checkRateLimit(docClient, UpdateCommand, { table, ip, prefix: "kb-builder-", maxRequests: 30, windowSeconds: 60 })`      | Yes - same PK, same limits, same TTL             |
| `checkRateLimit("vitals", clientIp)` in metrics      | `checkRateLimit(docClient, UpdateCommand, { table, ip, prefix: "metrics-vitals-", maxRequests: 200, windowSeconds: 60 })` | Yes - same PK, same limits                       |
| `checkRateLimit(clientIp, requestId)` in chat-stream | `checkRateLimit(docClient, UpdateCommand, { table, ip, maxRequests: 20, windowSeconds: 3600, ttlBuffer: 3600 })`          | Yes - same PK (bare hash), same limits, same TTL |

---

### Task 10: Update CLAUDE.md documentation

**Files:**

- Modify: `CLAUDE.md`

- [ ] **Step 1: Add shared module section to CLAUDE.md**

Add after the "Deployment" section of each Lambda's documentation (or as a new section):

```markdown
### Shared Lambda Utilities (`lambda/shared/`)

Common infrastructure used by chat-stream, metrics, and kb-builder Lambdas:

- `checkRateLimit(docClient, UpdateCommand, opts)`: Atomic DynamoDB rate limiting
- `validateCognitoToken(cognitoClient, GetUserCommand, authHeader)`: Cognito token validation
- `respond(statusCode, body, corsOrigin?)`: JSON response builder with optional CORS

**Usage:** Each Lambda lists `"lambda-shared": "file:../shared"` in its package.json. The shared code is copied into `node_modules/` on `npm install` and included in deployment zips automatically.

**Design:** AWS SDK clients are injected as parameters (not imported by the shared module) to avoid version conflicts and keep the module dependency-free.
```

- [ ] **Step 2: Update deployment instructions**

Add a note to each Lambda's deployment section that `npm install` must be run before zipping to ensure the shared module is included:

````markdown
**Deployment:**

```bash
cd lambda/kb-builder
npm install        # Required: copies shared module into node_modules
zip -r function.zip index.mjs package.json node_modules
aws lambda update-function-code --function-name thechrisgrey-kb-builder --zip-file fileb://function.zip --region us-east-1
```
````

````

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document shared Lambda utilities module"
````

---

### Task 11: Deploy updated Lambdas

**Files:** None (deployment commands only)

- [ ] **Step 1: Deploy kb-builder**

```bash
cd lambda/kb-builder
npm install
zip -r function.zip index.mjs package.json node_modules
aws lambda update-function-code --function-name thechrisgrey-kb-builder --zip-file fileb://function.zip --region us-east-1
rm function.zip
```

- [ ] **Step 2: Verify kb-builder works**

Test via the admin page on https://thechrisgrey.com/admin:

1. Log in with Cognito credentials
2. Load entries (GET /entries should succeed)
3. Create a test entry, then delete it

- [ ] **Step 3: Deploy metrics**

```bash
cd lambda/metrics
npm install
zip -r function.zip index.mjs package.json node_modules
aws lambda update-function-code --function-name thechrisgrey-metrics --zip-file fileb://function.zip --region us-east-1
rm function.zip
```

- [ ] **Step 4: Verify metrics works**

Check Web Vitals are still being received:

1. Visit https://thechrisgrey.com in a browser
2. Check CloudWatch for recent `LCP`, `CLS`, etc. metrics in `TheChrisGrey/SiteMetrics` namespace

- [ ] **Step 5: Deploy chat-stream**

```bash
cd lambda/chat-stream
npm install
zip -r function.zip index.mjs package.json node_modules
aws lambda update-function-code --function-name thechrisgrey-chat-stream --zip-file fileb://function.zip --region us-east-1
rm function.zip
```

- [ ] **Step 6: Verify chat-stream works**

Test via the chat widget on https://thechrisgrey.com:

1. Open the chat widget
2. Send a message (e.g., "Who is Christian?")
3. Verify streaming response arrives
4. Check CloudWatch logs for the chat-stream function -- confirm no errors

---

## Risk & Mitigation

| Risk                                           | Likelihood | Impact | Mitigation                                                                                       |
| ---------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------------------ |
| Import path resolution fails in Lambda runtime | Low        | High   | Test with `node -e "import(...)"` before deploying. Lambda Node.js 20 supports ESM `file:` deps. |
| Shared module not included in deployment zip   | Low        | High   | Verify with `unzip -l` that `node_modules/lambda-shared/` is present.                            |
| Rate limit behavior changes subtly             | Low        | Medium | PK format, window math, and TTL calculations are identical. Manual diff verification in Task 9.  |
| kb-builder CORS breaks                         | Low        | Medium | `respond()` with `corsOrigin` parameter produces identical headers. Test from admin page.        |
| Rolling deployment causes mixed versions       | Low        | Low    | Deploy in order: kb-builder first (admin-only, low traffic), then metrics, then chat-stream.     |

## Dependencies & Order of Operations

- Tasks 1-4 are independent and can be done in sequence (they build the shared module)
- Task 5 must complete before Tasks 6-8 (installs the dependency)
- Tasks 6, 7, 8 are independent and can be done in parallel or any order
- Task 9 must follow Tasks 6-8 (verification)
- Task 10 can be done anytime after Task 4
- Task 11 must be last (deployment)

Suggested sequence: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10 -> 11

## Estimated Effort

- **Complexity:** Low -- pure refactoring, no behavior change
- **Time estimate:** 2-3 hours
- **Files affected:** 4 created, 4 modified (3 Lambda index files + CLAUDE.md)
