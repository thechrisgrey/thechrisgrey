import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatSuggestions from './ChatSuggestions';

describe('ChatSuggestions', () => {
  const mockOnSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render 4 suggestion buttons', () => {
      render(<ChatSuggestions onSelect={mockOnSelect} />);
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(4);
    });

    it('should render all suggestion texts', () => {
      render(<ChatSuggestions onSelect={mockOnSelect} />);
      expect(
        screen.getByText('How did he go from Green Beret to tech CEO?')
      ).toBeInTheDocument();
      expect(
        screen.getByText("What drives Altivum's mission?")
      ).toBeInTheDocument();
      expect(
        screen.getByText('Why did he write Beyond the Assessment?')
      ).toBeInTheDocument();
      expect(
        screen.getByText("What's his take on AI and veterans?")
      ).toBeInTheDocument();
    });

    it('should use third-person phrasing (not first-person)', () => {
      render(<ChatSuggestions onSelect={mockOnSelect} />);
      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        // None should start with "What's your" or "Tell me about yourself"
        expect(button.textContent).not.toMatch(/^(What's your|Tell me about yourself)/i);
      });
    });
  });

  describe('interactions', () => {
    it('should call onSelect with the suggestion text when clicked', async () => {
      const user = userEvent.setup();
      render(<ChatSuggestions onSelect={mockOnSelect} />);

      const firstButton = screen.getByText(
        'How did he go from Green Beret to tech CEO?'
      );
      await user.click(firstButton);

      expect(mockOnSelect).toHaveBeenCalledTimes(1);
      expect(mockOnSelect).toHaveBeenCalledWith(
        'How did he go from Green Beret to tech CEO?'
      );
    });

    it('should call onSelect with correct text for each button', async () => {
      const user = userEvent.setup();
      render(<ChatSuggestions onSelect={mockOnSelect} />);

      const buttons = screen.getAllByRole('button');

      for (let i = 0; i < buttons.length; i++) {
        await user.click(buttons[i]);
        expect(mockOnSelect).toHaveBeenNthCalledWith(
          i + 1,
          buttons[i].textContent
        );
      }

      expect(mockOnSelect).toHaveBeenCalledTimes(4);
    });
  });
});
