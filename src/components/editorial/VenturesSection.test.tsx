import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
});
