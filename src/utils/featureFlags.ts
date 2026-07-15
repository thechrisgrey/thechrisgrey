/**
 * Centralized feature flag system.
 *
 * Replaces scattered `import.meta.env.VITE_*` boolean checks with a single
 * registry of typed feature flags. Each flag has:
 *  - A key (string identifier)
 *  - A type (boolean | string | number)
 *  - A default value
 *  - An env var source (optional VITE_* variable)
 *
 * Resolution order (highest priority first):
 *  1. localStorage override (`ff:<flagKey>`) — per-device testing in any env
 *  2. PostHog remote flag (`remoteKey`) — server-controlled rollouts (percentage
 *     rollout / targeting) that take effect without a redeploy, once the visitor
 *     has consented and PostHog has delivered flags
 *  3. Build-time env var (`VITE_*`)
 *  4. Hard-coded default
 *
 * Runtime overrides: flags can be toggled at runtime via localStorage with the
 * key `ff:<flagKey>`. This enables testing features in staging/production
 * without code changes or redeploys. Boolean overrides use "true"/"false"
 * strings; string/number overrides use the raw value.
 *
 * Usage:
 *   import { isFeatureEnabled, getFeatureFlag } from '../utils/featureFlags';
 *
 *   if (isFeatureEnabled('blueprint')) { ... }
 *   const endpoint = getFeatureFlag('blueprintEndpoint');
 *
 * In React components:
 *   const enabled = useFeatureFlag('blueprint');
 */

import { getPostHogFeatureFlag } from './posthog';

export type FlagType = 'boolean' | 'string' | 'number';

interface FlagDefinition<T extends FlagType> {
  key: string;
  type: T;
  description: string;
  envVar?: string;
  /**
   * PostHog feature-flag key. When set and PostHog has delivered flags, the
   * remote value takes precedence over the env var (but not over a localStorage
   * override), enabling percentage rollouts / targeting without a redeploy.
   */
  remoteKey?: string;
  defaultValue: ValueType<T>;
}

type ValueType<T extends FlagType> = T extends 'boolean'
  ? boolean
  : T extends 'string'
    ? string
    : T extends 'number'
      ? number
      : never;

type FlagValueMap = {
  [K in keyof typeof FLAGS]: ValueType<(typeof FLAGS)[K]['type']>;
};

const FLAGS = {
  blueprint: {
    key: 'blueprint',
    type: 'boolean' as const,
    description: 'Enable the architecture blueprint generator at /blueprint',
    envVar: 'VITE_BLUEPRINT_ENABLED',
    remoteKey: 'blueprint',
    defaultValue: false,
  },
  blueprintEndpoint: {
    key: 'blueprintEndpoint',
    type: 'string' as const,
    description: 'Blueprint Lambda endpoint URL',
    envVar: 'VITE_BLUEPRINT_ENDPOINT',
    remoteKey: undefined,
    defaultValue: '',
  },
} satisfies Record<string, FlagDefinition<FlagType>>;

export type FlagKey = keyof typeof FLAGS;
export type FlagValue<K extends FlagKey> = FlagValueMap[K];

const OVERRIDE_PREFIX = 'ff:';

function safeGetStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) return globalThis.localStorage;
    return null;
  } catch {
    return null;
  }
}

function parseOverride(value: string | null, type: FlagType): boolean | string | number | null {
  if (value === null) return null;
  if (type === 'boolean') return value === 'true';
  if (type === 'number') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return value;
}

function readEnvVar(envVar: string | undefined): string | undefined {
  if (!envVar) return undefined;
  return import.meta.env[envVar] as string | undefined;
}

function resolveFlag<K extends FlagKey>(flagKey: K): FlagValue<K> {
  const def = FLAGS[flagKey];
  const storage = safeGetStorage();

  // 1. Check localStorage override (highest priority)
  if (storage) {
    const override = parseOverride(storage.getItem(`${OVERRIDE_PREFIX}${def.key}`), def.type);
    if (override !== null) return override as FlagValue<K>;
  }

  // 2. Check PostHog remote flag (server-controlled rollout). Undefined until
  // PostHog is enabled and flags have loaded, so we fall through otherwise.
  if (def.remoteKey) {
    const remote = getPostHogFeatureFlag(def.remoteKey);
    if (remote !== undefined) {
      const type: FlagType = def.type;
      if (type === 'boolean') return (remote === true || remote === 'true') as FlagValue<K>;
      if (type === 'number') {
        const n = Number(remote);
        if (Number.isFinite(n)) return n as FlagValue<K>;
      }
      return String(remote) as FlagValue<K>;
    }
  }

  // 3. Check env var
  const envValue = readEnvVar(def.envVar);
  if (envValue !== undefined && envValue !== '') {
    if (def.type === 'boolean') return (envValue === 'true') as FlagValue<K>;
    if ((def.type as FlagType) === 'number') {
      const n = Number(envValue);
      if (Number.isFinite(n)) return n as FlagValue<K>;
    }
    return envValue as FlagValue<K>;
  }

  // 4. Fall back to default
  return def.defaultValue as FlagValue<K>;
}

/**
 * Check if a boolean feature flag is enabled.
 * @param flagKey - The flag key (e.g. 'blueprint')
 * @returns true if the flag is enabled
 */
export function isFeatureEnabled<K extends FlagKey>(flagKey: K): boolean {
  const value = resolveFlag(flagKey);
  return typeof value === 'boolean' ? value : Boolean(value);
}

/**
 * Get the value of any feature flag (boolean, string, or number).
 * @param flagKey - The flag key
 * @returns The flag value with proper typing
 */
export function getFeatureFlag<K extends FlagKey>(flagKey: K): FlagValue<K> {
  return resolveFlag(flagKey);
}

/**
 * Set a runtime override for a feature flag via localStorage.
 * Pass `null` to clear the override and fall back to env/default.
 * @param flagKey - The flag key
 * @param value - The override value, or null to clear
 */
export function setFeatureFlagOverride<K extends FlagKey>(flagKey: K, value: FlagValue<K> | null): void {
  const storage = safeGetStorage();
  if (!storage) return;
  const storageKey = `${OVERRIDE_PREFIX}${FLAGS[flagKey].key}`;
  if (value === null) {
    storage.removeItem(storageKey);
  } else {
    storage.setItem(storageKey, String(value));
  }
}

/**
 * Get all feature flag values (for debugging/admin display).
 * @returns A record of flag keys to their current resolved values
 */
export function getAllFeatureFlags(): Record<string, boolean | string | number> {
  const result: Record<string, boolean | string | number> = {};
  for (const key of Object.keys(FLAGS) as FlagKey[]) {
    result[key] = resolveFlag(key);
  }
  return result;
}

/**
 * Get metadata for all feature flags (for admin UI display).
 * @returns Array of flag definitions with current values
 */
export function getFeatureFlagMetadata(): Array<{
  key: string;
  description: string;
  type: FlagType;
  envVar: string | undefined;
  remoteKey: string | undefined;
  defaultValue: boolean | string | number;
  currentValue: boolean | string | number;
}> {
  return (Object.keys(FLAGS) as FlagKey[]).map((key) => {
    const def = FLAGS[key];
    return {
      key: def.key,
      description: def.description,
      type: def.type,
      envVar: def.envVar,
      remoteKey: def.remoteKey,
      defaultValue: def.defaultValue,
      currentValue: resolveFlag(key),
    };
  });
}
