import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import PrefetchLink from './PrefetchLink';

vi.mock('../utils/routeManifest', () => ({
  prefetchRoute: vi.fn(),
}));

import { prefetchRoute } from '../utils/routeManifest';

describe('PrefetchLink', () => {
  const renderWithRouter = (ui: React.ReactElement) =>
    render(<MemoryRouter>{ui}</MemoryRouter>);

  it('should render as a link with correct href', () => {
    renderWithRouter(<PrefetchLink to="/about">About</PrefetchLink>);
    const link = screen.getByRole('link', { name: /about/i });
    expect(link).toHaveAttribute('href', '/about');
  });

  it('should prefetch route on mouse enter', async () => {
    const user = userEvent.setup();
    renderWithRouter(<PrefetchLink to="/blog">Blog</PrefetchLink>);

    await user.hover(screen.getByRole('link'));
    expect(prefetchRoute).toHaveBeenCalledWith('/blog');
  });

  it('should prefetch route on focus', () => {
    renderWithRouter(<PrefetchLink to="/contact">Contact</PrefetchLink>);
    const link = screen.getByRole('link');

    link.focus();
    expect(prefetchRoute).toHaveBeenCalledWith('/contact');
  });

  it('should call original onMouseEnter handler in addition to prefetching', async () => {
    const user = userEvent.setup();
    const onMouseEnter = vi.fn();
    renderWithRouter(
      <PrefetchLink to="/about" onMouseEnter={onMouseEnter}>
        About
      </PrefetchLink>
    );

    await user.hover(screen.getByRole('link'));
    expect(onMouseEnter).toHaveBeenCalled();
    expect(prefetchRoute).toHaveBeenCalledWith('/about');
  });

  it('should call original onFocus handler in addition to prefetching', () => {
    const onFocus = vi.fn();
    renderWithRouter(
      <PrefetchLink to="/about" onFocus={onFocus}>
        About
      </PrefetchLink>
    );

    screen.getByRole('link').focus();
    expect(onFocus).toHaveBeenCalled();
    expect(prefetchRoute).toHaveBeenCalledWith('/about');
  });

  it('should pass additional props through to the Link', () => {
    renderWithRouter(
      <PrefetchLink to="/about" className="custom-class" data-testid="my-link">
        About
      </PrefetchLink>
    );
    const link = screen.getByTestId('my-link');
    expect(link).toHaveClass('custom-class');
  });
});
