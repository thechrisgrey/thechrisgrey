# Implementation Plan: Podcast Page Redesign

## Overview

This plan addresses the complete redesign of the `/podcast` page to:
1. **Remove Buzzsprout integration** - No longer using this platform
2. **Integrate with Riverside.fm** - New podcast hosting platform
3. **Improve user experience** - Modern, engaging podcast showcase
4. **Enhance SEO/AEO** - Update structured data and FAQs

**Key Constraint:** Riverside.fm does not offer embeddable audio players like Buzzsprout did. The redesigned page will focus on episode showcases with links to listening platforms.

---

## Current State Analysis

### What Exists (`src/pages/Podcast.tsx`)
- Buzzsprout script injection via `useEffect` (lines 8-32) - **REMOVE**
- Basic hero section with TVP logo
- "About The Vector Podcast" section
- "Latest Episodes" section with Buzzsprout containers - **REMOVE/REPLACE**
- "Listen & Subscribe" section with 2 CTAs

### What Needs to Change
| Component | Current | New |
|-----------|---------|-----|
| Episode display | Buzzsprout embeds | Episode cards with platform links |
| Episode data | Hardcoded script IDs | Fetched from Riverside RSS or manual array |
| Platform links | Buzzsprout RSS | Riverside-hosted platforms |
| Subscribe options | 2 buttons | Expanded platform grid |
| Visual design | Basic cards | Rich episode cards with thumbnails |

---

## Phase 1: Data Architecture

### Task 1.1: Define Episode Data Structure

**Create:** `src/types/podcast.ts`

```typescript
export interface PodcastEpisode {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  duration: string; // e.g., "1:23:45"
  episodeNumber?: number;
  seasonNumber?: number;
  thumbnail?: string;
  links: {
    spotify?: string;
    apple?: string;
    youtube?: string;
    riverside?: string; // Direct link to Riverside page
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
  color?: string;
}
```

### Task 1.2: Create Episode Data Source

**Option A: Static Data (Recommended for now)**

**Create:** `src/data/podcastEpisodes.ts`

```typescript
import { PodcastEpisode } from '../types/podcast';

export const PODCAST_EPISODES: PodcastEpisode[] = [
  {
    id: 'ep-003',
    title: 'Empowering Minds: AI, Neurodiversity & The Future of Mental Healthcare',
    description: 'A conversation with Dr. Jay Getten exploring the intersection of artificial intelligence and mental health...',
    publishedAt: '2025-01-02',
    duration: '58:32',
    episodeNumber: 3,
    thumbnail: '/assets/podcast/ep-003.jpg',
    links: {
      spotify: 'https://open.spotify.com/episode/...',
      apple: 'https://podcasts.apple.com/podcast/...',
      youtube: 'https://youtube.com/watch?v=...',
    },
    guests: [{
      name: 'Dr. Jay Getten',
      title: 'Clinical Psychologist & AI Researcher'
    }],
    topics: ['AI', 'Mental Health', 'Neurodiversity']
  },
  // ... more episodes
];

export const PODCAST_PLATFORMS: PodcastPlatform[] = [
  { name: 'Spotify', url: 'https://open.spotify.com/show/...', icon: 'spotify' },
  { name: 'Apple Podcasts', url: 'https://podcasts.apple.com/podcast/...', icon: 'apple' },
  { name: 'YouTube', url: 'https://www.youtube.com/@AltivumPress', icon: 'youtube' },
  { name: 'RSS Feed', url: 'YOUR_RIVERSIDE_RSS_URL', icon: 'rss' },
  { name: 'Overcast', url: 'https://overcast.fm/...', icon: 'overcast' },
  { name: 'Pocket Casts', url: 'https://pca.st/...', icon: 'pocketcasts' },
];
```

**Option B: Future Enhancement - RSS Parsing**

For a more dynamic approach, we could:
1. Fetch the Riverside RSS feed at build time
2. Parse episode data
3. Generate static data during `npm run build`

This requires additional tooling and is out of scope for initial implementation.

### Task 1.3: Update Social Links Constants

**Modify:** `src/constants/links.ts`

