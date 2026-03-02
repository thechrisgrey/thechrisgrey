# KB Admin Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Cognito-protected admin page that manages Knowledge Base entries in Sanity CMS and publishes a rebuilt document to S3 for Bedrock ingestion.

**Architecture:** Frontend `/admin` route (React, lazy-loaded) authenticates via Cognito, communicates with a new `thechrisgrey-kb-builder` Lambda that handles CRUD on Sanity `kbEntry` documents and assembles/uploads a structured text file to S3. The existing kb-sync Lambda automatically triggers Bedrock re-ingestion on S3 changes.

**Tech Stack:** React 18 + TypeScript + Tailwind, AWS Cognito (User Pool), AWS Lambda (Node.js ESM), Sanity CMS (existing project k5950b3w), AWS S3 (existing bucket thechrisgrey-kb-source)

---

## Task 1: Deploy Sanity `kbEntry` Schema

This task creates the new document type in Sanity. Since there's no local Sanity Studio in this project, we use the MCP `deploy_schema` tool.

**Files:**
- None (Sanity cloud schema deployment)

**Step 1: Deploy the kbEntry schema to Sanity**

Use the Sanity MCP tool `deploy_schema` with project ID `k5950b3w`, dataset `production`, to create the `kbEntry` document type:

```json
{
  "name": "kbEntry",
  "type": "document",
  "title": "Knowledge Base Entry",
  "fields": [
    {
      "name": "title",
      "type": "string",
      "title": "Title",
      "validation": [{"required": true}]
    },
    {
      "name": "category",
      "type": "string",
      "title": "Category",
      "options": {
        "list": [
          {"title": "Biography", "value": "biography"},
          {"title": "Career", "value": "career"},
          {"title": "Military", "value": "military"},
          {"title": "Education", "value": "education"},
          {"title": "Business", "value": "business"},
          {"title": "Philosophy", "value": "philosophy"},
          {"title": "Podcast", "value": "podcast"},
          {"title": "Book", "value": "book"},
          {"title": "Skills", "value": "skills"},
          {"title": "Awards", "value": "awards"}
        ]
      },
      "validation": [{"required": true}]
    },
    {
      "name": "content",
      "type": "text",
      "title": "Content",
      "description": "Plain text content for the Knowledge Base. No rich text needed.",
      "validation": [{"required": true}]
    },
    {
      "name": "date",
      "type": "date",
      "title": "Date",
      "description": "When this happened. Used for chronological ordering."
    },
    {
      "name": "sortOrder",
      "type": "number",
      "title": "Sort Order",
      "description": "Manual override for ordering within a category."
    },
    {
      "name": "isActive",
      "type": "boolean",
      "title": "Active",
      "description": "Toggle entries on/off without deleting.",
      "initialValue": true
    }
  ],
  "orderings": [
    {
      "title": "Category, then Date",
      "name": "categoryDate",
      "by": [
        {"field": "category", "direction": "asc"},
        {"field": "date", "direction": "desc"}
      ]
    }
  ]
}
```

**Step 2: Verify the schema deployed**

Use the Sanity MCP tool `get_schema` to confirm `kbEntry` exists in the project schema.

**Step 3: Commit**

```bash
git add docs/plans/2026-03-02-kb-admin-design.md docs/plans/2026-03-02-kb-admin-implementation.md
git commit -m "docs: add KB admin design and implementation plan"
```

---

## Task 2: Create AWS Cognito User Pool

This task is done via AWS CLI. Creates the admin auth infrastructure.

**Files:**
- None (AWS infrastructure)

**Step 1: Create the Cognito User Pool**

```bash
aws cognito-idp create-user-pool \
  --pool-name thechrisgrey-admin-pool \
  --policies '{"PasswordPolicy":{"MinimumLength":12,"RequireUppercase":true,"RequireLowercase":true,"RequireNumbers":true,"RequireSymbols":true}}' \
  --auto-verified-attributes email \
  --username-attributes email \
  --mfa-configuration OFF \
  --account-recovery-setting '{"RecoveryMechanisms":[{"Priority":1,"Name":"verified_email"}]}' \
  --admin-create-user-config '{"AllowAdminCreateUserOnly":true}' \
  --region us-east-1
```

Save the `UserPool.Id` from the output.

**Step 2: Create an App Client (no secret — public client for SPA)**

```bash
aws cognito-idp create-user-pool-client \
  --user-pool-id <POOL_ID> \
  --client-name thechrisgrey-admin-client \
  --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH \
  --no-generate-secret \
  --access-token-validity 1 \
  --id-token-validity 1 \
  --refresh-token-validity 30 \
  --token-validity-units '{"AccessToken":"hours","IdToken":"hours","RefreshToken":"days"}' \
  --region us-east-1
```

Save the `UserPoolClient.ClientId` from the output.

**Step 3: Create your admin user**

```bash
aws cognito-idp admin-create-user \
  --user-pool-id <POOL_ID> \
  --username christian@altivum.ai \
  --temporary-password "TempPass123!" \
  --user-attributes Name=email,Value=christian@altivum.ai Name=email_verified,Value=true \
  --message-action SUPPRESS \
  --region us-east-1
```

**Step 4: Set permanent password**

```bash
aws cognito-idp admin-set-user-password \
  --user-pool-id <POOL_ID> \
  --username christian@altivum.ai \
  --password "<YOUR_PERMANENT_PASSWORD>" \
  --permanent \
  --region us-east-1
```

**Step 5: Add env vars to `.env.local` and `.env.example`**

Add to `.env.local`:
```
VITE_COGNITO_USER_POOL_ID=<POOL_ID>
VITE_COGNITO_CLIENT_ID=<CLIENT_ID>
VITE_KB_BUILDER_ENDPOINT=https://placeholder.lambda-url.us-east-1.on.aws
```

