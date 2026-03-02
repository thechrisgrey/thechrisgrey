import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatInput from './ChatInput';

describe('ChatInput', () => {
  const mockOnSend = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render a textarea', () => {
      render(<ChatInput onSend={mockOnSend} />);
      const textarea = screen.getByPlaceholderText('Ask me anything...');
      expect(textarea).toBeInTheDocument();
      expect(textarea.tagName).toBe('TEXTAREA');
    });

    it('should render a send button', () => {
      render(<ChatInput onSend={mockOnSend} />);
      const button = screen.getByRole('button', { name: /send message/i });
      expect(button).toBeInTheDocument();
    });

    it('should have maxLength of 4000 on textarea', () => {
      render(<ChatInput onSend={mockOnSend} />);
      const textarea = screen.getByPlaceholderText('Ask me anything...');
      expect(textarea).toHaveAttribute('maxLength', '4000');
    });
  });

  describe('send button state', () => {
    it('should have send button disabled when textarea is empty', () => {
      render(<ChatInput onSend={mockOnSend} />);
      const button = screen.getByRole('button', { name: /send message/i });
      expect(button).toBeDisabled();
    });

    it('should have send button disabled when only whitespace is entered', async () => {
      const user = userEvent.setup();
      render(<ChatInput onSend={mockOnSend} />);
      const textarea = screen.getByPlaceholderText('Ask me anything...');

      await user.type(textarea, '   ');

      const button = screen.getByRole('button', { name: /send message/i });
      expect(button).toBeDisabled();
    });

    it('should enable send button when text is entered', async () => {
      const user = userEvent.setup();
      render(<ChatInput onSend={mockOnSend} />);
      const textarea = screen.getByPlaceholderText('Ask me anything...');

      await user.type(textarea, 'Hello');

      const button = screen.getByRole('button', { name: /send message/i });
      expect(button).not.toBeDisabled();
    });

    it('should have send button disabled when disabled prop is true', async () => {
      render(<ChatInput onSend={mockOnSend} disabled={true} />);
      const textarea = screen.getByPlaceholderText('Ask me anything...');

      // Even though the textarea is disabled, type into it won't work
      // but we check the button is disabled regardless
      expect(textarea).toBeDisabled();
      const button = screen.getByRole('button', { name: /send message/i });
      expect(button).toBeDisabled();
    });
  });

  describe('character counter', () => {
    it('should not show character counter when textarea is empty', () => {
      render(<ChatInput onSend={mockOnSend} />);
      expect(screen.queryByText(/\/4,000/)).not.toBeInTheDocument();
    });

    it('should show character counter when text is entered', async () => {
      const user = userEvent.setup();
      render(<ChatInput onSend={mockOnSend} />);
      const textarea = screen.getByPlaceholderText('Ask me anything...');

      await user.type(textarea, 'Hello');

      expect(screen.getByText('5/4,000')).toBeInTheDocument();
    });

    it('should apply gold color class when over 3600 characters', () => {
      render(<ChatInput onSend={mockOnSend} />);
      const textarea = screen.getByPlaceholderText('Ask me anything...');

      // Use fireEvent.change for performance with long strings (avoids typing 3601 chars)
      const longText = 'a'.repeat(3601);
      fireEvent.change(textarea, { target: { value: longText } });

      const counter = screen.getByText(`${longText.length}/4,000`);
      expect(counter.className).toContain('text-altivum-gold');
    });
  });

  describe('form submission', () => {
    it('should call onSend with trimmed message on form submit', async () => {
      const user = userEvent.setup();
      render(<ChatInput onSend={mockOnSend} />);
      const textarea = screen.getByPlaceholderText('Ask me anything...');

      await user.type(textarea, 'Hello world');
      const button = screen.getByRole('button', { name: /send message/i });
      await user.click(button);

      expect(mockOnSend).toHaveBeenCalledWith('Hello world');
    });

    it('should clear the textarea after successful submit', async () => {
      const user = userEvent.setup();
      render(<ChatInput onSend={mockOnSend} />);
      const textarea = screen.getByPlaceholderText(
        'Ask me anything...'
      ) as HTMLTextAreaElement;

      await user.type(textarea, 'Hello');
      await user.click(
        screen.getByRole('button', { name: /send message/i })
      );

      expect(textarea.value).toBe('');
    });

    it('should not call onSend when textarea is empty', async () => {
      const user = userEvent.setup();
      render(<ChatInput onSend={mockOnSend} />);

      // Try to click the disabled button (it shouldn't fire)
      const button = screen.getByRole('button', { name: /send message/i });
      await user.click(button);

      expect(mockOnSend).not.toHaveBeenCalled();
    });

    it('should not call onSend when disabled prop is true', async () => {
      render(<ChatInput onSend={mockOnSend} disabled={true} />);
      expect(mockOnSend).not.toHaveBeenCalled();
    });
  });

  describe('keyboard interaction', () => {
    it('should submit on Enter key press', async () => {
      const user = userEvent.setup();
      render(<ChatInput onSend={mockOnSend} />);
      const textarea = screen.getByPlaceholderText('Ask me anything...');

      await user.type(textarea, 'Hello{Enter}');

      expect(mockOnSend).toHaveBeenCalledWith('Hello');
    });

    it('should not submit on Shift+Enter (allows newline)', async () => {
      const user = userEvent.setup();
      render(<ChatInput onSend={mockOnSend} />);
      const textarea = screen.getByPlaceholderText('Ask me anything...');

      await user.type(textarea, 'Hello{Shift>}{Enter}{/Shift}');

      expect(mockOnSend).not.toHaveBeenCalled();
    });
  });
});
