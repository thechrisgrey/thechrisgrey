import { urlFor } from '../sanity/client'

interface SanityResponsiveImageProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  source: any
  alt: string
  sizes: string
  widths?: number[]
  aspectRatio?: number
  quality?: number
  priority?: boolean
  className?: string
}

/**
 * Responsive image component for Sanity-hosted images.
 * Generates srcSet with multiple widths and a blurred LQIP placeholder.
 */
const SanityResponsiveImage = ({
  source,
  alt,
  sizes,
  widths = [320, 480, 640, 800, 1200],
  aspectRatio = 16 / 9,
  quality = 80,
  priority = false,
  className = '',
}: SanityResponsiveImageProps) => {
  if (!source) return null

  const buildUrl = (w: number) =>
    urlFor(source)
      .width(w)
      .height(Math.round(w / aspectRatio))
      .auto('format')
      .quality(quality)
      .url()

  const srcSet = widths
    .map(w => `${buildUrl(w)} ${w}w`)
    .join(', ')

  const fallbackSrc = buildUrl(widths[widths.length - 1])

  // Tiny blurred placeholder for perceived instant load
  const lqipUrl = urlFor(source)
    .width(20)
    .height(Math.round(20 / aspectRatio))
    .quality(20)
    .blur(50)
    .auto('format')
    .url()

  return (
    <div
      className="relative overflow-hidden"
      style={{
        backgroundImage: `url(${lqipUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <img
        src={fallbackSrc}
        srcSet={srcSet}
        sizes={sizes}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding={priority ? 'sync' : 'async'}
        fetchPriority={priority ? 'high' : undefined}
        className={className}
      />
    </div>
  )
}

export default SanityResponsiveImage
