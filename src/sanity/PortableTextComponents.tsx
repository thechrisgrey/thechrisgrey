import { PortableTextComponents } from '@portabletext/react'
import { urlFor } from './client'
import type { CodeBlock, Callout, YouTube, Divider, PullQuote, BookReference } from './types'

// Extract YouTube video ID from URL
function getYouTubeId(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/
  const match = url.match(regExp)
  return match && match[2].length === 11 ? match[2] : null
}

// Callout icons and styles based on type
const calloutStyles = {
  note: {
    bg: 'bg-altivum-blue/20',
    border: 'border-altivum-blue',
    icon: 'info',
    label: 'Note',
  },
  tip: {
    bg: 'bg-green-900/20',
    border: 'border-green-500',
    icon: 'lightbulb',
    label: 'Tip',
  },
  warning: {
    bg: 'bg-yellow-900/20',
    border: 'border-yellow-500',
    icon: 'warning',
    label: 'Warning',
  },
  important: {
    bg: 'bg-red-900/20',
    border: 'border-red-500',
    icon: 'priority_high',
    label: 'Important',
  },
}

export const portableTextComponents: PortableTextComponents = {
  types: {
    // Inline images
    image: ({ value }) => {
      if (!value?.asset) return null
      return (
        <figure className="my-8">
          <img
            src={urlFor(value).width(800).auto('format').quality(80).url()}
            alt={value.alt || ''}
            className="w-full rounded-lg"
          />
          {value.caption && (
            <figcaption className="text-center text-sm text-altivum-silver/70 mt-3">
              {value.caption}
            </figcaption>
          )}
        </figure>
      )
    },

    // Code blocks with syntax highlighting styling
    codeBlock: ({ value }: { value: CodeBlock }) => {
      return (
        <div className="my-6">
          {value.filename && (
            <div className="bg-altivum-navy/80 px-4 py-2 text-xs text-altivum-silver border-b border-white/10 rounded-t-lg font-mono">
              {value.filename}
            </div>
          )}
          <pre
            className={`bg-altivum-navy/50 p-4 overflow-x-auto text-sm text-altivum-silver font-mono ${
              value.filename ? 'rounded-b-lg' : 'rounded-lg'
            }`}
          >
            <code className={value.language ? `language-${value.language}` : ''}>
              {value.code}
            </code>
          </pre>
          {value.language && (
            <div className="text-right text-xs text-altivum-slate mt-1">
              {value.language}
            </div>
          )}
        </div>
      )
    },

    // Callout boxes (Note, Tip, Warning, Important)
    callout: ({ value }: { value: Callout }) => {
      const style = calloutStyles[value.type] || calloutStyles.note
      return (
        <div
          className={`my-6 p-4 ${style.bg} border-l-4 ${style.border} rounded-r-lg`}
        >
          <div className="flex items-start gap-3">
            <span className="material-icons text-xl mt-0.5">{style.icon}</span>
            <div>
              <div className="font-semibold text-white mb-1">{style.label}</div>
              <p className="text-altivum-silver text-sm leading-relaxed">
                {value.text}
              </p>
            </div>
          </div>
        </div>
      )
    },

    // YouTube embeds
    youtube: ({ value }: { value: YouTube }) => {
      const videoId = getYouTubeId(value.url)
      if (!videoId) return null
      return (
        <figure className="my-8">
          <div className="relative aspect-video rounded-lg overflow-hidden">
            <iframe
              src={`https://www.youtube.com/embed/${videoId}`}
              title="YouTube video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 w-full h-full"
            />
          </div>
          {value.caption && (
            <figcaption className="text-center text-sm text-altivum-silver/70 mt-3">
              {value.caption}
            </figcaption>
          )}
        </figure>
      )
    },

    // Dividers / horizontal rules
    divider: ({ value }: { value: Divider }) => {
      const style = value.style || 'line'

      if (style === 'space') {
        return <div className="my-12" aria-hidden="true" />
      }

      if (style === 'dots') {
        return (
          <div className="my-10 flex justify-center gap-3" aria-hidden="true">
            <span className="w-1.5 h-1.5 rounded-full bg-altivum-gold/60" />
            <span className="w-1.5 h-1.5 rounded-full bg-altivum-gold/60" />
            <span className="w-1.5 h-1.5 rounded-full bg-altivum-gold/60" />
          </div>
        )
      }

      // Default: line
      return (
        <hr className="my-10 border-0 h-px bg-gradient-to-r from-transparent via-altivum-gold/40 to-transparent" />
      )
    },

    // Pull quotes - prominent callout for key insights
    pullQuote: ({ value }: { value: PullQuote }) => {
      return (
        <figure className="my-10 px-6 py-8 border-l-4 border-r-4 border-altivum-gold/60 bg-altivum-navy/30 rounded-lg">
          <blockquote className="text-xl md:text-2xl text-white font-light leading-relaxed text-center italic">
            "{value.quote}"
          </blockquote>
          {value.attribution && (
            <figcaption className="mt-4 text-center text-altivum-silver text-sm">
              — {value.attribution}
            </figcaption>
          )}
        </figure>
      )
    },

    // Book references - cards for recommended reading
    bookReference: ({ value }: { value: BookReference }) => {
      const content = (
        <div className="my-8 flex gap-5 p-5 bg-altivum-navy/40 border border-altivum-blue/30 rounded-lg hover:border-altivum-gold/40 transition-colors">
          {value.cover?.asset && (
            <div className="flex-shrink-0">
              <img
                src={urlFor(value.cover).width(120).height(180).auto('format').url()}
                alt={`Cover of ${value.title}`}
                className="w-20 md:w-24 rounded shadow-lg"
              />
            </div>
          )}
          <div className="flex flex-col justify-center">
            <div className="text-xs uppercase tracking-wider text-altivum-gold mb-1">
              Recommended Reading
            </div>
            <h4 className="text-lg font-semibold text-white mb-1">{value.title}</h4>
            <p className="text-sm text-altivum-silver mb-2">by {value.author}</p>
            {value.description && (
              <p className="text-sm text-altivum-silver/80 leading-relaxed">
                {value.description}
              </p>
            )}
          </div>
        </div>
      )

      if (value.link) {
        return (
          <a
            href={value.link}
            target="_blank"
            rel="noopener noreferrer"
            className="block no-underline"
          >
            {content}
          </a>
        )
      }

      return content
    },
  },

  block: {
    // Headings
    h2: ({ children }) => (
      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">{children}</h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-xl font-semibold text-white mt-8 mb-3">{children}</h3>
    ),
    h4: ({ children }) => (
      <h4 className="text-lg font-semibold text-white mt-6 mb-2">{children}</h4>
    ),
    // Normal paragraph
    normal: ({ children }) => (
      <p className="text-altivum-silver mb-6 leading-relaxed font-light">
        {children}
      </p>
    ),
    // Blockquote
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-altivum-gold pl-6 my-6 italic text-altivum-silver/90">
        {children}
      </blockquote>
    ),
  },

  marks: {
    // Text formatting
    strong: ({ children }) => (
      <strong className="font-semibold text-white">{children}</strong>
    ),
    em: ({ children }) => <em className="italic">{children}</em>,
    underline: ({ children }) => <span className="underline">{children}</span>,
    'strike-through': ({ children }) => (
      <span className="line-through">{children}</span>
    ),
    code: ({ children }) => (
      <code className="bg-altivum-navy/50 px-1.5 py-0.5 rounded text-sm font-mono text-altivum-gold">
        {children}
      </code>
    ),
    // Links
    link: ({ children, value }) => {
      const href = value?.href || ''
      const isExternal = href.startsWith('http')
      return (
        <a
          href={href}
          target={value?.openInNewTab || isExternal ? '_blank' : undefined}
          rel={isExternal ? 'noopener noreferrer' : undefined}
          className="text-altivum-gold hover:text-white underline underline-offset-2 transition-colors"
        >
          {children}
        </a>
      )
    },
  },

  list: {
    bullet: ({ children }) => (
      <ul className="list-disc list-inside mb-6 space-y-2 text-altivum-silver">
        {children}
      </ul>
    ),
    number: ({ children }) => (
      <ol className="list-decimal list-inside mb-6 space-y-2 text-altivum-silver">
        {children}
      </ol>
    ),
  },

  listItem: {
    bullet: ({ children }) => <li className="leading-relaxed">{children}</li>,
    number: ({ children }) => <li className="leading-relaxed">{children}</li>,
  },
}
