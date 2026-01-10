import { PodcastPlatform } from '../types/podcast';
import { PlatformIcon } from './PodcastPlatformIcons';

interface SubscribePlatformsProps {
  platforms: PodcastPlatform[];
}

const SubscribePlatforms = ({ platforms }: SubscribePlatformsProps) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {platforms.map((platform) => (
        <a
          key={platform.name}
          href={platform.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center justify-center p-6 rounded-lg border border-white/10 bg-white/5 hover:border-altivum-gold hover:bg-white/10 transition-all duration-200 group"
        >
          <PlatformIcon
            icon={platform.icon}
            className="w-8 h-8 mb-3 text-altivum-silver group-hover:text-altivum-gold transition-colors"
          />
          <span className="text-sm text-altivum-silver group-hover:text-white transition-colors font-medium">
            {platform.name}
          </span>
        </a>
      ))}
    </div>
  );
};

export default SubscribePlatforms;
