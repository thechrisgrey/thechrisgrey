import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Eyebrow from './Eyebrow';

vi.mock('gsap', () => ({
  default: {
    registerPlugin: vi.fn(),
    fromTo: vi.fn(() => ({ scrollTrigger: { kill: vi.fn() }, kill: vi.fn() })),
  },
  gsap: {
    registerPlugin: vi.fn(),
    fromTo: vi.fn(() => ({ scrollTrigger: { kill: vi.fn() }, kill: vi.fn() })),
  },
}));

vi.mock('gsap/ScrollTrigger', () => ({ ScrollTrigger: {} }));

describe('Eyebrow', () => {
  it('wraps the label in parentheses', () => {
    render(<Eyebrow>ABOUT</Eyebrow>);
    expect(screen.getByText('(ABOUT)')).toBeInTheDocument();
  });

  it('applies the editorial eyebrow style (italic, letter-spaced)', () => {
    render(<Eyebrow>THE RECORD</Eyebrow>);
    const el = screen.getByText('(THE RECORD)');
    expect(el.style.fontStyle).toBe('italic');
    expect(el.style.letterSpacing).toBe('0.25em');
  });

  it('passes through className', () => {
    render(<Eyebrow className="text-altivum-dark/50">NEXT</Eyebrow>);
    expect(screen.getByText('(NEXT)')).toHaveClass('text-altivum-dark/50');
  });
});