Add to `.env.example`:
```
# KB Admin (Cognito)
VITE_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
VITE_COGNITO_CLIENT_ID=your-cognito-client-id
VITE_KB_BUILDER_ENDPOINT=https://YOUR-FUNCTION-URL.lambda-url.us-east-1.on.aws/
```

---

## Task 3: Create the KB Builder Lambda

This Lambda handles CRUD for Sanity kbEntry documents and the document assembly + S3 upload.

**Files:**
- Create: `lambda/kb-builder/index.mjs`
- Create: `lambda/kb-builder/package.json`
- Create: `lambda/kb-builder/iam-policy.json`

**Step 1: Create `lambda/kb-builder/package.json`**

```json
{
  "name": "thechrisgrey-kb-builder",
  "version": "1.0.0",
  "type": "module",
  "description": "KB admin CRUD + document builder for thechrisgrey.com",
  "main": "index.mjs",
  "dependencies": {
    "@aws-sdk/client-s3": "^3.700.0",
    "@aws-sdk/client-cognito-identity-provider": "^3.700.0",
    "@sanity/client": "^7.14.0"
  }
}
```

**Step 2: Create `lambda/kb-builder/iam-policy.json`**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::thechrisgrey-kb-source/knowledge-base.txt"
    },
    {
      "Effect": "Allow",
      "Action": "logs:*",
      "Resource": "arn:aws:logs:us-east-1:205930636302:log-group:/aws/lambda/thechrisgrey-kb-builder:*"
    }
  ]
}
```

**Step 3: Create `lambda/kb-builder/index.mjs`**

```javascript
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import {
  CognitoIdentityProviderClient,
  GetUserCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { createClient } from "@sanity/client";

const s3Client = new S3Client({ region: "us-east-1" });
const cognitoClient = new CognitoIdentityProviderClient({ region: "us-east-1" });

const S3_BUCKET = "thechrisgrey-kb-source";
const S3_KEY = "knowledge-base.txt";

// Sanity client with write token (set in Lambda environment variables)
const sanityClient = createClient({
  projectId: "k5950b3w",
  dataset: "production",
  apiVersion: "2024-01-01",
  token: process.env.SANITY_WRITE_TOKEN,
  useCdn: false,
});

// Category display order for the assembled document
const CATEGORY_ORDER = [
  "biography",
  "military",
  "education",
  "career",
  "business",
  "skills",
  "awards",
  "philosophy",
  "podcast",
  "book",
];

const CATEGORY_LABELS = {
  biography: "BIOGRAPHY",
  military: "MILITARY SERVICE",
  education: "EDUCATION",
  career: "CAREER",
  business: "BUSINESS & ENTREPRENEURSHIP",
  skills: "SKILLS & EXPERTISE",
  awards: "AWARDS & RECOGNITION",
  philosophy: "PHILOSOPHY & LEADERSHIP",
  podcast: "THE VECTOR PODCAST",
  book: "BEYOND THE ASSESSMENT",
};

/**
 * Validate Cognito token. Returns user info or null.
 */
async function validateToken(authHeader) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice(7);

  try {
    const command = new GetUserCommand({ AccessToken: token });
    const response = await cognitoClient.send(command);
    return response;
  } catch (error) {
    console.error("Token validation failed:", error.name);
    return null;
  }
}

/**
 * Fetch all kbEntry documents from Sanity
 */
async function fetchEntries(activeOnly = false) {
  const filter = activeOnly
    ? '*[_type == "kbEntry" && isActive == true]'
    : '*[_type == "kbEntry"]';

  return sanityClient.fetch(
    `${filter} | order(category asc, sortOrder asc, date desc) {
      _id, _createdAt, _updatedAt, title, category, content, date, sortOrder, isActive
    }`
  );
}

/**
 * Assemble all active entries into a structured text document
 */
function assembleDocument(entries) {
  const grouped = {};

  for (const entry of entries) {
    const cat = entry.category || "biography";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(entry);
  }

  const sections = [];

  for (const category of CATEGORY_ORDER) {
    const items = grouped[category];
    if (!items || items.length === 0) continue;

    const label = CATEGORY_LABELS[category] || category.toUpperCase();
    const lines = [`=== ${label} ===`, ""];

    for (const item of items) {
      const dateStr = item.date
        ? ` (${new Date(item.date).toLocaleDateString("en-US", { year: "numeric", month: "long" })})`
        : "";
      lines.push(`${item.title}${dateStr}`);
      lines.push(item.content);
      lines.push("");
    }

    sections.push(lines.join("\n"));
  }

  // Handle any categories not in CATEGORY_ORDER
  for (const [category, items] of Object.entries(grouped)) {
    if (CATEGORY_ORDER.includes(category)) continue;
    const label = category.toUpperCase();
    const lines = [`=== ${label} ===`, ""];
    for (const item of items) {
      lines.push(item.title);
      lines.push(item.content);
      lines.push("");
    }
    sections.push(lines.join("\n"));
  }

  return sections.join("\n\n");
}

/**
 * Upload document to S3
 */
async function uploadToS3(document) {
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: S3_KEY,
    Body: document,
    ContentType: "text/plain; charset=utf-8",
  });
  return s3Client.send(command);
}

/**
 * Build CORS response
 */
function respond(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "https://thechrisgrey.com",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    },
    body: JSON.stringify(body),
  };
}

