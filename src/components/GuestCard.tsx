import { podcastUrlFor } from '../sanity';
import { typography } from '../utils/typography';
import type { PodcastGuest } from '../sanity';

const BRANCH_LABELS: Record<string, string> = {
  'army': 'U.S. Army',
  'navy': 'U.S. Navy',
  'marines': 'U.S. Marine Corps',
  'air-force': 'U.S. Air Force',
  'space-force': 'U.S. Space Force',
  'coast-guard': 'U.S. Coast Guard',
};

interface GuestCardProps {
  guest: PodcastGuest;
}

const GuestCard = ({ guest }: GuestCardProps) => {
  return (
    <div className="flex flex-col items-center text-center p-6 rounded-lg border border-white/10 hover:border-altivum-gold/50 transition-all duration-300 bg-transparent">
      {/* Headshot */}
      {guest.image?.asset ? (
        <img
          src={podcastUrlFor(guest.image).width(160).height(160).url()}
          alt={guest.image.alt || guest.name}
          className="w-20 h-20 rounded-full object-cover mb-4"
          loading="lazy"
        />
      ) : (
        <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4">
          <span className="material-icons text-altivum-slate text-3xl">person</span>
        </div>
      )}

      {/* Name & Role */}
      <h3 className="text-white mb-1" style={typography.cardTitleSmall}>
        {guest.name}
      </h3>
      <p className={`text-altivum-silver text-sm ${guest.branch ? 'mb-1' : 'mb-4'}`}>{guest.role}</p>
      {guest.branch && (
        <p className="text-altivum-gold text-xs uppercase tracking-wider mb-4">
          {BRANCH_LABELS[guest.branch]}
        </p>
      )}

      {/* Links */}
      <div className="flex items-center gap-3">
        {guest.episodeUrl && (
          <a
            href={guest.episodeUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Watch ${guest.name}'s episode`}
            className="text-altivum-slate hover:text-altivum-gold transition-colors"
          >
            <span className="material-icons text-xl">play_circle</span>
          </a>
        )}
        {guest.linkedinUrl && (
          <a
            href={guest.linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${guest.name} on LinkedIn`}
            className="text-altivum-slate hover:text-altivum-gold transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
          </a>
        )}
        {guest.websiteUrl && (
          <a
            href={guest.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={guest.websiteLabel || `${guest.name}'s website`}
            className="text-altivum-slate hover:text-altivum-gold transition-colors"
          >
            <span className="material-icons text-xl">language</span>
          </a>
        )}
      </div>
    </div>
  );
};

export default GuestCard;
