import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';

// Mock Sanity client at the module boundary
const { mockFetch, mockGetBlogListingCache, mockSetBlogListingCache } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
  mockGetBlogListingCache: vi.fn().mockReturnValue(null),
  mockSetBlogListingCache: vi.fn(),
}));

vi.mock('../../sanity', () => ({
  client: { fetch: mockFetch },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  urlFor: (_source: unknown) => ({
    width: () => ({ height: () => ({ auto: () => ({ quality: () => ({ url: () => 'https://mock-image.jpg' }) }) }) }),
  }),
  BLOG_LISTING_QUERY: 'mock-blog-query',
  POST_BY_SLUG_QUERY: 'mock-post-query',
  getBlogListingCache: mockGetBlogListingCache,
  setBlogListingCache: mockSetBlogListingCache,
  getPostCache: vi.fn().mockReturnValue(null),
  setPostCache: vi.fn(),
}));

// Mock the routeManifest used by Blog page
vi.mock('../../utils/routeManifest', () => ({
  prefetchBlogPostChunk: vi.fn(),
  prefetchRoute: vi.fn(),
}));

import Blog from '../../pages/Blog';

const mockPosts = [
  {
    _id: 'post-1',
    title: 'Building AI Systems on AWS',
    slug: { current: 'building-ai-systems' },
    excerpt: 'A deep dive into building production AI systems on AWS.',
    category: 'Technology',
    publishedAt: '2026-01-15',
    readingTime: 8,
    isFeatured: true,
    image: { asset: { _id: 'img-1', url: 'https://example.com/img1.jpg' }, alt: 'AI Systems' },
    tags: [
      { _id: 'tag-1', title: 'AI', slug: { current: 'ai' } },
      { _id: 'tag-2', title: 'AWS', slug: { current: 'aws' } },
    ],
    series: null,
    seriesOrder: null,
  },
  {
    _id: 'post-2',
    title: 'Leadership Lessons from Special Operations',
    slug: { current: 'leadership-lessons' },
    excerpt: 'What I learned about leadership during my time in the military.',
    category: 'Leadership',
    publishedAt: '2026-01-10',
    readingTime: 6,
    isFeatured: false,
    image: null,
    tags: [
      { _id: 'tag-3', title: 'Leadership', slug: { current: 'leadership' } },
    ],
    series: null,
    seriesOrder: null,
  },
  {
    _id: 'post-3',
    title: 'Cloud Architecture Part 1',
    slug: { current: 'cloud-arch-part-1' },
    excerpt: 'Introduction to modern cloud architecture patterns.',
    category: 'Technology',
    publishedAt: '2026-01-05',
    readingTime: 10,
    isFeatured: false,
    image: null,
    tags: [],
    series: {
      _id: 'series-1',
      title: 'Cloud Architecture Series',
      slug: { current: 'cloud-architecture' },
      description: 'A multi-part series on cloud architecture.',
    },
    seriesOrder: 1,
  },
];

const renderBlog = (route = '/blog') => {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[route]}>
        <Blog />
      </MemoryRouter>
    </HelmetProvider>
  );
};

