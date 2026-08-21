import type { ChatMessage, SessionMeta } from '../types'
import { uid } from '../utils/uid'

function formatMetrics(metrics: ChatMessage['metrics']): string {
  if (!metrics) return ''
  return `\n<!-- metrics: processing_time_ms=${metrics.processingTimeMs} tokens_used=${metrics.tokensUsed} tokens_per_second=${metrics.tokensPerSecond} -->`
}

function formatResponseState(status?: ChatMessage['responseStatus'], stopReason?: ChatMessage['stopReason']): string {
  if (!status) return ''
  return `\n<!-- response: status=${status}${stopReason ? ` stop_reason=${stopReason}` : ''} -->`
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

function parseResponseStateComment(content: string): { content: string; responseStatus?: ChatMessage['responseStatus']; stopReason?: string } {
  const match = content.match(/\n?<!-- response: status=(complete|incomplete)(?: stop_reason=([^>\s]+))? -->\s*$/)
  if (!match || match.index === undefined) return { content }

  return {
    content: content.slice(0, match.index).trimEnd(),
    responseStatus: match[1] as ChatMessage['responseStatus'],
    stopReason: match[2],
  }
}

// Serializes session-level model parameters into front-matter lines.
function formatParams(params?: ModelParams): string[] {
  if (!params) return []
  const lines: string[] = []
  if (typeof params.temperature === 'number' && !Number.isNaN(params.temperature)) {
    lines.push(`temperature: ${params.temperature}`)
  }
  if (typeof params.maxTokens === 'number' && !Number.isNaN(params.maxTokens)) {
    lines.push(`max_tokens: ${params.maxTokens}`)
  }
  if (typeof params.topP === 'number' && !Number.isNaN(params.topP)) {
    lines.push(`top_p: ${params.topP}`)
  }
  if (params.systemPrompt) {
    lines.push(`system_prompt: ${params.systemPrompt.replace(/\r?\n/g, ' ').trim()}`)
  }
  return lines
}

function parseAssistantMetadata(content: string): {
  content: string
  metrics?: ChatMessage['metrics']
  responseStatus?: ChatMessage['responseStatus']
  stopReason?: string
} {
  let remaining = content
  let metrics: ChatMessage['metrics'] | undefined
  let responseStatus: ChatMessage['responseStatus'] | undefined
  let stopReason: string | undefined

  while (true) {
    const parsedState = parseResponseStateComment(remaining)
    if (parsedState.responseStatus) {
      remaining = parsedState.content
      responseStatus = parsedState.responseStatus
      stopReason = parsedState.stopReason
      continue
    }

    const parsedMetrics = parseMetricsComment(remaining)
    if (parsedMetrics.metrics) {
      remaining = parsedMetrics.content
      metrics = parsedMetrics.metrics
      continue
    }

    break
  }

  return {
    content: remaining,
    metrics,
    responseStatus,
    stopReason,
  }
}

export class SessionService {
  buildMarkdown(messages: ChatMessage[], meta: SessionMeta): string {
    const header = [
      '---',
      `model: ${meta.model}`,
      `service: ${meta.service}`,
      `created: ${meta.created}`,
      ...(meta.title ? [`title: ${meta.title}`] : []),
      ...formatParams(meta.params),
      '---',
      '',
    ].join('\n')

    const body = messages
      .map((msg) => {
        const base = msg.role === 'assistant' ? 'Assistant' : 'User'
        const label = `${base}${msg.model ? ` (${msg.model})` : ''}`
        const assistantMeta = msg.role === 'assistant'
          ? `${formatMetrics(msg.metrics)}${formatResponseState(msg.responseStatus, msg.stopReason)}`
          : ''
        return `## ${msg.createdAt} — ${label}\n\n${msg.content}${assistantMeta}\n`
      })
      .join('\n')

    return header + body
  }

  parseMarkdown(content: string): { meta: SessionMeta; messages: ChatMessage[] } {
    const meta: SessionMeta = { model: '', service: '', created: '', title: undefined }
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
        else if (key === 'title') meta.title = value
        else if (key === 'temperature') meta.params = { ...meta.params, temperature: Number(value) }
        else if (key === 'max_tokens') meta.params = { ...meta.params, maxTokens: Number(value) }
        else if (key === 'top_p') meta.params = { ...meta.params, topP: Number(value) }
        else if (key === 'system_prompt') meta.params = { ...meta.params, systemPrompt: value }
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
          const parsed = currentMsg.role === 'assistant'
            ? parseAssistantMetadata(rawContent)
            : { content: rawContent }
          currentMsg.content = parsed.content
          if (parsed.metrics) currentMsg.metrics = parsed.metrics
          if (parsed.responseStatus) currentMsg.responseStatus = parsed.responseStatus
          if (parsed.stopReason) currentMsg.stopReason = parsed.stopReason
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
      const parsed = currentMsg.role === 'assistant'
        ? parseAssistantMetadata(rawContent)
        : { content: rawContent }
      currentMsg.content = parsed.content
      if (parsed.metrics) currentMsg.metrics = parsed.metrics
      if (parsed.responseStatus) currentMsg.responseStatus = parsed.responseStatus
      if (parsed.stopReason) currentMsg.stopReason = parsed.stopReason
      messages.push(currentMsg as ChatMessage)
    }

    return { meta, messages }
  }

  // Clean, readable Markdown for export (no YAML front-matter, optional
  // title heading). Pairs with the export feature (new-features #3).
  exportAsMarkdown(messages: ChatMessage[], meta: SessionMeta): string {
    const lines: string[] = []
    if (meta.title) {
      lines.push(`# ${meta.title}`, '')
    }
    for (const msg of messages) {
      const who = msg.role === 'assistant' ? 'Assistant' : 'User'
      lines.push(`## ${who}`, '', msg.content, '')
    }
    return `${lines.join('\n').trimEnd()}\n`
  }

  // Plain-text transcript: "Role:\ncontent" blocks separated by blank lines.
  exportAsText(messages: ChatMessage[]): string {
    if (messages.length === 0) return ''
    const blocks = messages.map((msg) => {
      const who = msg.role === 'assistant' ? 'Assistant' : 'User'
      return `${who}:\n${msg.content}`
    })
    return `${blocks.join('\n\n')}\n`
  }

  // Structured JSON containing the session meta and full message list.
  exportAsJson(messages: ChatMessage[], meta: SessionMeta): string {
    return JSON.stringify({ meta, messages }, null, 2)
  }

}
