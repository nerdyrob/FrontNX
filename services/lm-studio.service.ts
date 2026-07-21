import type { ModelOption, ChatMessage } from '../types'
import type {
  LLMResponseChunk,
  CustomChatEndPayload,
} from '../types/llm-response'

export interface ChatResponseMetrics {
  processingTimeMs: number
  tokensUsed: number
  tokensPerSecond: number
}

interface ChatResponse {
  content: string
  metrics?: ChatResponseMetrics
  status: 'complete' | 'incomplete'
  stopReason?: string
}

export class LmStudioService {
  constructor(private baseUrl: string) {}

  private get headers() {
    return { 'Content-Type': 'application/json' }
  }

  private extractContent(data: Record<string, unknown>): string {
    const choiceContent = (data as LLMResponseChunk)?.choices?.[0]?.message?.content
    if (typeof choiceContent === 'string' && choiceContent.length > 0) return choiceContent

    const choiceText = (data as LLMResponseChunk)?.choices?.[0]?.text
    if (typeof choiceText === 'string' && choiceText.length > 0) return choiceText

    if (Array.isArray(data.output)) {
      const messageItem = (data.output as Array<Record<string, unknown>>).find(
        (item) => item?.type === 'message' && typeof item?.content === 'string'
      )
      if (messageItem?.content && typeof messageItem.content === 'string') return messageItem.content
    }

    if (typeof data.content === 'string') return data.content

    return ''
  }

  private extractReasoning(data: Record<string, unknown>): string {
    const choiceReasoning = (data as LLMResponseChunk)?.choices?.[0]?.message?.reasoning_content
    if (typeof choiceReasoning === 'string' && choiceReasoning.length > 0) return choiceReasoning

    const rootReasoning = data.reasoning_content
    if (typeof rootReasoning === 'string' && rootReasoning.length > 0) return rootReasoning

    if (Array.isArray(data.output)) {
      const reasoningItems = (data.output as Array<Record<string, unknown>>)
        .filter((item) => item?.type === 'reasoning' && typeof item?.content === 'string')
        .map((item) => item.content as string)
      if (reasoningItems.length > 0) return reasoningItems.join('\n\n')
    }

    return ''
  }

  private extractMetrics(data: Record<string, unknown>): ChatResponseMetrics {
    const stats = ((data?.stats ?? (data as CustomChatEndPayload)?.result?.stats) ?? {}) as Record<string, unknown>
    const tokensUsed = (stats.total_output_tokens ?? stats.output_tokens ?? (data as LLMResponseChunk)?.usage?.completion_tokens ?? (data as LLMResponseChunk)?.usage?.total_tokens ?? 0) as number
    const tokensPerSecond = (stats.tokens_per_second ?? 0) as number
    const generationSeconds = (stats.generation_time ?? (
      tokensPerSecond > 0 && tokensUsed > 0 ? tokensUsed / tokensPerSecond : 0
    )) as number

    return {
      processingTimeMs: generationSeconds > 0 ? Math.round(generationSeconds * 1000) : 0,
      tokensUsed,
      tokensPerSecond,
    }
  }

  async getModels(): Promise<ModelOption[]> {
    const res = await fetch(`${this.baseUrl}/v0/models`, {
      headers: this.headers,
    })
    if (!res.ok) {
      throw new Error(`Failed to fetch models: ${res.status} ${res.statusText}`)
    }
    const json: { data?: ModelOption[] } = await res.json()
    return json.data ?? []
  }

  private sanitizeForApi(text: string): string {
    return text.replace(/data:image\/[a-z+]+;base64,[a-zA-Z0-9+/=]+/g, '[image omitted]')
  }

