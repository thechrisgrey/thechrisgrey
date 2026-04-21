interface TraceResponseBubbleProps {
  content: string;
  isStreaming: boolean;
  isSystemMessage: boolean;
}

export function TraceResponseBubble({ content, isStreaming, isSystemMessage }: TraceResponseBubbleProps) {
  return (
    <div
      className="mt-4 bg-altivum-navy/30 border border-altivum-slate/30 rounded-lg p-4"
      aria-live="polite"
    >
      {isSystemMessage && (
        <span className="inline-flex items-center gap-1.5 text-amber-400 text-xs font-light mb-2">
          <span className="material-icons text-sm">warning</span>
          Off-topic
        </span>
      )}
      <p
        className={`text-sm leading-relaxed ${
          isSystemMessage ? 'text-amber-400' : 'text-altivum-silver'
        }`}
      >
        {content}
        {isStreaming && (
          <span
            className="inline-block w-0.5 h-4 bg-altivum-gold ml-0.5 align-middle animate-pulse"
            aria-hidden="true"
          />
        )}
      </p>
    </div>
  );
}
