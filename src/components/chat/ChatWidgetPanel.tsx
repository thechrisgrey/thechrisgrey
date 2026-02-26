import { useNavigate } from 'react-router-dom';
import { useFocusTrap, useChatEngine } from '../../hooks';
import { typography } from '../../utils/typography';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import ChatSuggestions from './ChatSuggestions';
import TypingIndicator from './TypingIndicator';

interface ChatWidgetPanelProps {
  onClose: () => void;
}

const ChatWidgetPanel = ({ onClose }: ChatWidgetPanelProps) => {
  const navigate = useNavigate();
  const { containerRef, handleKeyDown } = useFocusTrap(true);

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

  const handleExpand = () => {
    onClose();
    navigate('/chat');
  };

  const handlePanelKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
      return;
    }
    handleKeyDown(e);
  };

  return (
    <div
      ref={containerRef}
      onKeyDown={handlePanelKeyDown}
      role="dialog"
      aria-modal="true"
      aria-label="AI Chat"
      className="fixed bottom-24 right-6 z-40 w-[calc(100vw-2rem)] h-[calc(100vh-8rem)] sm:w-[400px] sm:h-[560px] bg-altivum-navy border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-widget-open"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-altivum-dark/60 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-white text-sm" style={typography.smallText}>
            AI Chat
          </span>
        </div>
        <div className="flex items-center gap-1">
          {hasUserMessages && (
            <button
              onClick={handleClearConversation}
              className="p-1.5 text-altivum-silver hover:text-white rounded transition-colors duration-200"
              aria-label="Clear conversation"
            >
              <span className="material-icons text-lg">refresh</span>
            </button>
          )}
          <button
            onClick={handleExpand}
            className="p-1.5 text-altivum-silver hover:text-white rounded transition-colors duration-200"
            aria-label="Open full chat"
          >
            <span className="material-icons text-lg">open_in_full</span>
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-altivum-silver hover:text-white rounded transition-colors duration-200"
            aria-label="Close chat"
          >
            <span className="material-icons text-lg">close</span>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto">
        <div className="px-4 py-4">
          <div
            className="space-y-4"
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

        {showSuggestions && (
          <ChatSuggestions onSelect={handleSuggestionSelect} />
        )}
      </div>

      {/* Input */}
      <ChatInput onSend={handleSend} disabled={isTyping} />
    </div>
  );
};

export default ChatWidgetPanel;
