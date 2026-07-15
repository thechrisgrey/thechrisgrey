import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isFeatureEnabled,
  getFeatureFlag,
  setFeatureFlagOverride,
  getAllFeatureFlags,
  getFeatureFlagMetadata,
} from './featureFlags';

// Control the PostHog remote-flag layer without loading posthog-js. Defaults to
// `undefined` so the env/default tests below are unaffected by the remote layer.
const posthogMock = vi.hoisted(() => ({ remote: undefined as boolean | string | undefined }));
vi.mock('./posthog', () => ({
  getPostHogFeatureFlag: () => posthogMock.remote,
  subscribeToPostHogFeatureFlags: () => () => {},
}));

// jsdom in this project provides only a partial localStorage; install a complete,
// fresh Map-backed mock per test so feature flag overrides are deterministic.
function installMockLocalStorage() {
  const store = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => void store.set(k, String(v)),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
      key: (i: number) => [...store.keys()][i] ?? null,
      get length() {
        return store.size;
      },
    },
  });
}

describe('featureFlags', () => {
  beforeEach(() => {
    installMockLocalStorage();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    posthogMock.remote = undefined;
  });

  describe('isFeatureEnabled', () => {
    it('returns false for blueprint flag when env var is not set', () => {
      vi.stubEnv('VITE_BLUEPRINT_ENABLED', '');
      expect(isFeatureEnabled('blueprint')).toBe(false);
    });

    it('returns true for blueprint flag when env var is "true"', () => {
      vi.stubEnv('VITE_BLUEPRINT_ENABLED', 'true');
      expect(isFeatureEnabled('blueprint')).toBe(true);
    });

    it('returns false for blueprint flag when env var is "false"', () => {
      vi.stubEnv('VITE_BLUEPRINT_ENABLED', 'false');
      expect(isFeatureEnabled('blueprint')).toBe(false);
    });
  });

  describe('getFeatureFlag', () => {
    it('returns string flag value from env var', () => {
      vi.stubEnv('VITE_BLUEPRINT_ENDPOINT', 'https://test.example.com');
      expect(getFeatureFlag('blueprintEndpoint')).toBe('https://test.example.com');
    });

    it('returns default empty string when env var is not set', () => {
      vi.stubEnv('VITE_BLUEPRINT_ENDPOINT', '');
      expect(getFeatureFlag('blueprintEndpoint')).toBe('');
    });
  });

  describe('setFeatureFlagOverride', () => {
    it('overrides a boolean flag via localStorage', () => {
      vi.stubEnv('VITE_BLUEPRINT_ENABLED', '');
      expect(isFeatureEnabled('blueprint')).toBe(false);

      setFeatureFlagOverride('blueprint', true);
      expect(isFeatureEnabled('blueprint')).toBe(true);
    });

    it('overrides a string flag via localStorage', () => {
      setFeatureFlagOverride('blueprintEndpoint', 'https://override.example.com');
      expect(getFeatureFlag('blueprintEndpoint')).toBe('https://override.example.com');
    });

    it('clears override when null is passed', () => {
      vi.stubEnv('VITE_BLUEPRINT_ENABLED', 'false');
      setFeatureFlagOverride('blueprint', true);
      expect(isFeatureEnabled('blueprint')).toBe(true);

      setFeatureFlagOverride('blueprint', null);
      expect(isFeatureEnabled('blueprint')).toBe(false);
    });

    it('localStorage override takes priority over env var', () => {
      vi.stubEnv('VITE_BLUEPRINT_ENABLED', 'true');
      setFeatureFlagOverride('blueprint', false);
      expect(isFeatureEnabled('blueprint')).toBe(false);
    });
  });

  describe('PostHog remote layer', () => {
    it('a remote boolean flag overrides the env var', () => {
      vi.stubEnv('VITE_BLUEPRINT_ENABLED', 'false');
      posthogMock.remote = true;
      expect(isFeatureEnabled('blueprint')).toBe(true);
    });

    it('coerces a remote string "true" to a boolean flag', () => {
      vi.stubEnv('VITE_BLUEPRINT_ENABLED', '');
      posthogMock.remote = 'true';
      expect(isFeatureEnabled('blueprint')).toBe(true);
    });

    it('falls back to the env var when no remote flag is delivered', () => {
      vi.stubEnv('VITE_BLUEPRINT_ENABLED', 'true');
      posthogMock.remote = undefined;
      expect(isFeatureEnabled('blueprint')).toBe(true);
    });

    it('a localStorage override still beats the remote flag', () => {
      vi.stubEnv('VITE_BLUEPRINT_ENABLED', 'true');
      posthogMock.remote = true;
      setFeatureFlagOverride('blueprint', false);
      expect(isFeatureEnabled('blueprint')).toBe(false);
    });

    it('ignores the remote layer for flags without a remoteKey', () => {
      posthogMock.remote = 'https://remote.example.com';
      vi.stubEnv('VITE_BLUEPRINT_ENDPOINT', 'https://env.example.com');
      // blueprintEndpoint has no remoteKey, so the env value wins.
      expect(getFeatureFlag('blueprintEndpoint')).toBe('https://env.example.com');
    });
  });

  describe('getAllFeatureFlags', () => {
    it('returns a record of all flag values', () => {
      const flags = getAllFeatureFlags();
      expect(flags).toHaveProperty('blueprint');
      expect(flags).toHaveProperty('blueprintEndpoint');
      expect(typeof flags.blueprint).toBe('boolean');
      expect(typeof flags.blueprintEndpoint).toBe('string');
    });
  });

  describe('getFeatureFlagMetadata', () => {
    it('returns metadata for all flags with current values', () => {
      const metadata = getFeatureFlagMetadata();
      expect(metadata.length).toBeGreaterThanOrEqual(2);

      const blueprintFlag = metadata.find((m) => m.key === 'blueprint');
      expect(blueprintFlag).toBeDefined();
      expect(blueprintFlag?.type).toBe('boolean');
      expect(blueprintFlag?.description).toContain('blueprint');
      expect(blueprintFlag?.envVar).toBe('VITE_BLUEPRINT_ENABLED');
      expect(blueprintFlag?.remoteKey).toBe('blueprint');
      expect(typeof blueprintFlag?.currentValue).toBe('boolean');

      const endpointFlag = metadata.find((m) => m.key === 'blueprintEndpoint');
      expect(endpointFlag).toBeDefined();
      expect(endpointFlag?.type).toBe('string');
      expect(endpointFlag?.envVar).toBe('VITE_BLUEPRINT_ENDPOINT');
      expect(endpointFlag?.remoteKey).toBeUndefined();
    });
  });
});
