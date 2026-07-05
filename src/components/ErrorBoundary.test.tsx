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
        </ErrorBoundary>,
      );
      expect(screen.getByText('Normal content')).toBeInTheDocument();
    });

    it('should not show error UI', () => {
      renderWithRouter(
        <ErrorBoundary>
          <div>Normal content</div>
        </ErrorBoundary>,
      );
      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    });
  });

  describe('when a child component throws', () => {
    it('should show the default error title', () => {
      renderWithRouter(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>,
      );
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('should show the page name in error title when pageName is provided', () => {
      renderWithRouter(
        <ErrorBoundary pageName="the Blog">
          <ThrowingComponent />
        </ErrorBoundary>,
      );
      expect(screen.getByText('Something went wrong with the Blog')).toBeInTheDocument();
    });

    it('should show a Refresh Page button', () => {
      renderWithRouter(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>,
      );
      expect(screen.getByRole('button', { name: /refresh page/i })).toBeInTheDocument();
    });

    it('should show a Go Home link by default', () => {
      renderWithRouter(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>,
      );
      expect(screen.getByRole('link', { name: /go home/i })).toBeInTheDocument();
    });

    it('should hide the Go Home link when showHomeButton is false', () => {
      renderWithRouter(
        <ErrorBoundary showHomeButton={false}>
          <ThrowingComponent />
        </ErrorBoundary>,
      );
      expect(screen.queryByRole('link', { name: /go home/i })).not.toBeInTheDocument();
    });

    it('should show error description text', () => {
      renderWithRouter(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>,
      );
      expect(screen.getByText(/we encountered an unexpected error/i)).toBeInTheDocument();
    });

    it('should mention returning to home page when showHomeButton is true', () => {
      renderWithRouter(
        <ErrorBoundary showHomeButton={true}>
          <ThrowingComponent />
        </ErrorBoundary>,
      );
      expect(screen.getByText(/return to the home page/i)).toBeInTheDocument();
    });

    it('should not mention home page when showHomeButton is false', () => {
      renderWithRouter(
        <ErrorBoundary showHomeButton={false}>
          <ThrowingComponent />
        </ErrorBoundary>,
      );
      expect(screen.queryByText(/return to the home page/i)).not.toBeInTheDocument();
    });

    it('should render Go Home link pointing to "/"', () => {
      renderWithRouter(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>,
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
        </ErrorBoundary>,
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
        </ErrorBoundary>,
      );

      await user.click(screen.getByRole('button', { name: /refresh page/i }));

      expect(onReset).toHaveBeenCalledTimes(1);
    });
  });

  describe('reset on key change (navigation recovery)', () => {
    // Mirrors App.tsx: <ErrorBoundary key={location.pathname}>. Re-keying the
    // boundary remounts a fresh instance with hasError=false, so a genuine
    // render throw on one route is discarded on client-side navigation.
    it('discards a latched error when the key (pathname) changes', () => {
      const Harness = ({ path }: { path: string }) => (
        <MemoryRouter>
          <ErrorBoundary key={path}>
            <ThrowingComponent shouldThrow={path === '/throws'} />
          </ErrorBoundary>
        </MemoryRouter>
      );

      const { rerender } = render(<Harness path="/throws" />);
      // Error UI is shown on the throwing route.
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();

      // Simulate navigating to a different path: new key -> fresh boundary.
      rerender(<Harness path="/safe" />);
      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
      expect(screen.getByText('Child content rendered')).toBeInTheDocument();
    });

    it('keeps showing the error UI when the key does not change', () => {
      const Harness = ({ path }: { path: string }) => (
        <MemoryRouter>
          <ErrorBoundary key={path}>
            <ThrowingComponent shouldThrow />
          </ErrorBoundary>
        </MemoryRouter>
      );
      const { rerender } = render(<Harness path="/throws" />);
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      // Same key -> same boundary instance -> error stays latched (proves the
      // recovery in the previous test comes from re-keying, not a re-render).
      rerender(<Harness path="/throws" />);
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });
  });
});
