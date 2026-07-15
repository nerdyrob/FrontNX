import type { ChatMessage, SessionMeta } from '../types'

function uid(): string {
  if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

export class SessionService {
  buildMarkdown(messages: ChatMessage[], meta: SessionMeta): string {
    const header = [
      '---',
      `model: ${meta.model}`,
      `service: ${meta.service}`,
      `created: ${meta.created}`,
      '---',
      '',
    ].join('\n')

    const body = messages
      .map((msg) => {
        const label = msg.role === 'assistant'
          ? `Assistant${msg.model ? ` (${msg.model})` : ''}`
          : 'User'
        return `## ${msg.createdAt} — ${label}\n\n${msg.content}\n`
      })
      .join('\n')

    return header + body
  }

  parseMarkdown(content: string): { meta: SessionMeta; messages: ChatMessage[] } {
    const meta: SessionMeta = { model: '', service: '', created: '' }
    const messages: ChatMessage[] = []

    const lines = content.split('\n')
    let inFrontMatter = false
    let i = 0

    if (lines[0]?.trim() === '---') {
      inFrontMatter = true
      i = 1
      while (i < lines.length && lines[i]?.trim() !== '---') {
        const [key, ...rest] = lines[i].split(':')
        const value = rest.join(':').trim()
        if (key === 'model') meta.model = value
        else if (key === 'service') meta.service = value
        else if (key === 'created') meta.created = value
        i++
      }
      i++ // skip closing ---
    }

    let currentMsg: Partial<ChatMessage> | null = null
    const bodyLines: string[] = []

    for (; i < lines.length; i++) {
      const line = lines[i]
      const headingMatch = line.match(/^## (.+) — (.+)$/)

      if (headingMatch) {
        if (currentMsg) {
          currentMsg.content = bodyLines.join('\n').trim()
          messages.push(currentMsg as ChatMessage)
          bodyLines.length = 0
        }

        const createdAt = headingMatch[1]
        const label = headingMatch[2]
        const role = label.startsWith('Assistant') ? 'assistant' : 'user'
        const modelMatch = label.match(/\((.+)\)/)
        currentMsg = {
          id: uid(),
          role,
          createdAt,
          model: modelMatch ? modelMatch[1] : undefined,
          content: '',
        }
      } else if (currentMsg) {
        bodyLines.push(line)
      }
    }

    if (currentMsg) {
      currentMsg.content = bodyLines.join('\n').trim()
      messages.push(currentMsg as ChatMessage)
    }

    return { meta, messages }
  }

  filename(meta: SessionMeta): string {
    const d = new Date(meta.created)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.md`
  }
}
