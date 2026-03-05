import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SpotifyFacade from './SpotifyFacade';

describe('SpotifyFacade', () => {
  const defaultProps = {
    embedUrl: 'https://open.spotify.com/embed/show/123',
    title: 'The Vector Podcast',
  };

  it('should render the facade button initially (not the iframe)', () => {
    render(<SpotifyFacade {...defaultProps} />);
    expect(screen.getByRole('button', { name: /play the vector podcast on spotify/i })).toBeInTheDocument();
    expect(screen.queryByTitle(defaultProps.title)).not.toBeInTheDocument();
  });

  it('should display the title in the facade', () => {
    render(<SpotifyFacade {...defaultProps} />);
    expect(screen.getByText('The Vector Podcast')).toBeInTheDocument();
  });

  it('should display helper text in the facade', () => {
    render(<SpotifyFacade {...defaultProps} />);
    expect(screen.getByText('Click to load Spotify player')).toBeInTheDocument();
  });

  it('should load the iframe when the facade is clicked', async () => {
    const user = userEvent.setup();
    render(<SpotifyFacade {...defaultProps} />);

    await user.click(screen.getByRole('button'));

    // After click, iframe should be present
    const iframe = screen.getByTitle('The Vector Podcast');
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute('src', defaultProps.embedUrl);
  });

  it('should not show the facade button after loading', async () => {
    const user = userEvent.setup();
    render(<SpotifyFacade {...defaultProps} />);

    await user.click(screen.getByRole('button'));

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
