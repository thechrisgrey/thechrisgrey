import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import FadeReveal from './FadeReveal';

vi.mock('gsap', () => ({
  default: {
    registerPlugin: vi.fn(),
    timeline: vi.fn(() => ({
      fromTo: vi.fn(),
      scrollTrigger: { kill: vi.fn() },
      kill: vi.fn(),
    })),
  },
  gsap: {
    registerPlugin: vi.fn(),
    timeline: vi.fn(() => ({
      fromTo: vi.fn(),
      scrollTrigger: { kill: vi.fn() },
      kill: vi.fn(),
    })),
  },
}));

vi.mock('gsap/ScrollTrigger', () => ({
  ScrollTrigger: {},
}));

describe('FadeReveal', () => {
  it('renders children content', () => {
    render(
      <FadeReveal>
        <p>Hello World</p>
      </FadeReveal>,
    );
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('applies className prop', () => {
    const { container } = render(<FadeReveal className="custom-fade">Content</FadeReveal>);
    expect(container.firstChild).toHaveClass('custom-fade');
  });

  it('applies style prop merged with opacity', () => {
    const { container } = render(<FadeReveal style={{ fontSize: '16px' }}>Content</FadeReveal>);
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveStyle({ fontSize: '16px', opacity: '0' });
  });

  it('starts with opacity 0 for animation', () => {
    const { container } = render(<FadeReveal>Content</FadeReveal>);
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveStyle({ opacity: '0' });
  });

  it('renders plain div without opacity when prefers-reduced-motion is active', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }));

    const { container } = render(<FadeReveal>Content</FadeReveal>);
    const el = container.firstChild as HTMLElement;
    expect(el.style.opacity).not.toBe('0');
    expect(screen.getByText('Content')).toBeInTheDocument();

    vi.restoreAllMocks();
  });

  it('renders complex children correctly', () => {
    render(
      <FadeReveal>
        <span>First</span>
        <span>Second</span>
      </FadeReveal>,
    );
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
  });

  it('renders the final state (no opacity:0) when the prerender flag is set', () => {
    // The build-time Puppeteer crawl sets window.__PRERENDER__ before navigating
    // to each route. Components that animate opacity:0 → 1 must render their
    // final state in that case, otherwise the static HTML AI/SEO crawlers consume
    // hides the page's actual content.
    (window as unknown as { __PRERENDER__: boolean }).__PRERENDER__ = true;
    try {
      const { container } = render(<FadeReveal>Prerendered content</FadeReveal>);
      const el = container.firstChild as HTMLElement;
      expect(el.style.opacity).not.toBe('0');
      expect(screen.getByText('Prerendered content')).toBeInTheDocument();
    } finally {
      delete (window as unknown as { __PRERENDER__?: boolean }).__PRERENDER__;
    }
  });
});
