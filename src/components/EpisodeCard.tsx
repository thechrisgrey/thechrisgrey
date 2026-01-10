import { PodcastEpisode } from '../types/podcast';
import { typography } from '../utils/typography';
import { SpotifyIcon, ApplePodcastIcon, YouTubeIcon } from './PodcastPlatformIcons';

interface EpisodeCardProps {
  episode: PodcastEpisode;
  variant?: 'featured' | 'standard';
}

const EpisodeCard = ({ episode, variant = 'standard' }: EpisodeCardProps) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const isFeatured = variant === 'featured';

  return (
    <article className={`group ${isFeatured ? 'col-span-full' : ''}`}>
      <div className={`
        p-6 sm:p-8 rounded-lg border border-white/10 bg-white/5
        hover:border-altivum-gold/30 hover:bg-white/10
        transition-all duration-300
        ${isFeatured ? 'lg:flex lg:gap-10' : ''}
      `}>
        {/* Thumbnail placeholder - can add actual thumbnails later */}
        {isFeatured && (
          <div className="relative overflow-hidden rounded-lg mb-6 lg:w-2/5 lg:mb-0 aspect-video bg-gradient-to-br from-altivum-navy to-altivum-dark flex items-center justify-center">
            <div className="text-center p-6">
              <span className="material-icons text-6xl text-altivum-gold/50 mb-2">podcasts</span>
              <div className="text-altivum-gold font-medium">
                S{episode.seasonNumber} E{episode.episodeNumber}
              </div>
            </div>
            <div className="absolute bottom-3 right-3 px-3 py-1.5 bg-black/70 rounded text-sm text-white font-medium">
              {episode.duration}
            </div>
          </div>
        )}

        {/* Content */}
        <div className={isFeatured ? 'lg:flex-1' : ''}>
          {/* Meta */}
          <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-wider font-medium mb-4">
            {episode.episodeNumber && (
              <span className="text-altivum-gold">
                {episode.seasonNumber ? `S${episode.seasonNumber} ` : ''}Episode {episode.episodeNumber}
              </span>
            )}
            <span className="text-altivum-slate">|</span>
            <span className="text-altivum-silver">{formatDate(episode.publishedAt)}</span>
            {!isFeatured && (
              <>
                <span className="text-altivum-slate">|</span>
                <span className="text-altivum-silver">{episode.duration}</span>
              </>
            )}
          </div>

          {/* Title */}
          <h3
            className="text-white mb-4 group-hover:text-altivum-gold transition-colors"
            style={isFeatured ? typography.cardTitleLarge : typography.cardTitleSmall}
          >
            {episode.title}
          </h3>

          {/* Guests */}
          {episode.guests && episode.guests.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="text-altivum-slate text-sm">Featuring:</span>
              {episode.guests.map((guest, idx) => (
                <span key={idx} className="text-white text-sm font-medium">
                  {guest.name}
                  {guest.title && (
                    <span className="text-altivum-silver font-normal"> - {guest.title}</span>
                  )}
                </span>
              ))}
            </div>
          )}

          {/* Description */}
          <p
            className={`text-altivum-silver mb-5 ${isFeatured ? '' : 'line-clamp-3'}`}
            style={typography.bodyText}
          >
            {episode.description}
          </p>

          {/* Topics */}
          {episode.topics && episode.topics.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {episode.topics.map((topic, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 text-xs bg-altivum-gold/10 text-altivum-gold rounded-full"
                >
                  {topic}
                </span>
              ))}
            </div>
          )}

          {/* Listen Links */}
          <div className="flex flex-wrap gap-3">
            {episode.links.spotify && (
              <a
                href={episode.links.spotify}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#1DB954]/10 text-[#1DB954] rounded-full text-sm font-medium hover:bg-[#1DB954]/20 transition-colors"
              >
                <SpotifyIcon className="w-4 h-4" />
                Spotify
              </a>
            )}
            {episode.links.apple && (
              <a
                href={episode.links.apple}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#872EC4]/10 text-[#872EC4] rounded-full text-sm font-medium hover:bg-[#872EC4]/20 transition-colors"
              >
                <ApplePodcastIcon className="w-4 h-4" />
                Apple
              </a>
            )}
            {episode.links.youtube && (
              <a
                href={episode.links.youtube}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#FF0000]/10 text-[#FF0000] rounded-full text-sm font-medium hover:bg-[#FF0000]/20 transition-colors"
              >
                <YouTubeIcon className="w-4 h-4" />
                YouTube
              </a>
            )}
          </div>
        </div>
      </div>
    </article>
  );
};

export default EpisodeCard;
