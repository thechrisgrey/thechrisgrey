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
