import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useKbAdmin, KB_CATEGORIES } from './useKbAdmin';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useKbAdmin', () => {
  const mockGetAccessToken = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAccessToken.mockResolvedValue('test-token');
  });

  it('should initialize with empty entries and no loading/error state', () => {
    const { result } = renderHook(() => useKbAdmin(mockGetAccessToken));

    expect(result.current.entries).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isPublishing).toBe(false);
    expect(result.current.error).toBeNull();
  });

  describe('KB_CATEGORIES', () => {
    it('should have exactly 10 categories', () => {
      expect(KB_CATEGORIES).toHaveLength(10);
    });

    it('should have value and label for each category', () => {
      KB_CATEGORIES.forEach((cat) => {
        expect(cat.value).toBeTruthy();
        expect(cat.label).toBeTruthy();
      });
    });
  });

  describe('fetchEntries', () => {
    it('should fetch and set entries on success', async () => {
      const mockEntries = [
        { _id: '1', title: 'Entry 1', category: 'biography', content: 'content', isActive: true },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ entries: mockEntries }),
      });

      const { result } = renderHook(() => useKbAdmin(mockGetAccessToken));

      await act(async () => {
        await result.current.fetchEntries();
      });

      expect(result.current.entries).toEqual(mockEntries);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should set error when fetch fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Server error' }),
      });

      const { result } = renderHook(() => useKbAdmin(mockGetAccessToken));

      await act(async () => {
        await result.current.fetchEntries();
      });

      expect(result.current.error).toBe('Server error');
      expect(result.current.isLoading).toBe(false);
    });

    it('should set error when not authenticated', async () => {
      mockGetAccessToken.mockResolvedValueOnce(null);

      const { result } = renderHook(() => useKbAdmin(mockGetAccessToken));

      await act(async () => {
        await result.current.fetchEntries();
      });

      expect(result.current.error).toBe('Not authenticated');
    });
  });

  describe('createEntry', () => {
    it('should POST a new entry and refresh the list', async () => {
      // First call: POST to /entries
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'new-1' }),
      });
      // Second call: GET /entries (refresh)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ entries: [] }),
      });

      const { result } = renderHook(() => useKbAdmin(mockGetAccessToken));

      await act(async () => {
        await result.current.createEntry({
          title: 'New Entry',
          category: 'biography',
          content: 'Some content',
          isActive: true,
        });
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
      const firstCall = mockFetch.mock.calls[0];
      expect(firstCall[1].method).toBe('POST');
    });

    it('should set error and re-throw when creation fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'Validation error' }),
      });

      const { result } = renderHook(() => useKbAdmin(mockGetAccessToken));

      let thrownError: Error | undefined;
      await act(async () => {
        try {
          await result.current.createEntry({
            title: '',
            category: 'biography',
            content: '',
            isActive: true,
          });
        } catch (e) {
          thrownError = e as Error;
        }
      });

      expect(thrownError?.message).toBe('Validation error');
      expect(result.current.error).toBe('Validation error');
    });
  });

  describe('updateEntry', () => {
    it('should PUT updates and refresh the list', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ entries: [] }),
      });

      const { result } = renderHook(() => useKbAdmin(mockGetAccessToken));

      await act(async () => {
        await result.current.updateEntry('entry-1', { title: 'Updated Title' });
      });

      const firstCall = mockFetch.mock.calls[0];
      expect(firstCall[1].method).toBe('PUT');
      expect(firstCall[0]).toContain('/entries/entry-1');
    });

    it('should set error and re-throw on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Not found' }),
      });

      const { result } = renderHook(() => useKbAdmin(mockGetAccessToken));

      let thrownError: Error | undefined;
      await act(async () => {
        try {
          await result.current.updateEntry('nonexistent', { title: 'test' });
        } catch (e) {
          thrownError = e as Error;
        }
      });

      expect(thrownError?.message).toBe('Not found');
      expect(result.current.error).toBe('Not found');
    });
  });

  describe('deleteEntry', () => {
    it('should DELETE and refresh the list', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ entries: [] }),
      });

      const { result } = renderHook(() => useKbAdmin(mockGetAccessToken));

      await act(async () => {
        await result.current.deleteEntry('entry-1');
      });

      const firstCall = mockFetch.mock.calls[0];
      expect(firstCall[1].method).toBe('DELETE');
    });
  });

  describe('publish', () => {
    it('should POST to /publish and return result', async () => {
      const publishResult = {
        message: 'Published',
        entryCount: 5,
        documentSize: 1024,
        publishedAt: '2026-01-01T00:00:00Z',
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(publishResult),
      });

      const { result } = renderHook(() => useKbAdmin(mockGetAccessToken));

      let returnValue: unknown;
      await act(async () => {
        returnValue = await result.current.publish();
      });

      expect(returnValue).toEqual(publishResult);
      expect(result.current.isPublishing).toBe(false);
    });

    it('should set isPublishing during publish', async () => {
      let resolvePromise: (value: unknown) => void;
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      mockFetch.mockReturnValueOnce(
        pendingPromise.then(() => ({
          ok: true,
          json: () => Promise.resolve({ message: 'Done', entryCount: 1, documentSize: 100, publishedAt: 'now' }),
        }))
      );

      const { result } = renderHook(() => useKbAdmin(mockGetAccessToken));

      let publishPromise: Promise<unknown>;
      act(() => {
        publishPromise = result.current.publish();
      });

      // isPublishing should be true while in flight
      expect(result.current.isPublishing).toBe(true);

      await act(async () => {
        resolvePromise!(undefined);
        await publishPromise!;
      });

      expect(result.current.isPublishing).toBe(false);
    });

    it('should set error and re-throw on publish failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Publish failed' }),
      });

      const { result } = renderHook(() => useKbAdmin(mockGetAccessToken));

      let thrownError: Error | undefined;
      await act(async () => {
        try {
          await result.current.publish();
        } catch (e) {
          thrownError = e as Error;
        }
      });

      expect(thrownError?.message).toBe('Publish failed');
      expect(result.current.error).toBe('Publish failed');
      expect(result.current.isPublishing).toBe(false);
    });
  });
});
