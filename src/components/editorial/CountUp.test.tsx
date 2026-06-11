import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import CountUp from './CountUp';

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

describe('CountUp', () => {
  beforeEach(() => {
    fromToMock.mockClear();
    tweenKillSpy.mockClear();
    scrollTriggerKillSpy.mockClear();
  });

  it('renders the final value as text from first paint', () => {
    render(<CountUp value={18} suffix="D" caption="Special Forces Medical Sergeant" />);
    const numeral = screen.getByText('18');
    expect(numeral).toBeInTheDocument();
    expect(screen.getByText('D')).toBeInTheDocument();
    // The visual layer is hidden from assistive tech; the sr-only span speaks.
    expect(numeral.parentElement).toHaveAttribute('aria-hidden', 'true');
  });

  it('exposes one combined accessible label', () => {
    render(<CountUp value={60} suffix="+" caption="podcast episodes" />);
    expect(screen.getByText('60+ — podcast episodes')).toBeInTheDocument();
  });

  it('renders the caption', () => {
    render(<CountUp value={3} suffix="x" caption="ventures built and operating" />);
    expect(screen.getByText('ventures built and operating')).toBeInTheDocument();
  });

  it('renders without a suffix', () => {
    render(<CountUp value={1} caption="book" />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('1 — book')).toBeInTheDocument();
  });

  // Guard-path tests (matching Eyebrow.test.tsx pattern)

  it('skips the roll-up animation when prefers-reduced-motion is active', () => {
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

    try {
      render(<CountUp value={18} suffix="D" caption="Special Forces Medical Sergeant" />);
      expect(screen.getByText('18')).toBeInTheDocument();
      expect(fromToMock).not.toHaveBeenCalled();
    } finally {
      vi.restoreAllMocks();
    }
  });

  it('skips the roll-up animation during prerender', () => {
    const win = window as unknown as { __PRERENDER__?: boolean };
    win.__PRERENDER__ = true;

    try {
      render(<CountUp value={60} suffix="+" caption="podcast episodes" />);
      expect(screen.getByText('60')).toBeInTheDocument();
      expect(fromToMock).not.toHaveBeenCalled();
    } finally {
      delete win.__PRERENDER__;
    }
  });

  it('kills the tween and its ScrollTrigger on unmount and restores final value', () => {
    const { unmount } = render(
      <CountUp value={3} suffix="x" caption="ventures built and operating" />
    );
    expect(fromToMock).toHaveBeenCalledTimes(1);

    // Drive the tween's onUpdate by hand — the internal counter starts at 0,
    // so the numeral shows the transient roll-up value.
    const numeral = screen.getByText('3');
    const toVars = (fromToMock.mock.calls[0] as unknown[])[2] as { onUpdate: () => void };
    toVars.onUpdate();
    expect(numeral.textContent).toBe('0');

    unmount();
    expect(scrollTriggerKillSpy).toHaveBeenCalledTimes(1);
    expect(tweenKillSpy).toHaveBeenCalledTimes(1);
    expect(numeral.textContent).toBe('3');
  });
});
