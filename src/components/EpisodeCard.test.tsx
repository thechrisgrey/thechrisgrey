import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EpisodeCard from './EpisodeCard';
import type { PodcastEpisode } from '../types/podcast';

// Pin a negative-offset US timezone so the date-rendering assertions below would
// catch the bare-date off-by-one bug on any machine/CI (runtime process.env.TZ
// reassignment is honored by Intl in Node). publishedAt uses the bare
// 'YYYY-MM-DD' shape the real generated episode data ships.
const ORIGINAL_TZ = process.env.TZ;
beforeAll(() => {
  process.env.TZ = 'America/Los_Angeles';
});
afterAll(() => {
  process.env.TZ = ORIGINAL_TZ;
});

const baseEpisode: PodcastEpisode = {
  id: 'ep-1',
  title: 'Test Episode',
  description: 'A test episode description',
  publishedAt: '2026-01-10',
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

    // NOTE: `guests` and `topics` rendering branches were removed from
    // EpisodeCard — the generator emits topics:[] and never emits guests
    // (podcast guests come from a separate Sanity model rendered elsewhere).
    // The previously-dead "Featuring:" and topic-chip branches are unreachable
    // for production data, so they no longer render even when those fields are
    // present on the episode object.
    it('should not render a guests/topics section even when those fields are present', () => {
      const episode = {
        ...baseEpisode,
        guests: [{ name: 'John Doe', title: 'CEO' }],
        topics: ['AI', 'Leadership'],
      };
      render(<EpisodeCard episode={episode} />);
      expect(screen.queryByText('Featuring:')).not.toBeInTheDocument();
      expect(screen.queryByText(/John Doe/)).not.toBeInTheDocument();
      expect(screen.queryByText('AI')).not.toBeInTheDocument();
      expect(screen.queryByText('Leadership')).not.toBeInTheDocument();
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

    it('associates the toggle button with its revealed panel via aria-controls', async () => {
      const user = userEvent.setup();
      render(<EpisodeCard episode={baseEpisode} variant="compact" />);

      const button = screen.getByRole('button');
      const panelId = button.getAttribute('aria-controls');
      expect(panelId).toBeTruthy();

      await user.click(button);

      // The revealed panel must carry the id the button references.
      const panel = document.getElementById(panelId as string);
      expect(panel).toBeInTheDocument();
      expect(panel).toContainElement(screen.getByText('A test episode description'));
    });
  });

  describe('date rendering (timezone-safe)', () => {
    it('shows the intended calendar date in the standard variant', () => {
      render(<EpisodeCard episode={baseEpisode} />);
      expect(screen.getByText('January 10, 2026')).toBeInTheDocument();
    });

    it('shows the intended calendar date in the featured variant', () => {
      render(<EpisodeCard episode={baseEpisode} variant="featured" />);
      expect(screen.getByText('January 10, 2026')).toBeInTheDocument();
    });

    it('shows the intended calendar date in the compact variant (collapsed + expanded)', async () => {
      const user = userEvent.setup();
      render(<EpisodeCard episode={baseEpisode} variant="compact" />);
      // Collapsed: the desktop date span is in the DOM (md:block, no real CSS in jsdom).
      expect(screen.getByText('January 10, 2026')).toBeInTheDocument();
      // Expanded: the mobile-meta date also mounts, so the date appears twice.
      await user.click(screen.getByRole('button'));
      expect(screen.getAllByText('January 10, 2026').length).toBeGreaterThanOrEqual(2);
    });
  });
});
