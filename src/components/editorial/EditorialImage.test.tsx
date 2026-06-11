import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import EditorialImage from './EditorialImage';

vi.mock('@react-three/fiber', () => ({
  useFrame: vi.fn(),
  useThree: () => ({ invalidate: vi.fn() }),
}));
vi.mock('@react-three/drei', () => ({
  View: Object.assign(() => null, { Port: () => null }),
  PerspectiveCamera: () => null,
  useTexture: () => ({}),
}));

describe('EditorialImage', () => {
  const stem = 'venture-altivum';

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
    expect(sources[0].getAttribute('srcset')).toContain(`640w`);
    expect(sources[0].getAttribute('srcset')).toContain(`1920w`);
  });

  it('discovers native widths for undersized sources (portrait has 640+1200)', () => {
    const { container } = render(
      <EditorialImage stem="portrait" alt="Christian Perez" aspect="3 / 4" />
    );
    const avif = container.querySelector('source[type="image/avif"]');
    expect(avif?.getAttribute('srcset')).toContain('640w');
    expect(avif?.getAttribute('srcset')).toContain('1200w');
    expect(avif?.getAttribute('srcset')).not.toContain('1920w');
  });

  it('keeps the img fully visible when the canvas is not ready (jsdom default)', () => {
    render(<EditorialImage stem={stem} alt="Concrete curve" aspect="4 / 3" />);
    expect(screen.getByAltText('Concrete curve').className).not.toContain('opacity-0');
  });
});
