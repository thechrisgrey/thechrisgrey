import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AboutSection from './AboutSection';

vi.mock('gsap', () => ({
  default: {
    registerPlugin: vi.fn(),
    fromTo: vi.fn(() => ({ scrollTrigger: { kill: vi.fn() }, kill: vi.fn() })),
    timeline: vi.fn(() => ({
      fromTo: vi.fn(),
      scrollTrigger: { kill: vi.fn() },
      kill: vi.fn(),
    })),
  },
  gsap: {
    registerPlugin: vi.fn(),
    fromTo: vi.fn(() => ({ scrollTrigger: { kill: vi.fn() }, kill: vi.fn() })),
    timeline: vi.fn(() => ({
      fromTo: vi.fn(),
      scrollTrigger: { kill: vi.fn() },
      kill: vi.fn(),
    })),
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

describe('AboutSection', () => {
  const renderSection = () =>
    render(
      <MemoryRouter>
        <AboutSection />
      </MemoryRouter>
    );

  it('renders the (ABOUT) eyebrow', () => {
    renderSection();
    expect(screen.getByText('(ABOUT)')).toBeInTheDocument();
  });

  it('renders the display headline words', () => {
    renderSection();
    expect(screen.getByText(/QUIET/)).toBeInTheDocument();
    expect(screen.getByText(/RELENTLESS/)).toBeInTheDocument();
  });

  it('links to the full story', () => {
    renderSection();
    expect(screen.getByRole('link', { name: /THE FULL STORY/i })).toHaveAttribute(
      'href',
      '/about'
    );
  });

  it('renders the graded portrait', () => {
    renderSection();
    expect(screen.getByAltText(/Christian Perez/)).toBeInTheDocument();
  });
});
