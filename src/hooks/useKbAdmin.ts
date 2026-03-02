import { useState, useCallback } from 'react';

const KB_BUILDER_ENDPOINT = import.meta.env.VITE_KB_BUILDER_ENDPOINT;

export interface KbEntry {
  _id: string;
  _createdAt: string;
  _updatedAt: string;
  title: string;
  category: KbCategory;
  content: string;
  date?: string;
  sortOrder?: number;
  isActive: boolean;
}

export type KbCategory =
  | 'biography'
  | 'career'
  | 'military'
  | 'education'
  | 'business'
  | 'philosophy'
  | 'podcast'
  | 'book'
  | 'skills'
  | 'awards';

export const KB_CATEGORIES: { value: KbCategory; label: string }[] = [
  { value: 'biography', label: 'Biography' },
  { value: 'career', label: 'Career' },
  { value: 'military', label: 'Military' },
  { value: 'education', label: 'Education' },
  { value: 'business', label: 'Business' },
  { value: 'philosophy', label: 'Philosophy' },
  { value: 'podcast', label: 'Podcast' },
  { value: 'book', label: 'Book' },
  { value: 'skills', label: 'Skills' },
  { value: 'awards', label: 'Awards' },
];

interface PublishResult {
  message: string;
  entryCount: number;
  documentSize: number;
  publishedAt: string;
}

export function useKbAdmin(getAccessToken: () => string | null) {
  const [entries, setEntries] = useState<KbEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authFetch = useCallback(
    async (path: string, options: RequestInit = {}) => {
      const token = getAccessToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${KB_BUILDER_ENDPOINT}${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...options.headers,
        },
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Request failed: ${response.status}`);
      }
      return data;
    },
    [getAccessToken]
  );

  const fetchEntries = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await authFetch('/entries');
      setEntries(data.entries);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch entries');
    } finally {
      setIsLoading(false);
    }
  }, [authFetch]);

  const createEntry = useCallback(
    async (entry: Omit<KbEntry, '_id' | '_createdAt' | '_updatedAt'>) => {
      setError(null);
      try {
        await authFetch('/entries', {
          method: 'POST',
          body: JSON.stringify(entry),
        });
        await fetchEntries();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create entry');
        throw err;
      }
    },
    [authFetch, fetchEntries]
  );

  const updateEntry = useCallback(
    async (id: string, updates: Partial<KbEntry>) => {
      setError(null);
      try {
        await authFetch(`/entries/${id}`, {
          method: 'PUT',
          body: JSON.stringify(updates),
        });
        await fetchEntries();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update entry');
        throw err;
      }
    },
    [authFetch, fetchEntries]
  );

  const deleteEntry = useCallback(
    async (id: string) => {
      setError(null);
      try {
        await authFetch(`/entries/${id}`, { method: 'DELETE' });
        await fetchEntries();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete entry');
        throw err;
      }
    },
    [authFetch, fetchEntries]
  );

  const publish = useCallback(async (): Promise<PublishResult> => {
    setIsPublishing(true);
    setError(null);
    try {
      const result = await authFetch('/publish', { method: 'POST' });
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish');
      throw err;
    } finally {
      setIsPublishing(false);
    }
  }, [authFetch]);

  return {
    entries,
    isLoading,
    isPublishing,
    error,
    fetchEntries,
    createEntry,
    updateEntry,
    deleteEntry,
    publish,
  };
}
