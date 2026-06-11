import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { EditorialCanvasProvider, useEditorialCanvas } from './EditorialCanvas';
import { checkWebGLSupport } from '../../utils/checkWebGL';

vi.mock('@react-three/fiber', () => ({
  Canvas: () => null,
}));
vi.mock('@react-three/drei', () => ({
  View: Object.assign(() => null, { Port: () => null }),
}));
vi.mock('../../utils/checkWebGL', () => ({
  checkWebGLSupport: vi.fn(() => false),
}));

const Probe = () => {
  const { ready, invalidate } = useEditorialCanvas();
  return (
    <span data-testid="probe" data-invalidate-type={typeof invalidate}>
      {ready ? 'ready' : 'fallback'}
    </span>
  );
};

describe('EditorialCanvasProvider', () => {
  beforeEach(() => {
    // Matches real jsdom behavior: no WebGL context available.
    vi.mocked(checkWebGLSupport).mockReturnValue(false);
  });

  it('renders children', () => {
    render(
      <EditorialCanvasProvider>
        <p>page content</p>
      </EditorialCanvasProvider>
    );
    expect(screen.getByText('page content')).toBeInTheDocument();
  });

  it('reports not-ready when WebGL is unavailable (jsdom)', () => {
    render(
      <EditorialCanvasProvider>
        <Probe />
      </EditorialCanvasProvider>
    );
    expect(screen.getByTestId('probe')).toHaveTextContent('fallback');
  });

  it('useEditorialCanvas defaults to not-ready outside a provider', () => {
    render(<Probe />);
    expect(screen.getByTestId('probe')).toHaveTextContent('fallback');
    // The default context must still expose a callable (noop) invalidate.
    expect(screen.getByTestId('probe')).toHaveAttribute('data-invalidate-type', 'function');
  });

  it('exposes a callable invalidate through the provider', () => {
    render(
      <EditorialCanvasProvider>
        <Probe />
      </EditorialCanvasProvider>
    );
    expect(screen.getByTestId('probe')).toHaveAttribute('data-invalidate-type', 'function');
  });

  describe('when WebGL is available', () => {
    beforeEach(() => {
      vi.mocked(checkWebGLSupport).mockReturnValue(true);
      // jsdom has no requestIdleCallback, so the setTimeout(350) branch runs.
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('mounts the shared canvas layer after the idle delay', () => {
      const { container } = render(
        <EditorialCanvasProvider>
          <p>page content</p>
        </EditorialCanvasProvider>
      );
      expect(container.querySelector('div.fixed.inset-0.z-20')).toBeNull();
      act(() => {
        vi.advanceTimersByTime(350);
      });
      expect(container.querySelector('div.fixed.inset-0.z-20')).not.toBeNull();
    });

    it('stays not-ready until the canvas reports a created GL context', () => {
      render(
        <EditorialCanvasProvider>
          <Probe />
        </EditorialCanvasProvider>
      );
      act(() => {
        vi.advanceTimersByTime(350);
      });
      // Canvas is mocked to render nothing, so onCreated never fires:
      // ready must remain false even though the canvas layer is mounted.
      expect(screen.getByTestId('probe')).toHaveTextContent('fallback');
    });
  });
});
