import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SocialIcon from './SocialIcon';

describe('SocialIcon', () => {
  it('should render an SVG for a known fill-based platform', () => {
    const { container } = render(<SocialIcon platform="linkedin" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('fill', 'currentColor');
  });

  it('should render an SVG for a known stroke-based platform', () => {
    const { container } = render(<SocialIcon platform="email" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('fill', 'none');
    expect(svg).toHaveAttribute('stroke', 'currentColor');
  });

  it('should return null for an unknown platform', () => {
    const { container } = render(<SocialIcon platform="nonexistent" />);
    expect(container.innerHTML).toBe('');
  });

  it('should apply default className', () => {
    const { container } = render(<SocialIcon platform="github" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveClass('w-6', 'h-6');
  });

  it('should apply custom className', () => {
    const { container } = render(<SocialIcon platform="twitter" className="w-8 h-8" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveClass('w-8', 'h-8');
  });

  it('should apply fillRule and clipRule for github icon', () => {
    const { container } = render(<SocialIcon platform="github" />);
    const path = container.querySelector('path');
    expect(path).toHaveAttribute('fill-rule', 'evenodd');
    expect(path).toHaveAttribute('clip-rule', 'evenodd');
  });

  it('should render all known platforms without error', () => {
    const platforms = [
      'linkedin', 'twitter', 'facebook', 'github', 'instagram',
      'youtube', 'substack', 'linktree', 'devto', 'aws', 'email', 'asu',
    ];

    platforms.forEach((platform) => {
      const { container, unmount } = render(<SocialIcon platform={platform} />);
      expect(container.querySelector('svg')).toBeInTheDocument();
      unmount();
    });
  });
});
