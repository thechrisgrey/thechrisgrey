import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import Eyebrow from './Eyebrow';

const { fromToMock, tweenKillSpy, scrollTriggerKillSpy } = vi.hoisted(() => {
  const tweenKillSpy = vi.fn();
  const scrollTriggerKillSpy = vi.fn();
  const fromToMock = vi.fn(() => ({
    scrollTrigger: { kill: scrollTriggerKillSpy },
    kill: tweenKillSpy,
  }));
  return { fromToMock, tweenKillSpy, scrollTriggerKillSpy };
});

vi.mock('gsap', () => ({
  default: {
    registerPlugin: vi.fn(),
    fromTo: fromToMock,
  },
  gsap: {
    registerPlugin: vi.fn(),
    fromTo: fromToMock,
  },
}));

vi.mock('gsap/ScrollTrigger', () => ({ ScrollTrigger: {} }));

describe('Eyebrow', () => {
  beforeEach(() => {
    fromToMock.mockClear();
    tweenKillSpy.mockClear();
    scrollTriggerKillSpy.mockClear();
  });

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

  it('skips the wipe animation when prefers-reduced-motion is active', () => {
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

    render(<Eyebrow>CALM</Eyebrow>);
    expect(screen.getByText('(CALM)')).toBeInTheDocument();
    expect(fromToMock).not.toHaveBeenCalled();

    vi.restoreAllMocks();
  });

  it('skips the wipe animation during prerender', () => {
    const win = window as unknown as { __PRERENDER__?: boolean };
    win.__PRERENDER__ = true;

    try {
      render(<Eyebrow>STATIC</Eyebrow>);
      expect(screen.getByText('(STATIC)')).toBeInTheDocument();
      expect(fromToMock).not.toHaveBeenCalled();
    } finally {
      delete win.__PRERENDER__;
    }
  });

  it('kills the tween and its ScrollTrigger on unmount', () => {
    const { unmount } = render(<Eyebrow>BYE</Eyebrow>);
    expect(fromToMock).toHaveBeenCalledTimes(1);

    unmount();
    expect(scrollTriggerKillSpy).toHaveBeenCalledTimes(1);
    expect(tweenKillSpy).toHaveBeenCalledTimes(1);
  });
});
