import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ViewTransitionLink from './ViewTransitionLink';

vi.mock('../utils/routeManifest', () => ({
  prefetchRoute: vi.fn(),
}));

import { prefetchRoute } from '../utils/routeManifest';

const renderLink = (props: Partial<React.ComponentProps<typeof ViewTransitionLink>> = {}) => {
  return render(
    <MemoryRouter>
      <ViewTransitionLink to="/about" {...props}>
        About Page
      </ViewTransitionLink>
    </MemoryRouter>
  );
};

describe('ViewTransitionLink', () => {
  it('renders an anchor element with correct href', () => {
    renderLink();
    const link = screen.getByRole('link', { name: /about page/i });
    expect(link).toHaveAttribute('href', '/about');
  });

  it('prefetches route on mouse enter', () => {
    renderLink();
    const link = screen.getByRole('link', { name: /about page/i });
    fireEvent.mouseEnter(link);
    expect(prefetchRoute).toHaveBeenCalledWith('/about');
  });

  it('prefetches route on focus', () => {
    renderLink();
    const link = screen.getByRole('link', { name: /about page/i });
    fireEvent.focus(link);
    expect(prefetchRoute).toHaveBeenCalledWith('/about');
  });

  it('does not prevent default on meta+click (new tab)', () => {
    renderLink();
    const link = screen.getByRole('link', { name: /about page/i });
    const event = new MouseEvent('click', { bubbles: true, metaKey: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    link.dispatchEvent(event);
    expect(preventDefaultSpy).not.toHaveBeenCalled();
  });

  it('does not prevent default on ctrl+click (new tab)', () => {
    renderLink();
    const link = screen.getByRole('link', { name: /about page/i });
    const event = new MouseEvent('click', { bubbles: true, ctrlKey: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    link.dispatchEvent(event);
    expect(preventDefaultSpy).not.toHaveBeenCalled();
  });

  it('calls custom onClick handler on click', () => {
    const onClickSpy = vi.fn();
    renderLink({ onClick: onClickSpy });
    const link = screen.getByRole('link', { name: /about page/i });
    fireEvent.click(link);
    expect(onClickSpy).toHaveBeenCalled();
  });

  it('passes additional props to the underlying Link', () => {
    renderLink({ className: 'custom-class', 'aria-label': 'Go to about' });
    const link = screen.getByRole('link', { name: /go to about/i });
    expect(link).toHaveClass('custom-class');
  });

  it('has correct displayName', () => {
    expect(ViewTransitionLink.displayName).toBe('ViewTransitionLink');
  });
});
