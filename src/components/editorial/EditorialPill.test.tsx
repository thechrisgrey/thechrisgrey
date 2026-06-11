import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EditorialPill from './EditorialPill';

describe('EditorialPill', () => {
  it('renders an internal link when `to` is given', () => {
    render(
      <MemoryRouter>
        <EditorialPill to="/contact">CONTACT</EditorialPill>
      </MemoryRouter>
    );
    const link = screen.getByRole('link', { name: 'CONTACT' });
    expect(link).toHaveAttribute('href', '/contact');
  });

  it('renders a button when `onClick` is given', () => {
    const onClick = vi.fn();
    render(<EditorialPill onClick={onClick}>NEWSLETTER</EditorialPill>);
    fireEvent.click(screen.getByRole('button', { name: 'NEWSLETTER' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('renders an external anchor that opens in a new tab when `href` is given', () => {
    render(<EditorialPill href="https://example.com">EXTERNAL</EditorialPill>);
    const link = screen.getByRole('link', { name: 'EXTERNAL' });
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('appends className after the base utilities', () => {
    render(
      <EditorialPill onClick={() => {}} className="!px-5">
        CUSTOM
      </EditorialPill>
    );
    const button = screen.getByRole('button', { name: 'CUSTOM' });
    expect(button).toHaveClass('rounded-full');
    expect(button).toHaveClass('!px-5');
  });

  it('defaults to the gold-outline variant', () => {
    render(<EditorialPill onClick={() => {}}>GO</EditorialPill>);
    expect(screen.getByRole('button')).toHaveClass('border-altivum-gold');
  });

  it('supports the dark-solid variant for porcelain backgrounds', () => {
    render(
      <EditorialPill onClick={() => {}} variant="dark-solid">
        START
      </EditorialPill>
    );
    expect(screen.getByRole('button')).toHaveClass('bg-altivum-dark');
  });
});
