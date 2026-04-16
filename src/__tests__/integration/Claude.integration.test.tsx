import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import Claude from '../../pages/Claude';

// Mock static image imports
vi.mock('../../assets/claude-hero.png', () => ({ default: '/mock-claude-hero.png' }));
vi.mock('../../assets/claude-bedrock-cert.png', () => ({
  default: '/mock-claude-bedrock-cert.png',
}));

// Mock GSAP (ArchitectureXRay timeline animations)
vi.mock('gsap', () => ({
  default: {
    from: vi.fn(),
    to: vi.fn(),
    timeline: vi.fn(() => ({
      to: vi.fn().mockReturnThis(),
      play: vi.fn(),
      kill: vi.fn(),
    })),
  },
}));

// Mock useMediaQuery to return desktop layout for ArchitectureXRay
vi.mock('../../hooks/useMediaQuery', () => ({
  useMediaQuery: () => true,
}));

// Mock chatSigning (used by ArchitectureXRay for live trace)
vi.mock('../../utils/chatSigning', () => ({
  getSignedHeaders: vi.fn(),
}));

// Mock TraceInput and TraceResponseBubble (not needed for page-level structural tests)
vi.mock('../../components/claude/TraceInput', () => ({
  TraceInput: () => <div data-testid="trace-input" />,
}));

vi.mock('../../components/claude/TraceResponseBubble', () => ({
  TraceResponseBubble: () => null,
}));

const renderClaude = () => {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={['/claude']}>
        <Claude />
      </MemoryRouter>
    </HelmetProvider>
  );
};

describe('Claude Page Integration', () => {
  describe('Hero section', () => {
    it('renders the hero image with correct alt text', () => {
      renderClaude();
      const heroImage = screen.getByAltText('Applied — Claude by Anthropic');
      expect(heroImage).toBeInTheDocument();
      expect(heroImage.tagName).toBe('IMG');
    });

    it('renders an accessible sr-only h1 heading', () => {
      renderClaude();
      const heading = screen.getByRole('heading', {
        level: 1,
        name: /claude - applied ai engineer/i,
      });
      expect(heading).toBeInTheDocument();
    });
  });

  describe('Introduction section', () => {
    it('renders the first intro paragraph about Claude as foundation', () => {
      renderClaude();
      expect(
        screen.getByText((_content, element) => {
          if (element?.tagName !== 'P') return false;
          const text = element.textContent || '';
          return (
            text.includes("Claude isn't just a tool I use") &&
            text.includes('AI systems I build') &&
            text.includes('Altivum Inc.')
          );
        })
      ).toBeInTheDocument();
    });

    it('renders the paragraph about Claude Haiku 4.5 and RAG', () => {
      renderClaude();
      expect(
        screen.getByText((_content, element) => {
          if (element?.tagName !== 'P') return false;
          const text = element.textContent || '';
          return (
            text.includes('Claude Haiku 4.5') &&
            text.includes('retrieval-augmented generation') &&
            text.includes('production-grade AI applications')
          );
        })
      ).toBeInTheDocument();
    });

    it('renders the paragraph about the applied side of AI engineering', () => {
      renderClaude();
      expect(
        screen.getByText((_content, element) => {
          if (element?.tagName !== 'P') return false;
          const text = element.textContent || '';
          return (
            text.includes('applied side of AI engineering') &&
            text.includes('building real systems')
          );
        })
      ).toBeInTheDocument();
    });
  });

  describe('Architecture X-Ray section', () => {
    it('renders "The Architecture" section heading', () => {
      renderClaude();
      expect(
        screen.getByRole('heading', { name: /the architecture/i })
      ).toBeInTheDocument();
    });

    it('renders the pipeline diagram with accessible label', () => {
      renderClaude();
      expect(
        screen.getByRole('img', {
          name: /architecture pipeline diagram showing the alti chat data flow/i,
        })
      ).toBeInTheDocument();
    });
  });

  describe('What I Build (Focus Areas) section', () => {
    it('renders the "What I Build" heading', () => {
      renderClaude();
      expect(
        screen.getByRole('heading', { name: /what i build/i })
      ).toBeInTheDocument();
    });

    it('renders all 3 focus area cards', () => {
      renderClaude();
      expect(
        screen.getByRole('heading', { name: /conversational ai & rag/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: /ai-augmented development/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: /intelligent systems design/i })
      ).toBeInTheDocument();
    });
  });

  describe('How I Work With Claude section', () => {
    it('renders the "How I Work With Claude" heading', () => {
      renderClaude();
      expect(
        screen.getByRole('heading', { name: /how i work with claude/i })
      ).toBeInTheDocument();
    });

    it('renders all 3 subsections (Production First, Human in the Loop, Full-Stack AI)', () => {
      renderClaude();
      expect(
        screen.getByRole('heading', { name: /production first/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: /human in the loop/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: /full-stack ai/i })
      ).toBeInTheDocument();
    });
  });

  describe('Anthropic Academy section', () => {
    it('renders the featured "Claude with Amazon Bedrock" certification', () => {
      renderClaude();
      expect(
        screen.getByRole('heading', { name: /claude with amazon bedrock/i })
      ).toBeInTheDocument();
      expect(
        screen.getByAltText(
          'Certificate of Completion — Claude with Amazon Bedrock'
        )
      ).toBeInTheDocument();
      expect(screen.getByText(/issued january 2026/i)).toBeInTheDocument();
    });

    it('renders the "Claude with the Anthropic API" cert with correct verify URL and issued date', () => {
      renderClaude();
      const certHeading = screen.getByRole('heading', {
        name: /claude with the anthropic api/i,
      });
      expect(certHeading).toBeInTheDocument();

      // The issued-date text and Verify anchor sit inside the card wrapper,
      // alongside the heading. Traverse up to the card container to scope queries.
      const card = certHeading.closest('div');
      expect(card).not.toBeNull();

      expect(card!.textContent).toContain('Issued April 2026');

      const verifyLink = Array.from(
        card!.querySelectorAll('a')
      ).find((a) => a.textContent?.toLowerCase().includes('verify'));

      expect(verifyLink).toBeDefined();
      expect(verifyLink).toHaveAttribute(
        'href',
        'https://verify.skilljar.com/c/op29b22ona53'
      );
      expect(verifyLink).toHaveAttribute('target', '_blank');
      expect(verifyLink).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('renders the featured cert verify link with correct URL', () => {
      renderClaude();
      const links = screen.getAllByRole('link', { name: /verify/i });
      const featuredLink = links.find(
        (link) =>
          link.getAttribute('href') ===
          'https://verify.skilljar.com/c/chryt9ap866c'
      );
      expect(featuredLink).toBeDefined();
      expect(featuredLink).toHaveAttribute('target', '_blank');
      expect(featuredLink).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });

  describe('SEO metadata', () => {
    it('sets the page title correctly', async () => {
      renderClaude();

      await vi.waitFor(() => {
        expect(document.title).toBe('Claude | Christian Perez');
      });
    });

    it('includes breadcrumb structured data', async () => {
      renderClaude();

      await vi.waitFor(() => {
        const scripts = document.querySelectorAll(
          'script[type="application/ld+json"]'
        );
        const combined = Array.from(scripts)
          .map((s) => s.textContent || '')
          .join('\n');
        expect(combined).toContain('BreadcrumbList');
      });
    });
  });
});