```typescript
export const SOCIAL_LINKS = {
  // ... existing links ...

  // Podcast Platforms (add these)
  podcastSpotify: 'https://open.spotify.com/show/YOUR_SHOW_ID',
  podcastApple: 'https://podcasts.apple.com/podcast/YOUR_PODCAST_ID',
  podcastRSS: 'YOUR_RIVERSIDE_RSS_URL', // Replace buzzsproutRSS
  podcastOvercast: 'https://overcast.fm/itunes...',
  podcastPocketCasts: 'https://pca.st/...',

  // Update existing
  vectorPodcast: 'https://vector.altivum.ai', // Keep or update if URL changed
} as const;
```

---

## Phase 2: Component Development

### Task 2.1: Create Episode Card Component

**Create:** `src/components/EpisodeCard.tsx`

```typescript
import { Link } from 'react-router-dom';
import { PodcastEpisode } from '../types/podcast';
import { typography } from '../utils/typography';

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

  return (
    <article className={`group ${variant === 'featured' ? 'col-span-full' : ''}`}>
      <div className={`
        p-6 rounded-lg border border-white/10 bg-white/5
        hover:border-altivum-gold/30 hover:bg-white/10
        transition-all duration-300
        ${variant === 'featured' ? 'md:flex md:gap-8' : ''}
      `}>
        {/* Thumbnail */}
        {episode.thumbnail && (
          <div className={`
            relative overflow-hidden rounded-lg mb-4
            ${variant === 'featured' ? 'md:w-1/3 md:mb-0' : 'aspect-video'}
          `}>
            <img
              src={episode.thumbnail}
              alt={episode.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 rounded text-xs text-white">
              {episode.duration}
            </div>
          </div>
        )}

        {/* Content */}
        <div className={variant === 'featured' ? 'md:flex-1' : ''}>
          {/* Meta */}
          <div className="flex items-center gap-3 text-xs text-altivum-gold uppercase tracking-wider font-medium mb-3">
            {episode.episodeNumber && <span>Episode {episode.episodeNumber}</span>}
            <span className="text-altivum-slate">-</span>
            <span>{formatDate(episode.publishedAt)}</span>
          </div>

          {/* Title */}
          <h3
            className="text-white mb-3 group-hover:text-altivum-gold transition-colors"
            style={variant === 'featured' ? typography.cardTitleLarge : typography.cardTitleSmall}
          >
            {episode.title}
          </h3>

          {/* Description */}
          <p
            className="text-altivum-silver mb-4 line-clamp-3"
            style={typography.bodyText}
          >
            {episode.description}
          </p>

          {/* Guests */}
          {episode.guests && episode.guests.length > 0 && (
            <div className="flex items-center gap-2 mb-4">
              <span className="text-altivum-slate text-sm">Featuring:</span>
              {episode.guests.map((guest, idx) => (
                <span key={idx} className="text-white text-sm">
                  {guest.name}
                  {guest.title && <span className="text-altivum-silver"> ({guest.title})</span>}
                </span>
              ))}
            </div>
          )}

          {/* Topics */}
          {episode.topics && episode.topics.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {episode.topics.map((topic, idx) => (
                <span
                  key={idx}
                  className="px-2 py-1 text-xs bg-altivum-gold/10 text-altivum-gold rounded"
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
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#1DB954]/10 text-[#1DB954] rounded-full text-sm hover:bg-[#1DB954]/20 transition-colors"
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
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#FC3C44]/10 text-[#FC3C44] rounded-full text-sm hover:bg-[#FC3C44]/20 transition-colors"
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
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#FF0000]/10 text-[#FF0000] rounded-full text-sm hover:bg-[#FF0000]/20 transition-colors"
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
```

### Task 2.2: Create Platform Icons Component

**Create:** `src/components/PodcastPlatformIcons.tsx`

SVG icons for Spotify, Apple Podcasts, YouTube, RSS, Overcast, Pocket Casts, etc.

### Task 2.3: Create Subscribe Platforms Grid

**Create:** `src/components/SubscribePlatforms.tsx`

```typescript
import { PodcastPlatform } from '../types/podcast';
import { typography } from '../utils/typography';

interface SubscribePlatformsProps {
  platforms: PodcastPlatform[];
}

const SubscribePlatforms = ({ platforms }: SubscribePlatformsProps) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      {platforms.map((platform) => (
        <a
          key={platform.name}
          href={platform.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center justify-center p-6 rounded-lg border border-white/10 bg-white/5 hover:border-altivum-gold hover:bg-white/10 transition-all duration-200 group"
        >
          <PlatformIcon icon={platform.icon} className="w-8 h-8 mb-3 text-altivum-silver group-hover:text-altivum-gold transition-colors" />
          <span className="text-sm text-altivum-silver group-hover:text-white transition-colors">
            {platform.name}
          </span>
        </a>
      ))}
    </div>
  );
};
```

