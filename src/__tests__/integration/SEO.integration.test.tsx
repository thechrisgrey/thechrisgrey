import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';

// Mock static image imports
vi.mock('../../assets/hero2.png', () => ({ default: '/mock-hero.png' }));
vi.mock('../../assets/aws-hero.png', () => ({ default: '/mock-aws-hero.png' }));
vi.mock('../../assets/aws-community-builder.png', () => ({
  default: '/mock-aws-cb.png',
}));

// Mock Sanity client for Blog page
vi.mock('../../sanity', () => ({
  client: { fetch: vi.fn().mockResolvedValue({ posts: [], tags: [], series: [] }) },
  urlFor: () => ({
    width: () => ({ height: () => ({ auto: () => ({ quality: () => ({ url: () => 'https://mock.jpg' }) }) }) }),
  }),
  BLOG_LISTING_QUERY: 'mock-query',
  POST_BY_SLUG_QUERY: 'mock-query',
  getBlogListingCache: vi.fn().mockReturnValue(null),
  setBlogListingCache: vi.fn(),
  getPostCache: vi.fn().mockReturnValue(null),
  setPostCache: vi.fn(),
}));

vi.mock('../../utils/routeManifest', () => ({
  prefetchBlogPostChunk: vi.fn(),
  prefetchRoute: vi.fn(),
}));

import Home from '../../pages/Home';
import Blog from '../../pages/Blog';
import Contact from '../../pages/Contact';
import AWS from '../../pages/AWS';

const renderPage = (PageComponent: React.ComponentType, route: string) => {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[route]}>
        <PageComponent />
      </MemoryRouter>
    </HelmetProvider>
  );
};

