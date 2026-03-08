import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ChatWidget from '../../components/chat/ChatWidget';

// jsdom does not implement scrollTo on elements; polyfill for these tests
beforeEach(() => {
  Element.prototype.scrollTo = vi.fn();
});

// Note: Unlike the unit test for ChatWidget that mocks child components,
// this integration test renders the FULL widget including ChatWidgetButton and ChatWidgetPanel
// to verify the entire widget interaction flow.

const renderWidget = (route = '/') => {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <ChatWidget />
    </MemoryRouter>
  );
};

describe('Chat Widget Integration', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe('Widget button', () => {
    it('renders the widget button', () => {
      renderWidget();

      const button = screen.getByRole('button', { name: /open chat/i });
      expect(button).toBeInTheDocument();
    });

    it('button has correct aria-expanded state when closed', () => {
      renderWidget();

      const button = screen.getByRole('button', { name: /open chat/i });
      expect(button).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('Opening and closing the panel', () => {
    it('opens the chat panel when the widget button is clicked', async () => {
      const user = userEvent.setup();
      renderWidget();

      await user.click(screen.getByRole('button', { name: /open chat/i }));

      await waitFor(() => {
        const dialog = screen.getByRole('dialog', { name: /ai chat/i });
        expect(dialog).toBeInTheDocument();
      });
    });

    it('shows the chat interface inside the panel', async () => {
      const user = userEvent.setup();
      renderWidget();

      await user.click(screen.getByRole('button', { name: /open chat/i }));

      await waitFor(() => {
        // Should show the welcome message
        expect(
          screen.getByText(/I'm Christian's Personal AI Assistant/i)
        ).toBeInTheDocument();

        // Should show the input
        expect(
          screen.getByRole('textbox', { name: /type a message/i })
        ).toBeInTheDocument();

        // Should show page-specific suggestions (Home page for route '/')
        expect(
          screen.getByText("What's Christian's story?")
        ).toBeInTheDocument();
      });
    });

    it('closes the panel when the close button is clicked', async () => {
      const user = userEvent.setup();
      renderWidget();

      await user.click(screen.getByRole('button', { name: /open chat/i }));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Two buttons match "Close chat" (panel close + widget button).
      // Target the one inside the dialog.
      const dialog = screen.getByRole('dialog');
      await user.click(within(dialog).getByRole('button', { name: /close chat/i }));

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('closes the panel when Escape key is pressed', async () => {
      const user = userEvent.setup();
      renderWidget();

      await user.click(screen.getByRole('button', { name: /open chat/i }));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Focus something inside the dialog so the keydown event
      // bubbles through the panel's onKeyDown handler
      const input = screen.getByRole('textbox', { name: /type a message/i });
      await user.click(input);
      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('toggles widget button aria-expanded when panel opens', async () => {
      const user = userEvent.setup();
      renderWidget();

      const button = screen.getByRole('button', { name: /open chat/i });
      await user.click(button);

      await waitFor(() => {
        // After opening, the widget button label changes to "Close chat" and has aria-expanded="true".
        // Two buttons match "Close chat" (widget button + panel close button).
        // The widget button is the one with aria-expanded attribute.
        const closeButtons = screen.getAllByRole('button', { name: /close chat/i });
        const widgetButton = closeButtons.find(
          (btn) => btn.getAttribute('aria-expanded') !== null
        );
        expect(widgetButton).toHaveAttribute('aria-expanded', 'true');
      });
    });
  });

  describe('Panel header controls', () => {
    it('renders the expand button to navigate to full chat', async () => {
      const user = userEvent.setup();
      renderWidget();

      await user.click(screen.getByRole('button', { name: /open chat/i }));

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /open full chat/i })
        ).toBeInTheDocument();
      });
    });

    it('shows clear button after user sends a message', async () => {
      const user = userEvent.setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('Response'));
            controller.close();
          },
        }),
      } as Response);

      renderWidget();

      await user.click(screen.getByRole('button', { name: /open chat/i }));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const input = screen.getByRole('textbox', { name: /type a message/i });
      await user.type(input, 'Hello');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /clear conversation/i })
        ).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('panel has proper dialog ARIA attributes', async () => {
      const user = userEvent.setup();
      renderWidget();

      await user.click(screen.getByRole('button', { name: /open chat/i }));

      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveAttribute('aria-modal', 'true');
        expect(dialog).toHaveAttribute('aria-label', 'AI Chat');
      });
    });

    it('panel has a chat messages region with aria-live', async () => {
      const user = userEvent.setup();
      renderWidget();

      await user.click(screen.getByRole('button', { name: /open chat/i }));

      await waitFor(() => {
        const messagesRegion = screen.getByRole('log', {
          name: /chat messages/i,
        });
        expect(messagesRegion).toHaveAttribute('aria-live', 'polite');
      });
    });
  });
});
