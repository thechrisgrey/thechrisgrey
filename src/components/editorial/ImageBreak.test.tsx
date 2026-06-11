import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ImageBreak from './ImageBreak';

vi.mock('gsap', () => ({
  default: {
    registerPlugin: vi.fn(),
    fromTo: vi.fn(() => ({ scrollTrigger: { kill: vi.fn() }, kill: vi.fn() })),
    set: vi.fn(),
  },
  gsap: {
    registerPlugin: vi.fn(),
    fromTo: vi.fn(() => ({ scrollTrigger: { kill: vi.fn() }, kill: vi.fn() })),
    set: vi.fn(),
  },
}));
vi.mock('gsap/ScrollTrigger', () => ({ ScrollTrigger: {} }));
vi.mock('@react-three/fiber', () => ({
  useFrame: vi.fn(),
  useThree: () => ({ invalidate: vi.fn() }),
}));
vi.mock('@react-three/drei', () => ({
  View: Object.assign(() => <div data-testid="surface-view" />, { Port: () => null }),
  PerspectiveCamera: () => null,
  useTexture: () => ({}),
}));
// Canvas forced ready: proves surface={false} keeps the View out even when
// the shared canvas would otherwise mount it.
vi.mock('./EditorialCanvas', () => ({
  useEditorialCanvas: () => ({ ready: true, invalidate: vi.fn() }),
}));

describe('ImageBreak', () => {
  it('renders the pull-quote text', () => {
    render(<ImageBreak />);
    expect(screen.getByText(/The standard is the standard/)).toBeInTheDocument();
  });

  it('renders an Interlude section with a decorative full-bleed image and no surface artifacts', () => {
    const { container } = render(<ImageBreak />);

    // <section aria-label> maps to role=region — the a11y deviation from Task 16.
    expect(screen.getByRole('region', { name: 'Interlude' })).toBeInTheDocument();

    // Decorative image: empty alt inside the EditorialImage wrapper at 21/9.
    const wrapper = container.querySelector('[data-editorial-image]') as HTMLElement;
    expect(wrapper).not.toBeNull();
    expect(wrapper.style.aspectRatio).toBe('21 / 9');
    const img = wrapper.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('alt')).toBe('');

    // surface={false}: nothing canvas-related may mount even with canvas ready.
    expect(screen.queryByTestId('surface-view')).not.toBeInTheDocument();
  });
});
