import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { checkWebGLSupport } from '../../../utils/checkWebGL';
import { InfraTopology } from '../InfraTopology';

vi.mock('../../../utils/checkWebGL', () => ({
  checkWebGLSupport: vi.fn(),
}));

vi.mock('../TopologyScene', () => ({
  TopologyScene: () => <div data-testid="topology-scene" />,
}));

vi.mock('../TopologyFallback2D', () => ({
  TopologyFallback2D: () => <div data-testid="topology-fallback" />,
}));

// Mock useMediaQuery -- default to desktop
vi.mock('../../../hooks/useMediaQuery', () => ({
  useMediaQuery: () => true,
}));

const mockedCheckWebGL = vi.mocked(checkWebGLSupport);

describe('InfraTopology', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders section header "The Stack"', () => {
    mockedCheckWebGL.mockReturnValue(false);
    render(<InfraTopology />);

    expect(screen.getByText('The Stack')).toBeInTheDocument();
  });

  it('renders the fallback when checkWebGLSupport returns false', () => {
    mockedCheckWebGL.mockReturnValue(false);
    render(<InfraTopology />);

    expect(screen.getByTestId('topology-fallback')).toBeInTheDocument();
    expect(screen.queryByTestId('topology-scene')).not.toBeInTheDocument();
  });
});