---

## Phase 3: Page Redesign

### Task 3.1: Redesign Podcast Page Structure

**Modify:** `src/pages/Podcast.tsx`

New page structure:

```
Podcast.tsx
├── SEO Component (updated FAQs, schema)
├── Hero Section
│   ├── TVP Logo (existing)
│   └── Podcast stats (optional: episode count, etc.)
├── About Section (existing, minor updates)
├── Featured Episode Section (NEW)
│   └── Latest/featured episode with full details
├── All Episodes Section (NEW)
│   ├── Episode grid/list
│   └── "Load more" or pagination (if many episodes)
├── Topics/Categories Section (NEW, optional)
│   └── Browse by topic tags
├── Subscribe Section (ENHANCED)
│   ├── Platform grid (6+ platforms)
│   └── RSS feed link
└── Host Section (NEW, optional)
    └── About the host with photo
```

### Task 3.2: Remove Buzzsprout Code

**Remove from `src/pages/Podcast.tsx`:**
- Lines 8-32: `useEffect` with Buzzsprout script injection
- Lines 88-103: Buzzsprout container divs

### Task 3.3: Implement New Podcast Page

**Full implementation of `src/pages/Podcast.tsx`:**

```typescript
import { useState } from 'react';
import { typography } from '../utils/typography';
import { SEO } from '../components/SEO';
import tvpLogo from '../assets/tvp.png';
import { podcastFAQs, buildPodcastSeriesSchema } from '../utils/schemas';
import { PODCAST_EPISODES, PODCAST_PLATFORMS } from '../data/podcastEpisodes';
import EpisodeCard from '../components/EpisodeCard';
import SubscribePlatforms from '../components/SubscribePlatforms';
import { SOCIAL_LINKS } from '../constants/links';

const Podcast = () => {
  const [showAllEpisodes, setShowAllEpisodes] = useState(false);

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
              />
            </div>

            {/* Podcast Stats */}
            <div className="flex justify-center gap-8 mt-8">
              <div className="text-center">
                <div className="text-3xl font-light text-altivum-gold">{PODCAST_EPISODES.length}</div>
                <div className="text-sm text-altivum-silver uppercase tracking-wider">Episodes</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-light text-altivum-gold">2024</div>
                <div className="text-sm text-altivum-silver uppercase tracking-wider">Since</div>
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
          <p className="text-altivum-silver text-lg leading-relaxed" style={typography.subtitle}>
            The Vector Podcast delivers mission-focused conversations at the intersection of
            veteran experience, small business, and modern technology. We break down artificial
            intelligence, cloud solutions, and entrepreneurship into clear, actionable insights
            anyone can apply.
          </p>
        </div>
      </section>

      {/* Featured Episode */}
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

          <EpisodeCard episode={featuredEpisode} variant="featured" />
        </div>
      </section>

      {/* All Episodes */}
      {otherEpisodes.length > 0 && (
        <section className="py-24 bg-altivum-dark border-t border-white/5">
          <div className="max-w-6xl mx-auto px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-white mb-4" style={typography.sectionHeader}>
                All Episodes
              </h2>
              <div className="h-px w-24 bg-altivum-gold mx-auto"></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {displayedEpisodes.map((episode) => (
                <EpisodeCard key={episode.id} episode={episode} />
              ))}
            </div>

            {otherEpisodes.length > 4 && !showAllEpisodes && (
              <div className="text-center mt-12">
                <button
                  onClick={() => setShowAllEpisodes(true)}
                  className="inline-flex items-center px-8 py-3 bg-transparent border border-white/20 text-white font-medium hover:border-altivum-gold hover:text-altivum-gold transition-all duration-200"
                >
                  <span className="material-icons mr-2">expand_more</span>
                  Load More Episodes
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Subscribe Section */}
      <section className="py-24 bg-gradient-to-b from-altivum-dark to-altivum-navy border-t border-white/5">
        <div className="max-w-5xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-white mb-6" style={typography.sectionHeader}>
            Listen & Subscribe
          </h2>
          <p className="text-altivum-silver mb-12 max-w-2xl mx-auto" style={typography.bodyText}>
            Never miss an episode. Subscribe on your favorite podcast platform.
          </p>

          <SubscribePlatforms platforms={PODCAST_PLATFORMS} />

          {/* Direct Website Link */}
          <div className="mt-12">
            <a
              href={SOCIAL_LINKS.vectorPodcast}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-10 py-4 bg-altivum-gold text-altivum-dark font-semibold hover:bg-white transition-all duration-200"
            >
              <span className="material-icons mr-3">podcasts</span>
              Visit Podcast Website
            </a>
          </div>
        </div>
      </section>

      {/* Host Section */}
      <section className="py-24 bg-altivum-navy border-t border-white/5">
        <div className="max-w-4xl mx-auto px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="w-48 h-48 rounded-full overflow-hidden border-4 border-altivum-gold/30">
              <img
                src="/og.png"
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
                transitioning from Special Operations to tech leadership.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Podcast;
```

