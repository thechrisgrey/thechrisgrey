import { useState, useRef, useEffect, KeyboardEvent, FormEvent } from 'react';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

const ChatInput = ({ onSend, disabled = false }: ChatInputProps) => {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  };

  useEffect(() => {
    adjustHeight();
  }, [value]);

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault();
    if (value.trim() && !disabled) {
      onSend(value.trim());
      setValue('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const hasValue = value.trim().length > 0;

  return (
    <div className="border-t border-white/10 bg-altivum-navy/50 backdrop-blur-sm p-4">
      <form
        onSubmit={handleSubmit}
        className="max-w-4xl mx-auto"
      >
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything..."
            aria-label="Type a message"
            disabled={disabled}
            rows={1}
            maxLength={4000}
            className="w-full pl-4 pr-12 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-altivum-silver/50 focus:outline-none focus:border-altivum-gold transition-colors duration-200 resize-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            style={{
              minHeight: '48px',
              maxHeight: '200px',
            }}
          />
          <button
            type="submit"
            disabled={!hasValue || disabled}
            className={`absolute right-3 top-1/2 -translate-y-1/2 transition-colors duration-200 ${
              hasValue && !disabled
                ? 'text-altivum-gold hover:text-white'
                : 'text-altivum-slate/50 cursor-not-allowed'
            }`}
            aria-label="Send message"
          >
            <span className="material-icons text-xl">send</span>
          </button>
        </div>
        {value.length > 0 && (
          <div className="mt-1 text-right pr-1">
            <span
              className={`text-xs tabular-nums transition-colors duration-200 ${
                value.length > 3600 ? 'text-altivum-gold' : 'text-altivum-slate/50'
              }`}
            >
              {value.length}/4,000
            </span>
          </div>
        )}
      </form>
    </div>
  );
};

export default ChatInput;
