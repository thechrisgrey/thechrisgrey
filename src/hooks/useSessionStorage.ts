import { useState, useCallback, useEffect } from 'react';
import { createLogger } from '../utils/logger';

const log = createLogger('SessionStorage');

/**
 * Custom hook for managing state persisted in sessionStorage.
 * Handles JSON serialization with Date revival for timestamp fields.
 * SSR-safe - checks for window before accessing sessionStorage.
 */
export function useSessionStorage<T>(
  key: string,
  initialValue: T,
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  // Initialize state from sessionStorage or use initial value
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }

    try {
      const item = window.sessionStorage.getItem(key);
      if (item) {
        return JSON.parse(item, dateReviver);
      }
      return initialValue;
    } catch (error) {
      log.warn('read_failed', { key, error: error instanceof Error ? error.message : String(error) });
      return initialValue;
    }
  });

  // Sync to sessionStorage whenever value changes
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.sessionStorage.setItem(key, JSON.stringify(storedValue));
    } catch (error) {
      log.warn('write_failed', { key, error: error instanceof Error ? error.message : String(error) });
    }
  }, [key, storedValue]);

  // Setter that handles both direct values and updater functions
  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    setStoredValue((prev) => {
      const nextValue = value instanceof Function ? value(prev) : value;
      return nextValue;
    });
  }, []);

  // Clear function to reset to initial value and remove from storage
  const clearValue = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(key);
    }
    setStoredValue(initialValue);
  }, [key, initialValue]);

  return [storedValue, setValue, clearValue];
}

/**
 * JSON reviver function that converts ISO date strings back to Date objects.
 * Handles timestamp fields commonly used in chat messages.
 */
function dateReviver(_key: string, value: unknown): unknown {
  if (typeof value === 'string') {
    // ISO 8601 date format regex
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
    if (isoDateRegex.test(value)) {
      return new Date(value);
    }
  }
  return value;
}
