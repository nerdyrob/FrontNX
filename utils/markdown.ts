import MarkdownIt from 'markdown-it'

export type CodeBlockRecord = {
  code: string
  lang: string
}

export interface MdEnv {
  codeBlocks?: CodeBlockRecord[]
}

let _md: MarkdownIt

export function createMd(): MarkdownIt {
  if (_md) return _md
  _md = new MarkdownIt({
    html: false,
    breaks: true,
    linkify: true,
    typographer: true,
  })

  const defaultRender = _md.renderer.rules.link_open
    || ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options))

  _md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx]
    token.attrSet('target', '_blank')
    token.attrSet('rel', 'noopener noreferrer')
    return defaultRender(tokens, idx, options, env, self)
  }

  _md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx]
    const lang = token.info.trim()
    const e = env as MdEnv
    if (!e.codeBlocks) e.codeBlocks = []
    const i = e.codeBlocks.push({ code: token.content, lang }) - 1
    return `%%CODEBLOCK_${i}%%`
  }

  return _md
}
