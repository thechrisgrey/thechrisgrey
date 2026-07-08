# AGENTS.md

Guidance for autonomous coding agents working in this repository. This is the
canonical, machine-facing entry point. `CLAUDE.md` holds the deep architectural
reference; read it when you need subsystem detail. This file gives you the
essentials to set up, build, test, and change the code correctly.

## What this repo is

Personal website for Christian Perez (`thechrisgrey.com`). A React 19 +
TypeScript + Vite single-page app (deployed on AWS Amplify) plus seven
independently deployable AWS Lambda services under `lambda/`. The AI chat agent
"Alti" is powered by Amazon Bedrock (Claude Haiku 4.5) with RAG.

## Setup

- **Node 22** is required (pinned in `.nvmrc`). Use `nvm use` before anything.
- Package manager is **npm** (a committed `package-lock.json` is the source of truth).

```bash
nvm use            # switch to Node 22
npm install        # install frontend deps
npm run dev        # dev server at http://localhost:5173
```

Copy `.env.example` to `.env.local` and fill required `VITE_*` values before the
app can talk to its backends. Never commit `.env` or `.env.local`.

## Core commands

| Command                           | What it does                                |
| --------------------------------- | ------------------------------------------- |
| `npm run dev`                     | Vite dev server (localhost:5173)            |
| `npm run build`                   | Full production pipeline (see below)        |
| `npm run preview`                 | Serve the production build locally          |
| `npm run lint`                    | ESLint on `src/` (`--max-warnings 0`)       |
| `npm run lint:lambda`             | ESLint on `lambda/` `.mjs` handlers         |
| `npm run tsc:lambda`              | Type-check Lambda `.mjs` files via tsc      |
| `npm run format`                  | Prettier auto-format all files (`--write`)  |
| `npm run format:check`            | Prettier check (CI gate, no writes)         |
| `npm test`                        | Vitest run (frontend unit + integration)    |
| `npm run test:watch`              | Vitest in watch mode                        |
| `npm run test:coverage`           | Vitest with v8 coverage + thresholds        |
| `npm run test:lambda`             | `node --test` suites for every Lambda       |
| `npm run test:lambda:coverage`    | Lambda tests with coverage threshold check  |
| `npm run cy:run`                  | Cypress e2e (headless)                      |
| `npm run cy:open`                 | Cypress interactive runner                  |
| `npm run validate:agents`         | Check this file stays in sync with the code |
| `npm run knip`                    | Dead code and unused dependency detection   |
| `npm run jscpd`                   | Duplicate code detection (threshold 5%)     |
| `npm run check:tech-debt`         | TODO/FIXME must link to an issue            |
| `npm run deploy:lambda -- <name>` | Deploy one Lambda (see Deployment)          |

### Build pipeline

`npm run build` runs, in order:

```
validate-env -> generate-podcast-episodes -> lint -> tsc -> vite build
  -> generate-og-images -> prerender -> validate-prerender-seo
  -> generate-sitemap -> generate-rss
```

Any step failing fails the build. `tsc` runs in `--noEmit` type-check mode and
lint runs with zero-warning tolerance, so type and lint errors block the build.

## Testing

- **Frontend:** Vitest + React Testing Library, jsdom environment. Test files
  are `src/**/*.test.{ts,tsx}`; integration tests live in
  `src/__tests__/integration/`. Coverage thresholds are enforced in
  `vitest.config.ts` (lines 66 / statements 64 / branches 62 / functions 60).
- **Lambdas:** Node's built-in test runner (`node --test`) over
  `lambda/**/__tests__/*.test.mjs`. Run all via `npm run test:lambda`.
- **E2E:** Cypress specs in `cypress/e2e/`. Only mock-stubbed specs run in CI;
  WebGL-dependent specs (home, navigation, chat widget) are excluded there.
- **Live-API contract tests (opt-in):** suites that hit the real Cognito,
  Sanity, Bedrock KB, and guardrail boundaries. They skip cleanly unless their
  env flag is set. See `.env.example` for flags and required AWS permissions.

**Verification rule:** green unit tests are NOT proof a feature works. For
anything touching an external service (Bedrock, Amplify, streaming, auth),
exercise the real deployed path before claiming it works. Distrust mocks that
assume behavior the live SDK may not exhibit.

Run before finishing any change: `npm run format:check`, `npm run lint`, `npm run
lint:lambda` and `npm run tsc:lambda` (if you touched `lambda/`), `npm test`, and
`npm run test:lambda` (if you touched `lambda/`), and `npm run test:lambda:coverage`
(if you touched `lambda/`). Pre-commit hooks (husky + lint-staged) auto-run ESLint
and Prettier on staged files, but the full checks above should still be run manually.

If you edit this file, run `npm run validate:agents` to confirm it stays in
sync with the code. That check verifies every documented `npm run` command, file
reference, and the Node version against the repo, and it also runs in CI so a
stale AGENTS.md fails the build.

## Repository layout

```
src/                 React app (components/, pages/, hooks/, sanity/, utils/, __tests__/)
src/routes.ts        Single source of truth for routes (see Conventions)
lambda/shared/       Shared Lambda utils (auth, rate limit, hmac, metrics) - a library, not deployed alone
lambda/chat-stream/  Alti chat streaming (Strands + Bedrock + KB + guardrail)
lambda/blueprint/    Architecture generator (Bedrock Opus, Converse API)
lambda/kb-builder/   Cognito-auth'd Sanity kbEntry CRUD
lambda/kb-sync/      S3-triggered Bedrock KB ingestion
lambda/metrics/      Web Vitals + CSP ingestion to CloudWatch (has GET /health)
lambda/mcp-server/   Public MCP server (ask_alti, blog search)
lambda/session-token/ Turnstile-gated short-lived token issuer
scripts/             Build-time generators + deploy/verify tooling
docs/                Internal plans and runbooks
```

