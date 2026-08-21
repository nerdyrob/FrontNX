// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach } from 'vitest'

const hoisted = vi.hoisted(() => {
  const lastCall: { customSystemPrompt?: unknown; options?: unknown } = {}
  return {
    lastCall,
    record: (customSystemPrompt: unknown, options: unknown) => {
      lastCall.customSystemPrompt = customSystemPrompt
      lastCall.options = options
    },
  }
})

vi.mock('~/services/lm-studio.service', () => ({
  LmStudioService: vi.fn().mockImplementation(() => ({
    getModels: vi.fn().mockResolvedValue([{ id: 'test-model', object: 'model', created: 1, owned_by: 'test' }]),
    sendChat: vi.fn((
      _messages: unknown,
      _model: string,
      _onChunk?: (d: string) => void,
      _signal?: AbortSignal,
      _reasoning?: boolean,
      _onReasoning?: (d: string) => void,
      customSystemPrompt?: string,
      options?: { temperature?: number; maxTokens?: number; topP?: number },
    ) => {
      hoisted.record(customSystemPrompt, options)
      return Promise.resolve({ content: 'Test response', status: 'complete' })
    }),
  })),
}))

vi.mock('~/services/session.service', () => ({
  SessionService: vi.fn().mockImplementation(() => ({
    buildMarkdown: vi.fn().mockReturnValue('# session'),
    parseMarkdown: vi.fn().mockReturnValue({ meta: { model: '', service: '', created: '' }, messages: [] }),
  })),
}))

function mockFetchWithSession() {
  return vi.fn(async (url: string) => {
    if (url === '/api/session/create') return { path: 'test-session.md' }
    return { success: true }
  })
}

describe('useChatState model parameters', () => {
  beforeEach(() => {
    hoisted.lastCall.customSystemPrompt = undefined
    hoisted.lastCall.options = undefined
    globalThis.$fetch = vi.fn().mockResolvedValue([])
  })

  it('passes configured model params and system prompt override to sendChat (#4)', async () => {
    const chat = useChatState()
    await chat.loadModels()
    globalThis.$fetch = mockFetchWithSession()

    chat.setTemperature(0.5)
    chat.setMaxTokens(1024)
    chat.setTopP(0.8)
    chat.setSystemPromptOverride('Custom instructions')

    await chat.sendMessage('hi')

    expect(hoisted.lastCall.options).toEqual({ temperature: 0.5, maxTokens: 1024, topP: 0.8, includeImages: false })
    expect(hoisted.lastCall.customSystemPrompt).toBe('Custom instructions')
  })

  it('falls back to the default system prompt when the override is empty', async () => {
    const chat = useChatState()
    await chat.loadModels()
    globalThis.$fetch = mockFetchWithSession()

    chat.setSystemPromptOverride('   ')
    await chat.sendMessage('hi')

    expect(hoisted.lastCall.customSystemPrompt).not.toBe('   ')
  })

  it('exposes the parameter setters', () => {
    const chat = useChatState()
    chat.setTemperature(0.3)
    chat.setMaxTokens(256)
    chat.setTopP(0.5)
    chat.setSystemPromptOverride('x')
    expect(chat.temperature.value).toBe(0.3)
    expect(chat.maxTokens.value).toBe(256)
    expect(chat.topP.value).toBe(0.5)
    expect(chat.systemPromptOverride.value).toBe('x')
  })
})
