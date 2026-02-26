import { SEO } from '../components/SEO';
import { typography } from '../utils/typography';
import ChatMessage from '../components/chat/ChatMessage';
import ChatInput from '../components/chat/ChatInput';
import ChatSuggestions from '../components/chat/ChatSuggestions';
import TypingIndicator from '../components/chat/TypingIndicator';
import ErrorBoundary from '../components/ErrorBoundary';
import { ChatErrorFallback } from '../components/ErrorFallbacks';
import { useChatEngine, CHAT_STORAGE_KEY } from '../hooks';

const ChatContent = () => {
  const {
    messages,
    isTyping,
    messagesContainerRef,
    hasUserMessages,
    showSuggestions,
    handleSend,
    handleClearConversation,
    handleSuggestionSelect,
  } = useChatEngine();

  return (
    <div className="h-screen pt-20 flex flex-col bg-altivum-dark overflow-hidden">
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
        <div className="max-w-4xl mx-auto px-6 py-6 flex items-start justify-between">
          <div>
            <h1 className="text-white mb-2" style={typography.cardTitleLarge}>
              AI Chat
            </h1>
            <p className="text-altivum-silver" style={typography.smallText}>
              Ask me anything about Christian's background, Altivum, the podcast, or his book.
            </p>
          </div>
          {hasUserMessages && (
            <button
              onClick={handleClearConversation}
              className="flex items-center gap-2 px-4 py-2 text-altivum-silver hover:text-white border border-white/20 hover:border-white/40 rounded transition-colors duration-200 text-sm"
              aria-label="Clear conversation"
            >
              <span className="material-icons text-base">refresh</span>
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Messages Container */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto"
      >
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div
            className="space-y-6"
            role="log"
            aria-live="polite"
            aria-label="Chat messages"
          >
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                role={message.role}
                content={message.content}
              />
            ))}
            {isTyping && <TypingIndicator />}
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

// Clear chat storage on error reset
const handleChatErrorReset = () => {
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(CHAT_STORAGE_KEY);
    window.sessionStorage.removeItem('chat-typing');
  }
};

const Chat = () => {
  return (
    <ErrorBoundary
      fallback={<ChatErrorFallback onRetry={handleChatErrorReset} />}
      onReset={handleChatErrorReset}
      showHomeButton={false}
      pageName="Chat"
    >
      <ChatContent />
    </ErrorBoundary>
  );
};

export default Chat;
