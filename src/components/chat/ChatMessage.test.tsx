import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ChatMessage from './ChatMessage';

describe('ChatMessage', () => {
  describe('user messages', () => {
    it('should render user message content', () => {
      render(<ChatMessage role="user" content="Hello there" />);
      expect(screen.getByText('Hello there')).toBeInTheDocument();
    });

    it('should render with right-aligned container (justify-end)', () => {
      const { container } = render(
        <ChatMessage role="user" content="User message" />
      );
      const outerDiv = container.firstElementChild;
      expect(outerDiv?.className).toContain('justify-end');
    });

    it('should render with white text class', () => {
      render(<ChatMessage role="user" content="User text" />);
      const textElement = screen.getByText('User text');
      expect(textElement.className).toContain('text-white');
    });

    it('should render with white border for user messages', () => {
      const { container } = render(
        <ChatMessage role="user" content="User message" />
      );
      const messageDiv = container.querySelector('[class*="border-white"]');
      expect(messageDiv).not.toBeNull();
    });

    it('should NOT auto-link keywords in user messages', () => {
      render(
        <ChatMessage role="user" content="I want to learn about Altivum" />
      );
      const links = screen.queryAllByRole('link');
      expect(links).toHaveLength(0);
      expect(screen.getByText('I want to learn about Altivum')).toBeInTheDocument();
    });
  });

  describe('assistant messages', () => {
    it('should render assistant message content', () => {
      render(<ChatMessage role="assistant" content="Hi, I can help!" />);
      expect(screen.getByText('Hi, I can help!')).toBeInTheDocument();
    });

    it('should render with left-aligned container (justify-start)', () => {
      const { container } = render(
        <ChatMessage role="assistant" content="Assistant message" />
      );
      const outerDiv = container.firstElementChild;
      expect(outerDiv?.className).toContain('justify-start');
    });

    it('should render with gold text class', () => {
      render(
        <ChatMessage role="assistant" content="Assistant text" />
      );
      const textElement = screen.getByText('Assistant text');
      expect(textElement.className).toContain('text-altivum-gold');
    });

    it('should render with gold border for assistant messages', () => {
      const { container } = render(
        <ChatMessage role="assistant" content="Assistant message" />
      );
      const messageDiv = container.querySelector(
        '[class*="border-altivum-gold"]'
      );
      expect(messageDiv).not.toBeNull();
    });
  });

  describe('auto-linking in assistant messages', () => {
    it('should auto-link "Altivum" keyword', () => {
      render(
        <ChatMessage
          role="assistant"
          content="Learn more about Altivum today."
        />
      );
      const link = screen.getByRole('link', { name: 'Altivum' });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', 'https://altivum.ai');
    });

    it('should auto-link "Altivum Inc" before "Altivum"', () => {
      render(
        <ChatMessage
          role="assistant"
          content="He founded Altivum Inc in 2024."
        />
      );
      const link = screen.getByRole('link', { name: 'Altivum Inc' });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', 'https://altivum.ai');
    });

    it('should auto-link "Beyond the Assessment"', () => {
      render(
        <ChatMessage
          role="assistant"
          content="His book Beyond the Assessment is available now."
        />
      );
      const link = screen.getByRole('link', { name: 'Beyond the Assessment' });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', 'https://altivum.ai/bta');
    });

    it('should auto-link "The Vector Podcast"', () => {
      render(
        <ChatMessage
          role="assistant"
          content="Check out The Vector Podcast for more."
        />
      );
      const link = screen.getByRole('link', {
        name: 'The Vector Podcast',
      });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute(
        'href',
        'https://www.youtube.com/@thevectorpodcast'
      );
    });

    it('should auto-link "VetROI"', () => {
      render(
        <ChatMessage
          role="assistant"
          content="The VetROI platform helps veterans."
        />
      );
      const link = screen.getByRole('link', { name: 'VetROI' });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', 'https://vetroi.altivum.ai');
    });

    it('should auto-link multiple keywords in one message', () => {
      render(
        <ChatMessage
          role="assistant"
          content="He founded Altivum and hosts The Vector Podcast."
        />
      );
      const links = screen.getAllByRole('link');
      expect(links.length).toBeGreaterThanOrEqual(2);
    });

    it('should open links in a new tab', () => {
      render(
        <ChatMessage
          role="assistant"
          content="Visit Altivum for details."
        />
      );
      const link = screen.getByRole('link', { name: 'Altivum' });
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('should not create links when no keywords are present', () => {
      render(
        <ChatMessage
          role="assistant"
          content="This is a generic response without any special keywords."
        />
      );
      const links = screen.queryAllByRole('link');
      expect(links).toHaveLength(0);
    });
  });
});
