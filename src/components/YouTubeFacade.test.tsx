import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import YouTubeFacade from './YouTubeFacade';

describe('YouTubeFacade', () => {
  const defaultProps = {
    videoId: 'abc123',
    title: 'Test Video',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial render (facade state)', () => {
    it('should render a play button, not an iframe', () => {
      render(<YouTubeFacade {...defaultProps} />);
      const playButton = screen.getByRole('button', {
        name: /play test video/i,
      });
      expect(playButton).toBeInTheDocument();
      expect(screen.queryByTitle('Test Video')).not.toBeInTheDocument();
    });

    it('should show thumbnail image with maxresdefault URL', () => {
      render(<YouTubeFacade {...defaultProps} />);
      const img = screen.getByAltText('Test Video');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute(
        'src',
        'https://i.ytimg.com/vi/abc123/maxresdefault.jpg'
      );
    });

    it('should set loading="lazy" on thumbnail image', () => {
      render(<YouTubeFacade {...defaultProps} />);
      const img = screen.getByAltText('Test Video');
      expect(img).toHaveAttribute('loading', 'lazy');
    });

    it('should have an accessible aria-label on the play button', () => {
      render(<YouTubeFacade {...defaultProps} />);
      const button = screen.getByRole('button', {
        name: 'Play Test Video',
      });
      expect(button).toBeInTheDocument();
    });
  });

  describe('thumbnail fallback', () => {
    it('should fall back to hqdefault.jpg on image error', () => {
      render(<YouTubeFacade {...defaultProps} />);
      const img = screen.getByAltText('Test Video');

      // Simulate image load error
      fireEvent.error(img);

      expect(img).toHaveAttribute(
        'src',
        'https://i.ytimg.com/vi/abc123/hqdefault.jpg'
      );
    });

    it('should not change src if already using hqdefault', () => {
      render(<YouTubeFacade {...defaultProps} />);
      const img = screen.getByAltText('Test Video');

      // First error: switch to hqdefault
      fireEvent.error(img);
      expect(img).toHaveAttribute(
        'src',
        'https://i.ytimg.com/vi/abc123/hqdefault.jpg'
      );

      // Second error: should not change (already hqdefault)
      fireEvent.error(img);
      expect(img).toHaveAttribute(
        'src',
        'https://i.ytimg.com/vi/abc123/hqdefault.jpg'
      );
    });
  });

  describe('click to play (iframe state)', () => {
    it('should render an iframe after clicking the play button', async () => {
      const user = userEvent.setup();
      render(<YouTubeFacade {...defaultProps} />);

      const playButton = screen.getByRole('button', {
        name: /play test video/i,
      });
      await user.click(playButton);

      const iframe = screen.getByTitle('Test Video');
      expect(iframe).toBeInTheDocument();
      expect(iframe.tagName).toBe('IFRAME');
    });

    it('should include autoplay=1 in iframe src', async () => {
      const user = userEvent.setup();
      render(<YouTubeFacade {...defaultProps} />);

      await user.click(
        screen.getByRole('button', { name: /play test video/i })
      );

      const iframe = screen.getByTitle('Test Video');
      expect(iframe).toHaveAttribute(
        'src',
        'https://www.youtube.com/embed/abc123?autoplay=1'
      );
    });

    it('should include embedParams in iframe src when provided', async () => {
      const user = userEvent.setup();
      render(
        <YouTubeFacade {...defaultProps} embedParams="rel=0&modestbranding=1" />
      );

      await user.click(
        screen.getByRole('button', { name: /play test video/i })
      );

      const iframe = screen.getByTitle('Test Video');
      expect(iframe).toHaveAttribute(
        'src',
        'https://www.youtube.com/embed/abc123?rel=0&modestbranding=1&autoplay=1'
      );
    });

    it('should remove the play button after clicking', async () => {
      const user = userEvent.setup();
      render(<YouTubeFacade {...defaultProps} />);

      await user.click(
        screen.getByRole('button', { name: /play test video/i })
      );

      expect(
        screen.queryByRole('button', { name: /play test video/i })
      ).not.toBeInTheDocument();
    });

    it('should set sandbox attribute on iframe', async () => {
      const user = userEvent.setup();
      render(<YouTubeFacade {...defaultProps} />);

      await user.click(
        screen.getByRole('button', { name: /play test video/i })
      );

      const iframe = screen.getByTitle('Test Video');
      expect(iframe).toHaveAttribute(
        'sandbox',
        'allow-scripts allow-same-origin allow-presentation allow-popups'
      );
    });

    it('should set allowFullScreen on iframe', async () => {
      const user = userEvent.setup();
      render(<YouTubeFacade {...defaultProps} />);

      await user.click(
        screen.getByRole('button', { name: /play test video/i })
      );

      const iframe = screen.getByTitle('Test Video');
      expect(iframe).toHaveAttribute('allowfullscreen', '');
    });
  });

  describe('with different videoId', () => {
    it('should use the correct videoId in thumbnail URL', () => {
      render(
        <YouTubeFacade videoId="xyz789" title="Another Video" />
      );
      const img = screen.getByAltText('Another Video');
      expect(img).toHaveAttribute(
        'src',
        'https://i.ytimg.com/vi/xyz789/maxresdefault.jpg'
      );
    });

    it('should use the correct videoId in embed URL after click', async () => {
      const user = userEvent.setup();
      render(
        <YouTubeFacade videoId="xyz789" title="Another Video" />
      );

      await user.click(
        screen.getByRole('button', { name: /play another video/i })
      );

      const iframe = screen.getByTitle('Another Video');
      expect(iframe).toHaveAttribute(
        'src',
        'https://www.youtube.com/embed/xyz789?autoplay=1'
      );
    });
  });
});
