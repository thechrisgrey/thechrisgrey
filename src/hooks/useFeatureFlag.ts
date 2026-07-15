/**
 * React hooks for consuming feature flags in components.
 *
 * Flags are resolved synchronously from env vars (build-time) or localStorage
 * overrides (runtime). Since flags don't change during a render cycle, these
 * hooks return the resolved value directly without state subscriptions.
 *
 * For runtime testing, use setFeatureFlagOverride() to toggle flags via
 * localStorage, then navigate/reload to see the effect.
 *
 * Usage:
 *   const isEnabled = useIsFeatureEnabled('blueprint');
 *   const endpoint = useFeatureFlag('blueprintEndpoint');
 */

import { useSyncExternalStore } from 'react';
import {
  isFeatureEnabled,
  getFeatureFlag,
  setFeatureFlagOverride,
  getAllFeatureFlags,
  type FlagKey,
  type FlagValue,
} from '../utils/featureFlags';
import { subscribeToPostHogFeatureFlags } from '../utils/posthog';

// Lightweight pub/sub so components re-render when an override is set.
const listeners = new Set<() => void>();

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function notifyListeners(): void {
  listeners.forEach((cb) => cb());
}

// When PostHog delivers/updates remote flags (percentage rollouts, targeting),
// rebuild the snapshot cache and re-render subscribed components so a remote
// rollout takes effect live, without a redeploy or manual reload.
subscribeToPostHogFeatureFlags(() => {
  rebuildAllFlagsCache();
  notifyListeners();
});

const originalSetOverride = setFeatureFlagOverride;

/**
 * Set a runtime override for a feature flag and notify subscribed components.
 * Pass `null` to clear the override and fall back to env/default.
 */
export function setFlagOverride<K extends FlagKey>(flagKey: K, value: FlagValue<K> | null): void {
  originalSetOverride(flagKey, value);
  rebuildAllFlagsCache();
  notifyListeners();
}

/**
 * React hook that returns the value of a feature flag.
 * Re-renders when an override is set via setFlagOverride().
 */
export function useFeatureFlag<K extends FlagKey>(flagKey: K): FlagValue<K> {
  return useSyncExternalStore(
    subscribe,
    () => getFeatureFlag(flagKey),
    () => getFeatureFlag(flagKey),
  );
}

/**
 * React hook that returns whether a boolean feature flag is enabled.
 * Re-renders when an override is set via setFlagOverride().
 */
export function useIsFeatureEnabled(flagKey: FlagKey): boolean {
  return useSyncExternalStore(
    subscribe,
    () => isFeatureEnabled(flagKey),
    () => isFeatureEnabled(flagKey),
  );
}

// Cached snapshot for useAllFeatureFlags — useSyncExternalStore requires a
// stable reference between renders when nothing changed, so we rebuild the
// snapshot only when an override changes.
let allFlagsCache: Record<string, boolean | string | number> | null = null;

function getAllFlagsSnapshot(): Record<string, boolean | string | number> {
  if (allFlagsCache === null) {
    allFlagsCache = getAllFeatureFlags();
  }
  return allFlagsCache;
}

function rebuildAllFlagsCache(): void {
  allFlagsCache = getAllFeatureFlags();
}

/**
 * React hook that returns all feature flag values (for admin/debug display).
 * Re-renders when any override is set via setFlagOverride().
 */
export function useAllFeatureFlags(): Record<string, boolean | string | number> {
  return useSyncExternalStore(subscribe, getAllFlagsSnapshot, getAllFlagsSnapshot);
}

export { setFeatureFlagOverride };