describe('Blog Page Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetBlogListingCache.mockReturnValue(null);
    mockFetch.mockResolvedValue({ posts: mockPosts, tags: [], series: [] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial rendering with Sanity data', () => {
    it('shows loading skeletons while fetching', () => {
      // Keep the fetch pending
      mockFetch.mockReturnValue(new Promise(() => {}));
      renderBlog();

      expect(screen.getByRole('status', { name: /loading articles/i })).toBeInTheDocument();
    });

    it('renders all blog posts after data loads', async () => {
      renderBlog();

      await waitFor(() => {
        expect(screen.getByText('Building AI Systems on AWS')).toBeInTheDocument();
      });

      expect(screen.getByText('Leadership Lessons from Special Operations')).toBeInTheDocument();
      expect(screen.getByText('Cloud Architecture Part 1')).toBeInTheDocument();
    });

    it('renders post excerpts', async () => {
      renderBlog();

      await waitFor(() => {
        expect(
          screen.getByText('A deep dive into building production AI systems on AWS.')
        ).toBeInTheDocument();
      });
    });

    it('renders category labels for each post', async () => {
      renderBlog();

      await waitFor(() => {
        // "Technology" appears in the filter button AND in the post cards (2 posts),
        // plus possibly in "Read Article" links. Count should be >= 3
        const techLabels = screen.getAllByText('Technology');
        expect(techLabels.length).toBeGreaterThanOrEqual(3);
      });

      // "Leadership" appears as both a filter button and a post category label
      const leadershipLabels = screen.getAllByText('Leadership');
      expect(leadershipLabels.length).toBeGreaterThanOrEqual(2);
    });

    it('renders post tags as links', async () => {
      renderBlog();

      await waitFor(() => {
        expect(screen.getByText('AI')).toBeInTheDocument();
      });

      const aiTag = screen.getByRole('link', { name: 'AI' });
      expect(aiTag).toHaveAttribute('href', '/blog?tag=ai');
    });

    it('renders "Read Article" links for each post', async () => {
      renderBlog();

      await waitFor(() => {
        const readLinks = screen.getAllByText('Read Article');
        expect(readLinks).toHaveLength(3);
      });
    });

    it('caches the blog listing data after fetching', async () => {
      renderBlog();

      await waitFor(() => {
        expect(screen.getByText('Building AI Systems on AWS')).toBeInTheDocument();
      });

      expect(mockSetBlogListingCache).toHaveBeenCalledWith({
        posts: mockPosts,
        tags: [],
        series: [],
      });
    });

    it('uses cached data when available instead of fetching', async () => {
      mockGetBlogListingCache.mockReturnValue({ posts: mockPosts, tags: [], series: [] });
      renderBlog();

      await waitFor(() => {
        expect(screen.getByText('Building AI Systems on AWS')).toBeInTheDocument();
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('Category filtering', () => {
    it('renders dynamically derived category filter buttons', async () => {
      renderBlog();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: 'Technology' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Leadership' })).toBeInTheDocument();
    });

    it('filters posts when a category button is clicked', async () => {
      const user = userEvent.setup();
      renderBlog();

      await waitFor(() => {
        expect(screen.getByText('Building AI Systems on AWS')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Leadership' }));

      await waitFor(() => {
        expect(screen.getByText('Leadership Lessons from Special Operations')).toBeInTheDocument();
      });

      expect(screen.queryByText('Building AI Systems on AWS')).not.toBeInTheDocument();
    });

    it('shows active filter chip when a category is selected', async () => {
      const user = userEvent.setup();
      renderBlog();

      await waitFor(() => {
        expect(screen.getByText('Building AI Systems on AWS')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Technology' }));

      await waitFor(() => {
        expect(screen.getByText('Active filters:')).toBeInTheDocument();
      });
    });

    it('removes category filter when the filter chip is clicked', async () => {
      const user = userEvent.setup();
      renderBlog();

      await waitFor(() => {
        expect(screen.getByText('Building AI Systems on AWS')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Leadership' }));

      await waitFor(() => {
        expect(screen.queryByText('Building AI Systems on AWS')).not.toBeInTheDocument();
      });

      // Click "All" to clear the filter
      await user.click(screen.getByRole('button', { name: 'All' }));

      await waitFor(() => {
        expect(screen.getByText('Building AI Systems on AWS')).toBeInTheDocument();
      });
    });
  });

  describe('Series filtering via URL', () => {
    it('filters posts by series when ?series= param is present', async () => {
      renderBlog('/blog?series=cloud-architecture');

      await waitFor(() => {
        expect(screen.getByText('Cloud Architecture Part 1')).toBeInTheDocument();
      });

      // Non-series posts should not be visible
      expect(screen.queryByText('Building AI Systems on AWS')).not.toBeInTheDocument();
      expect(screen.queryByText('Leadership Lessons from Special Operations')).not.toBeInTheDocument();
    });

    it('shows series context banner when filtering by series', async () => {
      renderBlog('/blog?series=cloud-architecture');

      await waitFor(() => {
        expect(screen.getByText('Cloud Architecture Series')).toBeInTheDocument();
      });

      expect(
        screen.getByText('A multi-part series on cloud architecture.')
      ).toBeInTheDocument();

      expect(screen.getByText('1 post in this series')).toBeInTheDocument();
    });
  });

  describe('Search filtering', () => {
    it('filters posts by search query', async () => {
      const user = userEvent.setup();
      renderBlog();

      await waitFor(() => {
        expect(screen.getByText('Building AI Systems on AWS')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search articles...');
      await user.type(searchInput, 'leadership');

      await waitFor(() => {
        expect(screen.getByText('Leadership Lessons from Special Operations')).toBeInTheDocument();
      });

      expect(screen.queryByText('Building AI Systems on AWS')).not.toBeInTheDocument();
    });
  });

  describe('Empty and error states', () => {
    it('shows empty state message when no posts match filters', async () => {
      const user = userEvent.setup();
      renderBlog();

      await waitFor(() => {
        expect(screen.getByText('Building AI Systems on AWS')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search articles...');
      await user.type(searchInput, 'xyznonexistent');

      await waitFor(() => {
        expect(screen.getByText('No posts match your filters.')).toBeInTheDocument();
      });

      // Clear filters button should be visible
      expect(screen.getByText('Clear filters')).toBeInTheDocument();
    });

    it('shows error state when fetch fails', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));
      renderBlog();

      await waitFor(() => {
        expect(screen.getByText('Unable to load posts')).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });

    it('retries fetching when Try Again is clicked after error', async () => {
      const user = userEvent.setup();
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      renderBlog();

      await waitFor(() => {
        expect(screen.getByText('Unable to load posts')).toBeInTheDocument();
      });

      // Now resolve successfully on retry
      mockFetch.mockResolvedValueOnce({ posts: mockPosts, tags: [], series: [] });
      await user.click(screen.getByRole('button', { name: /try again/i }));

      await waitFor(() => {
        expect(screen.getByText('Building AI Systems on AWS')).toBeInTheDocument();
      });
    });

    it('shows "no posts yet" when the Sanity response returns empty posts', async () => {
      mockFetch.mockResolvedValue({ posts: [], tags: [], series: [] });
      renderBlog();

      await waitFor(() => {
        expect(screen.getByText('No posts yet. Check back soon!')).toBeInTheDocument();
      });
    });
  });

  describe('SEO metadata', () => {
    it('sets the page title to Blog', async () => {
      renderBlog();

      await vi.waitFor(() => {
        expect(document.title).toBe('Blog | Christian Perez');
      });
    });
  });
});
