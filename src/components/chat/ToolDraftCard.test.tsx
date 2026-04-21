import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import ToolDraftCard from './ToolDraftCard';

function LocationSpy({ onLocation }: { onLocation: (loc: string) => void }) {
  const loc = useLocation();
  onLocation(`${loc.pathname}${loc.search}${loc.hash}`);
  return null;
}

function renderWithRouter(ui: React.ReactElement, onLocation?: (loc: string) => void) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              {onLocation ? <LocationSpy onLocation={onLocation} /> : null}
              {ui}
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ToolDraftCard — navigate', () => {
  it('renders path and reason', () => {
    renderWithRouter(
      <ToolDraftCard
        action={{ kind: 'draft_action', action: 'navigate', path: '/podcast', reason: 'Christian hosts it.' }}
      />,
    );
    expect(screen.getByText(/\/podcast/)).toBeInTheDocument();
    expect(screen.getByText(/Christian hosts it/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Take me there/i })).toBeInTheDocument();
  });

  it('navigates and dismisses on accept', () => {
    let current = '/';
    renderWithRouter(
      <ToolDraftCard
        action={{ kind: 'draft_action', action: 'navigate', path: '/about', reason: 'To learn more.' }}
      />,
      (loc) => { current = loc; },
    );
    fireEvent.click(screen.getByRole('button', { name: /Take me there/i }));
    expect(current).toBe('/about');
    expect(screen.queryByRole('button', { name: /Take me there/i })).not.toBeInTheDocument();
  });

  it('dismisses without navigating', () => {
    const onDismiss = vi.fn();
    renderWithRouter(
      <ToolDraftCard
        action={{ kind: 'draft_action', action: 'navigate', path: '/altivum', reason: 'reason' }}
        onDismiss={onDismiss}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Dismiss/i }));
    expect(onDismiss).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /Take me there/i })).not.toBeInTheDocument();
  });
});

describe('ToolDraftCard — contact', () => {
  const baseAction = {
    kind: 'draft_action' as const,
    action: 'contact' as const,
    subject: 'Podcast appearance',
    body: 'Long body text',
    intent: 'podcast' as const,
  };

  it('renders subject, body, and intent label', () => {
    renderWithRouter(<ToolDraftCard action={baseAction} />);
    expect(screen.getByText(/Podcast invitation/i)).toBeInTheDocument();
    expect(screen.getByText(/Podcast appearance/)).toBeInTheDocument();
    expect(screen.getByText(/Long body text/)).toBeInTheDocument();
  });

  it('navigates to contact with query params on accept', () => {
    let current = '/';
    renderWithRouter(<ToolDraftCard action={baseAction} />, (loc) => { current = loc; });
    fireEvent.click(screen.getByRole('button', { name: /Review & send/i }));
    expect(current).toContain('/contact');
    expect(current).toContain('subject=Podcast');
    expect(current).toContain('intent=podcast');
  });
});

describe('ToolDraftCard — newsletter', () => {
  it('renders pitch and subscribe button', () => {
    renderWithRouter(
      <ToolDraftCard
        action={{ kind: 'draft_action', action: 'newsletter', pitch: 'Weekly insights' }}
      />,
    );
    expect(screen.getByText(/Weekly insights/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Subscribe/i })).toBeInTheDocument();
  });

  it('navigates to /contact#newsletter on subscribe', () => {
    let current = '/';
    renderWithRouter(
      <ToolDraftCard
        action={{ kind: 'draft_action', action: 'newsletter', pitch: 'pitch' }}
      />,
      (loc) => { current = loc; },
    );
    fireEvent.click(screen.getByRole('button', { name: /Subscribe/i }));
    expect(current).toBe('/contact#newsletter');
  });
});

