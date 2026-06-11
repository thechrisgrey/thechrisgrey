import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import EditorialImage from './EditorialImage';
import { coverScale } from './surfaceShader';

const canvasState = vi.hoisted(() => ({ ready: false }));

vi.mock('@react-three/fiber', () => ({
  useFrame: vi.fn(),
  useThree: () => ({ invalidate: vi.fn() }),
}));
vi.mock('@react-three/drei', () => ({
  // Renders the View container but never its children — the scene stays
  // "suspended" exactly like a texture that has not resolved yet.
  View: Object.assign(() => <div data-testid="surface-view" />, { Port: () => null }),
  PerspectiveCamera: () => null,
  useTexture: () => ({}),
}));
vi.mock('./EditorialCanvas', () => ({
  useEditorialCanvas: () => ({ ready: canvasState.ready, invalidate: vi.fn() }),
}));

describe('EditorialImage', () => {
  const stem = 'venture-altivum';

  beforeEach(() => {
    canvasState.ready = false;
  });

  it('renders a real img with alt text and reserved aspect ratio', () => {
    render(<EditorialImage stem={stem} alt="Concrete curve" aspect="4 / 3" />);
    const img = screen.getByAltText('Concrete curve');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('loading', 'lazy');
    const wrapper = img.closest('[data-editorial-image]') as HTMLElement;
    expect(wrapper.style.aspectRatio).toBe('4 / 3');
  });

  it('builds avif/webp sources and jpg fallback from the stem', () => {
    const { container } = render(
      <EditorialImage stem={stem} alt="Concrete curve" aspect="4 / 3" />
    );
    const sources = container.querySelectorAll('source');
    expect(sources[0].getAttribute('type')).toBe('image/avif');
    expect(sources[1].getAttribute('type')).toBe('image/webp');
    expect(sources[0].getAttribute('srcset')).toContain(`${stem}-640.avif 640w`);
    expect(sources[0].getAttribute('srcset')).toContain(`${stem}-1920.avif 1920w`);
  });

  it('discovers native widths for undersized sources (portrait has 640+1200)', () => {
    const { container } = render(
      <EditorialImage stem="portrait" alt="Christian Perez" aspect="3 / 4" />
    );
    const avif = container.querySelector('source[type="image/avif"]');
    expect(avif?.getAttribute('srcset')).toContain('portrait-640.avif 640w');
    expect(avif?.getAttribute('srcset')).toContain('portrait-1200.avif 1200w');
    expect(avif?.getAttribute('srcset')).not.toContain('1920w');
  });

  it('keeps the img fully visible when the canvas is not ready (jsdom default)', () => {
    render(<EditorialImage stem={stem} alt="Concrete curve" aspect="4 / 3" />);
    expect(screen.getByAltText('Concrete curve').className).not.toContain('opacity-0');
    expect(screen.queryByTestId('surface-view')).not.toBeInTheDocument();
  });

  it('mounts the surface view when ready but keeps the img visible until the texture loads', () => {
    canvasState.ready = true;
    render(<EditorialImage stem={stem} alt="Concrete curve" aspect="4 / 3" />);
    // jsdom has no IntersectionObserver, so the in-view gate opens immediately
    // and the View mounts — but the mocked View never renders SurfaceScene
    // (texture still "loading"), so the crossfade must not have started.
    expect(screen.getByTestId('surface-view')).toBeInTheDocument();
    expect(screen.getByAltText('Concrete curve').className).toContain('opacity-100');
  });
});

describe('coverScale', () => {
  it('crops texture width when the rect is taller than the image (portrait slot)', () => {
    const [u, v] = coverScale(0.75, 0.971);
    expect(u).toBeCloseTo(0.772, 2);
    expect(v).toBe(1);
  });

  it('crops texture height when the rect is wider than the image (hero break)', () => {
    const [u, v] = coverScale(1.778, 0.667);
    expect(u).toBe(1);
    expect(v).toBeCloseTo(0.375, 3);
  });

  it('crops texture height for a wide rect over a landscape image', () => {
    const [u, v] = coverScale(2.333, 1.5);
    expect(u).toBe(1);
    expect(v).toBeCloseTo(0.643, 3);
  });
});
