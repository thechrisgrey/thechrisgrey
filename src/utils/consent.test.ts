import { describe, it, expect, beforeEach } from 'vitest';
import { getConsent, setConsent, clearConsent } from './consent';

// jsdom in this project provides only a partial localStorage; install a complete,
// fresh Map-backed mock per test so consent persistence is deterministic.
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

describe('consent', () => {
  beforeEach(() => installMockLocalStorage());

  it('returns null when no choice has been stored', () => {
    expect(getConsent()).toBeNull();
  });

  it('persists and reads "granted"', () => {
    setConsent('granted');
    expect(getConsent()).toBe('granted');
  });

  it('persists and reads "denied"', () => {
    setConsent('denied');
    expect(getConsent()).toBe('denied');
  });

  it('clearConsent removes the stored choice', () => {
    setConsent('granted');
    clearConsent();
    expect(getConsent()).toBeNull();
  });

  it('treats any unrecognized stored value as no choice', () => {
    localStorage.setItem('tcg-analytics-consent', 'maybe');
    expect(getConsent()).toBeNull();
  });
});
