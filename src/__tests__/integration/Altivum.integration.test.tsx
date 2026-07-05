import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import Altivum from '../../pages/Altivum';

// Mock static image imports
vi.mock('../../assets/altivum.jpg', () => ({ default: '/mock-altivum.jpg' }));
vi.mock('../../assets/aws-partner-dark.png', () => ({
  default: '/mock-aws-partner-dark.png',
}));
vi.mock('../../assets/altivum.png', () => ({ default: '/mock-altivum.png' }));

const renderAltivum = () =>
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={['/altivum']}>
        <Altivum />
      </MemoryRouter>
    </HelmetProvider>,
  );

describe('Altivum Page Integration', () => {
  it('labels the chamber-recognition external link with destination and new-tab context', () => {
    renderAltivum();
    const chamberLink = screen.getByRole('link', {
      name: /veteran business of the month.*opens in new tab/i,
    });
    expect(chamberLink).toHaveAttribute('target', '_blank');
    expect(chamberLink).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('renders the three imperatives in both the timeline and mission sections', () => {
    renderAltivum();
    // Each imperative title appears once in the founder-journey list and once in
    // the mission-statement grid — proving the hoisted IMPERATIVES const drives both.
    expect(screen.getAllByText(/Advance AI through real-world application/)).toHaveLength(2);
    expect(screen.getAllByText(/Strengthen human-machine integration/)).toHaveLength(2);
    expect(screen.getAllByText(/Position veterans as strategic leaders/)).toHaveLength(2);
  });

  it('applies the standard button recipe to the learn-more CTAs', () => {
    renderAltivum();
    const visitCta = screen.getByRole('link', { name: 'Visit Altivum.ai' });
    expect(visitCta.className).toContain('min-h-[48px]');
    expect(visitCta.className).toContain('touch-manipulation');
    expect(visitCta.className).toContain('active:scale-[0.98]');

    const contactCta = screen.getByRole('link', { name: 'Get in Touch' });
    expect(contactCta).toHaveAttribute('href', '/contact');
    expect(contactCta.className).toContain('min-h-[48px]');
  });
});
