import { useState, useRef, useEffect, useCallback } from 'react';
import { useSessionStorage } from './useSessionStorage';
import type { PageContext } from '../utils/pageContext';
import { getSignedHeaders } from '../utils/chatSigning';
import { getOrCreateDeviceId, clearDeviceId } from '../utils/deviceId';
import { createChatStreamParser, type DraftAction, type ChatEvent } from '../utils/chatEvents';

const MAX_HISTORY = 20;

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isSystem?: boolean;
  drafts?: DraftAction[];
  toolActivity?: { tool: string; status: 'invoked' | 'complete' }[];
  memoryEvent?: { action: 'remembered' | 'forgotten'; content?: string };
}

const CHAT_ENDPOINT = import.meta.env.VITE_CHAT_ENDPOINT;
export const CHAT_STORAGE_KEY = 'chat-messages';

export const initialWelcomeMessage: Message = {
  id: 'welcome',
  role: 'assistant',
  content:
    "Hey there, I'm Alti\u2122, Altivum's official AI Agent and friend of Christian's. Feel free to ask about his background, Altivum\u00AE Inc, The Vector Podcast, or his book \"Beyond the Assessment.\" What would you like to know?",
  timestamp: new Date(),
};

function applyEventToMessage(msg: Message, event: ChatEvent): Message {
  switch (event.kind) {
    case 'draft_action': {
      const drafts = msg.drafts ? [...msg.drafts, event] : [event];
      return { ...msg, drafts };
    }
    case 'tool_invocation': {
      const toolActivity = msg.toolActivity ? [...msg.toolActivity] : [];
      toolActivity.push({ tool: event.tool, status: 'invoked' });
      return { ...msg, toolActivity };
    }
    case 'tool_result': {
      const toolActivity = msg.toolActivity ? [...msg.toolActivity] : [];
      const lastIdx = [...toolActivity].reverse().findIndex((t) => t.tool === event.tool && t.status === 'invoked');
      if (lastIdx !== -1) {
        const forwardIdx = toolActivity.length - 1 - lastIdx;
        toolActivity[forwardIdx] = { tool: event.tool, status: 'complete' };
      } else {
        toolActivity.push({ tool: event.tool, status: 'complete' });
      }
      return { ...msg, toolActivity };
    }
    case 'memory_update':
      return { ...msg, memoryEvent: { action: event.action, content: event.content } };
    case 'guardrail':
      return msg;
    default:
      return msg;
  }
}

