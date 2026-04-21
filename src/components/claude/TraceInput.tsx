import { useState } from 'react';
import { PAGE_SUGGESTIONS } from '../../utils/pageContext';

interface TraceInputProps {
  onTrace: (message: string) => void;
  disabled: boolean;
}

const suggestions = PAGE_SUGGESTIONS['/claude'];

export function TraceInput({ onTrace, disabled }: TraceInputProps) {
  const [input, setInput] = useState('');

  function handleSubmit() {
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    onTrace(trimmed);
    setInput('');
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleSuggestionClick(suggestion: string) {
    setInput('');
    onTrace(suggestion);
  }

  const isEmpty = input.trim().length === 0;

  return (
    <div className="mt-8">
      <div className="flex gap-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Alti something..."
          disabled={disabled}
          className="flex-1 bg-altivum-navy/30 border border-altivum-slate/30 rounded-lg px-4 py-3 text-altivum-silver text-sm placeholder:text-altivum-slate focus:outline-none focus:border-altivum-gold/50 transition-colors disabled:opacity-50"
        />
        <button
          onClick={handleSubmit}
          disabled={isEmpty || disabled}
          className="bg-altivum-gold text-altivum-dark font-semibold rounded px-6 py-3 text-sm hover:bg-altivum-gold/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
        >
          Trace It
        </button>
      </div>

      {isEmpty && !disabled && suggestions && (
        <div className="flex flex-wrap gap-2 mt-4">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => handleSuggestionClick(suggestion)}
              className="px-3 py-1.5 border border-white/10 rounded-full text-altivum-silver hover:text-white hover:bg-white/5 transition-all duration-200 text-xs touch-manipulation"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
