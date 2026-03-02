import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TypingIndicator from './TypingIndicator';

describe('TypingIndicator', () => {
  it('should render with role="status"', () => {
    render(<TypingIndicator />);
    const statusElement = screen.getByRole('status');
    expect(statusElement).toBeInTheDocument();
  });

  it('should have aria-label "AI is typing"', () => {
    render(<TypingIndicator />);
    const statusElement = screen.getByRole('status');
    expect(statusElement).toHaveAttribute('aria-label', 'AI is typing');
  });

  it('should render 3 bouncing dot elements', () => {
    const { container } = render(<TypingIndicator />);
    const dots = container.querySelectorAll('.animate-bounce');
    expect(dots).toHaveLength(3);
  });

  it('should have different animation delays for each dot', () => {
    const { container } = render(<TypingIndicator />);
    const dots = container.querySelectorAll('.animate-bounce');

    expect(dots[0]).toHaveStyle({ animationDelay: '0ms' });
    expect(dots[1]).toHaveStyle({ animationDelay: '150ms' });
    expect(dots[2]).toHaveStyle({ animationDelay: '300ms' });
  });

  it('should have consistent animation duration across all dots', () => {
    const { container } = render(<TypingIndicator />);
    const dots = container.querySelectorAll('.animate-bounce');

    dots.forEach((dot) => {
      expect(dot).toHaveStyle({ animationDuration: '0.6s' });
    });
  });

  it('should render dots as rounded elements', () => {
    const { container } = render(<TypingIndicator />);
    const dots = container.querySelectorAll('.rounded-full');
    expect(dots).toHaveLength(3);
  });
});
