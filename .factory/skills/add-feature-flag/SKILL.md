---
name: add-feature-flag
description: Add a new feature flag to the centralized feature flag system in src/utils/featureFlags.ts. Covers boolean/string/number flags, env var configuration, PostHog remote rollout keys, and the React hook integration.
---

# Add Feature Flag

Add a new feature flag to the centralized system in `src/utils/featureFlags.ts`.

## Steps

1. Add the flag definition to the `FLAGS` object in `src/utils/featureFlags.ts`:

   ```typescript
   myFeature: {
     key: 'myFeature',
     type: 'boolean' as const,
     description: 'Enable the my-feature page at /my-feature',
     envVar: 'VITE_MY_FEATURE_ENABLED',
     remoteKey: 'my-feature',  // optional: enables PostHog remote rollout
     defaultValue: false,
   },
   ```

2. If the flag controls a route, update `src/routes.ts` to conditionally include the route based on the flag.

3. Use the flag in components:

   ```typescript
   import { isFeatureEnabled, getFeatureFlag } from '../utils/featureFlags';
   import { useFeatureFlag } from '../hooks/useFeatureFlag';

   // In regular code:
   if (isFeatureEnabled('myFeature')) { ... }
   const endpoint = getFeatureFlag('myFeatureEndpoint');

   // In React components (reactive to PostHog flag changes):
   const enabled = useFeatureFlag('myFeature');
   ```

4. Add the env var to `.env.example`:

   ```
   # VITE_MY_FEATURE_ENABLED=true
   ```

5. Update `.env.local` (if developing locally) with the actual value.

6. If using a PostHog `remoteKey`, create the flag in the PostHog dashboard with matching key name.

## Flag types

- **boolean**: `type: 'boolean' as const`, use `isFeatureEnabled('key')` or `useFeatureFlag('key')`
- **string**: `type: 'string' as const`, use `getFeatureFlag('key')`
- **number**: `type: 'number' as const`, use `getFeatureFlag('key')`

## Resolution order (highest priority first)

1. localStorage override (`ff:<flagKey>`) - per-device testing in any env
2. PostHog remote flag (`remoteKey`) - server-controlled rollouts (percentage/targeting)
3. Build-time env var (`VITE_*`)
4. Hard-coded default

## Runtime testing

Toggle flags at runtime without code changes or redeploys:

```javascript
// In browser console:
localStorage.setItem('ff:myFeature', 'true'); // enable
localStorage.setItem('ff:myFeature', 'false'); // disable
localStorage.removeItem('ff:myFeature'); // clear override
```

## Important notes

- The `satisfies Record<string, FlagDefinition<FlagType>>` on the FLAGS object ensures type safety. Always include `as const` on the `type` field.
- If a flag does not need remote rollout, set `remoteKey: undefined` explicitly (required for TypeScript narrowing).
- All flags are typed via `FlagKey` and `FlagValue<K>` - consumers get full type safety.
- The `useFeatureFlag` hook subscribes to PostHog flag changes for reactive UI updates.
- Never use raw `import.meta.env.VITE_*` checks directly - always go through the feature flag system.
