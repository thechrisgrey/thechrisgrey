import { useState, useEffect } from 'react';
import { typography } from '../utils/typography';
import { SEO } from '../components/SEO';
import tvpLogo from '../assets/tvp.png';
// Profile image served from public/ at full quality (no Vite optimization)
const profileImage = '/profile1.jpeg';
import { podcastFAQs, buildPodcastSeriesSchema } from '../utils/schemas';
import { PODCAST_EPISODES, PODCAST_PLATFORMS, SPOTIFY_EMBED_URL, LATEST_VIDEO_ID } from '../data/podcastEpisodes';
import EpisodeCard from '../components/EpisodeCard';
import SubscribePlatforms from '../components/SubscribePlatforms';
import YouTubeFacade from '../components/YouTubeFacade';
import { podcastClient, PODCAST_GUESTS_QUERY } from '../sanity';
import type { PodcastGuest } from '../sanity';
import GuestCard from '../components/GuestCard';

const Podcast = () => {
  const [showAllEpisodes, setShowAllEpisodes] = useState(false);
  const [guests, setGuests] = useState<PodcastGuest[]>([]);
  const [isLoadingGuests, setIsLoadingGuests] = useState(true);

  useEffect(() => {
    podcastClient.fetch<PodcastGuest[]>(PODCAST_GUESTS_QUERY)
      .then(setGuests)
      .catch(() => setGuests([]))
      .finally(() => setIsLoadingGuests(false));
  }, []);

  const featuredEpisode = PODCAST_EPISODES[0];
  const otherEpisodes = PODCAST_EPISODES.slice(1);
  const displayedEpisodes = showAllEpisodes ? otherEpisodes : otherEpisodes.slice(0, 4);

  return (
    <div className="min-h-screen">
      <SEO
        title="The Vector Podcast"
        description="The Vector Podcast explores veteran experience, emerging technology, and purposeful entrepreneurship. Hosted by Christian Perez, featuring leaders navigating the transition from service to innovation."
        keywords="The Vector Podcast, Christian Perez podcast, AI podcast, veteran entrepreneurship, technology podcast, Altivum Press"
        url="https://thechrisgrey.com/podcast"
        faq={podcastFAQs}
        breadcrumbs={[
          { name: "Home", url: "https://thechrisgrey.com" },
          { name: "Podcast", url: "https://thechrisgrey.com/podcast" }
        ]}
        structuredData={[buildPodcastSeriesSchema()]}
      />

      {/* Hero Section */}
      <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden opacity-0 animate-fade-in">
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 md:py-32">
          <div className="max-w-4xl mx-auto text-center">
            <div className="mb-6 sm:mb-8">
              <img
                src={tvpLogo}
                alt="The Vector Podcast"
                className="w-full max-w-3xl mx-auto opacity-90"
                fetchPriority="high"
              />
              <h1 className="sr-only">The Vector Podcast - Hosted by Christian Perez</h1>
            </div>

            {/* Podcast Stats */}
            <div className="flex justify-center gap-12 mt-10">
              <div className="text-center">
                <div className="text-4xl font-light text-altivum-gold" style={{ fontWeight: 200 }}>
                  {PODCAST_EPISODES.length}
                </div>
                <div className="text-sm text-altivum-silver uppercase tracking-wider mt-1">
                  Episodes
                </div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-light text-altivum-gold" style={{ fontWeight: 200 }}>
                  2025
                </div>
                <div className="text-sm text-altivum-silver uppercase tracking-wider mt-1">
                  Launched
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="py-24 bg-altivum-dark">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-white mb-6" style={typography.sectionHeader}>
            About The Vector Podcast
          </h2>
          <div className="h-px w-24 bg-altivum-gold mx-auto mb-8"></div>
          <p className="text-altivum-silver leading-relaxed" style={typography.subtitle}>
            The Vector Podcast delivers mission-focused conversations at the intersection of
            veteran experience, small business, and modern technology. We break down artificial
            intelligence, cloud solutions, and entrepreneurship into clear, actionable insights
            anyone can apply.
          </p>
        </div>
      </section>

      {/* Latest Episode - YouTube Embed */}
      <section className="py-24 bg-altivum-dark border-t border-white/5">
        <div className="max-w-5xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="inline-block px-4 py-2 bg-altivum-gold/10 rounded-md mb-4">
              <span className="text-altivum-gold font-semibold text-sm uppercase tracking-wider">
                Latest Episode
              </span>
            </div>
            <h2 className="text-white" style={typography.sectionHeader}>
              Now Playing
            </h2>
          </div>

          {LATEST_VIDEO_ID ? (
            <div className="relative aspect-video rounded-xl overflow-hidden bg-altivum-navy">
              <YouTubeFacade
                videoId={LATEST_VIDEO_ID}
                title={featuredEpisode.title}
                embedParams="rel=0&modestbranding=1"
              />
            </div>
          ) : (
            <EpisodeCard episode={featuredEpisode} variant="featured" />
          )}

          {/* Episode Details (shown below video embed) */}
          {LATEST_VIDEO_ID && featuredEpisode && (
            <div className="mt-8 p-6 sm:p-8 rounded-lg border border-white/10 bg-white/5">
              <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-wider font-medium mb-4">
                {featuredEpisode.episodeNumber && (
                  <span className="text-altivum-gold">
                    {featuredEpisode.seasonNumber ? `S${featuredEpisode.seasonNumber} ` : ''}Episode {featuredEpisode.episodeNumber}
                  </span>
                )}
                <span className="text-altivum-slate">|</span>
                <span className="text-altivum-silver">{featuredEpisode.duration}</span>
              </div>
              <h3 className="text-white mb-4" style={typography.cardTitleLarge}>
                {featuredEpisode.title}
              </h3>
              <p className="text-altivum-silver" style={typography.bodyText}>
                {featuredEpisode.description}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Spotify Embed Section */}
      <section className="py-16 bg-altivum-dark border-t border-white/5">
        <div className="max-w-3xl mx-auto px-6 lg:px-8">
          <div className="rounded-xl overflow-hidden">
            <iframe
              src={SPOTIFY_EMBED_URL}
              width="100%"
              height="352"
              frameBorder="0"
              allowFullScreen
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
              title="The Vector Podcast on Spotify"
              className="rounded-xl"
            />
          </div>
        </div>
      </section>

      {/* All Episodes */}
      {otherEpisodes.length > 0 && (
        <section className="py-24 bg-altivum-dark border-t border-white/5">
          <div className="max-w-4xl mx-auto px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-white mb-4" style={typography.sectionHeader}>
                All Episodes
              </h2>
              <div className="h-px w-24 bg-altivum-gold mx-auto"></div>
            </div>

            <div className="flex flex-col gap-2">
              {displayedEpisodes.map((episode) => (
                <EpisodeCard key={episode.id} episode={episode} variant="compact" />
              ))}
            </div>

            {otherEpisodes.length > 4 && !showAllEpisodes && (
              <div className="text-center mt-8">
                <button
                  onClick={() => setShowAllEpisodes(true)}
                  className="inline-flex items-center px-6 py-2 text-sm bg-transparent border border-white/20 text-altivum-silver font-medium hover:border-altivum-gold hover:text-altivum-gold transition-all duration-200 rounded"
                >
                  Show All {otherEpisodes.length} Episodes
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Featured Veterans */}
      {!isLoadingGuests && guests.length > 0 && (
        <section className="py-24 bg-altivum-dark border-t border-white/5">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-white mb-4" style={typography.sectionHeader}>
                Featured Veterans
              </h2>
              <div className="h-px w-24 bg-altivum-gold mx-auto"></div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {guests.map((guest) => (
                <GuestCard key={guest._id} guest={guest} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Subscribe Section */}
      <section className="py-24 bg-gradient-to-b from-altivum-dark to-altivum-navy border-t border-white/5">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-white mb-6" style={typography.sectionHeader}>
            Listen & Subscribe
          </h2>
          <p className="text-altivum-silver mb-12 max-w-2xl mx-auto" style={typography.bodyText}>
            Never miss an episode. Subscribe on your favorite podcast platform.
          </p>

          <SubscribePlatforms platforms={PODCAST_PLATFORMS} />
        </div>
      </section>

      {/* Host Section */}
      <section className="py-24 bg-altivum-navy border-t border-white/5">
        <div className="max-w-4xl mx-auto px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center gap-10">
            <div className="w-48 h-48 rounded-full overflow-hidden border-4 border-altivum-gold/30 flex-shrink-0">
              <img
                src={profileImage}
                alt="Christian Perez"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="text-center md:text-left">
              <h3 className="text-white mb-2" style={typography.cardTitleLarge}>
                Your Host
              </h3>
              <h4 className="text-altivum-gold mb-4" style={typography.subtitle}>
                Christian Perez
              </h4>
              <p className="text-altivum-silver" style={typography.bodyText}>
                Former Green Beret, Founder & CEO of Altivum Inc., and passionate advocate
                for veteran entrepreneurship. Christian brings unique insights from his journey
                transitioning from Special Operations to tech leadership, exploring how emerging
                technology can empower individuals and organizations to adapt and excel.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Podcast;
