import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import Contact from '../../pages/Contact';

const renderContact = () => {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={['/contact']}>
        <Contact />
      </MemoryRouter>
    </HelmetProvider>
  );
};

describe('Contact Page Integration', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe('Page rendering', () => {
    it('renders the hero section with the "Let\'s Connect" heading', () => {
      renderContact();
      expect(
        screen.getByRole('heading', { level: 1, name: /let's connect/i })
      ).toBeInTheDocument();
    });

    it('renders the contact form with all required fields', () => {
      renderContact();

      expect(screen.getByLabelText(/name \*/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email \*/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/subject/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/message \*/i)).toBeInTheDocument();
    });

    it('renders the submit button', () => {
      renderContact();
      expect(
        screen.getByRole('button', { name: /send message/i })
      ).toBeInTheDocument();
    });

    it('renders all four speaking topic cards', () => {
      renderContact();

      expect(screen.getByText('Cloud & AI Strategy')).toBeInTheDocument();
      expect(screen.getByText('Veteran Transition')).toBeInTheDocument();
      expect(screen.getByText('Entrepreneurship')).toBeInTheDocument();
      expect(screen.getByText('Leadership')).toBeInTheDocument();
    });

    it('renders event types list', () => {
      renderContact();

      expect(screen.getByText('Keynote presentations')).toBeInTheDocument();
      expect(screen.getByText('Panel discussions')).toBeInTheDocument();
      // "Podcast guest appearances" appears in both event types and availability sections
      expect(screen.getAllByText('Podcast guest appearances').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Corporate workshops')).toBeInTheDocument();
      expect(screen.getByText('Media interviews')).toBeInTheDocument();
      expect(screen.getByText('Veteran organization events')).toBeInTheDocument();
    });

    it('renders the press kit download link', () => {
      renderContact();
      const pressKitLink = screen.getByRole('link', { name: /download press kit/i });
      expect(pressKitLink).toHaveAttribute('href', '/press-kit.zip');
      expect(pressKitLink).toHaveAttribute('download');
    });

    it('renders contact information cards', () => {
      renderContact();

      expect(screen.getByText('Phone')).toBeInTheDocument();
      expect(screen.getByText('(615) 219-9425')).toBeInTheDocument();
      expect(screen.getByText('General Inquiries')).toBeInTheDocument();
      expect(screen.getByText('info@altivum.ai')).toBeInTheDocument();
      expect(screen.getByText('Direct Email')).toBeInTheDocument();
      expect(screen.getByText('christian.perez@altivum.ai')).toBeInTheDocument();
    });
  });

  describe('Form validation', () => {
    it('shows error when name is too short', async () => {
      const user = userEvent.setup();
      renderContact();

      await user.type(screen.getByLabelText(/name \*/i), 'A');
      await user.type(screen.getByLabelText(/email \*/i), 'test@example.com');
      await user.type(
        screen.getByLabelText(/message \*/i),
        'This is a valid message for the form.'
      );

      await user.click(screen.getByRole('button', { name: /send message/i }));

      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toHaveTextContent('Name must be between 2 and 100 characters');
      });
    });

    it('shows error when email is invalid', async () => {
      const user = userEvent.setup();
      renderContact();

      await user.type(screen.getByLabelText(/name \*/i), 'Test User');
      // Use an email that passes HTML5 type="email" validation but fails custom regex
      // (our regex requires a TLD like .com; HTML5 allows bare domain like test@domain)
      await user.type(screen.getByLabelText(/email \*/i), 'test@domain');
      await user.type(
        screen.getByLabelText(/message \*/i),
        'This is a valid message for testing.'
      );

      await user.click(screen.getByRole('button', { name: /send message/i }));

      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toHaveTextContent('Please enter a valid email address');
      });
    });

    it('shows error when message is too short', async () => {
      const user = userEvent.setup();
      renderContact();

      await user.type(screen.getByLabelText(/name \*/i), 'Test User');
      await user.type(screen.getByLabelText(/email \*/i), 'test@example.com');
      await user.type(screen.getByLabelText(/message \*/i), 'Short');

      await user.click(screen.getByRole('button', { name: /send message/i }));

      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toHaveTextContent('Message must be between 10 and 5000 characters');
      });
    });

    it('clears error when user starts typing after an error', async () => {
      const user = userEvent.setup();
      renderContact();

      await user.type(screen.getByLabelText(/name \*/i), 'A');
      await user.type(screen.getByLabelText(/email \*/i), 'test@example.com');
      await user.type(
        screen.getByLabelText(/message \*/i),
        'This is a valid message for testing.'
      );

      await user.click(screen.getByRole('button', { name: /send message/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      // Start typing again - error should clear
      await user.type(screen.getByLabelText(/name \*/i), 'B');

      await waitFor(() => {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      });
    });
  });

  describe('Form submission flow', () => {
    it('shows loading state during submission', async () => {
      const user = userEvent.setup();
      // Keep the fetch pending
      fetchSpy.mockReturnValue(new Promise(() => {}));
      renderContact();

      await user.type(screen.getByLabelText(/name \*/i), 'Test User');
      await user.type(screen.getByLabelText(/email \*/i), 'test@example.com');
      await user.type(
        screen.getByLabelText(/message \*/i),
        'This is a valid message for the contact form.'
      );

      await user.click(screen.getByRole('button', { name: /send message/i }));

      await waitFor(() => {
        // "Sending..." appears in both the status alert and the button text
        const alerts = screen.getAllByText('Sending...');
        expect(alerts.length).toBeGreaterThanOrEqual(1);
      });

      const submitButton = screen.getByRole('button', { name: /sending/i });
      expect(submitButton).toBeDisabled();
    });

    it('shows success modal after successful submission', async () => {
      const user = userEvent.setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ message: 'Success' }),
      } as Response);
      renderContact();

      await user.type(screen.getByLabelText(/name \*/i), 'Test User');
      await user.type(screen.getByLabelText(/email \*/i), 'test@example.com');
      await user.type(
        screen.getByLabelText(/message \*/i),
        'This is a valid message for the contact form.'
      );

      await user.click(screen.getByRole('button', { name: /send message/i }));

      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        expect(dialog).toBeInTheDocument();
        expect(dialog).toHaveAttribute('aria-labelledby', 'contact-modal-title');
      });

      expect(screen.getByText('Thank You!')).toBeInTheDocument();
      expect(
        screen.getByText("Thanks for contacting me. I'll reach back as soon as possible.")
      ).toBeInTheDocument();
    });

    it('resets form fields after successful submission', async () => {
      const user = userEvent.setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ message: 'Success' }),
      } as Response);
      renderContact();

      const nameInput = screen.getByLabelText(/name \*/i);
      const emailInput = screen.getByLabelText(/email \*/i);
      const messageInput = screen.getByLabelText(/message \*/i);

      await user.type(nameInput, 'Test User');
      await user.type(emailInput, 'test@example.com');
      await user.type(messageInput, 'This is a valid message for the contact form.');

      await user.click(screen.getByRole('button', { name: /send message/i }));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      expect(nameInput).toHaveValue('');
      expect(emailInput).toHaveValue('');
      expect(messageInput).toHaveValue('');
    });

    it('closes the success modal when Close button is clicked', async () => {
      const user = userEvent.setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ message: 'Success' }),
      } as Response);
      renderContact();

      await user.type(screen.getByLabelText(/name \*/i), 'Test User');
      await user.type(screen.getByLabelText(/email \*/i), 'test@example.com');
      await user.type(
        screen.getByLabelText(/message \*/i),
        'This is a valid message for the contact form.'
      );

      await user.click(screen.getByRole('button', { name: /send message/i }));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Two "Close" buttons exist in the modal (icon X and text button).
      // Target the one inside the dialog using within.
      const dialog = screen.getByRole('dialog');
      const closeButtons = within(dialog).getAllByRole('button', { name: /^close$/i });
      // Click the last one (the visible text button at bottom of modal)
      await user.click(closeButtons[closeButtons.length - 1]);

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('shows error when the API returns an error', async () => {
      const user = userEvent.setup();
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Server error' }),
      } as Response);
      renderContact();

      await user.type(screen.getByLabelText(/name \*/i), 'Test User');
      await user.type(screen.getByLabelText(/email \*/i), 'test@example.com');
      await user.type(
        screen.getByLabelText(/message \*/i),
        'This is a valid message for the contact form.'
      );

      await user.click(screen.getByRole('button', { name: /send message/i }));

      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toHaveTextContent('Server error');
      });
    });

    it('shows rate limit error when API returns 429', async () => {
      const user = userEvent.setup();
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 429,
        json: () => Promise.resolve({ error: 'Rate limited' }),
      } as Response);
      renderContact();

      await user.type(screen.getByLabelText(/name \*/i), 'Test User');
      await user.type(screen.getByLabelText(/email \*/i), 'test@example.com');
      await user.type(
        screen.getByLabelText(/message \*/i),
        'This is a valid message for the contact form.'
      );

      await user.click(screen.getByRole('button', { name: /send message/i }));

      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toHaveTextContent('Too many requests');
      });
    });

    it('shows network error when fetch throws', async () => {
      const user = userEvent.setup();
      fetchSpy.mockRejectedValue(new Error('Network error'));
      renderContact();

      await user.type(screen.getByLabelText(/name \*/i), 'Test User');
      await user.type(screen.getByLabelText(/email \*/i), 'test@example.com');
      await user.type(
        screen.getByLabelText(/message \*/i),
        'This is a valid message for the contact form.'
      );

      await user.click(screen.getByRole('button', { name: /send message/i }));

      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toHaveTextContent('Network error');
      });
    });

    it('sends the correct payload to the API endpoint', async () => {
      const user = userEvent.setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ message: 'Success' }),
      } as Response);
      renderContact();

      await user.type(screen.getByLabelText(/name \*/i), 'Test User');
      await user.type(screen.getByLabelText(/email \*/i), 'test@example.com');
      await user.type(screen.getByLabelText(/subject/i), 'Test Subject');
      await user.type(
        screen.getByLabelText(/message \*/i),
        'This is a valid message for testing.'
      );

      await user.click(screen.getByRole('button', { name: /send message/i }));

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledTimes(1);
      });

      const [, options] = fetchSpy.mock.calls[0];
      const body = JSON.parse(options?.body as string);
      expect(body.name).toBe('Test User');
      expect(body.email).toBe('test@example.com');
      expect(body.message).toContain('Test Subject');
      expect(body.message).toContain('This is a valid message for testing.');
      // Honeypot should be empty
      expect(body.website).toBe('');
    });
  });

  describe('SEO metadata', () => {
    it('sets the page title correctly', async () => {
      renderContact();

      await vi.waitFor(() => {
        expect(document.title).toBe('Contact & Speaking | Christian Perez');
      });
    });
  });

  describe('Accessibility', () => {
    it('success modal has proper ARIA attributes', async () => {
      const user = userEvent.setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ message: 'Success' }),
      } as Response);
      renderContact();

      await user.type(screen.getByLabelText(/name \*/i), 'Test User');
      await user.type(screen.getByLabelText(/email \*/i), 'test@example.com');
      await user.type(
        screen.getByLabelText(/message \*/i),
        'This is a valid message for the contact form.'
      );

      await user.click(screen.getByRole('button', { name: /send message/i }));

      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveAttribute('aria-modal', 'true');
        expect(dialog).toHaveAttribute('aria-labelledby', 'contact-modal-title');
      });
    });

    it('closes the success modal with Escape key', async () => {
      const user = userEvent.setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ message: 'Success' }),
      } as Response);
      renderContact();

      await user.type(screen.getByLabelText(/name \*/i), 'Test User');
      await user.type(screen.getByLabelText(/email \*/i), 'test@example.com');
      await user.type(
        screen.getByLabelText(/message \*/i),
        'This is a valid message for the contact form.'
      );

      await user.click(screen.getByRole('button', { name: /send message/i }));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });
});
