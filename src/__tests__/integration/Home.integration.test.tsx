import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import Home from '../../pages/Home';

// WebGL is unavailable in jsdom — mock R3F so EditorialCanvas never touches the
// GPU. Children (R3F intrinsics) are dropped rather than rendered as unknown DOM nodes.
vi.mock('@react-three/fiber', () => ({
  Canvas: () => <div data-testid="editorial-canvas" />,
  useFrame: () => {},
  useThree: () => ({ size: { width: 800, height: 600 }, invalidate: () => {} }),
}));

vi.mock('@react-three/drei', () => ({
  View: Object.assign(() => null, { Port: () => null }),
  PerspectiveCamera: () => null,
  useTexture: () => ({}),
}));

// Mock Playfair woff2 imports — Vite's ?url suffix produces a hashed path
// that vitest can't resolve from node_modules.
vi.mock(
  '@fontsource/playfair-display/files/playfair-display-latin-400-normal.woff2?url',
  () => ({ default: '/mock-playfair-400.woff2' })
);
vi.mock(
  '@fontsource/playfair-display/files/playfair-display-latin-500-normal.woff2?url',
  () => ({ default: '/mock-playfair-500.woff2' })
);

const renderHome = () => {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={['/']}>
        <Home />
      </MemoryRouter>
    </HelmetProvider>
  );
};

describe('Home Page Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Hero section', () => {
    it('renders one h1 with the accessible name "Christian Perez"', () => {
      renderHome();
      const h1 = screen.getByRole('heading', { level: 1 });
      expect(h1).toHaveTextContent(/Christian\s+Perez/);
    });

    it('renders the founder eyebrow label', () => {
      renderHome();
      expect(screen.getByText('(FOUNDER & CEO — ALTIVUM INC.)')).toBeInTheDocument();
    });
  });

  describe('Wayfinding tiles', () => {
    it('renders links to The Vector Podcast, Beyond the Assessment, and Altivum Inc', () => {
      renderHome();
      // Multiple links may exist (hero bento + ventures section both link to these routes)
      const podcastLinks = screen.getAllByRole('link', { name: /The Vector Podcast/i });
      expect(podcastLinks.length).toBeGreaterThanOrEqual(1);
      expect(podcastLinks[0]).toHaveAttribute('href', '/podcast');

      const bookLinks = screen.getAllByRole('link', { name: /Beyond the Assessment/i });
      expect(bookLinks.length).toBeGreaterThanOrEqual(1);
      expect(bookLinks[0]).toHaveAttribute('href', '/beyond-the-assessment');

      const altivumLinks = screen.getAllByRole('link', { name: /Altivum Inc/i });
      expect(altivumLinks.length).toBeGreaterThanOrEqual(1);
      expect(altivumLinks[0]).toHaveAttribute('href', '/altivum');
    });

    it('renders a Start a conversation CTA link to /contact', () => {
      renderHome();
      // Multiple "Start a conversation" links may exist across sections
      const contactLinks = screen.getAllByRole('link', { name: /Start a conversation/i });
      expect(contactLinks.length).toBeGreaterThanOrEqual(1);
      expect(contactLinks[0]).toHaveAttribute('href', '/contact');
    });
  });

  describe('SEO metadata', () => {
    it('sets the page title correctly', async () => {
      renderHome();
      await vi.waitFor(() => {
        expect(document.title).toBe('Christian Perez | Christian Perez');
      });
    });

    it('includes JSON-LD structured data', async () => {
      renderHome();
      await vi.waitFor(() => {
        const script = document.querySelector('script[type="application/ld+json"]');
        expect(script).toBeTruthy();
        const content = script?.textContent || '';
        expect(content).toContain('@context');
        expect(content).toContain('schema.org');
      });
    });

    it('includes FAQ schema from homeFAQs', async () => {
      renderHome();
      await vi.waitFor(() => {
        const script = document.querySelector('script[type="application/ld+json"]');
        const content = script?.textContent || '';
        expect(content).toContain('FAQPage');
      });
    });
  });
});
