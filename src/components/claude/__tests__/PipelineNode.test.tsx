import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PipelineNode } from '../PipelineNode';
import type { PipelineNodeData } from '../../../data/architectureNodes';

const mockNode: PipelineNodeData = {
  id: 'test-node',
  label: 'Test Label',
  sublabel: 'Test Sublabel',
  service: 'Test Service',
  description: 'Test description',
  config: { Key: 'Value' },
  reasoning: 'Test reasoning',
};

function renderNode(overrides: Partial<React.ComponentProps<typeof PipelineNode>> = {}) {
  const defaultProps = {
    node: mockNode,
    state: 'dim' as const,
    isExpanded: false,
    onClick: vi.fn(),
    x: 100,
    y: 50,
  };

  return render(
    <svg>
      <PipelineNode {...defaultProps} {...overrides} />
    </svg>
  );
}

describe('PipelineNode', () => {
  it('renders label and sublabel text', () => {
    renderNode();
    expect(screen.getByText('Test Label')).toBeInTheDocument();
    expect(screen.getByText('Test Sublabel')).toBeInTheDocument();
  });

  it('has correct role="button" and aria-expanded attribute', () => {
    renderNode({ isExpanded: false });
    const button = screen.getByRole('button', { name: 'Test Label' });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('keyboard Enter triggers onClick callback', () => {
    const onClick = vi.fn();
    renderNode({ onClick });
    const button = screen.getByRole('button', { name: 'Test Label' });
    fireEvent.keyDown(button, { key: 'Enter' });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('keyboard Space triggers onClick callback', () => {
    const onClick = vi.fn();
    renderNode({ onClick });
    const button = screen.getByRole('button', { name: 'Test Label' });
    fireEvent.keyDown(button, { key: ' ' });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is keyboard-focusable (tabIndex=0)', () => {
    renderNode();
    const button = screen.getByRole('button', { name: 'Test Label' });
    expect(button).toHaveAttribute('tabindex', '0');
  });

  it('does not inline-suppress the outline, so the global focus-visible ring shows', () => {
    // An inline `outline: none` would override the global `[tabindex]:focus-visible`
    // gold ring (index.css) and hide keyboard focus. Assert it is not set inline.
    renderNode();
    const button = screen.getByRole('button', { name: 'Test Label' });
    expect(button.style.outline).toBe('');
  });
});
