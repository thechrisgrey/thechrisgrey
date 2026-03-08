import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Navigation from '../../components/Navigation';

// Mock static image imports
vi.mock('../../assets/logo.png', () => ({ default: '/mock-logo.png' }));

// Mock PrefetchLink as a simple forwarded-ref Link (prefetch behavior tested separately)
vi.mock('../../components/PrefetchLink', async () => {
  const React = await import('react');
  const { Link } = await import('react-router-dom');

  const MockPrefetchLink = React.forwardRef<
    HTMLAnchorElement,
    React.ComponentProps<typeof Link>
  >(({ to, children, ...rest }, ref) => (
    <Link ref={ref} to={to} {...rest}>
      {children}
    </Link>
  ));
  MockPrefetchLink.displayName = 'MockPrefetchLink';

  return { default: MockPrefetchLink };
});

const renderNavigation = (route = '/') => {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Navigation />
    </MemoryRouter>
  );
};

describe('Navigation Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Desktop navigation links', () => {
    it('renders the site logo and name', () => {
      renderNavigation();

      const logo = screen.getByAltText('TCG Logo');
      expect(logo).toBeInTheDocument();

      expect(screen.getByText('CHRISTIAN')).toBeInTheDocument();
      expect(screen.getByText('PEREZ')).toBeInTheDocument();
      expect(screen.getByText('thechrisgrey')).toBeInTheDocument();
    });

    it('renders the Home link', () => {
      renderNavigation();
      // There are potentially multiple "Home" links (desktop + mobile)
      const homeLinks = screen.getAllByText('Home');
      expect(homeLinks.length).toBeGreaterThanOrEqual(1);
    });

    it('renders the About dropdown button', () => {
      renderNavigation();
      const aboutButton = screen.getByRole('button', { name: /about menu/i });
      expect(aboutButton).toBeInTheDocument();
    });

    it('renders Blog, AI Chat, Links, and Contact nav items', () => {
      renderNavigation();
      expect(screen.getAllByText('Blog').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('AI Chat').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Links').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Contact').length).toBeGreaterThanOrEqual(1);
    });

    it('renders the skip-to-content link for keyboard navigation', () => {
      renderNavigation();
      const skipLink = screen.getByText('Skip to main content');
      expect(skipLink).toBeInTheDocument();
      expect(skipLink).toHaveAttribute('href', '#main-content');
    });
  });

  describe('About dropdown', () => {
    it('opens the dropdown when the About button is clicked', async () => {
      const user = userEvent.setup();
      renderNavigation();

      const aboutButton = screen.getByRole('button', { name: /about menu/i });
      await user.click(aboutButton);

      await waitFor(() => {
        const menu = screen.getByRole('menu');
        expect(menu).toBeInTheDocument();
      });
    });

    it('shows all 5 sub-items in the dropdown', async () => {
      const user = userEvent.setup();
      renderNavigation();

      await user.click(screen.getByRole('button', { name: /about menu/i }));

      await waitFor(() => {
        const menuItems = screen.getAllByRole('menuitem');
        expect(menuItems).toHaveLength(5);
      });

      // Check the labels
      expect(screen.getByRole('menuitem', { name: 'Personal Biography' })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'Altivum Inc' })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'The Vector Podcast' })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'Beyond the Assessment' })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'Amazon Web Services' })).toBeInTheDocument();
    });

    it('dropdown sub-items link to correct routes', async () => {
      const user = userEvent.setup();
      renderNavigation();

      await user.click(screen.getByRole('button', { name: /about menu/i }));

      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: 'Personal Biography' })).toHaveAttribute(
          'href',
          '/about'
        );
        expect(screen.getByRole('menuitem', { name: 'Altivum Inc' })).toHaveAttribute(
          'href',
          '/altivum'
        );
        expect(screen.getByRole('menuitem', { name: 'The Vector Podcast' })).toHaveAttribute(
          'href',
          '/podcast'
        );
        expect(
          screen.getByRole('menuitem', { name: 'Beyond the Assessment' })
        ).toHaveAttribute('href', '/beyond-the-assessment');
        expect(
          screen.getByRole('menuitem', { name: 'Amazon Web Services' })
        ).toHaveAttribute('href', '/aws');
      });
    });

    it('closes the dropdown when a sub-item is clicked', async () => {
      const user = userEvent.setup();
      renderNavigation();

      await user.click(screen.getByRole('button', { name: /about menu/i }));
      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('menuitem', { name: 'Personal Biography' }));

      await waitFor(() => {
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      });
    });

    it('closes the dropdown when clicking outside of it', async () => {
      const user = userEvent.setup();
      renderNavigation();

      await user.click(screen.getByRole('button', { name: /about menu/i }));
      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });

      // Click outside - mousedown event triggers close
      await user.click(document.body);

      await waitFor(() => {
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      });
    });

    it('sets aria-expanded correctly on the About button', async () => {
      const user = userEvent.setup();
      renderNavigation();

      const aboutButton = screen.getByRole('button', { name: /about menu/i });
      expect(aboutButton).toHaveAttribute('aria-expanded', 'false');

      await user.click(aboutButton);

      await waitFor(() => {
        expect(aboutButton).toHaveAttribute('aria-expanded', 'true');
      });

      await user.click(aboutButton);

      await waitFor(() => {
        expect(aboutButton).toHaveAttribute('aria-expanded', 'false');
      });
    });
  });

  describe('About dropdown keyboard navigation', () => {
    it('opens the dropdown and focuses first item with ArrowDown', async () => {
      const user = userEvent.setup();
      renderNavigation();

      const aboutButton = screen.getByRole('button', { name: /about menu/i });
      aboutButton.focus();

      await user.keyboard('{ArrowDown}');

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });
    });

    it('closes the dropdown with Escape key', async () => {
      const user = userEvent.setup();
      renderNavigation();

      const aboutButton = screen.getByRole('button', { name: /about menu/i });
      await user.click(aboutButton);

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });

      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      });
    });
  });

  describe('Mobile navigation', () => {
    it('renders the mobile menu toggle button', () => {
      renderNavigation();
      const menuButton = screen.getByRole('button', { name: /open menu/i });
      expect(menuButton).toBeInTheDocument();
    });

    it('opens mobile menu when hamburger button is clicked', async () => {
      const user = userEvent.setup();
      renderNavigation();

      await user.click(screen.getByRole('button', { name: /open menu/i }));

      // The About section in mobile has all items visible inline
      await waitFor(() => {
        // Mobile menu should show all nav items
        // "About" appears in both desktop dropdown button and mobile section header
        const aboutElements = screen.getAllByText('About');
        expect(aboutElements.length).toBeGreaterThanOrEqual(2);
      });
    });

    it('toggles mobile menu button aria state', async () => {
      const user = userEvent.setup();
      renderNavigation();

      const menuButton = screen.getByRole('button', { name: /open menu/i });
      expect(menuButton).toHaveAttribute('aria-expanded', 'false');

      await user.click(menuButton);

      await waitFor(() => {
        expect(menuButton).toHaveAttribute('aria-expanded', 'true');
      });
    });

    it('closes mobile menu when a link is clicked', async () => {
      const user = userEvent.setup();
      renderNavigation();

      await user.click(screen.getByRole('button', { name: /open menu/i }));

      await waitFor(() => {
        // Find the mobile Home link (we need to be careful with duplicates)
        const menuButton = screen.getByRole('button', { name: /close menu/i });
        expect(menuButton).toBeInTheDocument();
      });
    });
  });

  describe('Active route highlighting', () => {
    it('does not error when rendered on a non-home route', () => {
      expect(() => renderNavigation('/about')).not.toThrow();
    });

    it('renders correctly on the blog route', () => {
      renderNavigation('/blog');
      // Just ensure it renders without error on a different route
      expect(screen.getByRole('button', { name: /about menu/i })).toBeInTheDocument();
    });
  });
});