  async sendChat(
    messages: ChatMessage[],
    model: string,
    onChunk?: (delta: string) => void,
    signal?: AbortSignal,
    reasoning?: boolean,
    onReasoning?: (delta: string) => void,
  ): Promise<ChatResponse> {
    const baseMessages = messages.map(m => ({ role: m.role, content: this.sanitizeForApi(m.content) }))

    const systemPrompt = [
      { role: 'system', content: [
        'You are a helpful assistant with access to a rich markdown renderer.',
        'Use the following formats to make responses more readable:',
        '',
        '- Math: $$...$$ for display equations, $...$ for inline math (KaTeX).',
        '- Code fences: Use ```language with any common language tag for syntax highlighting.',
        '- Tables: Output CSV data in a ```csv or ```tsv fence for sortable/filterable tables.',
        '- Structured data: Use ```json, ```yaml, ```toml, or ```xml fences for interactive tree views.',
        '- Diagrams: Output SVG inside a ```svg fence for safe inline rendering.',
        '- Charts: Use ```chart with a JSON config for interactive Chart.js charts.',
        '  Supports types: bar, line, pie, doughnut, radar, polarArea, scatter.',
        '  Example:',
        '  ```chart',
        '  {"type":"bar","data":{"labels":["Q1","Q2","Q3"],"datasets":[{"label":"Sales","data":[120,90,150]}]}}',
        '  ```',
        '- SQL/GraphQL: Use ```sql or ```graphql fences. Format and validate buttons are provided.',
      ].join('\n') },
    ]

    if (!reasoning) {
      systemPrompt.push({
        role: 'system',
        content: 'Always respond directly. Do not include thinking, reasoning, or step-by-step analysis in your response.',
      })
    }

    const adjustedMessages = [...systemPrompt, ...baseMessages]

    const body = JSON.stringify({
      model,
      messages: adjustedMessages,
      stream: true,
      reasoning: reasoning ? 'on' : 'off',
    })

    const res = await fetch(`${this.baseUrl}/v0/chat/completions`, {
      method: 'POST',
      headers: this.headers,
      body,
      signal,
    })

    if (!res.ok) {
      throw new Error(`Chat request failed: ${res.status} ${res.statusText}`)
    }

    const reader = res.body?.getReader()
    if (!reader) throw new Error('Response body is not readable')

    const decoder = new TextDecoder()
    let buffer = ''
    let eventType = ''
    let eventData: string[] = []
    let fullContent = ''
    let fullReasoning = ''
    let metrics: ChatResponseMetrics | undefined
    let sawChatEnd = false
    let sawDone = false
    let sawFinishReason = false
    let stopReason: string | undefined

    function extractDelta(payload: Record<string, unknown>, currentEventType: string): string {
      if (currentEventType === 'message.delta' && typeof payload?.content === 'string') {
        return payload.content as string
      }
      const deltaContent = (payload as LLMResponseChunk)?.choices?.[0]?.delta?.content
      if (typeof deltaContent === 'string') return deltaContent
      const textChunk = (payload as LLMResponseChunk)?.choices?.[0]?.text
      if (typeof textChunk === 'string') return textChunk
      return ''
    }

    function extractReasoningDelta(payload: Record<string, unknown>, currentEventType: string): string {
      if (currentEventType === 'reasoning.delta' && typeof payload?.content === 'string') {
        return payload.content as string
      }
      const reasoningDelta = (payload as LLMResponseChunk)?.choices?.[0]?.delta?.reasoning_content
      if (typeof reasoningDelta === 'string') return reasoningDelta
      return ''
    }

    const applyMetrics = (payload: Record<string, unknown>, currentEventType: string) => {
      if (currentEventType === 'chat.end') {
        sawChatEnd = true
        const extracted = this.extractMetrics((payload as CustomChatEndPayload)?.result ?? payload)
        metrics = extracted
        const reason = (payload as CustomChatEndPayload)?.result?.stats?.stop_reason ?? (payload as CustomChatEndPayload)?.stats?.stop_reason
        if (typeof reason === 'string' && reason.length > 0) stopReason = reason
        return
      }

      if (payload?.stats || (payload as LLMResponseChunk)?.usage || (payload as CustomChatEndPayload)?.result?.stats) {
        metrics = this.extractMetrics(payload)
        const reason = (payload as CustomChatEndPayload)?.stats?.stop_reason ?? (payload as CustomChatEndPayload)?.result?.stats?.stop_reason
        if (typeof reason === 'string' && reason.length > 0) stopReason = reason
      }
    }

    const maybeApplyFinalContent = (payload: Record<string, unknown>, currentEventType: string) => {
      if (currentEventType === 'chat.end' && !fullContent) {
        const resultPayload = (payload as CustomChatEndPayload)?.result ?? payload
        const fallbackContent = this.extractContent(resultPayload)
        if (fallbackContent) fullContent = fallbackContent
      }

      if (currentEventType === 'chat.end' && !fullReasoning) {
        const resultPayload = (payload as CustomChatEndPayload)?.result ?? payload
        const fallbackReasoning = this.extractReasoning(resultPayload)
        if (fallbackReasoning) fullReasoning = fallbackReasoning
      }
    }

    const processPayload = (rawPayload: string, currentEventType: string) => {
      if (!rawPayload || rawPayload === '[DONE]') return
      try {
        const parsed: unknown = JSON.parse(rawPayload)
        if (typeof parsed !== 'object' || parsed === null) return
        const payload = parsed as Record<string, unknown>

        const finishReason = (payload as LLMResponseChunk)?.choices?.[0]?.finish_reason
        if (typeof finishReason === 'string' && finishReason.length > 0) {
          sawFinishReason = true
          stopReason = finishReason
        }

        const delta = extractDelta(payload, currentEventType)
        if (delta) {
          fullContent += delta
          onChunk?.(delta)
        }
        const reasoningDelta = extractReasoningDelta(payload, currentEventType)
        if (reasoningDelta) {
          fullReasoning += reasoningDelta
          onReasoning?.(reasoningDelta)
        }

        maybeApplyFinalContent(payload, currentEventType)
        applyMetrics(payload, currentEventType)
      } catch {
        // Ignore malformed SSE frames.
      }
    }

    const flushEvent = () => {
      if (!eventData.length) {
        eventType = ''
        return
      }
      const payload = eventData.join('\n')
      processPayload(payload, eventType)
      eventType = ''
      eventData = []
    }

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()

        if (!trimmed) {
          flushEvent()
          continue
        }

        if (trimmed.startsWith('event: ')) {
          eventType = trimmed.slice(7).trim()
          continue
        }

        if (trimmed.startsWith('data: ')) {
          const payload = trimmed.slice(6)
          if (!eventType) {
            if (payload === '[DONE]') {
              sawDone = true
              continue
            }
            processPayload(payload, '')
          } else {
            eventData.push(payload)
          }
        }
      }
    }

    // Process any remaining line in the buffer (no trailing newline)
    if (buffer) {
      const trimmed = buffer.trim()
      if (trimmed.startsWith('data: ')) {
        const payload = trimmed.slice(6)
        if (!eventType) {
          if (payload === '[DONE]') {
            sawDone = true
          } else {
            processPayload(payload, '')
          }
        } else {
          eventData.push(payload)
        }
      }
    }

    // Flush any trailing frame not followed by a blank line.
    flushEvent()

    if (!metrics) {
      metrics = {
        processingTimeMs: 0,
        tokensUsed: 0,
        tokensPerSecond: 0,
      }
    }

    const status = stopReason === 'userStopped'
      ? 'incomplete'
      : (sawChatEnd || sawDone || sawFinishReason ? 'complete' : 'incomplete')

    const hasInlineThinking = /<thinking>[\s\S]*<\/thinking>/i.test(fullContent)
    const normalizedReasoning = fullReasoning.trim()
    let mergedContent = fullContent

    if (!hasInlineThinking && normalizedReasoning) {
      mergedContent = `<thinking>\n${normalizedReasoning}\n</thinking>${fullContent ? `\n\n${fullContent}` : ''}`
    }

    return {
      content: mergedContent,
      metrics,
      status,
      stopReason,
    }
  }
}
