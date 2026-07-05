import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Hoisted mock holders so the vi.mock factory can close over them safely.
const mocks = vi.hoisted(() => ({
  handleSend: vi.fn(),
  state: {
    messages: [] as Array<Record<string, unknown>>,
    isTyping: false,
    isStreaming: false,
    streamingMessageId: null as string | null,
  },
}));

vi.mock('../../hooks', () => ({
  useChatEngine: () => ({ ...mocks.state, handleSend: mocks.handleSend }),
  usePageContext: () => ({
    currentPage: '/podcast',
    pageTitle: 'The Vector Podcast',
    section: 'The Vector Podcast',
    visitedPages: ['/podcast'],
  }),
}));

import AskTheVector from './AskTheVector';

function setup() {
  return render(
    <MemoryRouter>
      <AskTheVector />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mocks.handleSend.mockClear();
  mocks.state.messages = [];
  mocks.state.isTyping = false;
  mocks.state.isStreaming = false;
  mocks.state.streamingMessageId = null;
});

describe('AskTheVector', () => {
  it('renders the heading and example prompts before any question', () => {
    setup();
    expect(screen.getByText('Ask The Vector')).toBeInTheDocument();
    expect(screen.getByText(/Try asking/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /What do guests say about leaving the military\?/i }),
    ).toBeInTheDocument();
  });

  it('sends an example prompt when clicked', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /Which episodes talk about AI in defense\?/i }));
    expect(mocks.handleSend).toHaveBeenCalledWith('Which episodes talk about AI in defense?');
  });

  it('submits a typed question and clears the input', () => {
    setup();
    const input = screen.getByPlaceholderText(/Ask about a topic/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'veteran mental health' } });
    fireEvent.submit(input.closest('form')!);
    expect(mocks.handleSend).toHaveBeenCalledWith('veteran mental health');
    expect(input.value).toBe('');
  });

  it('does not send an empty or whitespace-only question', () => {
    setup();
    const input = screen.getByPlaceholderText(/Ask about a topic/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.submit(input.closest('form')!);
    expect(mocks.handleSend).not.toHaveBeenCalled();
  });

  it('renders the latest answer and its podcast citation card', () => {
    mocks.state.messages = [
      { id: 'u1', role: 'user', content: 'What about women veterans?', timestamp: new Date() },
      {
        id: 'a1',
        role: 'assistant',
        content: 'Brittinie Wick talked about how women veterans are often overlooked.',
        timestamp: new Date(),
        drafts: [
          {
            kind: 'draft_action',
            action: 'podcast_citation',
            videoId: 'ndX9SkIY7Mc',
            startSeconds: 725,
            episodeTitle: 'Brittinie Wick on Women Veterans',
            quote: 'Women veterans are too often invisible after service.',
            timestampLabel: '12:05',
            url: 'https://www.youtube.com/watch?v=ndX9SkIY7Mc&t=725s',
          },
        ],
      },
    ];
    setup();
    expect(screen.getByText(/Brittinie Wick talked about/)).toBeInTheDocument();
    expect(screen.getByText(/From The Vector Podcast/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Play at 12:05/i })).toBeInTheDocument();
    // Example prompts are hidden once a conversation exists.
    expect(screen.queryByText(/Try asking/i)).not.toBeInTheDocument();
  });

  it('surfaces a system message (e.g. rate limit) gracefully', () => {
    mocks.state.messages = [
      { id: 'u1', role: 'user', content: 'too many', timestamp: new Date() },
      {
        id: 's1',
        role: 'assistant',
        content: "You've reached the message limit. Please try again in about an hour.",
        timestamp: new Date(),
        isSystem: true,
      },
    ];
    setup();
    expect(screen.getByText(/reached the message limit/i)).toBeInTheDocument();
  });
});
