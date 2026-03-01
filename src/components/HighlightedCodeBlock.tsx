import { useState, useEffect, memo } from 'react'

interface HighlightedCodeBlockProps {
  code: string
  language?: string
  filename?: string
}

const HighlightedCodeBlock = memo(({ code, language, filename }: HighlightedCodeBlockProps) => {
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function highlight() {
      try {
        const { codeToHtml } = await import('shiki')
        const html = await codeToHtml(code, {
          lang: language || 'text',
          theme: 'github-dark',
        })
        if (!cancelled) {
          setHighlightedHtml(html)
        }
      } catch {
        // Shiki failed to load or language unsupported — keep plain fallback
      }
    }

    if (code) {
      highlight()
    }

    return () => {
      cancelled = true
    }
  }, [code, language])

  return (
    <div className="my-6">
      {filename && (
        <div className="bg-altivum-navy/80 px-4 py-2 text-xs text-altivum-silver border-b border-white/10 rounded-t-lg font-mono">
          {filename}
        </div>
      )}
      {highlightedHtml ? (
        // Safe: Shiki generates HTML from its own WASM tokenizer on CMS-authored code strings.
        // No user-supplied content flows through this path.
        <div
          className={`not-prose [&>pre]:bg-altivum-navy/50 [&>pre]:p-4 [&>pre]:overflow-x-auto [&>pre]:text-sm [&>pre]:font-mono ${
            filename ? '[&>pre]:rounded-b-lg [&>pre]:rounded-t-none' : '[&>pre]:rounded-lg'
          }`}
          dangerouslySetInnerHTML={{ __html: highlightedHtml }}
        />
      ) : (
        <pre
          className={`bg-altivum-navy/50 p-4 overflow-x-auto text-sm text-altivum-silver font-mono ${
            filename ? 'rounded-b-lg' : 'rounded-lg'
          }`}
        >
          <code>{code}</code>
        </pre>
      )}
      {language && (
        <div className="text-right text-xs text-altivum-slate mt-1">
          {language}
        </div>
      )}
    </div>
  )
})

HighlightedCodeBlock.displayName = 'HighlightedCodeBlock'

export default HighlightedCodeBlock
