import { typography } from '../../utils/typography';
import { memo, useMemo, ReactNode } from 'react';
import type { DraftAction } from '../../utils/chatEvents';
import type { UiBlock } from '../../utils/uiBlocks';
import ToolDraftCard from './ToolDraftCard';
import GenerativeBlocks from './GenerativeBlocks';

interface MemoryEventRecord {
  action: 'remembered' | 'forgotten';
  content?: string;
}

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  isSystem?: boolean;
  drafts?: DraftAction[];
  uiBlocks?: UiBlock[];
  toolActivity?: { tool: string; status: 'invoked' | 'complete' }[];
  memoryEvents?: MemoryEventRecord[];
  /** 'page' enables generative UI blocks; 'widget' (default) never renders them. */
  surface?: 'page' | 'widget';
}

const TOOL_LABELS: Record<string, string> = {
  navigate_to: 'navigating',
  draft_message: 'drafting a message',
  draft_newsletter_subscription: 'preparing a subscription',
  cite_blog_passage: 'looking up a blog post',
  search_podcast: 'searching the podcast',
  remember_fact: 'saving that detail',
};

function toolLabel(tool: string): string {
  return TOOL_LABELS[tool] || tool.replace(/_/g, ' ');
}

// Map of keywords to their URLs (ordered by length desc to match longer phrases first)
const linkMap: { keyword: string; url: string }[] = [
  { keyword: 'Beyond the Assessment', url: 'https://altivum.ai/bta' },
  { keyword: 'The Vector Podcast', url: 'https://www.youtube.com/@thevectorpodcast' },
  { keyword: 'Vector Podcast', url: 'https://www.youtube.com/@thevectorpodcast' },
  { keyword: 'Altivum Inc', url: 'https://altivum.ai' },
  { keyword: 'Altivum', url: 'https://altivum.ai' },
  { keyword: 'VetROI', url: 'https://vetroi.altivum.ai' },
  { keyword: 'Elo', url: 'https://elo.altivum.ai' },
];

/**
 * Process text content and replace keywords with hyperlinks
 */
function processContentWithLinks(content: string): ReactNode[] {
  const result: ReactNode[] = [];
  let remainingText = content;
  let keyIndex = 0;

  while (remainingText.length > 0) {
    // Find the earliest match among all keywords
    let earliestMatch: { index: number; keyword: string; url: string } | null = null;

    for (const { keyword, url } of linkMap) {
      const index = remainingText.toLowerCase().indexOf(keyword.toLowerCase());
      if (index !== -1 && (earliestMatch === null || index < earliestMatch.index)) {
        // Get the actual text from the content (preserves original casing)
        const actualKeyword = remainingText.substring(index, index + keyword.length);
        earliestMatch = { index, keyword: actualKeyword, url };
      }
    }

    if (earliestMatch) {
      // Add text before the match
      if (earliestMatch.index > 0) {
        result.push(remainingText.substring(0, earliestMatch.index));
      }

      // Add the link
      result.push(
        <a
          key={`link-${keyIndex++}`}
          href={earliestMatch.url}
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-altivum-gold/50 hover:decoration-altivum-gold transition-colors"
        >
          {earliestMatch.keyword}
        </a>
      );

      // Continue with remaining text
      remainingText = remainingText.substring(earliestMatch.index + earliestMatch.keyword.length);
    } else {
      // No more matches, add the rest of the text
      result.push(remainingText);
      break;
    }
  }

  return result;
}

const ChatMessage = memo(({ role, content, isStreaming, isSystem, drafts, uiBlocks, toolActivity, memoryEvents, surface = 'widget' }: ChatMessageProps) => {
  const isUser = role === 'user';

  const displayContent = useMemo(
    () => (isUser || isSystem) ? content : processContentWithLinks(content),
    [content, isUser, isSystem]
  );

  if (isSystem) {
    return (
      <div className="flex justify-center animate-fade-in">
        <div className="max-w-[90%] md:max-w-[80%] px-5 py-4 bg-white/5 border border-white/10 rounded-xl">
          <p className="text-altivum-silver flex items-start gap-2" style={typography.bodyText}>
            <span className="material-icons text-altivum-silver/60 text-lg mt-0.5 shrink-0">info</span>
            <span>{content}</span>
          </p>
        </div>
      </div>
    );
  }

  const activeTool = toolActivity?.find((t) => t.status === 'invoked');

  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}
    >
      <div className="flex flex-col gap-3 max-w-full" style={{ maxWidth: '100%' }}>
        {!isUser && activeTool ? (
          <div
            className="max-w-[90%] md:max-w-[80%] px-3 py-2 bg-white/5 border border-altivum-gold/20 rounded-xl"
            role="status"
            aria-live="polite"
          >
            <p className="text-altivum-silver flex items-center gap-2" style={typography.smallText}>
              <span className="material-icons text-altivum-gold/70 text-sm animate-pulse">hourglass_empty</span>
              <span>Alti is {toolLabel(activeTool.tool)}…</span>
            </p>
          </div>
        ) : null}

        {content || (!isUser && isStreaming) ? (
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
              {displayContent}
              {isStreaming && (
                <span className="inline-block w-[2px] h-[1em] bg-altivum-gold ml-0.5 animate-pulse align-middle" aria-hidden="true" />
              )}
            </p>
          </div>
        ) : null}

        {!isUser && surface === 'page' && uiBlocks && uiBlocks.length > 0 ? (
          <GenerativeBlocks blocks={uiBlocks} />
        ) : null}

        {!isUser && memoryEvents && memoryEvents.length > 0
          ? memoryEvents.map((evt, idx) => (
              <div
                key={`mem-${idx}`}
                className="max-w-[90%] md:max-w-[80%] px-3 py-2 bg-white/5 border border-white/10 rounded-xl"
                role="status"
              >
                <p className="text-altivum-silver flex items-center gap-2" style={typography.smallText}>
                  <span className="material-icons text-altivum-gold/70 text-sm">bookmark_added</span>
                  <span>
                    {evt.action === 'remembered'
                      ? 'Saved that for next time.'
                      : 'Cleared what I had saved.'}
                  </span>
                </p>
              </div>
            ))
          : null}

        {!isUser && drafts && drafts.length > 0
          ? drafts.map((d, idx) => <ToolDraftCard key={`draft-${idx}`} action={d} />)
          : null}
      </div>
    </div>
  );
});

ChatMessage.displayName = 'ChatMessage';

export default ChatMessage;
