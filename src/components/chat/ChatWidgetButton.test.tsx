import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatWidgetButton from './ChatWidgetButton';

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

  it('should show "chat" icon when closed', () => {
    render(<ChatWidgetButton isOpen={false} onClick={vi.fn()} />);
    const icon = screen.getByText('chat');
    expect(icon).toBeInTheDocument();
  });

  it('should show "close" icon when open', () => {
    render(<ChatWidgetButton isOpen={true} onClick={vi.fn()} />);
    const icon = screen.getByText('close');
    expect(icon).toBeInTheDocument();
  });

  it('should call onClick when clicked', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<ChatWidgetButton isOpen={false} onClick={onClick} />);

    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
