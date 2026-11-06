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

export interface ModelParams {
  temperature?: number
  maxTokens?: number
  topP?: number
  systemPrompt?: string
}

// Text extracted from a PDF the user attached to a message. The raw file is
// never stored; only the extracted text is sent to the model and persisted in
// the session markdown (see utils/pdf-attachment.ts).
export interface PdfAttachment {
  name: string
  pages: number
  characters: number
  truncated: boolean
  text: string
}

export interface SessionMeta {
  model: string
  service: string
  created: string
  title?: string
  params?: ModelParams
}
