import { useState, useRef, useEffect, useCallback } from 'react';
import { useSessionStorage } from './useSessionStorage';

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
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Clean up stale chat-typing key from sessionStorage (legacy)
  useEffect(() => {
    sessionStorage.removeItem('chat-typing');
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
    if (messages.length > 1) {
      scrollToBottom();
    }
  }, [messages, isTyping, scrollToBottom]);

  const handleSend = useCallback(
    async (content: string) => {
      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: 'user',
        content,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsTyping(true);

      const conversationHistory = [
        ...messages.filter((m) => m.id !== 'welcome'),
        userMessage,
      ].map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      const assistantMessageId = `assistant-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMessageId,
          role: 'assistant',
          content: '',
          timestamp: new Date(),
        },
      ]);
      setIsTyping(false);

      try {
        const response = await fetch(CHAT_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: conversationHistory }),
        });

        if (!response.ok) throw new Error('Failed to get response');

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (reader) {
          let done = false;
          while (!done) {
            const result = await reader.read();
            done = result.done;

            if (result.value) {
              const chunk = decoder.decode(result.value, { stream: true });
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
      } catch (error) {
        console.error('Chat error:', error);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content:
                    'I apologize, but I encountered an error. Please try again.',
                }
              : msg
          )
        );
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

  return {
    messages,
    isTyping,
    messagesContainerRef,
    hasUserMessages,
    showSuggestions,
    handleSend,
    handleClearConversation,
    handleSuggestionSelect,
  };
}