describe('ToolDraftCard — citation', () => {
  it('renders title, excerpt, and read button', () => {
    renderWithRouter(
      <ToolDraftCard
        action={{
          kind: 'draft_action',
          action: 'citation',
          slug: 'building-alti',
          title: 'Building Alti',
          excerpt: 'How I wired up the agent.',
          url: 'https://thechrisgrey.com/blog/building-alti',
        }}
      />,
    );
    expect(screen.getByText(/Building Alti/)).toBeInTheDocument();
    expect(screen.getByText(/How I wired up the agent/)).toBeInTheDocument();
  });

  it('navigates to blog post on accept', () => {
    let current = '/';
    renderWithRouter(
      <ToolDraftCard
        action={{
          kind: 'draft_action',
          action: 'citation',
          slug: 'a-post',
          title: 'Title',
          excerpt: '',
          url: 'https://thechrisgrey.com/blog/a-post',
        }}
      />,
      (loc) => { current = loc; },
    );
    fireEvent.click(screen.getByRole('button', { name: /Read the post/i }));
    expect(current).toBe('/blog/a-post');
  });
});

describe('ToolDraftCard — blog_search_results', () => {
  const sampleResults = [
    {
      slug: 'going-agentic',
      title: 'Going Agentic',
      excerpt: 'How Alti became a tool-user.',
      url: 'https://thechrisgrey.com/blog/going-agentic',
    },
    {
      slug: 'strands-a-tour',
      title: 'Strands, A Tour',
      excerpt: 'Walkthrough of the SDK.',
      url: 'https://thechrisgrey.com/blog/strands-a-tour',
    },
  ];

  it('renders query and all result titles', () => {
    renderWithRouter(
      <ToolDraftCard
        action={{
          kind: 'draft_action',
          action: 'blog_search_results',
          query: 'strands',
          results: sampleResults,
        }}
      />,
    );
    expect(screen.getByText(/Posts matching/i)).toBeInTheDocument();
    expect(screen.getByText('Going Agentic')).toBeInTheDocument();
    expect(screen.getByText('Strands, A Tour')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Read this post/i })).toHaveLength(2);
  });

  it('navigates to clicked post slug', () => {
    let current = '/';
    renderWithRouter(
      <ToolDraftCard
        action={{
          kind: 'draft_action',
          action: 'blog_search_results',
          query: 'agents',
          results: sampleResults,
        }}
      />,
      (loc) => { current = loc; },
    );
    const buttons = screen.getAllByRole('button', { name: /Read this post/i });
    fireEvent.click(buttons[1]);
    expect(current).toBe('/blog/strands-a-tour');
  });

  it('dismisses all on Dismiss all click', () => {
    const onDismiss = vi.fn();
    renderWithRouter(
      <ToolDraftCard
        action={{
          kind: 'draft_action',
          action: 'blog_search_results',
          query: 'agents',
          results: sampleResults,
        }}
        onDismiss={onDismiss}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Dismiss all/i }));
    expect(onDismiss).toHaveBeenCalled();
    expect(screen.queryByText('Going Agentic')).not.toBeInTheDocument();
  });

  it('renders nothing when results array is empty', () => {
    const { container } = renderWithRouter(
      <ToolDraftCard
        action={{
          kind: 'draft_action',
          action: 'blog_search_results',
          query: 'nothing',
          results: [],
        }}
      />,
    );
    expect(container.querySelector('[aria-label="Blog search results"]')).toBeNull();
  });

  it('omits excerpt paragraph when excerpt is empty', () => {
    const { container } = renderWithRouter(
      <ToolDraftCard
        action={{
          kind: 'draft_action',
          action: 'blog_search_results',
          query: 'test',
          results: [
            {
              slug: 'no-excerpt',
              title: 'No Excerpt',
              excerpt: '',
              url: 'https://thechrisgrey.com/blog/no-excerpt',
            },
          ],
        }}
      />,
    );
    expect(screen.getByText('No Excerpt')).toBeInTheDocument();
    const listItems = container.querySelectorAll('li');
    expect(listItems).toHaveLength(1);
    expect(listItems[0].querySelector('.italic')).toBeNull();
  });
});
