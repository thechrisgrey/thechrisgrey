import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import Home from '../../pages/Home';

// Mock static image imports that Vite handles at build time
vi.mock('../../assets/hero2.png', () => ({ default: '/mock-hero.png' }));

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
    it('renders the hero image with correct alt text', () => {
      renderHome();
      const heroImage = screen.getByAltText('Leadership Forged in Service');
      expect(heroImage).toBeInTheDocument();
      expect(heroImage.tagName).toBe('IMG');
    });

    it('renders an accessible h1 heading for screen readers', () => {
      renderHome();
      const heading = screen.getByRole('heading', {
        level: 1,
        name: /christian perez.*leadership forged in service/i,
      });
      expect(heading).toBeInTheDocument();
    });
  });

  describe('Summary section with key points', () => {
    it('renders all 5 key points with correct titles', () => {
      renderHome();
      expect(screen.getByText('Personal Biography')).toBeInTheDocument();
      expect(screen.getByText('Altivum Inc')).toBeInTheDocument();
      expect(screen.getByText('The Vector Podcast')).toBeInTheDocument();
      expect(screen.getByText('Beyond the Assessment')).toBeInTheDocument();
      expect(screen.getByText('Amazon Web Services')).toBeInTheDocument();
    });

    it('renders all 5 key points with correct subtitles', () => {
      renderHome();
      expect(screen.getByText('Christian Perez')).toBeInTheDocument();
      expect(screen.getByText('Founder & CEO')).toBeInTheDocument();
      expect(screen.getByText('Host')).toBeInTheDocument();
      expect(screen.getByText('Author')).toBeInTheDocument();
      expect(screen.getByText('AWS Community Builder (AI Engineering)')).toBeInTheDocument();
    });

    it('renders key points as links to their respective pages', () => {
      renderHome();

      const biographyLink = screen.getByRole('link', { name: /personal biography/i });
      expect(biographyLink).toHaveAttribute('href', '/about');

      const altivumLink = screen.getByRole('link', { name: /altivum inc/i });
      expect(altivumLink).toHaveAttribute('href', '/altivum');

      const podcastLink = screen.getByRole('link', { name: /the vector podcast/i });
      expect(podcastLink).toHaveAttribute('href', '/podcast');

      const bookLink = screen.getByRole('link', { name: /beyond the assessment/i });
      expect(bookLink).toHaveAttribute('href', '/beyond-the-assessment');

      const awsLink = screen.getByRole('link', { name: /amazon web services/i });
      expect(awsLink).toHaveAttribute('href', '/aws');
    });

    it('renders the profile image', () => {
      renderHome();
      const profileImage = screen.getByAltText('Christian Perez');
      expect(profileImage).toBeInTheDocument();
      expect(profileImage).toHaveAttribute('src', '/profile1.jpeg');
    });
  });

  describe('CTA section', () => {
    it('renders the "Let\'s Connect" heading', () => {
      renderHome();
      const heading = screen.getByRole('heading', { name: /let's connect/i });
      expect(heading).toBeInTheDocument();
    });

    it('renders a LinkedIn social link with correct href', () => {
      renderHome();
      const linkedinLinks = screen.getAllByRole('link', { name: /linkedin/i });
      const ctaLinkedIn = linkedinLinks.find(
        (link) => link.getAttribute('href') === 'https://www.linkedin.com/in/thechrisgrey/'
      );
      expect(ctaLinkedIn).toBeInTheDocument();
      expect(ctaLinkedIn).toHaveAttribute('target', '_blank');
      expect(ctaLinkedIn).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('renders an Instagram social link with correct href', () => {
      renderHome();
      const instagramLinks = screen.getAllByRole('link', { name: /instagram/i });
      const ctaInstagram = instagramLinks.find(
        (link) => link.getAttribute('href') === 'https://www.instagram.com/thechrisgrey/'
      );
      expect(ctaInstagram).toBeInTheDocument();
      expect(ctaInstagram).toHaveAttribute('target', '_blank');
    });

    it('renders a link to the Links page to see all socials', () => {
      renderHome();
      const allSocialsLink = screen.getByRole('link', {
        name: /check out the rest of my socials/i,
      });
      expect(allSocialsLink).toHaveAttribute('href', '/links');
    });
  });

  describe('SEO metadata', () => {
    it('sets the page title correctly', async () => {
      renderHome();
      // react-helmet-async sets document.title asynchronously in jsdom
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
