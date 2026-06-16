import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import NotFound from '../../pages/NotFound';

const renderNotFound = () =>
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={['/does-not-exist']}>
        <NotFound />
      </MemoryRouter>
    </HelmetProvider>
  );

describe('NotFound Page Integration', () => {
  it('renders the page heading and recovery copy', () => {
    renderNotFound();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Page Not Found' })
    ).toBeInTheDocument();
  });

  it('hides the decorative "404" glyph from the accessibility tree', () => {
    renderNotFound();
    const glyph = screen.getByText('404');
    expect(glyph).toHaveAttribute('aria-hidden', 'true');
  });

  it('exposes the primary recovery CTAs as routable links', () => {
    renderNotFound();
    expect(screen.getByRole('link', { name: 'Go Home' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Read the Blog' })).toHaveAttribute(
      'href',
      '/blog'
    );
    expect(screen.getByRole('link', { name: 'Get in Touch' })).toHaveAttribute(
      'href',
      '/contact'
    );
  });

  it('gives the primary CTA a comfortable tap-target height and press feedback', () => {
    renderNotFound();
    const goHome = screen.getByRole('link', { name: 'Go Home' });
    expect(goHome.className).toContain('min-h-[48px]');
    expect(goHome.className).toContain('touch-manipulation');
    expect(goHome.className).toContain('active:scale-[0.98]');
  });

  it('renders the secondary quick-links with comfortable tap targets', () => {
    renderNotFound();
    const quickLink = screen.getByRole('link', { name: 'Altivum Inc.' });
    expect(quickLink).toHaveAttribute('href', '/altivum');
    expect(quickLink.className).toContain('min-h-[44px]');
    expect(quickLink.className).toContain('touch-manipulation');
  });
});
