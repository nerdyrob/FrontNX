import type { ModelOption, ChatMessage } from '../types'

interface StreamChunk {
  content: string
  finished: boolean
}

export class LmStudioService {
  constructor(private baseUrl: string) {}

  private get headers() {
    return { 'Content-Type': 'application/json' }
  }

  async getModels(): Promise<ModelOption[]> {
    const res = await fetch(`${this.baseUrl}/v1/models`, {
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
  ): Promise<string> {
    const body = JSON.stringify({
      model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      stream: true,
    })

    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
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
    let fullContent = ''
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed === 'data: [DONE]') continue
        if (trimmed.startsWith('data: ')) {
          try {
            const parsed = JSON.parse(trimmed.slice(6))
            const delta = parsed.choices?.[0]?.delta?.content ?? ''
            if (delta) {
              fullContent += delta
              onChunk?.(delta)
            }
          } catch {
            // skip malformed JSON chunks
          }
        }
      }
    }

    return fullContent
  }
}