describe('SEO Integration Across Pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // React 19 + react-helmet-async + jsdom: Helmet manipulates document.head
    // outside React's tree. During unmount, React 19's stricter reconciliation
    // may throw when trying to remove already-detached nodes.
    // This only affects jsdom — browsers handle it fine.
    try {
      cleanup();
    } catch {
      // Ignore removeChild errors from Helmet + React 19 unmount race
    }
    document.title = '';
    document.head
      .querySelectorAll('meta, link[rel="canonical"], script[type="application/ld+json"]')
      .forEach((el) => el.remove());
  });

  describe('Home page SEO', () => {
    it('sets correct title', async () => {
      renderPage(Home, '/');
      await waitFor(() => {
        expect(document.title).toContain('Christian Perez');
      });
    });

    it('sets correct meta description', async () => {
      renderPage(Home, '/');
      await waitFor(() => {
        const meta = document.querySelector('meta[name="description"]');
        expect(meta).toBeTruthy();
        expect(meta?.getAttribute('content')).toContain('Christian Perez');
      });
    });

    it('includes JSON-LD with Person and Organization schemas', async () => {
      renderPage(Home, '/');
      await waitFor(() => {
        const script = document.querySelector('script[type="application/ld+json"]');
        expect(script).toBeTruthy();
        const content = script?.textContent || '';
        const data = JSON.parse(content);
        const types = data['@graph']?.map((item: { '@type': string }) => item['@type']);
        expect(types).toContain('Person');
        expect(types).toContain('Corporation');
        expect(types).toContain('WebSite');
      });
    });

    it('includes FAQ schema', async () => {
      renderPage(Home, '/');
      await waitFor(() => {
        const script = document.querySelector('script[type="application/ld+json"]');
        const content = script?.textContent || '';
        expect(content).toContain('FAQPage');
      });
    });

    it('includes WebPage structured data', async () => {
      renderPage(Home, '/');
      await waitFor(() => {
        const script = document.querySelector('script[type="application/ld+json"]');
        const content = script?.textContent || '';
        expect(content).toContain('WebPage');
      });
    });

    it('sets canonical URL', async () => {
      renderPage(Home, '/');
      await waitFor(() => {
        const canonical = document.querySelector('link[rel="canonical"]');
        expect(canonical).toHaveAttribute('href', 'https://thechrisgrey.com');
      });
    });

    it('sets OG and Twitter meta tags', async () => {
      renderPage(Home, '/');
      await waitFor(() => {
        const ogTitle = document.querySelector('meta[property="og:title"]');
        expect(ogTitle).toBeTruthy();

        const twitterCard = document.querySelector('meta[name="twitter:card"]');
        expect(twitterCard).toHaveAttribute('content', 'summary_large_image');

        const twitterCreator = document.querySelector('meta[name="twitter:creator"]');
        expect(twitterCreator).toHaveAttribute('content', '@thechrisgrey');
      });
    });
  });

  describe('Blog page SEO', () => {
    it('sets title to "Blog | Christian Perez"', async () => {
      renderPage(Blog, '/blog');
      await waitFor(() => {
        expect(document.title).toBe('Blog | Christian Perez');
      });
    });

    it('includes Blog structured data', async () => {
      renderPage(Blog, '/blog');
      await waitFor(() => {
        const script = document.querySelector('script[type="application/ld+json"]');
        const content = script?.textContent || '';
        expect(content).toContain('"@type":"Blog"');
      });
    });

    it('includes breadcrumb schema', async () => {
      renderPage(Blog, '/blog');
      await waitFor(() => {
        const script = document.querySelector('script[type="application/ld+json"]');
        const content = script?.textContent || '';
        expect(content).toContain('BreadcrumbList');
      });
    });

    it('sets OG type to article', async () => {
      renderPage(Blog, '/blog');
      await waitFor(() => {
        const ogType = document.querySelector('meta[property="og:type"]');
        expect(ogType).toHaveAttribute('content', 'article');
      });
    });
  });

  describe('Contact page SEO', () => {
    it('sets title to "Contact & Speaking | Christian Perez"', async () => {
      renderPage(Contact, '/contact');
      await waitFor(() => {
        expect(document.title).toBe('Contact & Speaking | Christian Perez');
      });
    });

    it('includes Contact page structured data', async () => {
      renderPage(Contact, '/contact');
      await waitFor(() => {
        const script = document.querySelector('script[type="application/ld+json"]');
        const content = script?.textContent || '';
        expect(content).toContain('ContactPage');
      });
    });

    it('sets canonical URL to the contact page', async () => {
      renderPage(Contact, '/contact');
      await waitFor(() => {
        const canonical = document.querySelector('link[rel="canonical"]');
        expect(canonical).toHaveAttribute('href', 'https://thechrisgrey.com/contact');
      });
    });

    it('includes keywords meta tag', async () => {
      renderPage(Contact, '/contact');
      await waitFor(() => {
        const meta = document.querySelector('meta[name="keywords"]');
        expect(meta).toBeTruthy();
        expect(meta?.getAttribute('content')).toContain('speaking engagements');
      });
    });
  });

  describe('AWS page SEO', () => {
    it('sets title to "Amazon Web Services | Christian Perez"', async () => {
      renderPage(AWS, '/aws');
      await waitFor(() => {
        expect(document.title).toBe('Amazon Web Services | Christian Perez');
      });
    });

    it('includes WebPage structured data', async () => {
      renderPage(AWS, '/aws');
      await waitFor(() => {
        const script = document.querySelector('script[type="application/ld+json"]');
        const content = script?.textContent || '';
        expect(content).toContain('WebPage');
      });
    });

    it('includes breadcrumb schema', async () => {
      renderPage(AWS, '/aws');
      await waitFor(() => {
        const script = document.querySelector('script[type="application/ld+json"]');
        const content = script?.textContent || '';
        expect(content).toContain('BreadcrumbList');
      });
    });

    it('includes keywords about AWS and AI', async () => {
      renderPage(AWS, '/aws');
      await waitFor(() => {
        const meta = document.querySelector('meta[name="keywords"]');
        expect(meta).toBeTruthy();
        expect(meta?.getAttribute('content')).toContain('AWS Community Builder');
        expect(meta?.getAttribute('content')).toContain('AI Engineering');
      });
    });
  });

  describe('Cross-page SEO consistency', () => {
    it('all pages include the default Person schema', async () => {
      const pages: [React.ComponentType, string][] = [
        [Home, '/'],
        [Blog, '/blog'],
        [Contact, '/contact'],
        [AWS, '/aws'],
      ];

      for (const [Page, route] of pages) {
        // Clean up between pages
        document.title = '';
        document.head
          .querySelectorAll('meta, link[rel="canonical"], script[type="application/ld+json"]')
          .forEach((el) => el.remove());

        const { unmount } = renderPage(Page, route);

        await waitFor(() => {
          const script = document.querySelector('script[type="application/ld+json"]');
          expect(script).toBeTruthy();
          const content = script?.textContent || '';
          expect(content).toContain('Person');
        });

        unmount();
      }
    });

    it('all pages set the default OG image when no custom image is provided', async () => {
      const pages: [React.ComponentType, string][] = [
        [Home, '/'],
        [Blog, '/blog'],
        [Contact, '/contact'],
        [AWS, '/aws'],
      ];

      for (const [Page, route] of pages) {
        document.head
          .querySelectorAll('meta[property="og:image"]')
          .forEach((el) => el.remove());

        const { unmount } = renderPage(Page, route);

        await waitFor(() => {
          const ogImage = document.querySelector('meta[property="og:image"]');
          expect(ogImage).toBeTruthy();
          expect(ogImage?.getAttribute('content')).toBe('https://thechrisgrey.com/og.png');
        });

        unmount();
      }
    });
  });
});