---

## Phase 4: Schema & SEO Updates

### Task 4.1: Update Podcast Schema

**Modify:** `src/utils/schemas.ts`

```typescript
/**
 * Updated PodcastSeries schema - remove Buzzsprout RSS
 */
export const buildPodcastSeriesSchema = () => ({
  "@type": "PodcastSeries",
  "@id": "https://vector.altivum.ai/#podcast",
  "name": "The Vector Podcast",
  "url": "https://vector.altivum.ai",
  "description": "The Vector Podcast explores conversations at the intersection of veteran experience, emerging technology, and purposeful entrepreneurship. Hosted by Christian Perez, each episode features leaders navigating the transition from service to innovation.",
  "webFeed": "YOUR_RIVERSIDE_RSS_URL", // <-- UPDATE THIS
  "image": `${SITE_URL}/assets/tvp.png`,
  "author": {
    "@id": `${SITE_URL}/#person`
  },
  "publisher": {
    "@id": `${ALTIVUM_URL}/#organization`
  },
  "inLanguage": "en-US",
  "genre": ["Technology", "Business", "Veterans", "Entrepreneurship", "Leadership"]
});

/**
 * NEW: PodcastEpisode schema builder
 */
export const buildPodcastEpisodeSchema = (episode: {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  duration: string;
  episodeNumber?: number;
}) => ({
  "@type": "PodcastEpisode",
  "@id": `https://vector.altivum.ai/episodes/${episode.id}`,
  "name": episode.title,
  "description": episode.description,
  "datePublished": episode.publishedAt,
  "duration": formatDurationISO(episode.duration), // e.g., "PT58M32S"
  "episodeNumber": episode.episodeNumber,
  "partOfSeries": {
    "@id": "https://vector.altivum.ai/#podcast"
  },
  "author": {
    "@id": `${SITE_URL}/#person`
  }
});
```

### Task 4.2: Update Podcast FAQs

**Modify:** `src/utils/schemas.ts`

```typescript
export const podcastFAQs: FAQItem[] = [
  {
    question: "What is The Vector Podcast about?",
    answer: "The Vector Podcast explores conversations at the intersection of veteran experience, emerging technology, and purposeful entrepreneurship. Each episode features leaders navigating the transition from service to innovation, discussing AI, cloud technology, leadership, and building mission-driven companies."
  },
  {
    question: "Who hosts The Vector Podcast?",
    answer: "The Vector Podcast is hosted by Christian Perez, Founder & CEO of Altivum Inc. and former Green Beret. Christian brings his unique perspective as a veteran entrepreneur to facilitate conversations with leaders in technology and business."
  },
  {
    question: "Where can I listen to The Vector Podcast?",
    answer: "The Vector Podcast is available on all major podcast platforms including Spotify, Apple Podcasts, YouTube, Overcast, and Pocket Casts. You can also listen directly at vector.altivum.ai or subscribe via our RSS feed."
  },
  {
    question: "How often are new episodes released?",
    answer: "New episodes of The Vector Podcast are released regularly. Subscribe on your favorite platform to be notified when new episodes are available."
  },
  {
    question: "Can I be a guest on The Vector Podcast?",
    answer: "We're always looking for inspiring guests with unique perspectives on technology, entrepreneurship, and veteran experience. Contact us through thechrisgrey.com/contact to discuss guest opportunities."
  }
];
```

---

## Phase 5: Assets & Polish

### Task 5.1: Add Podcast Thumbnail Assets

**Create directory:** `public/assets/podcast/`

Add episode thumbnail images:
- `ep-001.jpg`
- `ep-002.jpg`
- `ep-003.jpg`
- etc.

### Task 5.2: Update constants with Riverside URLs

**Modify:** `src/constants/links.ts`

Replace `buzzsproutRSS` with Riverside RSS URL and add platform-specific podcast links.

---

## Implementation Order & Dependencies

```
Phase 1: Data Architecture (Foundation)
├── Task 1.1: Create podcast types
├── Task 1.2: Create episode data source
└── Task 1.3: Update links constants

