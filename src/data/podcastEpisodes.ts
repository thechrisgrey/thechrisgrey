import { PodcastEpisode, PodcastPlatform } from '../types/podcast';
import generatedData from './generatedEpisodes.json';

// Fallback static episodes (used when YouTube API data isn't available)
const FALLBACK_EPISODES: PodcastEpisode[] = [
  {
    id: 'ep-003',
    title: 'Leading Through the Cloud',
    description: 'A conversation exploring the intersection of technical expertise, leadership, and the evolving role of artificial intelligence in modern cloud engineering. Daniel discusses his journey from a non-technical background to earning the AWS Golden Jacket certification, sharing insights on non-traditional career pathways, the value of certifications, and the importance of lifelong learning.',
    publishedAt: '2024-12-23',
    duration: '40:21',
    episodeNumber: 3,
    seasonNumber: 1,
    links: {
      spotify: 'https://open.spotify.com/show/4JtDt7M9b6J2HRvQxzX1CX',
      apple: 'https://podcasts.apple.com/us/podcast/the-vector-podcast/id1820813071',
    },
    guests: [{
      name: 'Daniel Gaina',
      title: 'Senior Cloud Engineer & AWS Community Builder'
    }],
    topics: ['Cloud Engineering', 'AWS', 'Leadership', 'Career Development', 'AI']
  },
  {
    id: 'ep-002',
    title: 'Empowering Minds: AI, Neurodiversity & The Future of Mental Healthcare',
    description: 'Jay Getten details developing a free open-source clinical decision support system that combines quantitative and qualitative data to enhance precision mental health treatment. The conversation explores neurodiversity, AI consciousness, and how interdisciplinary thinking drives innovation in mental healthcare technology.',
    publishedAt: '2024-11-16',
    duration: '55:33',
    episodeNumber: 2,
    seasonNumber: 1,
    links: {
      spotify: 'https://open.spotify.com/show/4JtDt7M9b6J2HRvQxzX1CX',
      apple: 'https://podcasts.apple.com/us/podcast/the-vector-podcast/id1820813071',
    },
    guests: [{
      name: 'Jay Getten',
      title: 'Mental Health Innovator & Creator of Seidr Software'
    }],
    topics: ['Mental Health', 'AI', 'Neurodiversity', 'Open Source', 'Healthcare Tech']
  },
  {
    id: 'ep-001',
    title: 'Ethics, Education, and Empathy in the Age of AI',
    description: 'Dr. Sarah Mendoza explores how artificial intelligence is transforming human-centered work through her perspective on counseling, education, ethics, and data privacy. The discussion examines the importance of maintaining empathy amid technological change and finding the right balance between innovation and the human element.',
    publishedAt: '2024-11-06',
    duration: '33:35',
    episodeNumber: 1,
    seasonNumber: 1,
    links: {
      spotify: 'https://open.spotify.com/show/4JtDt7M9b6J2HRvQxzX1CX',
      apple: 'https://podcasts.apple.com/us/podcast/the-vector-podcast/id1820813071',
    },
    guests: [{
      name: 'Dr. Sarah Mendoza',
      title: 'Austin Peay State University'
    }],
    topics: ['Ethics', 'Education', 'Counseling', 'Data Privacy', 'Empathy']
  }
];

// Use generated YouTube data if available, otherwise fallback to static
export const PODCAST_EPISODES: PodcastEpisode[] =
  generatedData.episodes.length > 0
    ? (generatedData.episodes as PodcastEpisode[])
    : FALLBACK_EPISODES;

// Latest video ID for YouTube embed (null if using fallback)
export const LATEST_VIDEO_ID: string | null = generatedData.latestVideoId || null;

// Podcast platforms for subscription
export const PODCAST_PLATFORMS: PodcastPlatform[] = [
  {
    name: 'Spotify',
    url: 'https://open.spotify.com/show/4JtDt7M9b6J2HRvQxzX1CX',
    icon: 'spotify'
  },
  {
    name: 'Apple Podcasts',
    url: 'https://podcasts.apple.com/us/podcast/the-vector-podcast/id1820813071',
    icon: 'apple'
  },
  {
    name: 'YouTube',
    url: 'https://www.youtube.com/@AltivumPress',
    icon: 'youtube'
  },
  {
    name: 'RSS Feed',
    url: 'https://api.riverside.fm/hosting/heA0qRHh.rss',
    icon: 'rss'
  }
];

// Spotify embed URL for the show
export const SPOTIFY_EMBED_URL = 'https://open.spotify.com/embed/show/4JtDt7M9b6J2HRvQxzX1CX?utm_source=generator';
