import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';

// Bundled poster asset — Vite resolves this at build time.
vi.mock('../../assets/hero-intro-poster.webp', () => ({ default: '/mock-hero-intro-poster.webp' }));

// Control the motion gate (prefers-reduced-motion / prerender) per test.
import { isMotionDisabled } from '../../utils/motion';
vi.mock('../../utils/motion', () => ({ isMotionDisabled: vi.fn() }));
const mockedIsMotionDisabled = vi.mocked(isMotionDisabled);

import HeroIntroVideo from './HeroIntroVideo';

const CDN_SRC = 'https://d1x8296f4gso9u.cloudfront.net/thechrisgrey/hero-h264.mp4';

beforeEach(() => {
  mockedIsMotionDisabled.mockReturnValue(false);
});

afterEach(() => {
  cleanup();
});

describe('HeroIntroVideo', () => {
  it('plays the muted, inline brand-intro video when motion is allowed', () => {
    const { container } = render(<HeroIntroVideo />);

    const video = container.querySelector('video');
    expect(video).toBeInTheDocument();
    expect(video).toHaveAttribute('src', CDN_SRC);
    // Gesture-free playback: attribute-driven autoplay + inline + muted.
    expect(video).toHaveAttribute('autoplay');
    expect(video).toHaveAttribute('playsinline');
    // muted is applied via the ref (browsers require it for gesture-free autoplay).
    expect((video as HTMLVideoElement).muted).toBe(true);
    // Decorative — identity is carried by the sibling sr-only <h1>.
    expect(video).toHaveAttribute('aria-hidden', 'true');
    // 16:9 intrinsic box reserves layout (no CLS); contained so the wordmark
    // is never cropped.
    expect(video).toHaveAttribute('width', '1920');
    expect(video).toHaveAttribute('height', '1080');
    expect(video?.className).toContain('object-contain');

    // No poster <img> in the animated branch.
    expect(container.querySelector('img')).toBeNull();
  });

  it('renders the static assembled frame (no video) when motion is disabled', () => {
    mockedIsMotionDisabled.mockReturnValue(true);
    const { container } = render(<HeroIntroVideo />);

    expect(container.querySelector('video')).toBeNull();
    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', '/mock-hero-intro-poster.webp');
    expect(img).toHaveAttribute('aria-hidden', 'true');
    expect(img?.className).toContain('object-contain');
  });
});
