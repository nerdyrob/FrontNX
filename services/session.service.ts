import type { ChatMessage, SessionMeta } from '../types'

function formatMetrics(metrics: ChatMessage['metrics']): string {
  if (!metrics) return ''
  return `\n<!-- metrics: processing_time_ms=${metrics.processingTimeMs} tokens_used=${metrics.tokensUsed} tokens_per_second=${metrics.tokensPerSecond} -->`
}

function parseMetricsComment(content: string): { content: string; metrics?: ChatMessage['metrics'] } {
  const match = content.match(/\n?<!-- metrics: processing_time_ms=(\d+) tokens_used=(\d+) tokens_per_second=([\d.]+) -->\s*$/)
  if (!match || match.index === undefined) return { content }

  return {
    content: content.slice(0, match.index).trimEnd(),
    metrics: {
      processingTimeMs: Number(match[1]),
      tokensUsed: Number(match[2]),
      tokensPerSecond: Number(match[3]),
    },
  }
}

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
        const base = msg.role === 'assistant' ? 'Assistant' : 'User'
        const label = `${base}${msg.model ? ` (${msg.model})` : ''}`
        return `## ${msg.createdAt} — ${label}\n\n${msg.content}${msg.role === 'assistant' ? formatMetrics(msg.metrics) : ''}\n`
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
          const rawContent = bodyLines.join('\n').trim()
          const parsed = currentMsg.role === 'assistant' ? parseMetricsComment(rawContent) : { content: rawContent }
          currentMsg.content = parsed.content
          if (parsed.metrics) currentMsg.metrics = parsed.metrics
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
      const rawContent = bodyLines.join('\n').trim()
      const parsed = currentMsg.role === 'assistant' ? parseMetricsComment(rawContent) : { content: rawContent }
      currentMsg.content = parsed.content
      if (parsed.metrics) currentMsg.metrics = parsed.metrics
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
