// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach } from 'vitest'

const hoisted = vi.hoisted(() => {
  const lastCall: { options?: { includeImages?: boolean } } = {}
  return {
    lastCall,
    record: (options: { includeImages?: boolean }) => { lastCall.options = options },
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
      _customSystemPrompt?: string,
      options?: { includeImages?: boolean },
    ) => {
      hoisted.record(options ?? {})
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

describe('useChatState image input', () => {
  beforeEach(() => {
    hoisted.lastCall.options = undefined
    globalThis.$fetch = vi.fn().mockResolvedValue([])
  })

  it('embeds attached images into the user message content (#5)', async () => {
    const chat = useChatState()
    await chat.loadModels()
    globalThis.$fetch = mockFetchWithSession()

    const img = 'data:image/png;base64,AAAA'
    await chat.sendMessage('describe this', [img])

    expect(chat.messages.value[0].content).toContain('describe this')
    expect(chat.messages.value[0].content).toContain('data:image/png;base64,AAAA')
    expect(chat.messages.value[0].content).toContain('![image]')
  })

  it('enables includeImages in the API request when images are present', async () => {
    const chat = useChatState()
    await chat.loadModels()
    globalThis.$fetch = mockFetchWithSession()

    await chat.sendMessage('look', ['data:image/png;base64,AAAA'])
    expect(hoisted.lastCall.options?.includeImages).toBe(true)
  })

  it('keeps includeImages disabled when no images are attached', async () => {
    const chat = useChatState()
    await chat.loadModels()
    globalThis.$fetch = mockFetchWithSession()

    await chat.sendMessage('hi')
    expect(hoisted.lastCall.options?.includeImages).toBe(false)
  })
})
