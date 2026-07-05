// SVG Icons for podcast platforms

interface IconProps {
  className?: string;
}

export const SpotifyIcon = ({ className = 'w-6 h-6' }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
  </svg>
);

export const ApplePodcastIcon = ({ className = 'w-6 h-6' }: IconProps) => (
  <svg className={className} viewBox="0 0 32 32" fill="currentColor">
    <path d="M7.12 0C3.19 0 0 3.19 0 7.12v17.76C0 28.81 3.19 32 7.12 32h17.76c3.93 0 7.12-3.19 7.12-7.12V7.12C32 3.19 28.81 0 24.88 0H7.12zm8.88 5.6c5.3 0 9.6 4.3 9.6 9.6 0 2.04-.64 3.93-1.72 5.49-.36-.42-.78-.78-1.24-1.08.8-1.26 1.26-2.76 1.26-4.36 0-4.42-3.58-8-8-8s-8 3.58-8 8c0 1.62.48 3.12 1.3 4.38-.46.3-.88.66-1.24 1.08C6.84 19.15 6.2 17.26 6.2 15.2c0-5.3 4.3-9.6 9.6-9.6h.2zm0 4c3.09 0 5.6 2.51 5.6 5.6 0 1.24-.4 2.38-1.08 3.3-.5-.24-1.04-.42-1.62-.52.5-.74.8-1.64.8-2.6 0-2.54-2.06-4.6-4.6-4.6s-4.6 2.06-4.6 4.6c0 .94.28 1.82.76 2.56-.56.1-1.1.28-1.6.52-.66-.9-1.06-2.02-1.06-3.24 0-3.09 2.51-5.6 5.6-5.6h.2-.4zm.2 4a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6zm0 4.8c1.77 0 3.2 1.43 3.2 3.2v4.8c0 .88-.72 1.6-1.6 1.6h-3.2c-.88 0-1.6-.72-1.6-1.6v-4.8c0-1.77 1.43-3.2 3.2-3.2z" />
  </svg>
);

export const YouTubeIcon = ({ className = 'w-6 h-6' }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

export const RSSIcon = ({ className = 'w-6 h-6' }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M6.18 15.64a2.18 2.18 0 0 1 2.18 2.18C8.36 19 7.38 20 6.18 20 5 20 4 19 4 17.82a2.18 2.18 0 0 1 2.18-2.18M4 4.44A15.56 15.56 0 0 1 19.56 20h-2.83A12.73 12.73 0 0 0 4 7.27V4.44m0 5.66a9.9 9.9 0 0 1 9.9 9.9h-2.83A7.07 7.07 0 0 0 4 12.93V10.1z" />
  </svg>
);

export const OvercastIcon = ({ className = 'w-6 h-6' }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 24C5.389 24 0 18.611 0 12S5.389 0 12 0s12 5.389 12 12-5.389 12-12 12zm0-3.6c4.636 0 8.4-3.764 8.4-8.4S16.636 3.6 12 3.6 3.6 7.364 3.6 12s3.764 8.4 8.4 8.4zM8.4 16.8l.6-2.4h6l.6 2.4h-1.5l-.3-1.2h-3.6l-.3 1.2H8.4zm2.1-3.6l1.5-6 1.5 6h-3zm4.2-4.2a2.7 2.7 0 1 1-5.4 0 2.7 2.7 0 0 1 5.4 0z" />
  </svg>
);

export const PocketCastsIcon = ({ className = 'w-6 h-6' }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.372 0 0 5.372 0 12s5.372 12 12 12 12-5.372 12-12S18.628 0 12 0zm0 3.6c4.636 0 8.4 3.764 8.4 8.4s-3.764 8.4-8.4 8.4S3.6 16.636 3.6 12 7.364 3.6 12 3.6zm0 2.4a6 6 0 1 0 0 12 6 6 0 0 0 0-12zm0 2.4a3.6 3.6 0 1 1 0 7.2 3.6 3.6 0 0 1 0-7.2z" />
  </svg>
);

// Icon selector component
interface PlatformIconProps {
  icon: 'spotify' | 'apple' | 'youtube' | 'rss' | 'overcast' | 'pocketcasts';
  className?: string;
}

export const PlatformIcon = ({ icon, className }: PlatformIconProps) => {
  switch (icon) {
    case 'spotify':
      return <SpotifyIcon className={className} />;
    case 'apple':
      return <ApplePodcastIcon className={className} />;
    case 'youtube':
      return <YouTubeIcon className={className} />;
    case 'rss':
      return <RSSIcon className={className} />;
    case 'overcast':
      return <OvercastIcon className={className} />;
    case 'pocketcasts':
      return <PocketCastsIcon className={className} />;
    default:
      return null;
  }
};
