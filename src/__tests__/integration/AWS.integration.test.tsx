import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import AWS from '../../pages/AWS';

// Mock static image imports
vi.mock('../../assets/aws-hero.png', () => ({ default: '/mock-aws-hero.png' }));
vi.mock('../../assets/aws-community-builder.png', () => ({
  default: '/mock-aws-community-builder.png',
}));

const renderAWS = () => {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={['/aws']}>
        <AWS />
      </MemoryRouter>
    </HelmetProvider>
  );
};

describe('AWS Page Integration', () => {
  describe('Hero section', () => {
    it('renders the hero image with correct alt text', () => {
      renderAWS();
      const heroImage = screen.getByAltText('AWS - AI Engineering');
      expect(heroImage).toBeInTheDocument();
      expect(heroImage.tagName).toBe('IMG');
    });

    it('renders an accessible h1 heading for screen readers', () => {
      renderAWS();
      const heading = screen.getByRole('heading', {
        level: 1,
        name: /amazon web services.*aws community builder.*ai engineering/i,
      });
      expect(heading).toBeInTheDocument();
    });
  });

  describe('Community Builder Banner section', () => {
    it('renders the community builder image', () => {
      renderAWS();
      const cbImage = screen.getByAltText('Christian Perez - AWS Community Builder');
      expect(cbImage).toBeInTheDocument();
    });
  });

  describe('Introduction section', () => {
    it('renders the AWS Community Builder title text', () => {
      renderAWS();
      // The title is split across spans: "AWS " + "<span>Community Builder</span>"
      // Use a custom text matcher to find text spread across elements
      expect(
        screen.getByText((_content, element) => {
          return element?.tagName === 'P' && element.textContent === 'AWS Community Builder';
        })
      ).toBeInTheDocument();
    });

    it('renders the AI Engineering subtitle', () => {
      renderAWS();
      // This text is in its own <p> element
      expect(
        screen.getByText((_content, element) => {
          return element?.tagName === 'P' && element.textContent?.trim() === 'AI Engineering';
        })
      ).toBeInTheDocument();
    });

    it('describes the AWS Community Builders program', () => {
      renderAWS();
      // Text is split with inline <span> elements; use a custom matcher
      expect(
        screen.getByText((_content, element) => {
          if (element?.tagName !== 'P') return false;
          const text = element.textContent || '';
          return text.includes('AWS Community Builders') && text.includes('program provides');
        })
      ).toBeInTheDocument();
    });
  });

  describe('Focus Areas section', () => {
    it('renders the "Focus Areas" section heading', () => {
      renderAWS();
      expect(
        screen.getByRole('heading', { name: /focus areas/i })
      ).toBeInTheDocument();
    });

    it('renders all 3 focus area cards with correct titles', () => {
      renderAWS();
      expect(screen.getByText('AI & Machine Learning')).toBeInTheDocument();
      expect(screen.getByText('Cloud Architecture')).toBeInTheDocument();
      expect(screen.getByText('Community & Content')).toBeInTheDocument();
    });

    it('renders service tags for the AI & Machine Learning card', () => {
      renderAWS();
      expect(screen.getByText('Amazon Bedrock')).toBeInTheDocument();
      expect(screen.getByText('SageMaker')).toBeInTheDocument();
      expect(screen.getByText('Titan Embeddings')).toBeInTheDocument();
      expect(screen.getByText('Knowledge Bases')).toBeInTheDocument();
    });

    it('renders service tags for the Cloud Architecture card', () => {
      renderAWS();
      expect(screen.getByText('Lambda')).toBeInTheDocument();
      expect(screen.getByText('API Gateway')).toBeInTheDocument();
      expect(screen.getByText('DynamoDB')).toBeInTheDocument();
      expect(screen.getByText('CloudFormation')).toBeInTheDocument();
    });

    it('renders service tags for the Community & Content card', () => {
      renderAWS();
      expect(screen.getByText('Technical Blogs')).toBeInTheDocument();
      expect(screen.getByText('Architecture Patterns')).toBeInTheDocument();
      expect(screen.getByText('Best Practices')).toBeInTheDocument();
    });

    it('renders descriptions for each focus area', () => {
      renderAWS();
      expect(
        screen.getByText(/Building intelligent systems with Amazon Bedrock/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Designing serverless, event-driven systems/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Sharing knowledge through technical writing/i)
      ).toBeInTheDocument();
    });
  });

  describe('What This Means section', () => {
    it('renders the "What This Means" section heading', () => {
      renderAWS();
      expect(
        screen.getByRole('heading', { name: /what this means/i })
      ).toBeInTheDocument();
    });

    it('renders all 3 items with correct titles', () => {
      renderAWS();
      expect(screen.getByText('Direct Access')).toBeInTheDocument();
      expect(screen.getByText('Knowledge Sharing')).toBeInTheDocument();
      expect(screen.getByText('Builder Network')).toBeInTheDocument();
    });

    it('renders descriptions for each item', () => {
      renderAWS();
      expect(
        screen.getByText(/Early access to AWS services/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/A commitment to sharing what I learn/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Connection to a global network of builders/i)
      ).toBeInTheDocument();
    });
  });

  describe('SEO metadata', () => {
    it('sets the page title correctly', async () => {
      renderAWS();

      await vi.waitFor(() => {
        expect(document.title).toBe('Amazon Web Services | Christian Perez');
      });
    });

    it('includes breadcrumb structured data', async () => {
      renderAWS();

      await vi.waitFor(() => {
        const script = document.querySelector('script[type="application/ld+json"]');
        const content = script?.textContent || '';
        expect(content).toContain('BreadcrumbList');
      });
    });
  });
});
