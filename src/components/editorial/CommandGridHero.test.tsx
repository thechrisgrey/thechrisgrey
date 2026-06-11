import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CommandGridHero from './CommandGridHero';

vi.mock('gsap', () => ({
  default: {
    registerPlugin: vi.fn(),
    fromTo: vi.fn(() => ({ kill: vi.fn() })),
  },
  gsap: {
    registerPlugin: vi.fn(),
    fromTo: vi.fn(() => ({ kill: vi.fn() })),
  },
}));
vi.mock('gsap/ScrollTrigger', () => ({ ScrollTrigger: {} }));
vi.mock('@react-three/fiber', () => ({
  useFrame: vi.fn(),
  useThree: () => ({ invalidate: vi.fn() }),
}));
vi.mock('@react-three/drei', () => ({
  View: Object.assign(() => null, { Port: () => null }),
  PerspectiveCamera: () => null,
  useTexture: () => ({}),
}));

const renderHero = () =>
  render(
    <MemoryRouter>
      <CommandGridHero />
    </MemoryRouter>
  );

describe('CommandGridHero', () => {
  it('renders one h1 with the full accessible name', () => {
    renderHero();
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent(/Christian\s+Perez/);
  });

  it('renders the eyebrow with founder title', () => {
    renderHero();
    expect(screen.getByText('(FOUNDER & CEO — ALTIVUM INC.)')).toBeInTheDocument();
  });

  it('renders the 18D stat tile with an sr-only combined label', () => {
    renderHero();
    expect(screen.getByText('18D — Special Forces Medical Sergeant')).toBeInTheDocument();
    expect(screen.getByText('18')).toBeInTheDocument();
    expect(screen.getByText(/SF Medical Sergeant/i)).toBeInTheDocument();
  });

  it('links the wayfinding tiles to their routes', () => {
    renderHero();
    expect(screen.getByRole('link', { name: /The Vector Podcast/i })).toHaveAttribute(
      'href',
      '/podcast'
    );
    expect(screen.getByRole('link', { name: /Beyond the Assessment/i })).toHaveAttribute(
      'href',
      '/beyond-the-assessment'
    );
    expect(screen.getByRole('link', { name: /Altivum Inc/i })).toHaveAttribute('href', '/altivum');
    expect(screen.getByRole('link', { name: /Start a conversation/i })).toHaveAttribute(
      'href',
      '/contact'
    );
  });

  it('renders the static ridge fallback in jsdom (no WebGL)', () => {
    const { container } = renderHero();
    expect(container.querySelector('svg path')).not.toBeNull();
  });
});