Phase 2: Component Development (Can start after 1.1)
├── Task 2.1: Create EpisodeCard component
├── Task 2.2: Create platform icons
└── Task 2.3: Create SubscribePlatforms component

Phase 3: Page Redesign (Depends on Phase 1 & 2)
├── Task 3.1: Plan new page structure
├── Task 3.2: Remove Buzzsprout code
└── Task 3.3: Implement new Podcast page

Phase 4: Schema & SEO Updates
├── Task 4.1: Update podcast schema
└── Task 4.2: Update podcast FAQs

Phase 5: Assets & Polish
├── Task 5.1: Add thumbnail assets
└── Task 5.2: Final URL updates
```

---

## Files Summary

### New Files (4-5)
| File | Purpose |
|------|---------|
| `src/types/podcast.ts` | TypeScript interfaces for podcast data |
| `src/data/podcastEpisodes.ts` | Episode data and platform links |
| `src/components/EpisodeCard.tsx` | Episode display component |
| `src/components/SubscribePlatforms.tsx` | Platform subscription grid |
| `src/components/PodcastPlatformIcons.tsx` | SVG icons for platforms |

### Modified Files (3)
| File | Changes |
|------|---------|
| `src/pages/Podcast.tsx` | Complete redesign, remove Buzzsprout |
| `src/utils/schemas.ts` | Update RSS URL, add episode schema, update FAQs |
| `src/constants/links.ts` | Add podcast platform URLs, update RSS |

---

## Data Collection Required

Before implementation, you'll need to provide:

1. **Riverside RSS Feed URL** (find in Riverside dashboard → Hosting → Copy RSS URL)
2. **Spotify Show URL** (e.g., `https://open.spotify.com/show/...`)
3. **Apple Podcasts URL** (e.g., `https://podcasts.apple.com/podcast/...`)
4. **Episode Details** for existing episodes:
   - Titles
   - Descriptions
   - Publish dates
   - Duration
   - Guest names
   - Platform-specific episode links
5. **Episode Thumbnails** (optional but recommended)

---

## Testing Checklist

### Functionality
- [ ] All Buzzsprout code removed
- [ ] Episodes display correctly
- [ ] Platform links open in new tabs
- [ ] "Load More" shows additional episodes
- [ ] Mobile responsive design works

### SEO
- [ ] Page title correct: "The Vector Podcast | Christian Perez"
- [ ] Meta description updated
- [ ] Structured data validates (test with Google Rich Results Test)
- [ ] RSS URL in schema is correct

### Accessibility
- [ ] All images have alt text
- [ ] Links have descriptive text
- [ ] Color contrast meets WCAG standards

---

## Future Enhancements (Out of Scope)

1. **RSS Auto-Parsing**: Fetch episode data from Riverside RSS at build time
2. **YouTube Embed Option**: Embed video versions of episodes
3. **Episode Transcripts**: Add searchable transcripts from Riverside
4. **Episode Search**: Filter episodes by topic/guest
5. **Newsletter Integration**: Subscribe to podcast updates via email
6. **Sanity CMS Integration**: Manage episodes through Sanity like blog posts

---

## Sources

- [Riverside.fm Podcast Hosting](https://riverside.com/podcast-hosting)
- [Riverside RSS URL Documentation](https://support.riverside.com/hc/en-us/articles/28858163004701-Hosting-Where-can-I-find-my-podcast-s-Riverside-RSS-URL)
- [Riverside Features Review](https://cotovan.com/post/riverside-features-complete-review-for-podcasters-creators/)
- [Best Podcast Hosting Platforms 2025](https://riverside.fm/blog/best-podcast-hosting)