export const handler = async (event) => {
  // Handle CORS preflight
  if (event.requestContext?.http?.method === "OPTIONS") {
    return respond(200, { ok: true });
  }

  // Validate auth
  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  const user = await validateToken(authHeader);
  if (!user) {
    return respond(401, { error: "Unauthorized" });
  }

  const method = event.requestContext?.http?.method;
  const path = event.rawPath || "";

  try {
    // GET /entries — list all entries
    if (method === "GET" && path === "/entries") {
      const entries = await fetchEntries(false);
      return respond(200, { entries });
    }

    // POST /entries — create entry
    if (method === "POST" && path === "/entries") {
      const body = JSON.parse(event.body || "{}");
      const { title, category, content, date, sortOrder, isActive } = body;

      if (!title || !category || !content) {
        return respond(400, { error: "title, category, and content are required" });
      }

      const doc = {
        _type: "kbEntry",
        title,
        category,
        content,
        date: date || undefined,
        sortOrder: sortOrder ?? undefined,
        isActive: isActive !== false,
      };

      const result = await sanityClient.create(doc);
      return respond(201, { entry: result });
    }

    // PUT /entries/:id — update entry
    if (method === "PUT" && path.startsWith("/entries/")) {
      const id = path.split("/entries/")[1];
      if (!id) return respond(400, { error: "Missing entry ID" });

      const body = JSON.parse(event.body || "{}");
      const patch = sanityClient.patch(id);

      if (body.title !== undefined) patch.set({ title: body.title });
      if (body.category !== undefined) patch.set({ category: body.category });
      if (body.content !== undefined) patch.set({ content: body.content });
      if (body.date !== undefined) patch.set({ date: body.date });
      if (body.sortOrder !== undefined) patch.set({ sortOrder: body.sortOrder });
      if (body.isActive !== undefined) patch.set({ isActive: body.isActive });

      const result = await patch.commit();
      return respond(200, { entry: result });
    }

    // DELETE /entries/:id — delete entry
    if (method === "DELETE" && path.startsWith("/entries/")) {
      const id = path.split("/entries/")[1];
      if (!id) return respond(400, { error: "Missing entry ID" });

      await sanityClient.delete(id);
      return respond(200, { deleted: true });
    }

    // POST /publish — rebuild document and upload to S3
    if (method === "POST" && path === "/publish") {
      const entries = await fetchEntries(true);

      if (entries.length === 0) {
        return respond(400, { error: "No active entries to publish" });
      }

      const document = assembleDocument(entries);
      await uploadToS3(document);

      return respond(200, {
        message: "Knowledge Base document published",
        entryCount: entries.length,
        documentSize: document.length,
        publishedAt: new Date().toISOString(),
      });
    }

    return respond(404, { error: "Not found" });
  } catch (error) {
    console.error("Handler error:", error);
    return respond(500, { error: "Internal server error" });
  }
};
```

**Step 4: Install dependencies and create deployment zip**

```bash
cd lambda/kb-builder && npm install
```

**Step 5: Create the Lambda function in AWS**

```bash
# Create IAM role first
aws iam create-role \
  --role-name thechrisgrey-kb-builder-role \
  --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}' \
  --region us-east-1

# Attach policies
aws iam put-role-policy \
  --role-name thechrisgrey-kb-builder-role \
  --policy-name kb-builder-policy \
  --policy-document file://lambda/kb-builder/iam-policy.json

aws iam attach-role-policy \
  --role-name thechrisgrey-kb-builder-role \
  --policy-name arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# Wait for role propagation
sleep 10

# Create the function
cd lambda/kb-builder
zip -r function.zip index.mjs package.json node_modules

aws lambda create-function \
  --function-name thechrisgrey-kb-builder \
  --runtime nodejs20.x \
  --handler index.handler \
  --role arn:aws:iam::205930636302:role/thechrisgrey-kb-builder-role \
  --zip-file fileb://function.zip \
  --timeout 30 \
  --memory-size 256 \
  --environment "Variables={SANITY_WRITE_TOKEN=<YOUR_SANITY_WRITE_TOKEN>}" \
  --region us-east-1

# Create Function URL with CORS
aws lambda create-function-url-config \
  --function-name thechrisgrey-kb-builder \
  --auth-type NONE \
  --cors '{
    "AllowOrigins":["https://thechrisgrey.com","http://localhost:5173"],
    "AllowMethods":["GET","POST","PUT","DELETE","OPTIONS"],
    "AllowHeaders":["Content-Type","Authorization"],
    "MaxAge":86400
  }' \
  --region us-east-1

# Make Function URL publicly invocable (auth is handled by Cognito token validation in code)
aws lambda add-permission \
  --function-name thechrisgrey-kb-builder \
  --statement-id FunctionURLAllowPublicAccess \
  --action lambda:InvokeFunctionUrl \
  --principal "*" \
  --function-url-auth-type NONE \
  --region us-east-1
```

Save the Function URL from the output. Update `VITE_KB_BUILDER_ENDPOINT` in `.env.local`.

**Step 6: Get a Sanity write token**

Go to https://www.sanity.io/manage/project/k5950b3w/api#tokens and create a token with "Editor" permissions. Set it as the `SANITY_WRITE_TOKEN` environment variable on the Lambda.

**Step 7: Commit**

```bash
git add lambda/kb-builder/
git commit -m "feat: add kb-builder Lambda for admin CRUD and S3 publish"
```

---

## Task 4: Create the `useAuth` Hook

Frontend Cognito authentication hook.

**Files:**
- Create: `src/hooks/useAuth.ts`
- Modify: `src/hooks/index.ts:1-5`

**Step 1: Install Cognito SDK**

```bash
npm install @aws-sdk/client-cognito-identity-provider
```

**Step 2: Create `src/hooks/useAuth.ts`**

```typescript
import { useState, useCallback, useEffect } from 'react';
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  GlobalSignOutCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const cognitoClient = new CognitoIdentityProviderClient({
  region: 'us-east-1',
});

