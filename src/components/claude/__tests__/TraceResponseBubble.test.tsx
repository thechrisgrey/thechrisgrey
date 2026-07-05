import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TraceResponseBubble } from '../TraceResponseBubble';

/**
 * The bubble's live region must announce only the *settled* response, not every
 * streamed chunk. Streaming -> aria-live="off" (no per-chunk re-announcement);
 * complete -> aria-live="polite" (final content announced once).
 */
describe('TraceResponseBubble', () => {
  it('renders the response content', () => {
    render(<TraceResponseBubble content="Hello there" isStreaming={false} isSystemMessage={false} />);
    expect(screen.getByText('Hello there')).toBeInTheDocument();
  });

  it('suppresses live announcements while streaming (aria-live="off")', () => {
    const { container } = render(<TraceResponseBubble content="partial" isStreaming isSystemMessage={false} />);
    const region = container.firstElementChild;
    expect(region).toHaveAttribute('aria-live', 'off');
  });

  it('announces politely once the response has settled (aria-live="polite")', () => {
    const { container } = render(
      <TraceResponseBubble content="final answer" isStreaming={false} isSystemMessage={false} />,
    );
    const region = container.firstElementChild;
    expect(region).toHaveAttribute('aria-live', 'polite');
  });

  it('shows the off-topic badge for system messages', () => {
    render(<TraceResponseBubble content="off topic" isStreaming={false} isSystemMessage />);
    expect(screen.getByText('Off-topic')).toBeInTheDocument();
  });
});
