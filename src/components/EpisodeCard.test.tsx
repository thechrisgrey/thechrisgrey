import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EpisodeCard from './EpisodeCard';
import type { PodcastEpisode } from '../types/podcast';

const baseEpisode: PodcastEpisode = {
  id: 'ep-1',
  title: 'Test Episode',
  description: 'A test episode description',
  publishedAt: '2026-01-10T12:00:00Z',
  duration: '45:00',
  episodeNumber: 1,
  seasonNumber: 1,
  links: {
    spotify: 'https://spotify.com/ep1',
    apple: 'https://apple.com/ep1',
    youtube: 'https://youtube.com/ep1',
  },
};

describe('EpisodeCard', () => {
  describe('standard variant', () => {
    it('should render the episode title', () => {
      render(<EpisodeCard episode={baseEpisode} />);
      expect(screen.getByText('Test Episode')).toBeInTheDocument();
    });

    it('should render episode number and season', () => {
      render(<EpisodeCard episode={baseEpisode} />);
      expect(screen.getByText(/S1 Episode 1/i)).toBeInTheDocument();
    });

    it('should render duration', () => {
      render(<EpisodeCard episode={baseEpisode} />);
      expect(screen.getByText('45:00')).toBeInTheDocument();
    });

    it('should render description', () => {
      render(<EpisodeCard episode={baseEpisode} />);
      expect(screen.getByText('A test episode description')).toBeInTheDocument();
    });

    it('should render platform links', () => {
      render(<EpisodeCard episode={baseEpisode} />);
      expect(screen.getByText('Spotify')).toBeInTheDocument();
      expect(screen.getByText('Apple')).toBeInTheDocument();
      expect(screen.getByText('YouTube')).toBeInTheDocument();
    });

    it('should not render links for missing platforms', () => {
      const episode = { ...baseEpisode, links: { spotify: 'https://spotify.com/ep1' } };
      render(<EpisodeCard episode={episode} />);
      expect(screen.getByText('Spotify')).toBeInTheDocument();
      expect(screen.queryByText('Apple')).not.toBeInTheDocument();
      expect(screen.queryByText('YouTube')).not.toBeInTheDocument();
    });

    it('should render guests when provided', () => {
      const episode = {
        ...baseEpisode,
        guests: [{ name: 'John Doe', title: 'CEO' }],
      };
      render(<EpisodeCard episode={episode} />);
      expect(screen.getByText('Featuring:')).toBeInTheDocument();
      expect(screen.getByText(/John Doe/)).toBeInTheDocument();
    });

    it('should render topics when provided', () => {
      const episode = {
        ...baseEpisode,
        topics: ['AI', 'Leadership'],
      };
      render(<EpisodeCard episode={episode} />);
      expect(screen.getByText('AI')).toBeInTheDocument();
      expect(screen.getByText('Leadership')).toBeInTheDocument();
    });
  });

  describe('featured variant', () => {
    it('should render thumbnail when provided', () => {
      const episode = { ...baseEpisode, thumbnail: 'https://example.com/thumb.jpg' };
      render(<EpisodeCard episode={episode} variant="featured" />);
      const img = screen.getByAltText('Test Episode');
      expect(img).toHaveAttribute('src', 'https://example.com/thumb.jpg');
    });

    it('should render fallback when no thumbnail', () => {
      const episode = { ...baseEpisode, thumbnail: undefined };
      render(<EpisodeCard episode={episode} variant="featured" />);
      expect(screen.getByText(/S1 E1/)).toBeInTheDocument();
    });
  });

  describe('compact variant', () => {
    it('should render as a collapsible button', () => {
      render(<EpisodeCard episode={baseEpisode} variant="compact" />);
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-expanded', 'false');
    });

    it('should show episode number in compact view', () => {
      render(<EpisodeCard episode={baseEpisode} variant="compact" />);
      expect(screen.getByText('Ep 1')).toBeInTheDocument();
    });

    it('should expand on click to show description', async () => {
      const user = userEvent.setup();
      render(<EpisodeCard episode={baseEpisode} variant="compact" />);

      // Description hidden initially in compact mode
      expect(screen.queryByText('A test episode description')).not.toBeInTheDocument();

      await user.click(screen.getByRole('button'));

      expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByText('A test episode description')).toBeInTheDocument();
    });

    it('should collapse on second click', async () => {
      const user = userEvent.setup();
      render(<EpisodeCard episode={baseEpisode} variant="compact" />);

      await user.click(screen.getByRole('button'));
      expect(screen.getByText('A test episode description')).toBeInTheDocument();

      await user.click(screen.getByRole('button'));
      expect(screen.queryByText('A test episode description')).not.toBeInTheDocument();
    });

    it('should show platform links when expanded', async () => {
      const user = userEvent.setup();
      render(<EpisodeCard episode={baseEpisode} variant="compact" />);

      await user.click(screen.getByRole('button'));
      expect(screen.getByText('YouTube')).toBeInTheDocument();
      expect(screen.getByText('Spotify')).toBeInTheDocument();
    });
  });
});
