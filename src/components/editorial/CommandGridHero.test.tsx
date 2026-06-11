import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CommandGridHero from './CommandGridHero';

const { fromToMock } = vi.hoisted(() => {
  const fromToMock = vi.fn(() => ({ kill: vi.fn() }));
  return { fromToMock };
});

vi.mock('gsap', () => ({
  default: {
    registerPlugin: vi.fn(),
    fromTo: fromToMock,
  },
  gsap: {
    registerPlugin: vi.fn(),
    fromTo: fromToMock,
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

describe('useCascadeReveal — __SKIP_HERO_CASCADE__ flag', () => {
  afterEach(() => {
    // Clean up window flag between tests
    delete (window as { __SKIP_HERO_CASCADE__?: boolean }).__SKIP_HERO_CASCADE__;
  });

  it('does NOT call gsap.fromTo cascade when flag is set, and clears the flag', () => {
    (window as { __SKIP_HERO_CASCADE__?: boolean }).__SKIP_HERO_CASCADE__ = true;

    render(
      <MemoryRouter>
        <CommandGridHero />
      </MemoryRouter>
    );

    // The cascade tween (the one with stagger) must not have been called
    const cascadeCalls = fromToMock.mock.calls.filter(
      (call) => 'stagger' in ((call as unknown[])[2] as Record<string, unknown>)
    );
    expect(cascadeCalls).toHaveLength(0);

    // Flag must be consumed (set to false)
    expect((window as { __SKIP_HERO_CASCADE__?: boolean }).__SKIP_HERO_CASCADE__).toBe(false);
  });

  it('DOES call gsap.fromTo cascade on a subsequent render after flag was consumed', () => {
    // Flag already false from prior consumption (or absent)
    (window as { __SKIP_HERO_CASCADE__?: boolean }).__SKIP_HERO_CASCADE__ = false;
    fromToMock.mockClear();

    render(
      <MemoryRouter>
        <CommandGridHero />
      </MemoryRouter>
    );

    const cascadeCalls = fromToMock.mock.calls.filter(
      (call) => 'stagger' in ((call as unknown[])[2] as Record<string, unknown>)
    );
    expect(cascadeCalls).toHaveLength(1);
  });
});

describe('CommandGridHero', () => {
  beforeEach(() => {
    fromToMock.mockClear();
    // Ensure flag is not set for standard tests
    delete (window as { __SKIP_HERO_CASCADE__?: boolean }).__SKIP_HERO_CASCADE__;
  });

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

  it('cascades exactly the seven satellite tiles (scene tile excluded)', () => {
    const { container } = renderHero();
    expect(container.querySelectorAll('[data-cascade]')).toHaveLength(7);
    // Eyebrow instances also call gsap.fromTo (clip-path wipes on single
    // elements); the cascade tween is the only call carrying a stagger.
    const cascadeCalls = fromToMock.mock.calls.filter(
      (call) => 'stagger' in ((call as unknown[])[2] as Record<string, unknown>)
    );
    expect(cascadeCalls).toHaveLength(1);
    const [targets, , vars] = cascadeCalls[0] as unknown[];
    expect(targets).toHaveLength(7);
    expect((vars as Record<string, unknown>).clearProps).toBe('transform');
  });
});
