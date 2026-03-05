import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import BlogPostArticleSkeleton from './BlogPostArticleSkeleton';

describe('BlogPostArticleSkeleton', () => {
  it('should render without crashing', () => {
    const { container } = render(<BlogPostArticleSkeleton />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('should be hidden from screen readers with aria-hidden', () => {
    const { container } = render(<BlogPostArticleSkeleton />);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('should contain shimmer/pulse animation elements', () => {
    const { container } = render(<BlogPostArticleSkeleton />);
    const pulseElements = container.querySelectorAll('.animate-pulse');
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  it('should render the hero image placeholder', () => {
    const { container } = render(<BlogPostArticleSkeleton />);
    const heroPlaceholder = container.querySelector('.aspect-\\[3\\/1\\]');
    expect(heroPlaceholder).toBeInTheDocument();
  });
});
