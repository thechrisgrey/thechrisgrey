import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ErrorBoundary from './ErrorBoundary';

// A component that throws an error on render
const ThrowingComponent = ({ shouldThrow = true }: { shouldThrow?: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>Child content rendered</div>;
};

// Suppress console.error from React error boundary logging during tests
const originalConsoleError = console.error;

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    console.error = vi.fn();
  });

  afterAll(() => {
    console.error = originalConsoleError;
  });

  const renderWithRouter = (ui: React.ReactElement) => {
    return render(<MemoryRouter>{ui}</MemoryRouter>);
  };

  describe('when no error occurs', () => {
    it('should render children normally', () => {
      renderWithRouter(
        <ErrorBoundary>
          <div>Normal content</div>
        </ErrorBoundary>
      );
      expect(screen.getByText('Normal content')).toBeInTheDocument();
    });

    it('should not show error UI', () => {
      renderWithRouter(
        <ErrorBoundary>
          <div>Normal content</div>
        </ErrorBoundary>
      );
      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    });
  });

  describe('when a child component throws', () => {
    it('should show the default error title', () => {
      renderWithRouter(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      );
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('should show the page name in error title when pageName is provided', () => {
      renderWithRouter(
        <ErrorBoundary pageName="the Blog">
          <ThrowingComponent />
        </ErrorBoundary>
      );
      expect(
        screen.getByText('Something went wrong with the Blog')
      ).toBeInTheDocument();
    });

    it('should show a Refresh Page button', () => {
      renderWithRouter(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      );
      expect(
        screen.getByRole('button', { name: /refresh page/i })
      ).toBeInTheDocument();
    });

    it('should show a Go Home link by default', () => {
      renderWithRouter(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      );
      expect(screen.getByRole('link', { name: /go home/i })).toBeInTheDocument();
    });

    it('should hide the Go Home link when showHomeButton is false', () => {
      renderWithRouter(
        <ErrorBoundary showHomeButton={false}>
          <ThrowingComponent />
        </ErrorBoundary>
      );
      expect(
        screen.queryByRole('link', { name: /go home/i })
      ).not.toBeInTheDocument();
    });

    it('should show error description text', () => {
      renderWithRouter(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      );
      expect(
        screen.getByText(/we encountered an unexpected error/i)
      ).toBeInTheDocument();
    });

    it('should mention returning to home page when showHomeButton is true', () => {
      renderWithRouter(
        <ErrorBoundary showHomeButton={true}>
          <ThrowingComponent />
        </ErrorBoundary>
      );
      expect(
        screen.getByText(/return to the home page/i)
      ).toBeInTheDocument();
    });

    it('should not mention home page when showHomeButton is false', () => {
      renderWithRouter(
        <ErrorBoundary showHomeButton={false}>
          <ThrowingComponent />
        </ErrorBoundary>
      );
      expect(
        screen.queryByText(/return to the home page/i)
      ).not.toBeInTheDocument();
    });

    it('should render Go Home link pointing to "/"', () => {
      renderWithRouter(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      );
      const homeLink = screen.getByRole('link', { name: /go home/i });
      expect(homeLink).toHaveAttribute('href', '/');
    });
  });

  describe('custom fallback', () => {
    it('should render custom fallback instead of default error UI', () => {
      renderWithRouter(
        <ErrorBoundary fallback={<div>Custom error page</div>}>
          <ThrowingComponent />
        </ErrorBoundary>
      );
      expect(screen.getByText('Custom error page')).toBeInTheDocument();
      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    });
  });

  describe('onReset callback', () => {
    it('should call onReset when Refresh Page button is clicked', async () => {
      const onReset = vi.fn();
      // Mock window.location.reload
      const reloadMock = vi.fn();
      Object.defineProperty(window, 'location', {
        value: { ...window.location, reload: reloadMock },
        writable: true,
      });

      const user = userEvent.setup();

      renderWithRouter(
        <ErrorBoundary onReset={onReset}>
          <ThrowingComponent />
        </ErrorBoundary>
      );

      await user.click(
        screen.getByRole('button', { name: /refresh page/i })
      );

      expect(onReset).toHaveBeenCalledTimes(1);
    });
  });
});
