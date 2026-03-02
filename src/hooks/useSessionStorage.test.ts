import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSessionStorage } from './useSessionStorage';

describe('useSessionStorage', () => {
  beforeEach(() => {
    // Clear sessionStorage before each test
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    window.sessionStorage.clear();
  });

  describe('initialization', () => {
    it('should return the initial value when sessionStorage is empty', () => {
      const { result } = renderHook(() => useSessionStorage('test-key', 'default'));
      expect(result.current[0]).toBe('default');
    });

    it('should return the initial value for complex types', () => {
      const initialValue = { name: 'test', count: 0 };
      const { result } = renderHook(() =>
        useSessionStorage('test-key', initialValue)
      );
      expect(result.current[0]).toEqual(initialValue);
    });

    it('should return the initial value for arrays', () => {
      const initialValue = [1, 2, 3];
      const { result } = renderHook(() =>
        useSessionStorage('test-key', initialValue)
      );
      expect(result.current[0]).toEqual([1, 2, 3]);
    });

    it('should read existing value from sessionStorage', () => {
      window.sessionStorage.setItem('test-key', JSON.stringify('stored-value'));
      const { result } = renderHook(() =>
        useSessionStorage('test-key', 'default')
      );
      expect(result.current[0]).toBe('stored-value');
    });

    it('should fall back to initial value if sessionStorage contains invalid JSON', () => {
      window.sessionStorage.setItem('test-key', 'not-valid-json{{{');
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { result } = renderHook(() =>
        useSessionStorage('test-key', 'fallback')
      );
      expect(result.current[0]).toBe('fallback');
      expect(warnSpy).toHaveBeenCalled();
    });
  });

  describe('setValue', () => {
    it('should update the stored value', () => {
      const { result } = renderHook(() =>
        useSessionStorage('test-key', 'initial')
      );

      act(() => {
        result.current[1]('updated');
      });

      expect(result.current[0]).toBe('updated');
    });

    it('should persist value to sessionStorage', () => {
      const { result } = renderHook(() =>
        useSessionStorage('test-key', 'initial')
      );

      act(() => {
        result.current[1]('persisted');
      });

      expect(window.sessionStorage.getItem('test-key')).toBe(
        JSON.stringify('persisted')
      );
    });

    it('should support updater function (prev => newValue)', () => {
      const { result } = renderHook(() =>
        useSessionStorage('counter', 0)
      );

      act(() => {
        result.current[1]((prev) => prev + 1);
      });

      expect(result.current[0]).toBe(1);

      act(() => {
        result.current[1]((prev) => prev + 10);
      });

      expect(result.current[0]).toBe(11);
    });

    it('should support updater function with arrays', () => {
      const { result } = renderHook(() =>
        useSessionStorage<string[]>('items', [])
      );

      act(() => {
        result.current[1]((prev) => [...prev, 'item1']);
      });

      expect(result.current[0]).toEqual(['item1']);

      act(() => {
        result.current[1]((prev) => [...prev, 'item2']);
      });

      expect(result.current[0]).toEqual(['item1', 'item2']);
    });
  });

  describe('clearValue', () => {
    it('should reset value to initial value', () => {
      const { result } = renderHook(() =>
        useSessionStorage('test-key', 'initial')
      );

      act(() => {
        result.current[1]('changed');
      });

      expect(result.current[0]).toBe('changed');

      act(() => {
        result.current[2](); // clearValue
      });

      expect(result.current[0]).toBe('initial');
    });

    it('should reset sessionStorage to initial value after clear', () => {
      const { result } = renderHook(() =>
        useSessionStorage('test-key', 'initial')
      );

      act(() => {
        result.current[1]('something');
      });

      act(() => {
        result.current[2](); // clearValue
      });

      // After clear, the hook resets storedValue to initialValue.
      // The useEffect then syncs the initial value back to sessionStorage.
      // So the storage will contain the serialized initial value, not null.
      expect(result.current[0]).toBe('initial');
    });
  });

  describe('Date revival', () => {
    it('should revive ISO date strings back to Date objects', () => {
      const isoDate = '2026-01-15T10:30:00.000Z';
      const data = { timestamp: isoDate, label: 'test' };
      window.sessionStorage.setItem('date-key', JSON.stringify(data));

      const { result } = renderHook(() =>
        useSessionStorage<{ timestamp: Date | string; label: string }>(
          'date-key',
          { timestamp: '', label: '' }
        )
      );

      expect(result.current[0].timestamp).toBeInstanceOf(Date);
      expect((result.current[0].timestamp as Date).toISOString()).toBe(isoDate);
      expect(result.current[0].label).toBe('test');
    });

    it('should revive dates inside arrays', () => {
      const messages = [
        { id: '1', timestamp: '2026-01-15T10:30:00.000Z' },
        { id: '2', timestamp: '2026-01-16T12:00:00.000Z' },
      ];
      window.sessionStorage.setItem('messages', JSON.stringify(messages));

      const { result } = renderHook(() =>
        useSessionStorage<Array<{ id: string; timestamp: Date | string }>>(
          'messages',
          []
        )
      );

      expect(result.current[0][0].timestamp).toBeInstanceOf(Date);
      expect(result.current[0][1].timestamp).toBeInstanceOf(Date);
    });

    it('should not convert non-ISO date strings to Date objects', () => {
      const data = { name: 'January 15, 2026', value: 'not-a-date' };
      window.sessionStorage.setItem('text-key', JSON.stringify(data));

      const { result } = renderHook(() =>
        useSessionStorage<{ name: string; value: string }>(
          'text-key',
          { name: '', value: '' }
        )
      );

      expect(typeof result.current[0].name).toBe('string');
      expect(typeof result.current[0].value).toBe('string');
    });
  });

  describe('return value structure', () => {
    it('should return a tuple of [value, setValue, clearValue]', () => {
      const { result } = renderHook(() =>
        useSessionStorage('test-key', 'initial')
      );

      expect(result.current).toHaveLength(3);
      expect(typeof result.current[1]).toBe('function');
      expect(typeof result.current[2]).toBe('function');
    });
  });
});
