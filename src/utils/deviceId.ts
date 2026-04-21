const STORAGE_KEY = 'alti-device-id';
const DEVICE_ID_PATTERN = /^[a-zA-Z0-9_-]{8,64}$/;

function generateDeviceId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function safeGetStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getOrCreateDeviceId(): string | null {
  const storage = safeGetStorage();
  if (!storage) return null;

  try {
    const existing = storage.getItem(STORAGE_KEY);
    if (existing && DEVICE_ID_PATTERN.test(existing)) {
      return existing;
    }
    const fresh = generateDeviceId();
    storage.setItem(STORAGE_KEY, fresh);
    return fresh;
  } catch {
    return null;
  }
}

export function clearDeviceId(): void {
  const storage = safeGetStorage();
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export const DEVICE_ID_STORAGE_KEY = STORAGE_KEY;