const USER_POOL_ID = import.meta.env.VITE_COGNITO_USER_POOL_ID;
const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID;

const AUTH_STORAGE_KEY = 'admin-auth';

interface AuthTokens {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  // Check for existing valid session on mount
  useEffect(() => {
    const stored = sessionStorage.getItem(AUTH_STORAGE_KEY);
    if (stored) {
      try {
        const tokens: AuthTokens = JSON.parse(stored);
        if (tokens.expiresAt > Date.now()) {
          setState({ isAuthenticated: true, isLoading: false, error: null });
          return;
        }
      } catch {
        // Invalid stored data, clear it
      }
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
    }
    setState({ isAuthenticated: false, isLoading: false, error: null });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const command = new InitiateAuthCommand({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: CLIENT_ID,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password,
        },
      });

      const response = await cognitoClient.send(command);
      const result = response.AuthenticationResult;

      if (!result?.AccessToken || !result?.IdToken) {
        throw new Error('Authentication failed');
      }

      const tokens: AuthTokens = {
        accessToken: result.AccessToken,
        idToken: result.IdToken,
        refreshToken: result.RefreshToken || '',
        expiresAt: Date.now() + (result.ExpiresIn || 3600) * 1000,
      };

      sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(tokens));
      setState({ isAuthenticated: true, isLoading: false, error: null });
    } catch (error) {
      const message =
        error instanceof Error && error.name === 'NotAuthorizedException'
          ? 'Invalid email or password'
          : 'Authentication failed. Please try again.';
      setState({ isAuthenticated: false, isLoading: false, error: message });
    }
  }, []);

  const logout = useCallback(async () => {
    const stored = sessionStorage.getItem(AUTH_STORAGE_KEY);
    if (stored) {
      try {
        const tokens: AuthTokens = JSON.parse(stored);
        await cognitoClient.send(
          new GlobalSignOutCommand({ AccessToken: tokens.accessToken })
        );
      } catch {
        // Sign out locally even if remote sign out fails
      }
    }
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
    setState({ isAuthenticated: false, isLoading: false, error: null });
  }, []);

  const getAccessToken = useCallback((): string | null => {
    const stored = sessionStorage.getItem(AUTH_STORAGE_KEY);
    if (!stored) return null;

    try {
      const tokens: AuthTokens = JSON.parse(stored);
      if (tokens.expiresAt <= Date.now()) {
        sessionStorage.removeItem(AUTH_STORAGE_KEY);
        setState({ isAuthenticated: false, isLoading: false, error: null });
        return null;
      }
      return tokens.accessToken;
    } catch {
      return null;
    }
  }, []);

  return {
    isAuthenticated: state.isAuthenticated,
    isLoading: state.isLoading,
    error: state.error,
    login,
    logout,
    getAccessToken,
  };
}
```

**Step 3: Export from hooks barrel**

Modify `src/hooks/index.ts` — add at the end:

```typescript
export { useAuth } from './useAuth';
```

**Step 4: Commit**

```bash
git add src/hooks/useAuth.ts src/hooks/index.ts package.json package-lock.json
git commit -m "feat: add useAuth hook for Cognito authentication"
```

---

## Task 5: Create the `useKbAdmin` Hook

API hook for communicating with the kb-builder Lambda.

**Files:**
- Create: `src/hooks/useKbAdmin.ts`
- Modify: `src/hooks/index.ts`

**Step 1: Create `src/hooks/useKbAdmin.ts`**

```typescript
import { useState, useCallback } from 'react';

const KB_BUILDER_ENDPOINT = import.meta.env.VITE_KB_BUILDER_ENDPOINT;

export interface KbEntry {
  _id: string;
  _createdAt: string;
  _updatedAt: string;
  title: string;
  category: string;
  content: string;
  date?: string;
  sortOrder?: number;
  isActive: boolean;
}

export type KbCategory =
  | 'biography'
  | 'career'
  | 'military'
  | 'education'
  | 'business'
  | 'philosophy'
  | 'podcast'
  | 'book'
  | 'skills'
  | 'awards';

export const KB_CATEGORIES: { value: KbCategory; label: string }[] = [
  { value: 'biography', label: 'Biography' },
  { value: 'career', label: 'Career' },
  { value: 'military', label: 'Military' },
  { value: 'education', label: 'Education' },
  { value: 'business', label: 'Business' },
  { value: 'philosophy', label: 'Philosophy' },
  { value: 'podcast', label: 'Podcast' },
  { value: 'book', label: 'Book' },
  { value: 'skills', label: 'Skills' },
  { value: 'awards', label: 'Awards' },
];

interface PublishResult {
  message: string;
  entryCount: number;
  documentSize: number;
  publishedAt: string;
}

