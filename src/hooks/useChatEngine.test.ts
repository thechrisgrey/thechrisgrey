import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useChatEngine,
  CHAT_STORAGE_KEY,
  initialWelcomeMessage,
} from './useChatEngine';
import type { Message } from './useChatEngine';

// Mock import.meta.env
vi.stubEnv('VITE_CHAT_ENDPOINT', 'https://test-chat-endpoint.example.com');

// Mock signing so tests don't depend on crypto.subtle or VITE_CHAT_SIGNING_KEY
vi.mock('../utils/chatSigning', () => ({
  getSignedHeaders: vi.fn().mockResolvedValue({}),
}));

describe('useChatEngine', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  describe('exports', () => {
    it('should export CHAT_STORAGE_KEY as "chat-messages"', () => {
      expect(CHAT_STORAGE_KEY).toBe('chat-messages');
    });

    it('should export initialWelcomeMessage with correct structure', () => {
      expect(initialWelcomeMessage).toHaveProperty('id', 'welcome');
      expect(initialWelcomeMessage).toHaveProperty('role', 'assistant');
      expect(initialWelcomeMessage).toHaveProperty('content');
      expect(initialWelcomeMessage).toHaveProperty('timestamp');
      expect(initialWelcomeMessage.content.length).toBeGreaterThan(0);
    });
  });

  describe('initial state', () => {
    it('should start with the welcome message in messages', () => {
      const { result } = renderHook(() => useChatEngine());
      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].id).toBe('welcome');
      expect(result.current.messages[0].role).toBe('assistant');
    });

    it('should have isTyping as false initially', () => {
      const { result } = renderHook(() => useChatEngine());
      expect(result.current.isTyping).toBe(false);
    });

    it('should have isStreaming as false initially', () => {
      const { result } = renderHook(() => useChatEngine());
      expect(result.current.isStreaming).toBe(false);
    });

    it('should have showSuggestions as true initially', () => {
      const { result } = renderHook(() => useChatEngine());
      expect(result.current.showSuggestions).toBe(true);
    });

    it('should have hasUserMessages as false initially', () => {
      const { result } = renderHook(() => useChatEngine());
      expect(result.current.hasUserMessages).toBe(false);
    });

    it('should provide a messagesContainerRef', () => {
      const { result } = renderHook(() => useChatEngine());
      expect(result.current.messagesContainerRef).toBeDefined();
      expect(result.current.messagesContainerRef.current).toBeNull();
    });
  });

  describe('handleClearConversation', () => {
    it('should reset messages to initial welcome message', () => {
      const { result } = renderHook(() => useChatEngine());

      // Simulate having messages by directly calling clear
      act(() => {
        result.current.handleClearConversation();
      });

      // After clear, the messages array should be the default (welcome message)
      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].id).toBe('welcome');
    });

    it('should remove messages from sessionStorage', () => {
      const { result } = renderHook(() => useChatEngine());

      act(() => {
        result.current.handleClearConversation();
      });

      expect(window.sessionStorage.getItem(CHAT_STORAGE_KEY)).toBeNull();
    });
  });

  describe('handleSend', () => {
    it('should add a user message to the messages array', async () => {
      // Mock fetch to return an empty readable stream
      const mockReader = {
        read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
      };
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          body: { getReader: () => mockReader },
        })
      );

      const { result } = renderHook(() => useChatEngine());

      await act(async () => {
        await result.current.handleSend('Hello there');
      });

      const userMessages = result.current.messages.filter(
        (m: Message) => m.role === 'user'
      );
      expect(userMessages).toHaveLength(1);
      expect(userMessages[0].content).toBe('Hello there');
    });

    it('should set isTyping to true while waiting for response', async () => {
      // Create a fetch that never resolves immediately
      let resolveFetch: (value: unknown) => void;
      const fetchPromise = new Promise((resolve) => {
        resolveFetch = resolve;
      });
      vi.stubGlobal('fetch', vi.fn().mockReturnValue(fetchPromise));

      const { result } = renderHook(() => useChatEngine());

      // Start sending without awaiting
      act(() => {
        result.current.handleSend('Hello');
      });

      // isTyping should be true while waiting
      expect(result.current.isTyping).toBe(true);

      // Clean up by resolving
      await act(async () => {
        resolveFetch!({
          ok: true,
          body: {
            getReader: () => ({
              read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
            }),
          },
        });
      });
    });

    it('should call fetch with the correct request shape and body', async () => {
      const mockReader = {
        read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
      };
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        body: { getReader: () => mockReader },
      });
      vi.stubGlobal('fetch', mockFetch);

      const { result } = renderHook(() => useChatEngine());

      await act(async () => {
        await result.current.handleSend('Test message');
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Verify the request shape (method, headers, signal)
      const [, options] = mockFetch.mock.calls[0];
      expect(options.method).toBe('POST');
      expect(options.headers).toEqual({ 'Content-Type': 'application/json' });
      expect(options.signal).toBeInstanceOf(AbortSignal);

      // Verify the body includes the user message
      const callBody = JSON.parse(options.body);
      expect(callBody.messages).toBeDefined();
      expect(Array.isArray(callBody.messages)).toBe(true);
      const lastMessage = callBody.messages[callBody.messages.length - 1];
      expect(lastMessage.role).toBe('user');
      expect(lastMessage.content).toBe('Test message');
    });

    it('should handle fetch errors gracefully', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockRejectedValue(new Error('Network error'))
      );
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useChatEngine());

      await act(async () => {
        await result.current.handleSend('Hello');
      });

      // Should have added an error message
      const assistantMessages = result.current.messages.filter(
        (m: Message) => m.role === 'assistant' && m.id !== 'welcome'
      );
      expect(assistantMessages).toHaveLength(1);
      expect(assistantMessages[0].content).toContain('error');
      expect(result.current.isTyping).toBe(false);
      expect(result.current.isStreaming).toBe(false);

      errorSpy.mockRestore();
    });

    it('should handle non-ok response', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: false, status: 500 })
      );
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useChatEngine());

      await act(async () => {
        await result.current.handleSend('Hello');
      });

      const assistantMessages = result.current.messages.filter(
        (m: Message) => m.role === 'assistant' && m.id !== 'welcome'
      );
      expect(assistantMessages).toHaveLength(1);
      expect(assistantMessages[0].content).toContain('error');

      errorSpy.mockRestore();
    });

    it('should handle streaming response chunks', async () => {
      const encoder = new TextEncoder();
      let callCount = 0;
      const mockReader = {
        read: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve({
              done: false,
              value: encoder.encode('Hello '),
            });
          }
          if (callCount === 2) {
            return Promise.resolve({
              done: false,
              value: encoder.encode('World'),
            });
          }
          return Promise.resolve({ done: true, value: undefined });
        }),
      };

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          body: { getReader: () => mockReader },
        })
      );

      const { result } = renderHook(() => useChatEngine());

      await act(async () => {
        await result.current.handleSend('Hi');
      });

      // Find the assistant response (not the welcome message)
      const assistantMessages = result.current.messages.filter(
        (m: Message) => m.role === 'assistant' && m.id !== 'welcome'
      );
      expect(assistantMessages).toHaveLength(1);
      expect(assistantMessages[0].content).toBe('Hello World');
    });

    it('should handle empty stream', async () => {
      const mockReader = {
        read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
      };
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          body: { getReader: () => mockReader },
        })
      );

      const { result } = renderHook(() => useChatEngine());

      await act(async () => {
        await result.current.handleSend('Hello');
      });

      // Should add an "empty response" message
      const assistantMessages = result.current.messages.filter(
        (m: Message) => m.role === 'assistant' && m.id !== 'welcome'
      );
      expect(assistantMessages).toHaveLength(1);
      expect(assistantMessages[0].content).toContain('empty response');
    });
  });

  describe('handleSuggestionSelect', () => {
    it('should call handleSend with the suggestion text', async () => {
      const mockReader = {
        read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
      };
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          body: { getReader: () => mockReader },
        })
      );

      const { result } = renderHook(() => useChatEngine());

      await act(async () => {
        await result.current.handleSuggestionSelect('Test suggestion');
      });

      const userMessages = result.current.messages.filter(
        (m: Message) => m.role === 'user'
      );
      expect(userMessages).toHaveLength(1);
      expect(userMessages[0].content).toBe('Test suggestion');
    });
  });

  describe('showSuggestions', () => {
    it('should be false after a user message is sent', async () => {
      const mockReader = {
        read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
      };
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          body: { getReader: () => mockReader },
        })
      );

      const { result } = renderHook(() => useChatEngine());

      await act(async () => {
        await result.current.handleSend('Hello');
      });

      expect(result.current.showSuggestions).toBe(false);
      expect(result.current.hasUserMessages).toBe(true);
    });
  });

  describe('session persistence', () => {
    it('should restore messages from sessionStorage', () => {
      const existingMessages: Message[] = [
        {
          id: 'welcome',
          role: 'assistant',
          content: 'Welcome',
          timestamp: new Date('2026-01-01T00:00:00.000Z'),
        },
        {
          id: 'user-1',
          role: 'user',
          content: 'Hello',
          timestamp: new Date('2026-01-01T00:01:00.000Z'),
        },
      ];
      window.sessionStorage.setItem(
        CHAT_STORAGE_KEY,
        JSON.stringify(existingMessages)
      );

      const { result } = renderHook(() => useChatEngine());

      expect(result.current.messages).toHaveLength(2);
      expect(result.current.hasUserMessages).toBe(true);
      expect(result.current.showSuggestions).toBe(false);
    });
  });
});
