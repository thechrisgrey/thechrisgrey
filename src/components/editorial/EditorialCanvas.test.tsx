import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EditorialCanvasProvider, useEditorialCanvas } from './EditorialCanvas';

vi.mock('@react-three/fiber', () => ({
  Canvas: () => null,
}));
vi.mock('@react-three/drei', () => ({
  View: Object.assign(() => null, { Port: () => null }),
}));

const Probe = () => {
  const { ready } = useEditorialCanvas();
  return <span data-testid="probe">{ready ? 'ready' : 'fallback'}</span>;
};

describe('EditorialCanvasProvider', () => {
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
  });
});
