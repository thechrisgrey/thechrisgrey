import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { usePageContext } from './usePageContext';

describe('usePageContext', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  const renderWithRouter = (initialPath: string) => {
    return renderHook(() => usePageContext(), {
      wrapper: ({ children }) => (
        <MemoryRouter initialEntries={[initialPath]}>{children}</MemoryRouter>
      ),
    });
  };

  it('should return page context for the home page', () => {
    const { result } = renderWithRouter('/');

    expect(result.current.currentPage).toBe('/');
    expect(result.current.pageTitle).toBe('Home');
    expect(result.current.section).toBe('Home');
  });

  it('should return page context for the about page', () => {
    const { result } = renderWithRouter('/about');

    expect(result.current.currentPage).toBe('/about');
    expect(result.current.pageTitle).toBe('Personal Biography');
  });

  it('should include the current page in visitedPages', () => {
    const { result } = renderWithRouter('/blog');

    expect(result.current.visitedPages).toContain('/blog');
  });

  it('should store visited pages in sessionStorage', () => {
    renderWithRouter('/contact');

    const stored = JSON.parse(sessionStorage.getItem('phantom-journey') || '[]');
    expect(stored).toContain('/contact');
  });

  it('should handle blog post routes', () => {
    const { result } = renderWithRouter('/blog/my-article');

    expect(result.current.pageTitle).toBe('Blog Post');
    expect(result.current.section).toContain('my-article');
  });

  it('should return default context for unknown routes', () => {
    const { result } = renderWithRouter('/something-unknown');

    expect(result.current.pageTitle).toBe('Page');
    expect(result.current.section).toBe('General');
  });
});
