import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CtaSection from './CtaSection';

vi.mock('gsap', () => ({
  default: {
    registerPlugin: vi.fn(),
    fromTo: vi.fn(() => ({ scrollTrigger: { kill: vi.fn() }, kill: vi.fn() })),
  },
  gsap: {
    registerPlugin: vi.fn(),
    fromTo: vi.fn(() => ({ scrollTrigger: { kill: vi.fn() }, kill: vi.fn() })),
  },
}));
vi.mock('gsap/ScrollTrigger', () => ({ ScrollTrigger: {} }));

const scrollToMock = vi.fn();
vi.mock('../../hooks/useLenis', () => ({
  useLenisContext: () => ({ lenis: null, scrollTo: scrollToMock }),
}));

describe('CtaSection', () => {
  const renderSection = () =>
    render(
      <MemoryRouter>
        <CtaSection />
      </MemoryRouter>
    );

  it('renders the porcelain section with the display headline', () => {
    renderSection();
    expect(screen.getByText(/BUILD SOMETHING/)).toBeInTheDocument();
    expect(screen.getByText(/WORTH KEEPING\./)).toBeInTheDocument();
  });

  it('links the primary pill to /contact', () => {
    renderSection();
    expect(screen.getByRole('link', { name: /Start a conversation/i })).toHaveAttribute(
      'href',
      '/contact'
    );
  });

  it('scrolls to the footer newsletter on secondary pill click', () => {
    renderSection();
    screen.getByRole('button', { name: /Newsletter/i }).click();
    expect(scrollToMock).toHaveBeenCalledWith('#newsletter', expect.anything());
  });
});
