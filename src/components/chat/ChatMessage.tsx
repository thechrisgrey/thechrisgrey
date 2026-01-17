import { typography } from '../../utils/typography';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
}

const ChatMessage = ({ role, content }: ChatMessageProps) => {
  const isUser = role === 'user';

  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}
    >
      <div
        className={`max-w-[90%] md:max-w-[80%] px-5 py-4 ${
          isUser
            ? 'bg-white/5 border border-white/30 rounded-2xl rounded-br-sm'
            : 'bg-white/5 border border-altivum-gold/30 rounded-2xl rounded-bl-sm'
        }`}
      >
        <p
          className={isUser ? 'text-white' : 'text-altivum-gold'}
          style={typography.bodyText}
        >
          {content}
        </p>
      </div>
    </div>
  );
};

export default ChatMessage;
