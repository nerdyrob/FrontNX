import type { ModelOption, ChatMessage } from '../types'

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

  private extractContent(json: any): string {
    const choiceContent = json?.choices?.[0]?.message?.content
    if (typeof choiceContent === 'string' && choiceContent.length > 0) return choiceContent

    const choiceText = json?.choices?.[0]?.text
    if (typeof choiceText === 'string' && choiceText.length > 0) return choiceText

    if (Array.isArray(json?.output)) {
      const messageItem = json.output.find((item: any) => item?.type === 'message' && typeof item?.content === 'string')
      if (messageItem?.content) return messageItem.content
    }

    if (typeof json?.content === 'string') return json.content

    return ''
  }

  private extractReasoning(json: any): string {
    const choiceReasoning = json?.choices?.[0]?.message?.reasoning_content
    if (typeof choiceReasoning === 'string' && choiceReasoning.length > 0) return choiceReasoning

    const rootReasoning = json?.reasoning_content
    if (typeof rootReasoning === 'string' && rootReasoning.length > 0) return rootReasoning

    if (Array.isArray(json?.output)) {
      const reasoningItems = json.output
        .filter((item: any) => item?.type === 'reasoning' && typeof item?.content === 'string')
        .map((item: any) => item.content)
      if (reasoningItems.length > 0) return reasoningItems.join('\n\n')
    }

    return ''
  }

  private extractMetrics(json: any): ChatResponseMetrics {
    const stats = json?.stats ?? json?.result?.stats ?? {}
    const tokensUsed = stats.total_output_tokens ?? stats.output_tokens ?? json?.usage?.completion_tokens ?? json?.usage?.total_tokens ?? 0
    const tokensPerSecond = stats.tokens_per_second ?? 0
    const generationSeconds = stats.generation_time ?? (
      tokensPerSecond > 0 && tokensUsed > 0 ? tokensUsed / tokensPerSecond : 0
    )

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
    const json = await res.json()
    return json.data ?? []
  }

  async sendChat(
    messages: ChatMessage[],
    model: string,
    onChunk?: (delta: string) => void,
    signal?: AbortSignal,
  ): Promise<ChatResponse> {
    const body = JSON.stringify({
      model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      stream: true,
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

    const extractDelta = (payload: any, currentEventType: string): string => {
      if (currentEventType === 'message.delta' && typeof payload?.content === 'string') {
        return payload.content
      }
      const deltaContent = payload?.choices?.[0]?.delta?.content
      if (typeof deltaContent === 'string') return deltaContent
      const textChunk = payload?.choices?.[0]?.text
      if (typeof textChunk === 'string') return textChunk
      return ''
    }

    const extractReasoningDelta = (payload: any, currentEventType: string): string => {
      if (currentEventType === 'reasoning.delta' && typeof payload?.content === 'string') {
        return payload.content
      }
      const reasoningDelta = payload?.choices?.[0]?.delta?.reasoning_content
      if (typeof reasoningDelta === 'string') return reasoningDelta
      return ''
    }

    const applyMetrics = (payload: any, currentEventType: string) => {
      if (currentEventType === 'chat.end') {
        sawChatEnd = true
        const extracted = this.extractMetrics(payload?.result ?? payload)
        metrics = extracted
        const reason = payload?.result?.stats?.stop_reason ?? payload?.stats?.stop_reason
        if (typeof reason === 'string' && reason.length > 0) stopReason = reason
        return
      }

      if (payload?.stats || payload?.usage || payload?.result?.stats) {
        metrics = this.extractMetrics(payload)
        const reason = payload?.stats?.stop_reason ?? payload?.result?.stats?.stop_reason
        if (typeof reason === 'string' && reason.length > 0) stopReason = reason
      }
    }

    const maybeApplyFinalContent = (payload: any, currentEventType: string) => {
      if (currentEventType === 'chat.end' && !fullContent) {
        const resultPayload = payload?.result ?? payload
        const fallbackContent = this.extractContent(resultPayload)
        if (fallbackContent) fullContent = fallbackContent
      }

      if (currentEventType === 'chat.end' && !fullReasoning) {
        const resultPayload = payload?.result ?? payload
        const fallbackReasoning = this.extractReasoning(resultPayload)
        if (fallbackReasoning) fullReasoning = fallbackReasoning
      }
    }

    const processPayload = (rawPayload: string, currentEventType: string) => {
      if (!rawPayload || rawPayload === '[DONE]') return
      try {
        const payload = JSON.parse(rawPayload)
        const finishReason = payload?.choices?.[0]?.finish_reason
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
            // OpenAI-style SSE often omits explicit event names; handle each data frame directly.
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
