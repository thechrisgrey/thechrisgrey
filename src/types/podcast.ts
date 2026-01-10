// TypeScript types for podcast content

export interface PodcastEpisode {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  duration: string;
  episodeNumber?: number;
  seasonNumber?: number;
  thumbnail?: string;
  audioUrl?: string;
  links: {
    spotify?: string;
    apple?: string;
    youtube?: string;
    riverside?: string;
  };
  guests?: {
    name: string;
    title?: string;
    image?: string;
  }[];
  topics?: string[];
}

export interface PodcastPlatform {
  name: string;
  url: string;
  icon: 'spotify' | 'apple' | 'youtube' | 'rss' | 'overcast' | 'pocketcasts';
}
