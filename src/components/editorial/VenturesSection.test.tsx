import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import VenturesSection from './VenturesSection';

const scrollTriggerStub = { kill: vi.fn(), progress: 0 };
vi.mock('gsap', () => ({
  default: {
    registerPlugin: vi.fn(),
    to: vi.fn(() => ({ scrollTrigger: scrollTriggerStub, kill: vi.fn() })),
    fromTo: vi.fn(() => ({ scrollTrigger: scrollTriggerStub, kill: vi.fn() })),
  },
  gsap: {
    registerPlugin: vi.fn(),
    to: vi.fn(() => ({ scrollTrigger: scrollTriggerStub, kill: vi.fn() })),
    fromTo: vi.fn(() => ({ scrollTrigger: scrollTriggerStub, kill: vi.fn() })),
  },
}));
vi.mock('gsap/ScrollTrigger', () => ({ ScrollTrigger: { refresh: vi.fn() } }));
vi.mock('@react-three/fiber', () => ({
  useFrame: vi.fn(),
  useThree: () => ({ invalidate: vi.fn() }),
}));
vi.mock('@react-three/drei', () => ({
  View: Object.assign(() => null, { Port: () => null }),
  PerspectiveCamera: () => null,
  useTexture: () => ({}),
}));

describe('VenturesSection', () => {
  const renderSection = () =>
    render(
      <MemoryRouter>
        <VenturesSection />
      </MemoryRouter>
    );

  it('renders the (VENTURES) eyebrow and numbered indicator', () => {
    renderSection();
    expect(screen.getByText('(VENTURES)')).toBeInTheDocument();
    expect(screen.getByText('(1)')).toBeInTheDocument();
    expect(screen.getByText('(4)')).toBeInTheDocument();
  });

  it('renders all four venture panels with links', () => {
    renderSection();
    expect(screen.getByRole('link', { name: /Altivum/i })).toHaveAttribute('href', '/altivum');
    expect(screen.getByRole('link', { name: /Vector/i })).toHaveAttribute('href', '/podcast');
    expect(screen.getByRole('link', { name: /Assessment/i })).toHaveAttribute(
      'href',
      '/beyond-the-assessment'
    );
    expect(screen.getByRole('link', { name: /Cloud & AI/i })).toHaveAttribute('href', '/aws');
  });

  it('uses a horizontally scrollable list (keyboard/touch fallback path)', () => {
    const { container } = renderSection();
    const track = container.querySelector('[data-ventures-track]');
    expect(track).not.toBeNull();
  });

  it('updates the active indicator from track scroll position in fallback mode', () => {
    const { container } = renderSection();
    const track = container.querySelector('[data-ventures-track]') as HTMLDivElement;

    // jsdom layout is all zeros — stub the scroll geometry of a track scrolled
    // exactly one third of its travel: 300 / (2000 - 1100) = 1/3 → panel 2.
    Object.defineProperty(track, 'scrollLeft', { value: 300, configurable: true });
    Object.defineProperty(track, 'scrollWidth', { value: 2000, configurable: true });
    Object.defineProperty(track, 'clientWidth', { value: 1100, configurable: true });
    fireEvent.scroll(track);

    const indicators = screen.getAllByText(/^\(\d\)$/);
    expect(indicators[1].className).toContain('text-altivum-gold');
    expect(indicators[0].className).not.toContain('text-altivum-gold');

    // Scroll to the end → last panel active.
    Object.defineProperty(track, 'scrollLeft', { value: 900, configurable: true });
    fireEvent.scroll(track);
    expect(indicators[3].className).toContain('text-altivum-gold');
    expect(indicators[1].className).not.toContain('text-altivum-gold');
  });
});