export function useChatEngine(pageContext?: PageContext) {
  const [messages, setMessages, clearMessages] = useSessionStorage<Message[]>(
    CHAT_STORAGE_KEY,
    [initialWelcomeMessage]
  );
  const [isTyping, setIsTyping] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamingMessageIdRef = useRef<string | null>(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  useEffect(() => {
    sessionStorage.removeItem('chat-typing');
  }, []);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const hasUserMessages = messages.some((m) => m.role === 'user');
  const showSuggestions = !hasUserMessages;

  const handleClearConversation = useCallback(() => {
    clearMessages();
  }, [clearMessages]);

  const scrollToBottom = useCallback(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

  const handleSend = useCallback(
    async (content: string) => {
      abortControllerRef.current?.abort();

      const controller = new AbortController();
      abortControllerRef.current = controller;
      const timeoutId = setTimeout(() => controller.abort(), 30_000);

      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: 'user',
        content,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsTyping(true);

      const allMessages = [
        ...messagesRef.current.filter((m) => m.id !== 'welcome'),
        userMessage,
      ];
      const windowed = allMessages.length > MAX_HISTORY
        ? allMessages.slice(allMessages.length - MAX_HISTORY)
        : allMessages;
      const conversationHistory = windowed.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      const assistantMessageId = `assistant-${Date.now()}`;
      streamingMessageIdRef.current = assistantMessageId;
      setIsStreaming(true);

      const deviceId = getOrCreateDeviceId();

      try {
        const requestBody = JSON.stringify({
          messages: conversationHistory,
          ...(deviceId && { deviceId }),
          ...(pageContext && {
            pageContext: {
              currentPage: pageContext.currentPage,
              pageTitle: pageContext.pageTitle,
              section: pageContext.section,
              visitedPages: pageContext.visitedPages,
            },
          }),
        });
        const signedHeaders = await getSignedHeaders(requestBody);

        const response = await fetch(CHAT_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...signedHeaders },
          body: requestBody,
          signal: controller.signal,
        });

        if (!response.ok) throw new Error('Failed to get response');

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        const parser = createChatStreamParser();

        const ensureMessage = () => {
          setMessages((prev) => {
            if (prev.some((m) => m.id === assistantMessageId)) return prev;
            return [
              ...prev,
              {
                id: assistantMessageId,
                role: 'assistant' as const,
                content: '',
                timestamp: new Date(),
              },
            ];
          });
        };

        const applyText = (text: string, isSystem: boolean) => {
          setMessages((prev) => {
            const idx = prev.findIndex((m) => m.id === assistantMessageId);
            if (idx === -1) {
              return [
                ...prev,
                {
                  id: assistantMessageId,
                  role: 'assistant' as const,
                  content: text,
                  timestamp: new Date(),
                  ...(isSystem && { isSystem: true }),
                },
              ];
            }
            const existing = prev[idx];
            const merged: Message = isSystem
              ? { ...existing, content: text, isSystem: true }
              : { ...existing, content: existing.content + text };
            return [...prev.slice(0, idx), merged, ...prev.slice(idx + 1)];
          });
        };

        const applyEvent = (event: ChatEvent) => {
          setMessages((prev) => {
            const idx = prev.findIndex((m) => m.id === assistantMessageId);
            if (idx === -1) return prev;
            const updated = applyEventToMessage(prev[idx], event);
            return [...prev.slice(0, idx), updated, ...prev.slice(idx + 1)];
          });
        };

        if (reader) {
          let done = false;
          let firstOutput = true;
          while (!done) {
            const result = await reader.read();
            done = result.done;

            if (result.value) {
              const chunk = decoder.decode(result.value, { stream: true });
              const parts = parser.push(chunk);

              for (const part of parts) {
                if (firstOutput) {
                  firstOutput = false;
                  setIsTyping(false);
                  ensureMessage();
                }
                if (part.kind === 'text') {
                  applyText(part.text, false);
                } else if (part.kind === 'system') {
                  applyText(part.text, true);
                } else if (part.kind === 'event') {
                  ensureMessage();
                  applyEvent(part.event);
                }
              }
            }
          }

          const tail = parser.flush();
          for (const part of tail) {
            if (firstOutput) {
              firstOutput = false;
              setIsTyping(false);
              ensureMessage();
            }
            if (part.kind === 'text') applyText(part.text, false);
            else if (part.kind === 'system') applyText(part.text, true);
            else if (part.kind === 'event') {
              ensureMessage();
              applyEvent(part.event);
            }
          }

          if (firstOutput) {
            setIsTyping(false);
            setMessages((prev) => [
              ...prev,
              {
                id: assistantMessageId,
                role: 'assistant' as const,
                content: 'I received an empty response. Please try again.',
                timestamp: new Date(),
              },
            ]);
          }
        }
      } catch (error) {
        setIsTyping(false);
        if (error instanceof Error && error.name === 'AbortError') {
          setMessages((prev) => {
            const hasMessage = prev.some((m) => m.id === assistantMessageId);
            if (hasMessage) return prev;
            return [
              ...prev,
              {
                id: assistantMessageId,
                role: 'assistant' as const,
                content: 'The response timed out. Please try again.',
                timestamp: new Date(),
              },
            ];
          });
        } else {
          console.error('Chat error:', error);
          setMessages((prev) => {
            const hasMessage = prev.some((m) => m.id === assistantMessageId);
            if (hasMessage) return prev;
            return [
              ...prev,
              {
                id: assistantMessageId,
                role: 'assistant' as const,
                content: 'I encountered an error. Please try again.',
                timestamp: new Date(),
              },
            ];
          });
        }
      } finally {
        clearTimeout(timeoutId);
        setIsStreaming(false);
        streamingMessageIdRef.current = null;
        abortControllerRef.current = null;
      }
    },
    [setMessages, pageContext]
  );

  const handleForgetMemory = useCallback(async (): Promise<{ ok: boolean; deleted?: number; error?: string }> => {
    const deviceId = getOrCreateDeviceId();
    if (!deviceId) {
      clearDeviceId();
      return { ok: true, deleted: 0 };
    }
    const requestBody = JSON.stringify({ deviceId });
    const signedHeaders = await getSignedHeaders(requestBody);
    const forgetUrl = CHAT_ENDPOINT.endsWith('/') ? `${CHAT_ENDPOINT}forget` : `${CHAT_ENDPOINT}/forget`;
    try {
      const response = await fetch(forgetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...signedHeaders },
        body: requestBody,
      });
      if (!response.ok) return { ok: false, error: 'Server declined request.' };
      const text = await response.text();
      const first = text.split('\x00SYS\x00')[0];
      try {
        const json = JSON.parse(first);
        if (json?.ok) {
          clearDeviceId();
          return { ok: true, deleted: json.deleted };
        }
        return { ok: false, error: 'Unexpected response.' };
      } catch {
        return { ok: false, error: 'Unable to parse response.' };
      }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Network error.' };
    }
  }, []);

  const handleSuggestionSelect = useCallback(
    (suggestion: string) => {
      handleSend(suggestion);
    },
    [handleSend]
  );

  const streamingMessageId = isStreaming ? streamingMessageIdRef.current : null;

  return {
    messages,
    isTyping,
    isStreaming,
    streamingMessageId,
    messagesContainerRef,
    hasUserMessages,
    showSuggestions,
    handleSend,
    handleClearConversation,
    handleSuggestionSelect,
    handleForgetMemory,
  };
}
