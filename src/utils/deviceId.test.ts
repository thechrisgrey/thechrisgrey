import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import {
  getOrCreateDeviceId,
  clearDeviceId,
  DEVICE_ID_STORAGE_KEY,
} from './deviceId';

class MemStorage implements Storage {
  private store = new Map<string, string>();
  get length() { return this.store.size; }
  clear() { this.store.clear(); }
  getItem(k: string) { return this.store.has(k) ? this.store.get(k)! : null; }
  key(i: number) { return Array.from(this.store.keys())[i] ?? null; }
  removeItem(k: string) { this.store.delete(k); }
  setItem(k: string, v: string) { this.store.set(k, String(v)); }
}

describe('deviceId', () => {
  beforeAll(() => {
    if (typeof window.localStorage?.setItem !== 'function') {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        value: new MemStorage(),
      });
    }
  });

  beforeEach(() => {
    window.localStorage.removeItem(DEVICE_ID_STORAGE_KEY);
    vi.restoreAllMocks();
  });

  it('generates a new device id when none exists', () => {
    const id = getOrCreateDeviceId();
    expect(id).toMatch(/^[a-zA-Z0-9_-]{8,64}$/);
    expect(window.localStorage.getItem(DEVICE_ID_STORAGE_KEY)).toBe(id);
  });

  it('returns existing valid device id', () => {
    window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, 'abc12345-valid-id');
    expect(getOrCreateDeviceId()).toBe('abc12345-valid-id');
  });

  it('regenerates when stored id is malformed', () => {
    window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, 'bad id with spaces!');
    const id = getOrCreateDeviceId();
    expect(id).toMatch(/^[a-zA-Z0-9_-]{8,64}$/);
    expect(id).not.toBe('bad id with spaces!');
  });

  it('clearDeviceId removes the stored id', () => {
    getOrCreateDeviceId();
    clearDeviceId();
    expect(window.localStorage.getItem(DEVICE_ID_STORAGE_KEY)).toBeNull();
  });

  it('returns null when localStorage throws', () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');
    const throwingStorage: Storage = {
      length: 0,
      clear: () => {},
      getItem: () => { throw new Error('quota'); },
      key: () => null,
      removeItem: () => {},
      setItem: () => { throw new Error('quota'); },
    };
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: throwingStorage,
    });
    try {
      expect(getOrCreateDeviceId()).toBeNull();
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(window, 'localStorage', originalDescriptor);
      }
    }
  });
});
