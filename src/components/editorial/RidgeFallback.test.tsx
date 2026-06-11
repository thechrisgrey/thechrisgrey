import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import RidgeFallback from './RidgeFallback';

describe('RidgeFallback', () => {
  it('renders a decorative SVG with gold contour paths', () => {
    const { container } = render(<RidgeFallback />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelectorAll('path').length).toBeGreaterThanOrEqual(4);
  });

  it('hides itself when the canvas is ready', () => {
    const { container } = render(<RidgeFallback hidden />);
    expect((container.firstChild as HTMLElement).className).toContain('opacity-0');
  });
});
