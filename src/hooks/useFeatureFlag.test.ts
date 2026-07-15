import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFeatureFlag, useIsFeatureEnabled, useAllFeatureFlags, setFlagOverride } from './useFeatureFlag';

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

describe('useFeatureFlag', () => {
  beforeEach(() => {
    installMockLocalStorage();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('useIsFeatureEnabled returns false by default', () => {
    vi.stubEnv('VITE_BLUEPRINT_ENABLED', '');
    const { result } = renderHook(() => useIsFeatureEnabled('blueprint'));
    expect(result.current).toBe(false);
  });

  it('useIsFeatureEnabled returns true when env var is set', () => {
    vi.stubEnv('VITE_BLUEPRINT_ENABLED', 'true');
    const { result } = renderHook(() => useIsFeatureEnabled('blueprint'));
    expect(result.current).toBe(true);
  });

  it('useFeatureFlag returns string value from env var', () => {
    vi.stubEnv('VITE_BLUEPRINT_ENDPOINT', 'https://test.example.com');
    const { result } = renderHook(() => useFeatureFlag('blueprintEndpoint'));
    expect(result.current).toBe('https://test.example.com');
  });

  it('useFeatureFlag returns default when env var is unset', () => {
    vi.stubEnv('VITE_BLUEPRINT_ENDPOINT', '');
    const { result } = renderHook(() => useFeatureFlag('blueprintEndpoint'));
    expect(result.current).toBe('');
  });

  it('useAllFeatureFlags returns all flag values', () => {
    vi.stubEnv('VITE_BLUEPRINT_ENABLED', 'true');
    vi.stubEnv('VITE_BLUEPRINT_ENDPOINT', 'https://test.example.com');
    const { result } = renderHook(() => useAllFeatureFlags());
    expect(result.current).toHaveProperty('blueprint', true);
    expect(result.current).toHaveProperty('blueprintEndpoint', 'https://test.example.com');
  });

  it('setFlagOverride triggers re-render with new value', () => {
    vi.stubEnv('VITE_BLUEPRINT_ENABLED', '');
    const { result } = renderHook(() => useIsFeatureEnabled('blueprint'));
    expect(result.current).toBe(false);

    act(() => {
      setFlagOverride('blueprint', true);
    });
    expect(result.current).toBe(true);
  });

  it('setFlagOverride with null clears override and reverts to env/default', () => {
    vi.stubEnv('VITE_BLUEPRINT_ENABLED', 'false');
    const { result } = renderHook(() => useIsFeatureEnabled('blueprint'));

    act(() => {
      setFlagOverride('blueprint', true);
    });
    expect(result.current).toBe(true);

    act(() => {
      setFlagOverride('blueprint', null);
    });
    expect(result.current).toBe(false);
  });
});
