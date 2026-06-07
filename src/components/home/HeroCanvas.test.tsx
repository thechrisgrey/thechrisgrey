import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';

// WebGL is unavailable in jsdom — mock R3F so the Canvas renders a marker
// element instead of touching the GPU. We drop the R3F children (mesh /
// shaderMaterial intrinsics) rather than render them as unknown DOM nodes.
vi.mock('@react-three/fiber', () => ({
  Canvas: () => <div data-testid="hero-canvas" />,
  useFrame: () => {},
  useThree: () => ({ size: { width: 800, height: 600 }, invalidate: () => {} }),
}));

// Static image import (Vite resolves this at build time).
vi.mock('../../assets/hero2.png', () => ({ default: '/mock-hero.png' }));

// Controllable reduced-motion flag.
const reducedMotionRef = { current: false };
vi.mock('../../hooks/useMediaQuery', () => ({
  useMediaQuery: () => reducedMotionRef.current,
}));

// Lenis context — no instance needed for these assertions.
vi.mock('../../hooks/useLenis', async () => {
  const actual = await vi.importActual<typeof import('../../hooks/useLenis')>(
    '../../hooks/useLenis',
  );
  return {
    ...actual,
    useLenisContext: () => ({ lenis: null, scrollTo: () => {} }),
  };
});

import Home from '../../pages/Home';

const renderHome = () =>
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={['/']}>
        <Home />
      </MemoryRouter>
    </HelmetProvider>,
  );

describe('HeroCanvas in the hero section', () => {
  beforeEach(() => {
    reducedMotionRef.current = false;
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('mounts the WebGL Canvas by default and keeps the static brandmark', async () => {
    renderHome();

    // Static brandmark (the LCP element) is always present.
    const heroImage = screen.getByAltText('Leadership Forged in Service');
    expect(heroImage).toBeInTheDocument();

    // The lazy HeroCanvas resolves asynchronously.
    const canvas = await screen.findByTestId('hero-canvas');
    expect(canvas).toBeInTheDocument();
  });

  it('does not mount the Canvas under prefers-reduced-motion, only the static image', async () => {
    reducedMotionRef.current = true;
    renderHome();

    // Static brandmark still renders.
    const heroImage = screen.getByAltText('Leadership Forged in Service');
    expect(heroImage).toBeInTheDocument();

    // Give any pending lazy import a tick to (not) resolve, then assert absence.
    await Promise.resolve();
    expect(screen.queryByTestId('hero-canvas')).not.toBeInTheDocument();
  });
});
