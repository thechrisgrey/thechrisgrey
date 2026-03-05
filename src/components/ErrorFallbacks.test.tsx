import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { BlogErrorFallback, ChatErrorFallback, GenericPageErrorFallback } from './ErrorFallbacks';

const renderWithRouter = (ui: React.ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>);

describe('BlogErrorFallback', () => {
  it('should render the error heading', () => {
    renderWithRouter(<BlogErrorFallback />);
    expect(screen.getByText('Unable to load blog')).toBeInTheDocument();
  });

  it('should render a Try Again button', () => {
    renderWithRouter(<BlogErrorFallback />);
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('should render a Go Home link', () => {
    renderWithRouter(<BlogErrorFallback />);
    expect(screen.getByRole('link', { name: /go home/i })).toHaveAttribute('href', '/');
  });

  it('should call onRetry when Try Again is clicked', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    renderWithRouter(<BlogErrorFallback onRetry={onRetry} />);

    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('should fall back to window.location.reload when no onRetry provided', async () => {
    const user = userEvent.setup();
    const reloadSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: reloadSpy },
      writable: true,
    });

    renderWithRouter(<BlogErrorFallback />);
    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(reloadSpy).toHaveBeenCalled();
  });
});

describe('ChatErrorFallback', () => {
  it('should render the error heading', () => {
    renderWithRouter(<ChatErrorFallback />);
    expect(screen.getByText('Chat unavailable')).toBeInTheDocument();
  });

  it('should render a Restart Chat button', () => {
    renderWithRouter(<ChatErrorFallback />);
    expect(screen.getByRole('button', { name: /restart chat/i })).toBeInTheDocument();
  });

  it('should not render a Go Home link (full-viewport layout)', () => {
    renderWithRouter(<ChatErrorFallback />);
    expect(screen.queryByRole('link', { name: /go home/i })).not.toBeInTheDocument();
  });

  it('should call onRetry when Restart Chat is clicked', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    renderWithRouter(<ChatErrorFallback onRetry={onRetry} />);

    await user.click(screen.getByRole('button', { name: /restart chat/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

describe('GenericPageErrorFallback', () => {
  it('should render default heading when no pageName provided', () => {
    renderWithRouter(<GenericPageErrorFallback />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('should render contextual heading when pageName is provided', () => {
    renderWithRouter(<GenericPageErrorFallback pageName="Podcast" />);
    expect(screen.getByText('Unable to load Podcast')).toBeInTheDocument();
  });

  it('should show Go Home link by default', () => {
    renderWithRouter(<GenericPageErrorFallback />);
    expect(screen.getByRole('link', { name: /go home/i })).toBeInTheDocument();
  });

  it('should hide Go Home link when showHomeButton is false', () => {
    renderWithRouter(<GenericPageErrorFallback showHomeButton={false} />);
    expect(screen.queryByRole('link', { name: /go home/i })).not.toBeInTheDocument();
  });

  it('should call onRetry when Try Again is clicked', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    renderWithRouter(<GenericPageErrorFallback onRetry={onRetry} />);

    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
