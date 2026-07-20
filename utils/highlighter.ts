import { createHighlighter, type Highlighter } from 'shiki'

let highlighter: Highlighter | null = null
let loading: Promise<Highlighter> | null = null

const languages = [
  'javascript', 'typescript', 'python', 'json', 'yaml', 'xml', 'sql',
  'graphql', 'bash', 'shell', 'css', 'html', 'markdown', 'toml',
  'diff', 'http', 'dockerfile', 'ini', 'java', 'go', 'rust', 'ruby',
  'php', 'c', 'cpp', 'csharp', 'swift', 'kotlin', 'scala', 'r',
  'makefile', 'powershell', 'latex', 'plaintext',
]

export function ensureHighlighter(): Promise<Highlighter> {
  if (highlighter) return Promise.resolve(highlighter)
  if (!loading) {
    loading = createHighlighter({
      themes: ['github-light', 'github-dark'],
      langs: languages,
    }).then((h) => {
      highlighter = h
      return h
    })
  }
  return loading
}

ensureHighlighter()

export function highlightCode(code: string, lang: string): { html: string } {
  if (!highlighter) return { html: '' }
  try {
    const html = highlighter.codeToHtml(code, {
      lang: lang || 'text',
      themes: { light: 'github-light', dark: 'github-dark' },
    })
    return { html }
  } catch {
    return { html: '' }
  }
}
