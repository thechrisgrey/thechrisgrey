import type { HighlighterCore } from 'shiki/core'

const SUPPORTED_LANGUAGES = [
  'typescript', 'javascript', 'python', 'bash', 'json', 'html', 'css',
  'yaml', 'markdown', 'sql', 'go', 'rust', 'java', 'tsx', 'jsx',
] as const

type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

let highlighterPromise: Promise<HighlighterCore> | null = null

function createHighlighterInstance(): Promise<HighlighterCore> {
  return import('shiki/core').then(({ createHighlighterCore }) =>
    import('shiki/engine/javascript').then(({ createJavaScriptRegexEngine }) =>
      createHighlighterCore({
        themes: [import('@shikijs/themes/github-dark')],
        langs: [
          import('@shikijs/langs/typescript'),
          import('@shikijs/langs/javascript'),
          import('@shikijs/langs/python'),
          import('@shikijs/langs/bash'),
          import('@shikijs/langs/json'),
          import('@shikijs/langs/html'),
          import('@shikijs/langs/css'),
          import('@shikijs/langs/yaml'),
          import('@shikijs/langs/markdown'),
          import('@shikijs/langs/sql'),
          import('@shikijs/langs/go'),
          import('@shikijs/langs/rust'),
          import('@shikijs/langs/java'),
          import('@shikijs/langs/tsx'),
          import('@shikijs/langs/jsx'),
        ],
        engine: createJavaScriptRegexEngine(),
      })
    )
  )
}

export function getHighlighter(): Promise<HighlighterCore> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighterInstance()
  }
  return highlighterPromise
}

export function isSupportedLanguage(lang: string): lang is SupportedLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(lang)
}
