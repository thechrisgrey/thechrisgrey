import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatWidgetButton from './ChatWidgetButton';

// Mock AltiMascot since Three.js Canvas doesn't work in jsdom
vi.mock('./AltiMascot', () => ({
  default: ({ isOpen }: { isOpen: boolean }) => (
    <div data-testid="alti-mascot" data-is-open={isOpen} />
  ),
}));

describe('ChatWidgetButton', () => {
  it('should render with "Open chat" label when closed', () => {
    render(<ChatWidgetButton isOpen={false} onClick={vi.fn()} />);
    const button = screen.getByRole('button', { name: /open chat/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('should render with "Close chat" label when open', () => {
    render(<ChatWidgetButton isOpen={true} onClick={vi.fn()} />);
    const button = screen.getByRole('button', { name: /close chat/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });

  it('should render AltiMascot with isOpen prop', async () => {
    render(<ChatWidgetButton isOpen={false} onClick={vi.fn()} />);
    const mascot = await screen.findByTestId('alti-mascot');
    expect(mascot).toBeInTheDocument();
    expect(mascot).toHaveAttribute('data-is-open', 'false');
  });

  it('should pass isOpen=true to AltiMascot when open', async () => {
    render(<ChatWidgetButton isOpen={true} onClick={vi.fn()} />);
    const mascot = await screen.findByTestId('alti-mascot');
    expect(mascot).toHaveAttribute('data-is-open', 'true');
  });

  it('should call onClick when clicked', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<ChatWidgetButton isOpen={false} onClick={onClick} />);

    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
