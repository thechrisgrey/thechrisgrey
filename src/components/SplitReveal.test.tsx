import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import SplitReveal from './SplitReveal';

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

describe('SplitReveal', () => {
  it('renders each word in a separate span', () => {
    render(<SplitReveal>Hello World Test</SplitReveal>);
    const wordSpans = screen.getAllByText(/^(Hello|World|Test)$/);
    expect(wordSpans).toHaveLength(3);
  });

  it('renders with the specified tag', () => {
    const { container } = render(<SplitReveal as="h3">Title Text</SplitReveal>);
    expect(container.querySelector('h3')).not.toBeNull();
  });

  it('renders as an h2 when as="h2" (home key-point titles)', () => {
    const { container } = render(<SplitReveal as="h2">Key Point</SplitReveal>);
    expect(container.querySelector('h2')).not.toBeNull();
    expect(container.querySelector('h2')?.textContent).toBe('Key Point');
  });

  it('applies className and style props', () => {
    const { container } = render(
      <SplitReveal className="test-class" style={{ fontSize: '20px' }}>
        Word
      </SplitReveal>,
    );
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveClass('test-class');
    expect(el).toHaveStyle({ fontSize: '20px' });
  });

  it('renders spaces between words for accessible textContent', () => {
    const { container } = render(<SplitReveal>Two Words</SplitReveal>);
    const text = container.textContent;
    expect(text).toContain('Two');
    expect(text).toContain('Words');
  });

  it('adds split-word-inner class to inner spans', () => {
    const { container } = render(<SplitReveal>Hello</SplitReveal>);
    const inner = container.querySelector('.split-word-inner');
    expect(inner).not.toBeNull();
    expect(inner?.textContent).toBe('Hello');
  });

  it('renders plain text when prefers-reduced-motion is active', () => {
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

    const { container } = render(<SplitReveal as="h3">Plain Text</SplitReveal>);
    expect(container.querySelector('.split-word-inner')).toBeNull();
    expect(container.querySelector('h3')?.textContent).toBe('Plain Text');

    vi.restoreAllMocks();
  });

  it('handles single-word text correctly', () => {
    render(<SplitReveal>Solo</SplitReveal>);
    expect(screen.getByText('Solo')).toBeInTheDocument();
  });

  it('renders the final state (no .split-word-inner shells) when prerendering', () => {
    // The build-time Puppeteer crawl sets window.__PRERENDER__ before navigating
    // to each route. The Home page renders its 8 key-point titles via SplitReveal;
    // if we keep the opacity-0 shells, the static HTML AI/SEO crawlers consume
    // hides those titles. Render the final plain-text state instead.
    (window as unknown as { __PRERENDER__: boolean }).__PRERENDER__ = true;
    try {
      const { container } = render(<SplitReveal as="h3">Personal Biography</SplitReveal>);
      expect(container.querySelector('.split-word-inner')).toBeNull();
      expect(container.querySelector('h3')?.textContent).toBe('Personal Biography');
    } finally {
      delete (window as unknown as { __PRERENDER__?: boolean }).__PRERENDER__;
    }
  });
});
