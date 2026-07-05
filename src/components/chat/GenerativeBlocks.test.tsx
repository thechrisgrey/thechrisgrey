import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GenerativeBlocks from './GenerativeBlocks';
import type { UiBlock } from '../../utils/uiBlocks';

function renderBlocks(blocks: UiBlock[]) {
  return render(
    <MemoryRouter>
      <GenerativeBlocks blocks={blocks} />
    </MemoryRouter>,
  );
}

describe('GenerativeBlocks', () => {
  it('renders nothing for an empty list', () => {
    const { container } = renderBlocks([]);
    expect(container.firstChild).toBeNull();
  });

  it('renders a timeline block', () => {
    renderBlocks([
      {
        type: 'timeline',
        title: 'Career',
        items: [
          { year: '2008', heading: 'Enlisted', detail: 'Joined the Army.' },
          { year: '2014', heading: '18D', detail: 'Special Forces medic.' },
        ],
      },
    ]);
    expect(screen.getByText('Career')).toBeInTheDocument();
    expect(screen.getByText('Enlisted')).toBeInTheDocument();
    expect(screen.getByText('18D')).toBeInTheDocument();
  });

  it('renders a comparison block with both columns', () => {
    renderBlocks([
      {
        type: 'comparison',
        title: 'Two hats',
        left: { heading: 'AWS work', points: ['Community Builder'] },
        right: { heading: 'Claude work', points: ['Applied AI engineer'] },
      },
    ]);
    expect(screen.getByText('AWS work')).toBeInTheDocument();
    expect(screen.getByText('Claude work')).toBeInTheDocument();
    expect(screen.getByText('Community Builder')).toBeInTheDocument();
  });

  it('renders a stat_row block', () => {
    renderBlocks([
      {
        type: 'stat_row',
        stats: [
          { value: '9', label: 'Episodes' },
          { value: '2025', label: 'Launched' },
        ],
      },
    ]);
    expect(screen.getByText('9')).toBeInTheDocument();
    expect(screen.getByText('Episodes')).toBeInTheDocument();
  });

  it('renders a link_grid with internal links and filters external ones', () => {
    renderBlocks([
      {
        type: 'link_grid',
        links: [
          { label: 'Podcast', path: '/podcast', blurb: 'The Vector Podcast' },
          // External paths are filtered by the isInternalPath guard.
          { label: 'Evil', path: 'https://evil.example', blurb: 'nope' },
        ],
      },
    ]);
    const podcastLink = screen.getByRole('link', { name: /Podcast/i });
    expect(podcastLink).toHaveAttribute('href', '/podcast');
    expect(screen.queryByText('Evil')).not.toBeInTheDocument();
  });

  it('renders a profile_mini with an internal CTA', () => {
    renderBlocks([
      {
        type: 'profile_mini',
        name: 'Christian Perez',
        role: 'Founder & CEO',
        blurb: 'Former Green Beret.',
        ctaPath: '/about',
      },
    ]);
    expect(screen.getByText('Christian Perez')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Learn more/i })).toHaveAttribute('href', '/about');
  });

  it('renders an explainer block with paragraphs and bullets', () => {
    renderBlocks([
      {
        type: 'explainer',
        title: 'What is Alti',
        paragraphs: ['Alti is the site agent.'],
        bullets: ['RAG', 'Tool use'],
      },
    ]);
    expect(screen.getByText('What is Alti')).toBeInTheDocument();
    expect(screen.getByText('Alti is the site agent.')).toBeInTheDocument();
    expect(screen.getByText('RAG')).toBeInTheDocument();
  });

  it('ignores an unknown block type without crashing', () => {
    const { container } = renderBlocks([{ type: 'iframe', src: 'x' } as unknown as UiBlock]);
    // The wrapper renders but the unknown block produces no child content.
    expect(container.textContent).toBe('');
  });
});
