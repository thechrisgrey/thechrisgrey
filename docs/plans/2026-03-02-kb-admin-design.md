# Knowledge Base Admin Page — Design Document

**Date:** 2026-03-02
**Status:** Approved

## Problem

The AI chat Knowledge Base is powered by a single document in S3. Updating it requires manually downloading, editing, and re-uploading the file. This friction means the KB falls out of date as life events occur.

## Solution

A Cognito-protected admin page at `/admin` where Christian can create, edit, and organize Knowledge Base entries stored in Sanity CMS. A "Publish to KB" action triggers a Lambda that reads all entries from Sanity, assembles a single structured text document, and uploads it to S3 — where the existing kb-sync Lambda automatically triggers Bedrock re-ingestion.

## Architecture

```
Browser (/admin)
  │
  ├─ Login → Cognito User Pool (thechrisgrey-admin-pool)
  │
  ├─ CRUD entries → kb-builder Lambda → Sanity CMS (kbEntry docs)
  │                  (validates Cognito token)
  │
  └─ "Publish to KB" → kb-builder Lambda
                         │
                         ├─ Read all active kbEntries from Sanity
                         ├─ Assemble structured text document
                         └─ Upload knowledge-base.txt to S3
                                 │
                                 ▼
                         S3 ObjectCreated event (existing)
                                 │
                                 ▼
                         kb-sync Lambda (existing, unchanged)
                                 │
                                 ▼
                         Bedrock KB Ingestion → Vector embeddings updated
```

## Data Model (Sanity)

New document type `kbEntry` in project `k5950b3w`:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| title | string | Yes | Short label (e.g., "AWS SA Certification") |
| category | string (enum) | Yes | One of: biography, career, military, education, business, philosophy, podcast, book, skills, awards |
| content | text | Yes | Plain text prose or facts. No Portable Text — output is a flat text file for embeddings. |
| date | date | No | When this happened. Used for chronological ordering within categories. |
| sortOrder | number | No | Manual override for ordering within a category. |
| isActive | boolean | Yes (default true) | Toggle entries on/off without deleting. |

**Why plain text:** The output is a single text file for Bedrock ingestion. Portable Text would need serialization back to plain text, adding complexity with zero benefit for embeddings.

## Authentication (AWS Cognito)

- **User Pool:** `thechrisgrey-admin-pool` (us-east-1)
- **Single user:** Created manually in AWS console. No self-signup.
- **Auth flow:** `USER_PASSWORD_AUTH`
- **Token storage:** `sessionStorage` (cleared on browser close)
- **Token expiry:** 1 hour. Expired token redirects to login.
- **Frontend:** `useAuth` hook checks token validity before rendering admin UI.
- **Backend:** kb-builder Lambda validates Cognito `IdToken` on every request.

## Admin Page UI

**Route:** `/admin` — lazy-loaded, not linked in navigation (accessed by direct URL).

**Login screen:**
- Centered card with email + password fields
- Matches site aesthetic (altivum-dark, gold accents, SF Pro Display)

**Dashboard:**
- Header: "Knowledge Base Admin" + logout + "Publish to KB" button
- Stats bar: total entries, last published timestamp, active/inactive counts
- Entry list: grouped by category, sorted by date within groups
- Each entry: title, category badge, date, active toggle, edit/delete actions
- "Add Entry" button opens inline form

**Entry form:**
- title (text input), category (dropdown), content (textarea), date (date picker), sortOrder (number, under "Advanced"), isActive (toggle)
- Save writes to Sanity via kb-builder Lambda

**Publish flow:**
- "Publish to KB" calls kb-builder Lambda `/publish` endpoint
- Progress: "Rebuilding document..." → "Uploading to S3..." → "KB sync triggered."
- Disabled while in progress

## Document Builder Lambda

**Function:** `thechrisgrey-kb-builder` (us-east-1)
**Trigger:** Lambda Function URL (HTTP)

**Endpoints:**
- `GET /entries` — List all kbEntry documents
- `POST /entries` — Create entry
- `PUT /entries/:id` — Update entry
- `DELETE /entries/:id` — Delete entry
- `POST /publish` — Rebuild document and upload to S3

**All endpoints validate Cognito IdToken before executing.**

**Publish logic:**
1. Fetch all active kbEntries from Sanity
2. Group by category
3. Assemble structured text:
   ```
   === BIOGRAPHY ===

   [Title] (March 2026)
   [Content]

   === MILITARY SERVICE ===

   [Title] (2015)
   [Content]
   ```
4. Upload to `s3://thechrisgrey-kb-source/knowledge-base.txt`
5. Return success with timestamp

**Why section markers:** `===` headers give Bedrock's chunking algorithm clear semantic boundaries. Related facts cluster in vector space, improving retrieval relevance.

**Sanity write token:** Lives only in this Lambda's environment variables. Never exposed to the browser.

## New Infrastructure

| Component | Details |
|-----------|---------|
| Cognito User Pool | `thechrisgrey-admin-pool`, us-east-1, single user, no self-signup |
| Lambda Function | `thechrisgrey-kb-builder`, us-east-1, Function URL with CORS |
| Sanity Document Type | `kbEntry` in project k5950b3w |
| Frontend Route | `/admin` (lazy-loaded) |

## Existing Infrastructure (Unchanged)

- kb-sync Lambda
- chat-stream Lambda
- S3 bucket (thechrisgrey-kb-source)
- Bedrock Knowledge Base (ARFYABW8HP)
- Vector store (thechrisgrey-vectors)

## New Environment Variables

| Variable | Purpose |
|----------|---------|
| `VITE_KB_BUILDER_ENDPOINT` | kb-builder Lambda Function URL |
| `VITE_COGNITO_USER_POOL_ID` | Cognito User Pool ID |
| `VITE_COGNITO_CLIENT_ID` | Cognito App Client ID |

## New Dependency

- `@aws-sdk/client-cognito-identity-provider` — frontend Cognito auth

## CSP Updates (amplify.yml)

- Add kb-builder Lambda Function URL to `connect-src`
- Add `cognito-idp.us-east-1.amazonaws.com` to `connect-src`

## Security Boundaries

- Cognito token required for all admin operations
- Sanity write token lives only in kb-builder Lambda (never in browser)
- S3 write permission lives only in kb-builder Lambda IAM role
- Admin page is read/write; public site remains read-only
- `/admin` route hidden from navigation

## Migration Plan

1. Deploy Sanity schema with `kbEntry` type
2. Manually break existing `Autobiography.docx` content into individual kbEntry documents in Sanity
3. First publish from admin page generates `knowledge-base.txt`
4. Verify chat responses use new content
5. Delete `Autobiography.docx` from S3
