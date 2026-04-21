import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ArchitectureXRay } from '../ArchitectureXRay';
import { pipelineNodes } from '../../../data/architectureNodes';

// Mock GSAP -- gsap.to must invoke onComplete synchronously so close animations complete
vi.mock('gsap', () => ({
  default: {
    from: vi.fn(),
    to: vi.fn((_target: unknown, vars: Record<string, unknown>) => {
      if (typeof vars?.onComplete === 'function') {
        (vars.onComplete as () => void)();
      }
    }),
    timeline: vi.fn(() => ({
      to: vi.fn().mockReturnThis(),
      play: vi.fn(),
      kill: vi.fn(),
    })),
  },
}));

// Mock useMediaQuery to return desktop layout
vi.mock('../../../hooks/useMediaQuery', () => ({
  useMediaQuery: () => true,
}));

// Mock chatSigning
vi.mock('../../../utils/chatSigning', () => ({
  getSignedHeaders: vi.fn(),
}));

// Mock TraceInput (not needed for these tests, simplifies render)
vi.mock('../TraceInput', () => ({
  TraceInput: () => <div data-testid="trace-input" />,
}));

// Mock TraceResponseBubble
vi.mock('../TraceResponseBubble', () => ({
  TraceResponseBubble: () => null,
}));

describe('ArchitectureXRay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('renders all 7 node labels', () => {
    render(<ArchitectureXRay />);

    for (const node of pipelineNodes) {
      expect(screen.getByText(node.label)).toBeInTheDocument();
    }
  });

  it('clicking a node shows the NodeDetailPanel with that node service name', async () => {
    const user = userEvent.setup();
    render(<ArchitectureXRay />);

    const firstNode = pipelineNodes[0];
    const nodeButton = screen.getByRole('button', { name: firstNode.label });
    await user.click(nodeButton);

    expect(screen.getByText(firstNode.service)).toBeInTheDocument();
  });

  it('clicking another node swaps the detail panel content', async () => {
    const user = userEvent.setup();
    render(<ArchitectureXRay />);

    const firstNode = pipelineNodes[0];
    const secondNode = pipelineNodes[1];

    // Click first node
    await user.click(screen.getByRole('button', { name: firstNode.label }));
    expect(screen.getByText(firstNode.service)).toBeInTheDocument();

    // Click second node
    await user.click(screen.getByRole('button', { name: secondNode.label }));
    expect(screen.getByText(secondNode.service)).toBeInTheDocument();
    expect(screen.queryByText(firstNode.service)).not.toBeInTheDocument();
  });

  it('pressing Escape closes the detail panel', async () => {
    const user = userEvent.setup();
    render(<ArchitectureXRay />);

    const firstNode = pipelineNodes[0];
    await user.click(screen.getByRole('button', { name: firstNode.label }));
    expect(screen.getByText(firstNode.service)).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText(firstNode.service)).not.toBeInTheDocument();
  });
});
