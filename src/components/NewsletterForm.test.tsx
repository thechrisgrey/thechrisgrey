import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NewsletterForm from './NewsletterForm';

// Mock the hooks module
vi.mock('../hooks', () => ({
  useFocusTrap: () => ({
    containerRef: { current: null },
    handleKeyDown: vi.fn(),
  }),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('NewsletterForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('full variant (default)', () => {
    it('should render the subscribe heading', () => {
      render(<NewsletterForm />);
      expect(screen.getByText('Stay Informed')).toBeInTheDocument();
    });

    it('should render an email input and submit button', () => {
      render(<NewsletterForm />);
      expect(screen.getByPlaceholderText('Enter your email address')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /subscribe/i })).toBeInTheDocument();
    });

    it('should show error for invalid email', async () => {
      render(<NewsletterForm />);

      const input = screen.getByPlaceholderText('Enter your email address');
      // Use fireEvent.change to set value directly (bypasses native email validation)
      fireEvent.change(input, { target: { value: 'invalid-email' } });
      // Submit the form directly to bypass native required/email validation
      fireEvent.submit(input.closest('form')!);

      expect(screen.getByRole('alert')).toHaveTextContent('Please enter a valid email address');
    });

    it('should clear error when user starts typing after an error', async () => {
      const user = userEvent.setup();
      render(<NewsletterForm />);

      const input = screen.getByPlaceholderText('Enter your email address');
      fireEvent.change(input, { target: { value: 'bad' } });
      fireEvent.submit(input.closest('form')!);

      expect(screen.getByRole('alert')).toBeInTheDocument();

      // Typing should clear the error
      await user.type(input, 'x');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('should show success modal on successful subscription', async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: 'Subscribed' }),
      });

      render(<NewsletterForm />);

      const input = screen.getByPlaceholderText('Enter your email address');
      await user.type(input, 'test@example.com');
      await user.click(screen.getByRole('button', { name: /subscribe/i }));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      expect(screen.getByText('Thank You for Subscribing!')).toBeInTheDocument();
    });

    it('should show error for 429 rate limit response', async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: () => Promise.resolve({}),
      });

      render(<NewsletterForm />);

      const input = screen.getByPlaceholderText('Enter your email address');
      await user.type(input, 'test@example.com');
      await user.click(screen.getByRole('button', { name: /subscribe/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/too many subscription attempts/i);
      });
    });

    it('should show server error message', async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Server error' }),
      });

      render(<NewsletterForm />);

      const input = screen.getByPlaceholderText('Enter your email address');
      await user.type(input, 'test@example.com');
      await user.click(screen.getByRole('button', { name: /subscribe/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Server error');
      });
    });

    it('should show network error on fetch failure', async () => {
      const user = userEvent.setup();
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      vi.spyOn(console, 'error').mockImplementation(() => {});

      render(<NewsletterForm />);

      const input = screen.getByPlaceholderText('Enter your email address');
      await user.type(input, 'test@example.com');
      await user.click(screen.getByRole('button', { name: /subscribe/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/network error/i);
      });
    });

    it('should close success modal with close button', async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: 'Subscribed' }),
      });

      render(<NewsletterForm />);

      const input = screen.getByPlaceholderText('Enter your email address');
      await user.type(input, 'test@example.com');
      await user.click(screen.getByRole('button', { name: /subscribe/i }));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // There are two close-related elements: an X icon button (aria-label="Close")
      // and the text "Close" button at the bottom. Use the X button.
      const closeButtons = screen.getAllByRole('button', { name: /close/i });
      // Click the first close button (the X icon in the dialog)
      await user.click(closeButtons[0]);

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('should disable input and button while loading', async () => {
      const user = userEvent.setup();
      let resolvePromise: (value: unknown) => void;
      mockFetch.mockReturnValueOnce(
        new Promise((resolve) => {
          resolvePromise = resolve;
        })
      );

      render(<NewsletterForm />);

      const input = screen.getByPlaceholderText('Enter your email address');
      await user.type(input, 'test@example.com');
      await user.click(screen.getByRole('button', { name: /subscribe/i }));

      expect(screen.getByPlaceholderText('Enter your email address')).toBeDisabled();
      expect(screen.getByRole('button', { name: /subscribing/i })).toBeDisabled();

      // Cleanup
      resolvePromise!({ ok: true, json: () => Promise.resolve({}) });
    });
  });

  describe('compact variant', () => {
    it('should render a simpler form without the heading', () => {
      render(<NewsletterForm variant="compact" />);
      expect(screen.queryByText('Stay Informed')).not.toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter your email address')).toBeInTheDocument();
    });
  });
});