## Code conventions

- **TypeScript strict mode** is on for `src/` (`tsconfig.json`); keep it type-clean
  (`noUnusedLocals`/`noUnusedParameters` are enforced). Do not add `@ts-nocheck`.
  Lambda `.mjs` files are type-checked via `lambda/tsconfig.json` (`checkJs` +
  JSDoc annotations); run `npm run tsc:lambda` to verify.
- **Naming conventions** are enforced by `@typescript-eslint/naming-convention`
  in ESLint:
  - **Variables:** `camelCase` (e.g. `const url = ...`), `UPPER_CASE` for
    constants (e.g. `const SITE_ORIGIN = ...`), `PascalCase` for React component
    assignments (e.g. `const MyComponent = () => {}`). `snake_case` is allowed
    only for destructured variables matching external API response keys.
  - **Functions:** `camelCase` for utilities (e.g. `validateInput`), `PascalCase`
    for React components (e.g. `function About() {}`).
  - **Types/Interfaces/Classes:** `PascalCase` (e.g. `SanityPost`, `BlueprintOutput`).
  - **Parameters:** `camelCase` with leading underscore allowed for unused params
    (e.g. `_key`). `PascalCase` allowed for React component params (e.g. `Tag`).
  - **Enum members / Type parameters:** `PascalCase`.
- **Comments:** default to none. Add one only for a non-obvious constraint,
  invariant, or workaround. Code should be self-documenting. No em dashes in prose.
- **Routing is single-source-of-truth:** add/change routes in `src/routes.ts`.
  `src/utils/routeManifest.ts` and `src/utils/pageContext.ts` derive from it and
  a drift test (`src/routes.test.ts`) enforces sync. The chat Lambda mirrors this
  via `lambda/chat-stream/validation.mjs` `VALID_PATHS` (drift test guards it).
- **Typography:** use `src/utils/typography.ts` styles (`typography.heroHeader`,
  etc.). Never add Google Fonts.
- **Navigation:** use `<ViewTransitionLink>` for internal links, not `<Link>`
  (except inside error boundaries).
- **Icons:** Material Icons via CDN (`<span className="material-icons">`); brand
  logos are inline SVG.
- **Syntax highlighting:** import Shiki through the
  `src/utils/shikiHighlighter.ts` singleton, never `import('shiki')` directly.
- **3D / WebGL:** mock `AltiMascot`/Three.js in jsdom tests (no WebGL there).
- **Lambdas** are ESM `.mjs` on AWS SDK v3. Emit structured JSON logs
  (`console.log(JSON.stringify({ requestId, event, ... }))`) and never log PII;
  `lambda/chat-stream/memory.mjs` `sanitizeFactContent` enforces PII rejection.
- **Tailwind v4** is CSS-first: theme colors live in the `@theme` block in
  `src/index.css`, not in a standalone Tailwind JS config file.
- **CSP:** when adding an external resource, update the CSP allowlist in
  `amplify.yml` / `customHttp.yml`.

## Security

- Never commit secrets. `.env` files (except `.env.example`) are gitignored.
- Frontend `VITE_*` values are public (bundled). Server secrets live only on the
  Lambdas / Amplify env, never in the bundle (e.g. Turnstile secret is server-only).
- Chat requests use short-lived scoped session tokens (Turnstile-gated, issued by
  `lambda/session-token/`, sent as `Authorization: Bearer` via
  `src/utils/sessionToken.ts`) and are rate-limited server-side. Preserve those
  checks when editing `lambda/chat-stream/`.

## Deployment

- **Frontend:** push to `main` triggers Amplify (app `d3du8eg39a9peo`, us-east-2).
- **Lambdas:** never hand-zip. Use the verified script, which reinstalls from the
  lockfile, dereferences `lambda-shared`, and smoke-checks the module graph before
  upload:

```bash
npm run deploy:lambda -- <name> --dry-run   # build + verify, no upload
npm run deploy:lambda -- <name>             # deploy (default region us-east-1)
```

## API contracts

Each HTTP Lambda ships an OpenAPI 3.1 spec (`lambda/<service>/openapi.yaml`)
documenting its routes, auth, request/response schemas, and status codes:

- `lambda/chat-stream/openapi.yaml` - streaming chat + `/forget` (framed events)
- `lambda/blueprint/openapi.yaml` - NDJSON blueprint generation
- `lambda/kb-builder/openapi.yaml` - Cognito-auth'd kbEntry CRUD + publish
- `lambda/metrics/openapi.yaml` - Web Vitals / CSP ingestion + Cognito health
- `lambda/mcp-server/openapi.yaml` - JSON-RPC 2.0 MCP endpoint + health
- `lambda/session-token/openapi.yaml` - Turnstile-gated token issuer

`kb-sync` is S3-event-triggered and has no HTTP API. When you change a handler's
routes or payloads, update its spec so the contract stays accurate.

## Where to look next

- `CLAUDE.md`: full architecture, design system, subsystem internals.
- `README.md`: public project overview and AWS infrastructure table.
- `docs/`: implementation plans, runbooks, and cost/logging notes.
- `docs/ideas-to-consider.md`: pending feature ideas.
