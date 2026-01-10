// SVG Icons for podcast platforms

interface IconProps {
  className?: string;
}

export const SpotifyIcon = ({ className = 'w-6 h-6' }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
  </svg>
);

export const ApplePodcastIcon = ({ className = 'w-6 h-6' }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M5.34 0A5.328 5.328 0 000 5.34v13.32A5.328 5.328 0 005.34 24h13.32A5.328 5.328 0 0024 18.66V5.34A5.328 5.328 0 0018.66 0H5.34zm6.525 2.568c2.336 0 4.448.902 6.056 2.587 1.224 1.272 1.912 2.619 2.264 4.392.12.59-.312 1.14-.912 1.14h-.72c-.456 0-.864-.312-.96-.768-.264-1.32-.792-2.424-1.704-3.384-1.32-1.392-2.976-2.088-4.92-2.088-1.944 0-3.6.696-4.92 2.088-.912.96-1.44 2.064-1.704 3.384-.096.456-.504.768-.96.768h-.72c-.6 0-1.032-.55-.912-1.14.352-1.773 1.04-3.12 2.264-4.392 1.608-1.685 3.72-2.587 6.056-2.587zm.144 7.056c1.392 0 2.52 1.128 2.52 2.52 0 1.392-1.128 2.52-2.52 2.52-1.392 0-2.52-1.128-2.52-2.52 0-1.392 1.128-2.52 2.52-2.52zm-4.2-3.36c1.44-1.392 3.336-2.184 5.4-2.184s3.96.792 5.4 2.184c1.056 1.008 1.728 2.208 2.016 3.648.072.36-.24.72-.6.72h-1.44c-.264 0-.504-.192-.576-.432-.216-.984-.648-1.872-1.368-2.592-1.08-1.08-2.52-1.68-4.08-1.68s-3 .6-4.08 1.68c-.72.72-1.152 1.608-1.368 2.592-.072.24-.312.432-.576.432H5.232c-.36 0-.672-.36-.6-.72.288-1.44.96-2.64 2.016-3.648zM12 14.424c.816 0 1.488.672 1.488 1.488v5.088c0 .816-.672 1.488-1.488 1.488s-1.488-.672-1.488-1.488V15.912c0-.816.672-1.488 1.488-1.488z"/>
  </svg>
);

export const YouTubeIcon = ({ className = 'w-6 h-6' }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

export const RSSIcon = ({ className = 'w-6 h-6' }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M6.18 15.64a2.18 2.18 0 0 1 2.18 2.18C8.36 19 7.38 20 6.18 20 5 20 4 19 4 17.82a2.18 2.18 0 0 1 2.18-2.18M4 4.44A15.56 15.56 0 0 1 19.56 20h-2.83A12.73 12.73 0 0 0 4 7.27V4.44m0 5.66a9.9 9.9 0 0 1 9.9 9.9h-2.83A7.07 7.07 0 0 0 4 12.93V10.1z"/>
  </svg>
);

export const OvercastIcon = ({ className = 'w-6 h-6' }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 24C5.389 24 0 18.611 0 12S5.389 0 12 0s12 5.389 12 12-5.389 12-12 12zm0-3.6c4.636 0 8.4-3.764 8.4-8.4S16.636 3.6 12 3.6 3.6 7.364 3.6 12s3.764 8.4 8.4 8.4zM8.4 16.8l.6-2.4h6l.6 2.4h-1.5l-.3-1.2h-3.6l-.3 1.2H8.4zm2.1-3.6l1.5-6 1.5 6h-3zm4.2-4.2a2.7 2.7 0 1 1-5.4 0 2.7 2.7 0 0 1 5.4 0z"/>
  </svg>
);

export const PocketCastsIcon = ({ className = 'w-6 h-6' }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.372 0 0 5.372 0 12s5.372 12 12 12 12-5.372 12-12S18.628 0 12 0zm0 3.6c4.636 0 8.4 3.764 8.4 8.4s-3.764 8.4-8.4 8.4S3.6 16.636 3.6 12 7.364 3.6 12 3.6zm0 2.4a6 6 0 1 0 0 12 6 6 0 0 0 0-12zm0 2.4a3.6 3.6 0 1 1 0 7.2 3.6 3.6 0 0 1 0-7.2z"/>
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
