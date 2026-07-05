import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import LenisProvider from './LenisProvider';
import { useLenisContext } from '../hooks/useLenis';

// vitest 4 no longer treats `vi.fn(() => obj)` as a constructable function
// when used with `new` (arrow-function impls cannot be construct-called).
// Use a real class so `new Lenis(...)` in useLenis.ts works under the mock.
vi.mock('lenis', () => ({
  default: class MockLenis {
    destroy = vi.fn();
    raf = vi.fn();
    scrollTo = vi.fn();
    on = vi.fn();
    off = vi.fn();
  },
}));

function TestConsumer() {
  const { lenis } = useLenisContext();
  return <span data-testid="status">{lenis ? 'active' : 'inactive'}</span>;
}

describe('LenisProvider', () => {
  it('renders children', () => {
    render(
      <LenisProvider>
        <p>Child content</p>
      </LenisProvider>,
    );
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('provides lenis instance via context', () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);

    render(
      <LenisProvider>
        <TestConsumer />
      </LenisProvider>,
    );
    expect(screen.getByTestId('status').textContent).toBe('active');

    vi.restoreAllMocks();
  });

  it('provides null lenis when reduced motion is preferred', () => {
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

    render(
      <LenisProvider>
        <TestConsumer />
      </LenisProvider>,
    );
    expect(screen.getByTestId('status').textContent).toBe('inactive');

    vi.restoreAllMocks();
  });
});
