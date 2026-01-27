/**
 * Fetches podcast episodes from YouTube channel and generates episode data.
 * Runs at build time to auto-update episode list with thumbnails.
 *
 * Requires YOUTUBE_API_KEY environment variable.
 *
 * Usage: node scripts/generate-podcast-episodes.js
 */

import { writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// YouTube channel configuration
const YOUTUBE_CHANNEL_HANDLE = '@AltivumPress';
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

// Podcast platform links (static, won't change)
const SPOTIFY_SHOW_URL = 'https://open.spotify.com/show/4JtDt7M9b6J2HRvQxzX1CX';
const APPLE_PODCAST_URL = 'https://podcasts.apple.com/us/podcast/the-vector-podcast/id1820813071';

/**
 * Fetch channel ID from handle using YouTube API
 */
async function getChannelId(handle) {
  const url = `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${handle}&key=${YOUTUBE_API_KEY}`;
  const response = await fetch(url);
  const data = await response.json();

  if (data.error) {
    throw new Error(`YouTube API error: ${data.error.message}`);
  }

  if (!data.items || data.items.length === 0) {
    throw new Error(`Channel not found for handle: ${handle}`);
  }

  return data.items[0].id;
}

/**
 * Fetch uploads playlist ID for a channel
 */
async function getUploadsPlaylistId(channelId) {
  const url = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${YOUTUBE_API_KEY}`;
  const response = await fetch(url);
  const data = await response.json();

  if (data.error) {
    throw new Error(`YouTube API error: ${data.error.message}`);
  }

  return data.items[0].contentDetails.relatedPlaylists.uploads;
}

/**
 * Fetch all videos from a playlist
 */
async function getPlaylistVideos(playlistId) {
  const videos = [];
  let nextPageToken = null;

  do {
    const url = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
    url.searchParams.set('part', 'snippet,contentDetails');
    url.searchParams.set('playlistId', playlistId);
    url.searchParams.set('maxResults', '50');
    url.searchParams.set('key', YOUTUBE_API_KEY);
    if (nextPageToken) {
      url.searchParams.set('pageToken', nextPageToken);
    }

    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      throw new Error(`YouTube API error: ${data.error.message}`);
    }

    videos.push(...data.items);
    nextPageToken = data.nextPageToken;
  } while (nextPageToken);

  return videos;
}

/**
 * Fetch video details (duration) for multiple videos
 */
async function getVideoDetails(videoIds) {
  const details = {};

  // YouTube API allows up to 50 IDs per request
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const url = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${batch.join(',')}&key=${YOUTUBE_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      throw new Error(`YouTube API error: ${data.error.message}`);
    }

    for (const item of data.items) {
      details[item.id] = item.contentDetails;
    }
  }

  return details;
}

/**
 * Parse ISO 8601 duration to readable format (e.g., "PT1H2M30S" -> "1:02:30")
 */
function parseDuration(isoDuration) {
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return '0:00';

  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Extract episode number from video title if present
 * Looks for patterns like "Ep 1", "Episode 1", "E1", "#1"
 */
function extractEpisodeNumber(title) {
  const patterns = [
    /(?:ep(?:isode)?\.?\s*#?\s*)(\d+)/i,
    /(?:#\s*)(\d+)/,
    /(?:e)(\d+)(?:\s|:|$)/i,
  ];

  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match) {
      return parseInt(match[1], 10);
    }
  }
  return null;
}

/**
 * Main function to fetch and generate episode data
 */
async function generateEpisodes() {
  if (!YOUTUBE_API_KEY) {
    console.warn('⚠️  YOUTUBE_API_KEY not set. Using fallback static episodes.');
    return null;
  }

  console.log('🎙️  Fetching podcast episodes from YouTube...');

  try {
    // Get channel ID from handle
    console.log(`   Looking up channel: ${YOUTUBE_CHANNEL_HANDLE}`);
    const channelId = await getChannelId(YOUTUBE_CHANNEL_HANDLE);
    console.log(`   Channel ID: ${channelId}`);

    // Get uploads playlist
    const uploadsPlaylistId = await getUploadsPlaylistId(channelId);
    console.log(`   Uploads playlist: ${uploadsPlaylistId}`);

    // Fetch all videos
    const videos = await getPlaylistVideos(uploadsPlaylistId);
    console.log(`   Found ${videos.length} videos`);

    // Get video durations
    const videoIds = videos.map(v => v.contentDetails.videoId);
    const videoDetails = await getVideoDetails(videoIds);

    // Transform to episode format
    const episodes = videos
      .filter(video => {
        // Filter out shorts, livestreams, or non-podcast content if needed
        const title = video.snippet.title.toLowerCase();
        // Keep videos that look like podcast episodes
        return !title.includes('#shorts') && video.snippet.title.length > 10;
      })
      .map((video, index) => {
        const videoId = video.contentDetails.videoId;
        const snippet = video.snippet;
        const details = videoDetails[videoId] || {};
        const episodeNum = extractEpisodeNumber(snippet.title);

        return {
          id: `yt-${videoId}`,
          videoId: videoId,
          title: snippet.title,
          description: snippet.description?.split('\n\n')[0] || '', // First paragraph
          publishedAt: snippet.publishedAt.split('T')[0], // YYYY-MM-DD
          duration: parseDuration(details.duration || 'PT0S'),
          episodeNumber: episodeNum || (videos.length - index), // Fallback to reverse index
          seasonNumber: 1,
          thumbnail: snippet.thumbnails?.maxres?.url ||
                     snippet.thumbnails?.high?.url ||
                     snippet.thumbnails?.medium?.url ||
                     snippet.thumbnails?.default?.url,
          links: {
            youtube: `https://www.youtube.com/watch?v=${videoId}`,
            spotify: SPOTIFY_SHOW_URL,
            apple: APPLE_PODCAST_URL,
          },
          topics: [], // Could extract from description hashtags if present
        };
      })
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt)); // Newest first

    return {
      episodes,
      channelId,
      latestVideoId: episodes[0]?.videoId || null,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('❌ Error fetching from YouTube:', error.message);
    return null;
  }
}

/**
 * Write generated data to JSON file
 */
async function main() {
  const data = await generateEpisodes();
  const outputPath = resolve(__dirname, '../src/data/generatedEpisodes.json');

  if (data) {
    writeFileSync(outputPath, JSON.stringify(data, null, 2));
    console.log(`✅ Generated ${data.episodes.length} episodes to src/data/generatedEpisodes.json`);
    console.log(`   Latest episode: "${data.episodes[0]?.title}"`);
  } else {
    console.log('ℹ️  Skipping episode generation (no API key or error occurred)');
    // Ensure the file exists with empty structure for build to succeed
    if (!existsSync(outputPath)) {
      writeFileSync(outputPath, JSON.stringify({ episodes: [], latestVideoId: null, generatedAt: null }, null, 2));
    }
  }
}

main().catch(console.error);
