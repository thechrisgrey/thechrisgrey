import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import BlogPostSkeleton from './BlogPostSkeleton';

describe('BlogPostSkeleton', () => {
  it('should render with aria-hidden="true"', () => {
    const { container } = render(<BlogPostSkeleton />);
    const article = container.querySelector('article');
    expect(article).toBeInTheDocument();
    expect(article).toHaveAttribute('aria-hidden', 'true');
  });

  it('should render as an article element', () => {
    const { container } = render(<BlogPostSkeleton />);
    const article = container.querySelector('article');
    expect(article).not.toBeNull();
  });

  it('should contain shimmer animation classes', () => {
    const { container } = render(<BlogPostSkeleton />);
    const shimmerElements = container.querySelectorAll('.animate-shimmer');
    expect(shimmerElements.length).toBeGreaterThan(0);
  });

  it('should render an aspect-video placeholder for the image', () => {
    const { container } = render(<BlogPostSkeleton />);
    const videoPlaceholder = container.querySelector('.aspect-video');
    expect(videoPlaceholder).not.toBeNull();
  });

  it('should render multiple skeleton lines for text content', () => {
    const { container } = render(<BlogPostSkeleton />);
    // There should be multiple placeholder divs with shimmer class
    const shimmerDivs = container.querySelectorAll('.animate-shimmer');
    // At least image + several text lines + tag pills
    expect(shimmerDivs.length).toBeGreaterThanOrEqual(8);
  });

  it('should render tag skeleton pills with rounded-full class', () => {
    const { container } = render(<BlogPostSkeleton />);
    const roundedFullElements = container.querySelectorAll('.rounded-full');
    expect(roundedFullElements.length).toBeGreaterThanOrEqual(2);
  });
});
