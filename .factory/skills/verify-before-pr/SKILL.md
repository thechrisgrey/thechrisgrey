---
name: verify-before-pr
description: Run the full verification suite required before finishing any change to the thechrisgrey codebase. Covers lint, typecheck, tests, formatting, and AGENTS.md validation.
---

# Verify Before PR

Run these checks before finishing any change. Pre-commit hooks (husky + lint-staged) auto-run ESLint and Prettier on staged files, but the full checks below must still be run manually.

## Full verification suite

```bash
# 1. Formatting check (CI gate)
npm run format:check

# 2. Lint (frontend, zero-warning tolerance)
npm run lint

# 3. Lint (Lambda .mjs handlers)
npm run lint:lambda

# 4. Type check (Lambda .mjs via JSDoc + checkJs)
npm run tsc:lambda

# 5. Frontend tests (Vitest)
npm test

# 6. Lambda tests (node --test for all 7 Lambda packages)
npm run test:lambda

# 7. AGENTS.md validation (verifies documented commands, file refs, Node version)
npm run validate:agents
```

## When to run which checks

| Check                  | When to run                                         |
| ---------------------- | --------------------------------------------------- |
| `format:check`         | Always                                              |
| `lint`                 | Always (or if you touched `src/`)                   |
| `lint:lambda`          | If you touched `lambda/`                            |
| `tsc:lambda`           | If you touched `lambda/`                            |
| `npm test`             | Always (or if you touched `src/`)                   |
| `test:lambda`          | If you touched `lambda/`                            |
| `test:lambda:coverage` | If you touched `lambda/`                            |
| `validate:agents`      | If you edited `AGENTS.md`                           |
| `knip`                 | If you added/removed imports or exports             |
| `jscpd`                | If you added significant code (duplicate detection) |

## Common failures and fixes

- **Prettier formatting**: Run `npm run format` (auto-fix all files)
- **ESLint naming-convention**: Variables must be camelCase, constants UPPER_CASE, React components PascalCase. Types/Interfaces/Classes must be PascalCase.
- **validate:agents failure**: Every `npm run` command, file reference, and the Node version in AGENTS.md must match the repo. If you added a new script or file, document it in AGENTS.md.
- **tsc:lambda type error**: Lambda `.mjs` files are type-checked via JSDoc annotations. Use `@param {{ send: any }} client` instead of `@param {object} client` for SDK clients. Catch variables are `unknown` (use `instanceof Error` check).
- **Test coverage threshold**: vitest.config.ts enforces lines 66, statements 64, branches 62, functions 60. Run `npm run test:coverage` to check.

## Important notes

- Green tests are NOT proof a feature works. For anything touching an external service (Bedrock, Amplify, streaming, auth), exercise the real deployed path before claiming it works.
- Never commit `.env` or `.env.local` files.
- Never hand-zip Lambda bundles. Use `npm run deploy:lambda -- <name>`.
- If you created new files, `git add` them before running `validate:agents` (it checks for tracked files).
- The build pipeline (`npm run build`) runs validate-env, generate-podcast-episodes, lint, tsc, vite build, generate-og-images, prerender, validate-prerender-seo, generate-sitemap, generate-rss. Any step failing fails the build.
