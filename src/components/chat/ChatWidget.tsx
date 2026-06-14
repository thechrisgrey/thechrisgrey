import { useState } from 'react';
import ChatWidgetButton from './ChatWidgetButton';
import ChatWidgetPanel from './ChatWidgetPanel';
import { trackEvent } from '../../utils/analytics';

const ChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);

  const toggle = () => {
    // Fire the engagement goal only on open (not on close). Read isOpen from the
    // closure rather than inside the updater — StrictMode double-invokes updaters,
    // which would double-count the event.
    if (!isOpen) trackEvent('Chat Opened', { surface: 'widget' });
    setIsOpen((prev) => !prev);
  };

  return (
    <div data-vt-persist="chat-widget">
      {isOpen && <ChatWidgetPanel onClose={() => setIsOpen(false)} />}
      <ChatWidgetButton isOpen={isOpen} onClick={toggle} />
    </div>
  );
};

export default ChatWidget;
