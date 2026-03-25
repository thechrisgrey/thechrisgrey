import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TraceInput } from '../TraceInput';

// Mock pageContext to provide suggestions for /claude
vi.mock('../../../utils/pageContext', () => ({
  PAGE_SUGGESTIONS: {
    '/claude': [
      'How does he use Claude in production?',
      'What Anthropic Academy certifications does he have?',
    ],
  },
}));

describe('TraceInput', () => {
  it('renders input and button', () => {
    render(<TraceInput onTrace={vi.fn()} disabled={false} />);

    expect(screen.getByPlaceholderText('Ask Alti something...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /trace it/i })).toBeInTheDocument();
  });

  it('button is disabled when input is empty', () => {
    render(<TraceInput onTrace={vi.fn()} disabled={false} />);

    expect(screen.getByRole('button', { name: /trace it/i })).toBeDisabled();
  });

  it('typing text enables the button', async () => {
    const user = userEvent.setup();
    render(<TraceInput onTrace={vi.fn()} disabled={false} />);

    const input = screen.getByPlaceholderText('Ask Alti something...');
    await user.type(input, 'Hello');

    expect(screen.getByRole('button', { name: /trace it/i })).toBeEnabled();
  });

  it('clicking a suggestion calls onTrace with the suggestion text', async () => {
    const onTrace = vi.fn();
    const user = userEvent.setup();
    render(<TraceInput onTrace={onTrace} disabled={false} />);

    const suggestion = screen.getByText('How does he use Claude in production?');
    await user.click(suggestion);

    expect(onTrace).toHaveBeenCalledWith('How does he use Claude in production?');
  });

  it('pressing Enter with text calls onTrace', async () => {
    const onTrace = vi.fn();
    const user = userEvent.setup();
    render(<TraceInput onTrace={onTrace} disabled={false} />);

    const input = screen.getByPlaceholderText('Ask Alti something...');
    await user.type(input, 'Hello{Enter}');

    expect(onTrace).toHaveBeenCalledWith('Hello');
  });
});
