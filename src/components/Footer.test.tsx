import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Footer from './Footer';
import { SOCIAL_LINKS } from '../constants/links';

vi.mock('gsap', () => ({
  default: {
    registerPlugin: vi.fn(),
    fromTo: vi.fn(() => ({ scrollTrigger: { kill: vi.fn() }, kill: vi.fn() })),
  },
  gsap: {
    registerPlugin: vi.fn(),
    fromTo: vi.fn(() => ({ scrollTrigger: { kill: vi.fn() }, kill: vi.fn() })),
  },
}));
vi.mock('gsap/ScrollTrigger', () => ({ ScrollTrigger: {} }));

describe('Footer', () => {
  const renderFooter = () =>
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    );

  it('renders the editorial statement line', () => {
    renderFooter();
    expect(screen.getByText(/BUILD SOMETHING/)).toBeInTheDocument();
    expect(screen.getByText(/WORTH KEEPING\./)).toBeInTheDocument();
  });

  it('renders the parenthesized eyebrow column labels', () => {
    renderFooter();
    expect(screen.getByText('(NAVIGATE)')).toBeInTheDocument();
    expect(screen.getByText('(VENTURES)')).toBeInTheDocument();
    expect(screen.getByText('(CONNECT)')).toBeInTheDocument();
  });

  it('links the NAVIGATE column to internal routes and the RSS feed', () => {
    renderFooter();
    expect(screen.getByRole('link', { name: 'About' })).toHaveAttribute('href', '/about');
    expect(screen.getByRole('link', { name: 'Blog' })).toHaveAttribute('href', '/blog');
    expect(screen.getByRole('link', { name: 'Links' })).toHaveAttribute('href', '/links');
    expect(screen.getByRole('link', { name: 'Contact' })).toHaveAttribute('href', '/contact');
    expect(screen.getByRole('link', { name: 'RSS Feed' })).toHaveAttribute('href', '/rss.xml');
  });

  it('links the VENTURES column to each venture route', () => {
    renderFooter();
    expect(screen.getByRole('link', { name: 'Altivum Inc.' })).toHaveAttribute('href', '/altivum');
    expect(screen.getByRole('link', { name: 'The Vector Podcast' })).toHaveAttribute(
      'href',
      '/podcast'
    );
    expect(screen.getByRole('link', { name: 'Beyond the Assessment' })).toHaveAttribute(
      'href',
      '/beyond-the-assessment'
    );
    expect(screen.getByRole('link', { name: 'Claude' })).toHaveAttribute('href', '/claude');
  });

  it('links the CONNECT column to social profiles in a new tab', () => {
    renderFooter();
    const linkedin = screen.getByRole('link', { name: 'LinkedIn' });
    const github = screen.getByRole('link', { name: 'GitHub' });
    expect(linkedin).toHaveAttribute('href', SOCIAL_LINKS.linkedin);
    expect(linkedin).toHaveAttribute('target', '_blank');
    expect(linkedin).toHaveAttribute('rel', 'noopener noreferrer');
    expect(github).toHaveAttribute('href', SOCIAL_LINKS.github);
    expect(github).toHaveAttribute('target', '_blank');
    expect(github).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders the newsletter form inside the #newsletter anchor', () => {
    const { container } = renderFooter();
    const anchor = container.querySelector('#newsletter');
    expect(anchor).not.toBeNull();
    expect(anchor!.querySelector('input[type="email"]')).not.toBeNull();
  });

  it('renders the copyright with the current year and privacy link', () => {
    renderFooter();
    const year = new Date().getFullYear();
    expect(screen.getByText(new RegExp(`© ${year} Christian Perez`))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute(
      'href',
      '/privacy'
    );
  });

  it('keeps the view-transition persist marker on the footer element', () => {
    const { container } = renderFooter();
    expect(container.querySelector('footer')).toHaveAttribute('data-vt-persist', 'footer');
  });
});
