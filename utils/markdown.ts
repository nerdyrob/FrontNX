import MarkdownIt from 'markdown-it'

let _md: MarkdownIt

export function createMd(): MarkdownIt {
  if (_md) return _md
  _md = new MarkdownIt({
    html: false,
    breaks: true,
    linkify: true,
    typographer: true,
  })

  const defaultRender = _md.renderer.rules.link_open || ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options))

  _md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx]
    token.attrSet('target', '_blank')
    token.attrSet('rel', 'noopener noreferrer')
    return defaultRender(tokens, idx, options, env, self)
  }

  return _md
}
