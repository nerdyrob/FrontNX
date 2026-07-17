export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  model?: string
  createdAt: string
  metrics?: MessageMetrics
  responseStatus?: 'complete' | 'incomplete'
  stopReason?: string
  thinking?: string
}

export interface MessageMetrics {
  processingTimeMs: number
  tokensUsed: number
  tokensPerSecond: number
}

export interface SessionMeta {
  model: string
  service: string
  created: string
}
