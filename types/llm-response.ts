export interface LLMDelta {
  content?: string
  reasoning_content?: string
}

export interface LLMMessage {
  content?: string
  reasoning_content?: string
}

export interface LLMChoice {
  delta?: LLMDelta
  message?: LLMMessage
  text?: string
  finish_reason?: string | null
}

export interface LLMResponseChunk {
  choices?: LLMChoice[]
  usage?: {
    completion_tokens?: number
    total_tokens?: number
  }
}

export interface CustomMessageDelta {
  content: string
}

export interface CustomStats {
  total_output_tokens?: number
  tokens_per_second?: number
  generation_time?: number
  stop_reason?: string
  output_tokens?: number
}

export interface CustomChatEndResult {
  content?: string
  reasoning?: string
  stats?: CustomStats
}

export interface CustomChatEndPayload {
  result?: CustomChatEndResult
  stats?: CustomStats
}

export interface CustomReasoningDelta {
  content: string
}

export interface LLMModelList {
  data?: Array<{
    id: string
    object: string
    created: number
    owned_by: string
  }>
}

export function isLLMResponseChunk(data: unknown): data is LLMResponseChunk {
  return typeof data === 'object' && data !== null
}

export function isRecord(data: unknown): data is Record<string, unknown> {
  return typeof data === 'object' && data !== null && !Array.isArray(data)
}
