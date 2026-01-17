interface ChatSuggestionsProps {
  onSelect: (suggestion: string) => void;
}

const suggestions = [
  "What's your background?",
  "Tell me about Altivum",
  "What's The Vector Podcast about?",
  "What inspired your book?",
];

const ChatSuggestions = ({ onSelect }: ChatSuggestionsProps) => {
  return (
    <div className="flex flex-wrap gap-3 justify-center px-4 py-6">
      {suggestions.map((suggestion, index) => (
        <button
          key={index}
          onClick={() => onSelect(suggestion)}
          className="px-4 py-2 border border-white/10 rounded-full text-altivum-silver hover:text-white hover:bg-white/5 transition-all duration-200 text-sm touch-manipulation"
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
};

export default ChatSuggestions;
