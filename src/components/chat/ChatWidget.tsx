import { useState } from 'react';
import ChatWidgetButton from './ChatWidgetButton';
import ChatWidgetPanel from './ChatWidgetPanel';

const ChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div data-vt-persist="chat-widget">
      {isOpen && <ChatWidgetPanel onClose={() => setIsOpen(false)} />}
      <ChatWidgetButton isOpen={isOpen} onClick={() => setIsOpen((prev) => !prev)} />
    </div>
  );
};

export default ChatWidget;
