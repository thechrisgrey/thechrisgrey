import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import RecordSection from './RecordSection';

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

describe('RecordSection', () => {
  it('renders the (THE RECORD) eyebrow', () => {
    render(<RecordSection />);
    expect(screen.getByText('(THE RECORD)')).toBeInTheDocument();
  });

  it('renders all four stats with combined sr-only labels', () => {
    render(<RecordSection />);
    expect(screen.getByText('18D — Special Forces Medical Sergeant')).toBeInTheDocument();
    expect(screen.getByText('60+ — podcast episodes & conversations')).toBeInTheDocument();
    expect(screen.getByText('1 — book — Beyond the Assessment')).toBeInTheDocument();
    expect(screen.getByText('3x — ventures built and operating')).toBeInTheDocument();
  });
});
