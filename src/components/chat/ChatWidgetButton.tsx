import { lazy, Suspense } from 'react';

const AltiMascot = lazy(() => import('./AltiMascot'));

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
      className="fixed bottom-6 right-6 z-40 flex items-center justify-center cursor-pointer bg-transparent border-none p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-altivum-gold focus-visible:ring-offset-2 focus-visible:ring-offset-altivum-dark"
    >
      <Suspense fallback={null}>
        <AltiMascot isOpen={isOpen} />
      </Suspense>
    </button>
  );
};

export default ChatWidgetButton;
