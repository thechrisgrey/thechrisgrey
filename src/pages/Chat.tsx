import { useState, useRef, useEffect } from 'react';
import { SEO } from '../components/SEO';
import { typography } from '../utils/typography';
import ChatMessage from '../components/chat/ChatMessage';
import ChatInput from '../components/chat/ChatInput';
import ChatSuggestions from '../components/chat/ChatSuggestions';
import TypingIndicator from '../components/chat/TypingIndicator';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const initialWelcomeMessage: Message = {
  id: 'welcome',
  role: 'assistant',
  content: "Hey there! I'm an AI assistant here to help you learn about Christian Perez. Feel free to ask about his background, Altivum Inc, The Vector Podcast, or his book \"Beyond the Assessment.\" What would you like to know?",
  timestamp: new Date(),
};

const mockResponses = [
  "That's a great question! I'm still being trained on all the details about Christian's background and work. Once I'm fully connected, I'll be able to share specific information about his journey from Green Beret to tech CEO.",
  "Thanks for your interest! This chat experience is still being developed. Soon I'll be able to provide detailed answers about Altivum Inc's cloud migration and AI integration services.",
  "I appreciate you asking! When I'm fully operational, I'll be able to tell you all about The Vector Podcast and the insights Christian shares with his guests.",
  "Good question! I'm currently in development, but once complete I'll be able to share the inspiration behind \"Beyond the Assessment\" and its lessons from Special Forces.",
];

const Chat = () => {
  const [messages, setMessages] = useState<Message[]>([initialWelcomeMessage]);
  const [isTyping, setIsTyping] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = (content: string) => {
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setShowSuggestions(false);
    setIsTyping(true);

    // Simulate AI response delay
    const delay = 1000 + Math.random() * 1500;
    setTimeout(() => {
      const randomResponse = mockResponses[Math.floor(Math.random() * mockResponses.length)];
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: randomResponse,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsTyping(false);
    }, delay);
  };

  const handleSuggestionSelect = (suggestion: string) => {
    handleSend(suggestion);
  };

  return (
    <div className="min-h-screen pt-20 flex flex-col bg-altivum-dark">
      <SEO
        title="AI Chat"
        description="Have a conversation with an AI assistant trained on Christian Perez's background, work, and expertise. Learn about his journey from Green Beret to tech CEO."
        keywords="AI chat, Christian Perez, conversation, Altivum, veteran entrepreneur"
        url="https://thechrisgrey.com/chat"
        breadcrumbs={[
          { name: "Home", url: "https://thechrisgrey.com" },
          { name: "AI Chat", url: "https://thechrisgrey.com/chat" }
        ]}
      />

      {/* Header */}
      <div className="border-b border-white/10 bg-altivum-dark/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <h1 className="text-white mb-2" style={typography.cardTitleLarge}>
            AI Chat
          </h1>
          <p className="text-altivum-silver" style={typography.smallText}>
            Ask me anything about Christian's background, Altivum, the podcast, or his book.
          </p>
        </div>
      </div>

      {/* Messages Container */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto"
      >
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="space-y-6">
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                role={message.role}
                content={message.content}
              />
            ))}
            {isTyping && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Suggestions */}
        {showSuggestions && (
          <div className="max-w-4xl mx-auto">
            <ChatSuggestions onSelect={handleSuggestionSelect} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <ChatInput onSend={handleSend} disabled={isTyping} />
    </div>
  );
};

export default Chat;
