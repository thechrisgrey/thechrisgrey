import { useState, useRef, useEffect, useCallback } from 'react';
import { useSessionStorage } from './useSessionStorage';

const MAX_HISTORY = 20;

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const CHAT_ENDPOINT = import.meta.env.VITE_CHAT_ENDPOINT;
export const CHAT_STORAGE_KEY = 'chat-messages';

export const initialWelcomeMessage: Message = {
  id: 'welcome',
  role: 'assistant',
  content:
    "Hey there! I'm Christian's Personal AI Assistant here to help you learn more about him. Feel free to ask about his background, Altivum\u00AE Inc, The Vector Podcast, or his book \"Beyond the Assessment.\" What would you like to know?",
  timestamp: new Date(),
};

export function useChatEngine() {
  const [messages, setMessages, clearMessages] = useSessionStorage<Message[]>(
    CHAT_STORAGE_KEY,
    [initialWelcomeMessage]
  );
  const [isTyping, setIsTyping] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamingMessageIdRef = useRef<string | null>(null);

  // Clean up stale chat-typing key from sessionStorage (legacy)
  useEffect(() => {
    sessionStorage.removeItem('chat-typing');
  }, []);

  // Abort in-flight request on unmount
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
      // Abort any previous in-flight request
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

      // Client-side sliding window (mirrors server-side 20-message limit)
      const allMessages = [
        ...messages.filter((m) => m.id !== 'welcome'),
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

      try {
        const response = await fetch(CHAT_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: conversationHistory }),
          signal: controller.signal,
        });

        if (!response.ok) throw new Error('Failed to get response');

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (reader) {
          let done = false;
          let firstChunk = true;
          while (!done) {
            const result = await reader.read();
            done = result.done;

            if (result.value) {
              const chunk = decoder.decode(result.value, { stream: true });

              if (firstChunk) {
                firstChunk = false;
                setIsTyping(false);
                setMessages((prev) => [
                  ...prev,
                  {
                    id: assistantMessageId,
                    role: 'assistant' as const,
                    content: chunk,
                    timestamp: new Date(),
                  },
                ]);
              } else {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId
                      ? { ...msg, content: msg.content + chunk }
                      : msg
                  )
                );
              }
            }
          }

          // Edge case: stream opened but no chunks received
          if (firstChunk) {
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
            if (hasMessage) return prev; // partial content visible, keep it
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
    [messages, setMessages]
  );

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
  };
}
