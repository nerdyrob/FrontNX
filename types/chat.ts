export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  model?: string
  createdAt: string
}

export interface SessionMeta {
  model: string
  service: string
  created: string
}
