import { isMotionDisabled } from '../../utils/motion';
import introPoster from '../../assets/hero-intro-poster.webp';

// The animated brand intro is served from the altivum-media-assets CloudFront
// distribution, which is allowlisted under CSP `media-src` in customHttp.yml.
// The poster is bundled locally (same-origin) on purpose: CSP `img-src` does NOT
// include the CDN, so a CDN-hosted `<img>` — or a `<video poster>`, which the
// browser fetches under `img-src` — would be blocked. Video frame 0 is a solid
// dark-navy field, so the clip starts seamlessly over the section background.
const HERO_INTRO_SRC = 'https://d1x8296f4gso9u.cloudfront.net/thechrisgrey/hero-h264.mp4';

// 16:9 clip, contained so the "@TheChrisGrey" wordmark is never cropped. The
// letterbox area falls back to the section's solid altivum-dark, which matches
// the clip's own dark corners, so the framing reads as seamless at any viewport.
const MEDIA_CLASS = 'absolute inset-0 h-full w-full object-contain';

// Guarantee the muted *property* is set the instant the element attaches. React
// applies `muted` as a property after creating the node, and browsers gate
// gesture-free autoplay on the muted state, so setting it here removes any doubt.
// Stable module-level identity keeps the ref from re-firing on every render.
function ensureMuted(el: HTMLVideoElement | null) {
  if (el) el.muted = true;
}

/**
 * Full-bleed animated brand intro for the home hero. It plays once and rests on
 * the fully assembled wordmark.
 *
 * When motion is disabled (prefers-reduced-motion or the prerender crawl) it
 * renders the assembled frame as a static image instead — the same end state,
 * without animation, and a stable DOM for crawlers.
 *
 * Playback is driven purely by the muted + inline autoplay attributes, which
 * every modern browser allows without a user gesture. We intentionally do NOT
 * call play() imperatively: under React StrictMode the effect double-invokes and
 * the play() promise rejected with a transient AbortError, which intermittently
 * swapped the video for the poster. The media is decorative — identity is carried
 * by the sibling sr-only <h1> — so it is aria-hidden.
 */
export default function HeroIntroVideo() {
  if (isMotionDisabled()) {
    return <img src={introPoster} alt="" aria-hidden="true" className={MEDIA_CLASS} width={1920} height={1080} />;
  }

  return (
    <video
      ref={ensureMuted}
      className={MEDIA_CLASS}
      src={HERO_INTRO_SRC}
      autoPlay
      muted
      playsInline
      preload="auto"
      aria-hidden="true"
      width={1920}
      height={1080}
    />
  );
}