export function useKbAdmin(getAccessToken: () => string | null) {
  const [entries, setEntries] = useState<KbEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authFetch = useCallback(
    async (path: string, options: RequestInit = {}) => {
      const token = getAccessToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${KB_BUILDER_ENDPOINT}${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...options.headers,
        },
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Request failed: ${response.status}`);
      }
      return data;
    },
    [getAccessToken]
  );

  const fetchEntries = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await authFetch('/entries');
      setEntries(data.entries);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch entries');
    } finally {
      setIsLoading(false);
    }
  }, [authFetch]);

  const createEntry = useCallback(
    async (entry: Omit<KbEntry, '_id' | '_createdAt' | '_updatedAt'>) => {
      setError(null);
      try {
        await authFetch('/entries', {
          method: 'POST',
          body: JSON.stringify(entry),
        });
        await fetchEntries();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create entry');
        throw err;
      }
    },
    [authFetch, fetchEntries]
  );

  const updateEntry = useCallback(
    async (id: string, updates: Partial<KbEntry>) => {
      setError(null);
      try {
        await authFetch(`/entries/${id}`, {
          method: 'PUT',
          body: JSON.stringify(updates),
        });
        await fetchEntries();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update entry');
        throw err;
      }
    },
    [authFetch, fetchEntries]
  );

  const deleteEntry = useCallback(
    async (id: string) => {
      setError(null);
      try {
        await authFetch(`/entries/${id}`, { method: 'DELETE' });
        await fetchEntries();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete entry');
        throw err;
      }
    },
    [authFetch, fetchEntries]
  );

  const publish = useCallback(async (): Promise<PublishResult> => {
    setIsPublishing(true);
    setError(null);
    try {
      const result = await authFetch('/publish', { method: 'POST' });
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish');
      throw err;
    } finally {
      setIsPublishing(false);
    }
  }, [authFetch]);

  return {
    entries,
    isLoading,
    isPublishing,
    error,
    fetchEntries,
    createEntry,
    updateEntry,
    deleteEntry,
    publish,
  };
}
```

**Step 2: Export from hooks barrel**

Add to `src/hooks/index.ts`:

```typescript
export { useKbAdmin } from './useKbAdmin';
export type { KbEntry, KbCategory } from './useKbAdmin';
export { KB_CATEGORIES } from './useKbAdmin';
```

**Step 3: Commit**

```bash
git add src/hooks/useKbAdmin.ts src/hooks/index.ts
git commit -m "feat: add useKbAdmin hook for KB entry CRUD and publish"
```

---

## Task 6: Build the Admin Page

The main admin page with login, entry management, and publish functionality.

**Files:**
- Create: `src/pages/Admin.tsx`
- Modify: `src/App.tsx:24,34,69`

**Step 1: Create `src/pages/Admin.tsx`**

This is the largest file. It contains:
- Login form (shown when not authenticated)
- Dashboard with entry list, grouped by category
- Add/edit entry form (inline)
- Publish button with status feedback

```typescript
import { useState, useEffect, FormEvent } from 'react';
import { typography } from '../utils/typography';
import { useAuth, useKbAdmin, KB_CATEGORIES } from '../hooks';
import type { KbEntry, KbCategory } from '../hooks';

// Login form component
function AdminLogin({
  onLogin,
  isLoading,
  error,
}: {
  onLogin: (email: string, password: string) => void;
  isLoading: boolean;
  error: string | null;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onLogin(email, password);
  };

  return (
    <div className="min-h-screen bg-altivum-dark flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="text-white mb-2" style={typography.sectionHeader}>
            Admin
          </h1>
          <p className="text-altivum-silver" style={typography.bodyText}>
            Knowledge Base Management
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div>
            <label
              htmlFor="admin-email"
              className="block text-xs font-medium text-altivum-gold mb-3 uppercase tracking-widest"
            >
              Email
            </label>
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-0 py-4 bg-transparent border-b-2 border-white/10 text-white placeholder-white/70 focus:outline-none focus:border-altivum-gold transition-all duration-300 rounded-none"
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label
              htmlFor="admin-password"
              className="block text-xs font-medium text-altivum-gold mb-3 uppercase tracking-widest"
            >
              Password
            </label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-0 py-4 bg-transparent border-b-2 border-white/10 text-white placeholder-white/70 focus:outline-none focus:border-altivum-gold transition-all duration-300 rounded-none"
              placeholder="Enter password"
            />
          </div>

          {error && (
            <div
              className="p-4 bg-red-900/30 border-l-4 border-red-500 text-red-300 text-sm"
              role="alert"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-4 font-medium uppercase tracking-wider text-sm transition-all duration-300 ${
              isLoading
                ? 'bg-altivum-slate/50 text-altivum-silver cursor-not-allowed'
                : 'bg-altivum-gold text-altivum-dark hover:bg-white'
            }`}
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

// Entry form component
function EntryForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: KbEntry;
  onSave: (data: Omit<KbEntry, '_id' | '_createdAt' | '_updatedAt'>) => Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title || '');
  const [category, setCategory] = useState<KbCategory>(
    (initial?.category as KbCategory) || 'biography'
  );
  const [content, setContent] = useState(initial?.content || '');
  const [date, setDate] = useState(initial?.date || '');
  const [sortOrder, setSortOrder] = useState<number | ''>(initial?.sortOrder ?? '');
  const [isActive, setIsActive] = useState(initial?.isActive !== false);
  const [isSaving, setIsSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave({
        title,
        category,
        content,
        date: date || undefined,
        sortOrder: sortOrder !== '' ? sortOrder : undefined,
        isActive,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="p-6 bg-altivum-navy/50 border border-white/10 rounded-lg space-y-6"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-xs font-medium text-altivum-gold mb-2 uppercase tracking-widest">
            Title *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full px-4 py-3 bg-white/5 border border-white/10 text-white rounded focus:outline-none focus:border-altivum-gold transition-colors"
            placeholder="Entry title"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-altivum-gold mb-2 uppercase tracking-widest">
            Category *
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as KbCategory)}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 text-white rounded focus:outline-none focus:border-altivum-gold transition-colors"
          >
            {KB_CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value} className="bg-altivum-navy">
                {cat.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-altivum-gold mb-2 uppercase tracking-widest">
          Content *
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
          rows={8}
          className="w-full px-4 py-3 bg-white/5 border border-white/10 text-white rounded focus:outline-none focus:border-altivum-gold transition-colors resize-y"
          placeholder="Entry content (plain text)"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-xs font-medium text-altivum-silver mb-2 uppercase tracking-widest">
            Date
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 text-white rounded focus:outline-none focus:border-altivum-gold transition-colors"
          />
        </div>

        <div className="flex items-end pb-1">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-5 h-5 rounded border-white/20 bg-white/5 text-altivum-gold focus:ring-altivum-gold"
            />
            <span className="text-altivum-silver text-sm">Active</span>
          </label>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="text-altivum-slate text-xs uppercase tracking-wider hover:text-altivum-silver transition-colors"
      >
        {showAdvanced ? 'Hide' : 'Show'} Advanced
      </button>

      {showAdvanced && (
        <div>
          <label className="block text-xs font-medium text-altivum-silver mb-2 uppercase tracking-widest">
            Sort Order
          </label>
          <input
            type="number"
            value={sortOrder}
            onChange={(e) =>
              setSortOrder(e.target.value ? parseInt(e.target.value, 10) : '')
            }
            className="w-full max-w-xs px-4 py-3 bg-white/5 border border-white/10 text-white rounded focus:outline-none focus:border-altivum-gold transition-colors"
            placeholder="Optional numeric order"
          />
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isSaving}
          className={`px-8 py-3 font-medium uppercase tracking-wider text-sm transition-all duration-300 ${
            isSaving
              ? 'bg-altivum-slate/50 text-altivum-silver cursor-not-allowed'
              : 'bg-altivum-gold text-altivum-dark hover:bg-white'
          }`}
        >
          {isSaving ? 'Saving...' : initial ? 'Update' : 'Create'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-8 py-3 text-altivum-silver border border-white/10 uppercase tracking-wider text-sm hover:border-white/30 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// Main admin dashboard
function AdminDashboard() {
  const { logout, getAccessToken } = useAuth();
  const {
    entries,
    isLoading,
    isPublishing,
    error,
    fetchEntries,
    createEntry,
    updateEntry,
    deleteEntry,
    publish,
  } = useKbAdmin(getAccessToken);

  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<KbEntry | null>(null);
  const [publishResult, setPublishResult] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handleCreate = async (
    data: Omit<KbEntry, '_id' | '_createdAt' | '_updatedAt'>
  ) => {
    await createEntry(data);
    setShowForm(false);
  };

  const handleUpdate = async (
    data: Omit<KbEntry, '_id' | '_createdAt' | '_updatedAt'>
  ) => {
    if (!editingEntry) return;
    await updateEntry(editingEntry._id, data);
    setEditingEntry(null);
  };

  const handleDelete = async (id: string) => {
    await deleteEntry(id);
    setDeleteConfirm(null);
  };

  const handleToggleActive = async (entry: KbEntry) => {
    await updateEntry(entry._id, { isActive: !entry.isActive });
  };

  const handlePublish = async () => {
    try {
      const result = await publish();
      setPublishResult(
        `Published ${result.entryCount} entries (${Math.round(result.documentSize / 1024)}KB). KB sync triggered.`
      );
      setTimeout(() => setPublishResult(null), 10000);
    } catch {
      // Error already set by hook
    }
  };

  // Group entries by category
  const grouped = entries.reduce<Record<string, KbEntry[]>>((acc, entry) => {
    const cat = entry.category || 'biography';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(entry);
    return acc;
  }, {});

  const activeCount = entries.filter((e) => e.isActive).length;
  const inactiveCount = entries.length - activeCount;

  return (
    <div className="min-h-screen bg-altivum-dark pt-24 pb-16">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-10">
          <div>
            <h1 className="text-white mb-1" style={typography.sectionHeader}>
              Knowledge Base
            </h1>
            <p className="text-altivum-silver" style={typography.bodyText}>
              Manage AI chat knowledge entries
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePublish}
              disabled={isPublishing || entries.length === 0}
              className={`px-6 py-3 font-medium uppercase tracking-wider text-sm transition-all duration-300 ${
                isPublishing || entries.length === 0
                  ? 'bg-altivum-slate/50 text-altivum-silver cursor-not-allowed'
                  : 'bg-altivum-gold text-altivum-dark hover:bg-white'
              }`}
            >
              {isPublishing ? 'Publishing...' : 'Publish to KB'}
            </button>
            <button
              onClick={logout}
              className="px-4 py-3 text-altivum-silver border border-white/10 text-sm hover:border-white/30 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Status messages */}
        {publishResult && (
          <div className="mb-6 p-4 bg-green-900/30 border-l-4 border-green-500 text-green-300 text-sm">
            {publishResult}
          </div>
        )}
        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border-l-4 border-red-500 text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="p-4 bg-altivum-navy/30 border border-white/5 rounded">
            <div className="text-2xl text-white font-semibold">{entries.length}</div>
            <div className="text-xs text-altivum-slate uppercase tracking-wider">Total Entries</div>
          </div>
          <div className="p-4 bg-altivum-navy/30 border border-white/5 rounded">
            <div className="text-2xl text-green-400 font-semibold">{activeCount}</div>
            <div className="text-xs text-altivum-slate uppercase tracking-wider">Active</div>
          </div>
          <div className="p-4 bg-altivum-navy/30 border border-white/5 rounded">
            <div className="text-2xl text-altivum-slate font-semibold">{inactiveCount}</div>
            <div className="text-xs text-altivum-slate uppercase tracking-wider">Inactive</div>
          </div>
        </div>

        {/* Add entry button / form */}
        {showForm ? (
          <div className="mb-8">
            <h2 className="text-white mb-4" style={typography.cardTitleLarge}>
              New Entry
            </h2>
            <EntryForm onSave={handleCreate} onCancel={() => setShowForm(false)} />
          </div>
        ) : editingEntry ? null : (
          <button
            onClick={() => setShowForm(true)}
            className="mb-8 inline-flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 text-altivum-silver text-sm hover:border-altivum-gold hover:text-altivum-gold transition-colors"
          >
            <span className="material-icons text-lg">add</span>
            Add Entry
          </button>
        )}

        {/* Loading state */}
        {isLoading && entries.length === 0 && (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-altivum-gold/30 border-t-altivum-gold rounded-full animate-spin" />
          </div>
        )}

        {/* Entry list grouped by category */}
        {KB_CATEGORIES.map((cat) => {
          const items = grouped[cat.value];
          if (!items || items.length === 0) return null;

          return (
            <div key={cat.value} className="mb-10">
              <h2 className="text-white text-sm font-semibold uppercase tracking-wider mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-altivum-gold" />
                {cat.label}
                <span className="text-altivum-slate font-normal">({items.length})</span>
              </h2>

              <div className="space-y-3">
                {items.map((entry) =>
                  editingEntry?._id === entry._id ? (
                    <div key={entry._id}>
                      <EntryForm
                        initial={entry}
                        onSave={handleUpdate}
                        onCancel={() => setEditingEntry(null)}
                      />
                    </div>
                  ) : (
                    <div
                      key={entry._id}
                      className={`p-4 border rounded-lg transition-colors ${
                        entry.isActive
                          ? 'bg-altivum-navy/30 border-white/5'
                          : 'bg-altivum-dark/50 border-white/5 opacity-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="text-white text-sm font-medium truncate">
                              {entry.title}
                            </h3>
                            {entry.date && (
                              <span className="text-altivum-slate text-xs flex-shrink-0">
                                {new Date(entry.date).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                })}
                              </span>
                            )}
                            {!entry.isActive && (
                              <span className="text-xs text-altivum-slate bg-white/5 px-2 py-0.5 rounded">
                                Inactive
                              </span>
                            )}
                          </div>
                          <p className="text-altivum-silver text-sm line-clamp-2">
                            {entry.content}
                          </p>
                        </div>

                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => handleToggleActive(entry)}
                            className="p-1.5 text-altivum-slate hover:text-altivum-gold transition-colors"
                            aria-label={entry.isActive ? 'Deactivate' : 'Activate'}
                            title={entry.isActive ? 'Deactivate' : 'Activate'}
                          >
                            <span className="material-icons text-lg">
                              {entry.isActive ? 'visibility' : 'visibility_off'}
                            </span>
                          </button>
                          <button
                            onClick={() => {
                              setEditingEntry(entry);
                              setShowForm(false);
                            }}
                            className="p-1.5 text-altivum-slate hover:text-white transition-colors"
                            aria-label="Edit"
                          >
                            <span className="material-icons text-lg">edit</span>
                          </button>
                          {deleteConfirm === entry._id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleDelete(entry._id)}
                                className="p-1.5 text-red-400 hover:text-red-300 transition-colors"
                                aria-label="Confirm delete"
                              >
                                <span className="material-icons text-lg">check</span>
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(null)}
                                className="p-1.5 text-altivum-slate hover:text-white transition-colors"
                                aria-label="Cancel delete"
                              >
                                <span className="material-icons text-lg">close</span>
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirm(entry._id)}
                              className="p-1.5 text-altivum-slate hover:text-red-400 transition-colors"
                              aria-label="Delete"
                            >
                              <span className="material-icons text-lg">delete</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          );
        })}

        {/* Empty state */}
        {!isLoading && entries.length === 0 && (
          <div className="text-center py-20">
            <span className="material-icons text-5xl text-altivum-slate mb-4 block">
              library_books
            </span>
            <p className="text-altivum-silver mb-2">No entries yet</p>
            <p className="text-altivum-slate text-sm">
              Add your first Knowledge Base entry to get started.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Main export — switches between login and dashboard
const Admin = () => {
  const { isAuthenticated, isLoading, error, login } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-altivum-dark flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-altivum-gold/30 border-t-altivum-gold rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AdminLogin onLogin={login} isLoading={isLoading} error={error} />;
  }

  return <AdminDashboard />;
};

export default Admin;
```

**Step 2: Register the route in `App.tsx`**

Add lazy import after line 24 (after `const NotFound`):

```typescript
const Admin = lazy(() => import('./pages/Admin'));
```

Update `isFullscreenPage` on line 34 to also hide footer/widget on admin:

```typescript
const isFullscreenPage = location.pathname === '/chat' || location.pathname === '/admin';
```

Add route after the `*` catch-all route (line 69), or better, before it:

```tsx
<Route path="/admin" element={<Admin />} />
```

**Step 3: Commit**

```bash
git add src/pages/Admin.tsx src/App.tsx
git commit -m "feat: add admin page with login, entry CRUD, and publish"
```

---

## Task 7: Update Environment Config and CSP

Wire up the new endpoints in env validation, CSP, and preconnects.

**Files:**
- Modify: `scripts/validate-env.js:5-8`
- Modify: `amplify.yml:31`
- Modify: `index.html:50-52`
- Modify: `.env.example`

**Step 1: Update `scripts/validate-env.js`**

Add the 3 new env vars to the `required` array:

```javascript
const required = [
  'VITE_NEWSLETTER_ENDPOINT',
  'VITE_CONTACT_ENDPOINT',
  'VITE_CHAT_ENDPOINT',
  'VITE_COGNITO_USER_POOL_ID',
  'VITE_COGNITO_CLIENT_ID',
  'VITE_KB_BUILDER_ENDPOINT',
];
```

**Step 2: Update CSP in `amplify.yml`**

Add to `connect-src` (line 31) — append before the closing `"`:

```
https://<KB_BUILDER_FUNCTION_URL_HOST>.lambda-url.us-east-1.on.aws https://cognito-idp.us-east-1.amazonaws.com
```

**Step 3: Add preconnect in `index.html`**

After line 52 (`buzzsprout` preconnect), add:

```html
<link rel="preconnect" href="https://<KB_BUILDER_FUNCTION_URL_HOST>.lambda-url.us-east-1.on.aws" crossorigin />
```

**Step 4: Update `.env.example`**

Append:

```
# KB Admin
VITE_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
VITE_COGNITO_CLIENT_ID=your-cognito-client-id
VITE_KB_BUILDER_ENDPOINT=https://YOUR-FUNCTION-URL.lambda-url.us-east-1.on.aws/
```

**Step 5: Add env vars to Amplify**

```bash
aws amplify update-branch \
  --app-id d3du8eg39a9peo \
  --branch-name main \
  --environment-variables \
    "VITE_COGNITO_USER_POOL_ID=<POOL_ID>,VITE_COGNITO_CLIENT_ID=<CLIENT_ID>,VITE_KB_BUILDER_ENDPOINT=<FUNCTION_URL>" \
  --region us-east-2
```

**Step 6: Commit**

```bash
git add scripts/validate-env.js amplify.yml index.html .env.example
git commit -m "feat: add KB admin env vars, CSP, and preconnects"
```

---

## Task 8: Update CLAUDE.md

Document the new admin page infrastructure.

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Add Admin section to CLAUDE.md**

Add after the "### AI Chat" section a new section:

```markdown
### KB Admin (`/admin`)

Protected admin page for managing the AI chat's Knowledge Base content.

**Authentication:**
- AWS Cognito User Pool: `thechrisgrey-admin-pool` (us-east-1)
- Single admin user, no self-signup
- Tokens stored in sessionStorage (1-hour expiry)

**Data Flow:**
1. Admin creates/edits `kbEntry` documents via kb-builder Lambda → Sanity CMS
2. "Publish to KB" reads all active entries, assembles structured text document
3. Uploads `knowledge-base.txt` to `s3://thechrisgrey-kb-source/`
4. Existing kb-sync Lambda triggers Bedrock re-ingestion automatically

**KB Builder Lambda** (`lambda/kb-builder/`):
- Function: `thechrisgrey-kb-builder` (us-east-1)
- Endpoints: GET/POST/PUT/DELETE `/entries`, POST `/publish`
- Validates Cognito token on every request
- Holds Sanity write token (env: `SANITY_WRITE_TOKEN`)
- IAM Role: `thechrisgrey-kb-builder-role`

**Sanity Document Type:** `kbEntry`
- Fields: title, category, content (plain text), date, sortOrder, isActive
- Categories: biography, career, military, education, business, philosophy, podcast, book, skills, awards

**Deployment:**
```bash
cd lambda/kb-builder
npm install
zip -r function.zip index.mjs package.json node_modules
aws lambda update-function-code --function-name thechrisgrey-kb-builder --zip-file fileb://function.zip --region us-east-1
```
```

**Step 2: Add new env vars to the Environment Variables section**

Append to the existing list:

```markdown
- `VITE_COGNITO_USER_POOL_ID`: Cognito User Pool ID for admin auth
- `VITE_COGNITO_CLIENT_ID`: Cognito App Client ID for admin auth
- `VITE_KB_BUILDER_ENDPOINT`: Lambda Function URL for KB admin operations
```

**Step 3: Add to Key Files section**

```markdown
- `src/pages/Admin.tsx`: KB admin page (login + entry CRUD + publish)
- `src/hooks/useAuth.ts`: Cognito authentication hook
- `src/hooks/useKbAdmin.ts`: KB entry CRUD and publish hook
- `lambda/kb-builder/`: KB admin Lambda (Sanity CRUD + S3 document assembly)
```

**Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document KB admin page infrastructure in CLAUDE.md"
```

---

## Task 9: Migrate Autobiography Content

One-time migration of existing Autobiography.docx content into Sanity kbEntry documents.

**Step 1: Download and read the current Autobiography.docx**

```bash
aws s3 cp s3://thechrisgrey-kb-source/Autobiography.docx ./Autobiography.docx
```

Open and review the content. Identify natural sections and break them into individual entries by category.

**Step 2: Create entries via the admin page**

Navigate to `http://localhost:5173/admin`, log in, and create entries for each section of the autobiography. Assign appropriate categories and dates.

**Step 3: Publish and verify**

Hit "Publish to KB" on the admin page. Then test the AI chat to confirm responses reflect the new content.

**Step 4: Remove the old file from S3**

Once verified:

```bash
aws s3 rm s3://thechrisgrey-kb-source/Autobiography.docx
```

The kb-sync Lambda will trigger re-ingestion with only `knowledge-base.txt` remaining.

---

## Task 10: Build Verification and Final Test

**Step 1: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

**Step 2: Lint**

```bash
npm run lint
```

Expected: 0 warnings, 0 errors.

**Step 3: Run tests**

```bash
npm run test
```

Expected: All existing tests pass.

**Step 4: Manual end-to-end test**

1. `npm run dev` — navigate to `/admin`
2. Log in with Cognito credentials
3. Create a test entry (title: "Test Entry", category: biography, content: "This is a test.")
4. Verify it appears in the list
5. Edit it — change the title
6. Toggle it inactive — verify it shows dimmed
7. Hit "Publish to KB" — verify success message
8. Check S3: `aws s3 cp s3://thechrisgrey-kb-source/knowledge-base.txt -` to see the assembled document
9. Delete the test entry
10. Navigate to `/chat` — ask a question to verify the chat still works
11. Verify `/admin` is not visible in navigation
12. Verify footer and chat widget are hidden on `/admin`

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat: KB admin page — complete implementation with Cognito auth, Sanity CRUD, and S3 publish"
```
