interface ChatWidgetButtonProps {
  isOpen: boolean;
  onClick: () => void;
}

const ChatWidgetButton = ({ isOpen, onClick }: ChatWidgetButtonProps) => {
  return (
    <button
      onClick={onClick}
      aria-label={isOpen ? 'Close chat' : 'Open chat'}
      aria-expanded={isOpen}
      className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-altivum-gold text-altivum-dark flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-altivum-gold focus-visible:ring-offset-2 focus-visible:ring-offset-altivum-dark"
    >
      <span className="material-icons text-2xl transition-transform duration-200">
        {isOpen ? 'close' : 'chat'}
      </span>
    </button>
  );
};

export default ChatWidgetButton;
