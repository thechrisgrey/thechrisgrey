import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TopologyFallback2D } from '../TopologyFallback2D';
import { clusters } from '../../../data/infrastructureTopology';

// Mock GSAP
vi.mock('gsap', () => ({
  default: {
    from: vi.fn(),
    to: vi.fn(),
  },
}));

// Mock useFocusTrap
vi.mock('../../../hooks/useFocusTrap', () => ({
  useFocusTrap: () => ({ containerRef: { current: null }, handleKeyDown: vi.fn() }),
}));

describe('TopologyFallback2D', () => {
  it('renders 6 cluster labels', () => {
    render(<TopologyFallback2D />);

    for (const cluster of clusters) {
      expect(screen.getByText(cluster.label)).toBeInTheDocument();
    }
  });

  it('clicking a cluster shows FallbackDetail with service names', async () => {
    const user = userEvent.setup();
    render(<TopologyFallback2D />);

    const firstCluster = clusters[0];
    const clusterButton = screen.getByRole('button', {
      name: new RegExp(firstCluster.label),
    });
    await user.click(clusterButton);

    for (const service of firstCluster.services) {
      expect(screen.getByText(service.name)).toBeInTheDocument();
    }
  });

  it('clicking another cluster swaps the detail panel', async () => {
    const user = userEvent.setup();
    render(<TopologyFallback2D />);

    const firstCluster = clusters[0];
    const secondCluster = clusters[1];

    // Click first cluster
    await user.click(
      screen.getByRole('button', { name: new RegExp(firstCluster.label) })
    );
    for (const service of firstCluster.services) {
      expect(screen.getByText(service.name)).toBeInTheDocument();
    }

    // Click second cluster
    await user.click(
      screen.getByRole('button', { name: new RegExp(secondCluster.label) })
    );
    for (const service of secondCluster.services) {
      expect(screen.getByText(service.name)).toBeInTheDocument();
    }
  });

  it('pressing Escape closes the panel', async () => {
    const user = userEvent.setup();
    render(<TopologyFallback2D />);

    const firstCluster = clusters[0];
    await user.click(
      screen.getByRole('button', { name: new RegExp(firstCluster.label) })
    );

    // Verify the detail panel is open (shows service names)
    expect(screen.getByText(firstCluster.services[0].name)).toBeInTheDocument();

    // Press Escape
    fireEvent.keyDown(document, { key: 'Escape' });

    // Detail panel should close -- service names from FallbackDetail should be gone
    expect(screen.queryByText(firstCluster.services[0].name)).not.toBeInTheDocument();
  });
});
