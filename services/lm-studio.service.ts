import type { ModelOption, ChatMessage } from '../types'

export interface ChatResponseMetrics {
  processingTimeMs: number
  tokensUsed: number
  tokensPerSecond: number
}

interface ChatResponse {
  content: string
  metrics?: ChatResponseMetrics
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
      stream: false,
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

    const json = await res.json() as any

    return {
      content: this.extractContent(json),
      metrics: this.extractMetrics(json),
    }
  }
}
