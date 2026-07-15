## Summary

<!-- What does this PR do and why? Link the issue it closes (e.g. Closes #123). -->

## Type of change

<!-- Check all that apply -->

- [ ] Frontend (React app, components, pages, hooks, utils)
- [ ] Lambda service (chat-stream, blueprint, kb-builder, kb-sync, metrics, mcp-server, session-token)
- [ ] Infrastructure (AWS, Amplify, CloudFront, CI/CD)
- [ ] Documentation
- [ ] Refactor / chore
- [ ] Breaking change (describe impact below)

## Testing done

<!-- Per the repo verification rule: green unit tests are NOT proof a feature
     works. For anything touching an external service (Bedrock, Amplify,
     streaming, auth, Sanity, Cognito), exercise the REAL deployed path. -->

- [ ] `npm run format:check` passes
- [ ] `npm run lint` passes (`--max-warnings 0`)
- [ ] `npm run tsc` passes (or `npm run tsc:lambda` if Lambda touched)
- [ ] `npm test` passes (frontend unit + integration)
- [ ] `npm run test:lambda` passes (if Lambda touched)
- [ ] `npm run validate:agents` passes (if AGENTS.md touched)
- [ ] Manually verified in dev server (`npm run dev`)
- [ ] Live API / deployed path verified (for external-service changes)

### Verification details

<!-- Describe how you verified this works. If you tested against a live
     endpoint, note which one. If you relied on mocks, explain why that's
     sufficient here. -->

## Related issues / context

<!-- Related issues, PRs, design docs, or screenshots. Anything a reviewer
     needs to understand the change. -->
