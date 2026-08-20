// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach } from 'vitest'

const hoisted = vi.hoisted(() => {
  let capturedSignal: AbortSignal | null = null
  let mode: 'resolve' | 'waitForAbort' = 'resolve'
  let lastReasoning: boolean | undefined
  return {
    getSignal: () => capturedSignal,
    setMode: (m: 'resolve' | 'waitForAbort') => { mode = m },
    getMode: () => mode,
    setSignal: (s: AbortSignal | null) => { capturedSignal = s },
    getReasoning: () => lastReasoning,
    setReasoning: (r: boolean | undefined) => { lastReasoning = r },
  }
})

vi.mock('~/services/lm-studio.service', () => ({
  LmStudioService: vi.fn().mockImplementation(() => ({
    getModels: vi.fn().mockResolvedValue([{ id: 'test-model', object: 'model', created: 1, owned_by: 'test' }]),
    sendChat: vi.fn((
      _messages: unknown,
      _model: string,
      _onChunk?: (d: string) => void,
      signal?: AbortSignal,
      reasoning?: boolean,
    ) => {
      hoisted.setSignal(signal ?? null)
      hoisted.setReasoning(reasoning)
      if (hoisted.getMode() === 'waitForAbort') {
        return new Promise((_resolve, reject) => {
          signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'))
          })
        })
      }
      return Promise.resolve({ content: 'Test response', status: 'complete' })
    }),
  })),
}))

vi.mock('~/services/session.service', () => ({
  SessionService: vi.fn().mockImplementation(() => ({
    buildMarkdown: vi.fn().mockReturnValue('# session'),
    parseMarkdown: vi.fn().mockReturnValue({
      meta: { model: '', service: '', created: '' },
      messages: [],
    }),
  })),
}))

describe('useChatState streaming behavior', () => {
  beforeEach(() => {
    hoisted.setMode('resolve')
    hoisted.setSignal(null)
    hoisted.setReasoning(undefined)
    globalThis.$fetch = vi.fn().mockResolvedValue([])
  })

  it('stopStreaming aborts the in-flight request and marks it incomplete', async () => {
    const chat = useChatState()
    await chat.loadModels()
    globalThis.$fetch = vi.fn(async (url: string) => {
      if (url === '/api/session/create') return { path: '/tmp/test.md' }
      return { success: true }
    })

    hoisted.setMode('waitForAbort')
    const p = chat.sendMessage('hello')
    // Wait until the stream has actually started (signal captured).
    await vi.waitFor(() => expect(hoisted.getSignal()).not.toBeNull())
    expect(chat.isStreaming.value).toBe(true)

    chat.stopStreaming()
    await p

    expect(hoisted.getSignal()?.aborted).toBe(true)
    expect(chat.isStreaming.value).toBe(false)
    expect(chat.messages.value[1].responseStatus).toBe('incomplete')
    expect(chat.messages.value[1].stopReason).toBe('userStopped')
    expect(chat.messages.value[1].content).toContain('Stopped by user')
  })

  it('setThinkingEnabled lets the user disable thinking', () => {
    const chat = useChatState()
    expect(chat.thinkingEnabled.value).toBe(true)
    chat.setThinkingEnabled(false)
    expect(chat.thinkingEnabled.value).toBe(false)
  })

  it('disabling thinking passes reasoning=false to the LM service', async () => {
    const chat = useChatState()
    await chat.loadModels()
    globalThis.$fetch = vi.fn(async (url: string) => {
      if (url === '/api/session/create') return { path: '/tmp/test.md' }
      return { success: true }
    })

    chat.setThinkingEnabled(false)
    await chat.sendMessage('hello')

    expect(hoisted.getReasoning()).toBe(false)
  })

  it('thinking stays enabled by default when sent', async () => {
    const chat = useChatState()
    await chat.loadModels()
    globalThis.$fetch = vi.fn(async (url: string) => {
      if (url === '/api/session/create') return { path: '/tmp/test.md' }
      return { success: true }
    })

    await chat.sendMessage('hello')
    expect(hoisted.getReasoning()).toBe(true)
  })

  it('preserves the thinking preference when switching models (#5 Minor/UX)', async () => {
    const chat = useChatState()
    await chat.loadModels() // first selection enables thinking
    expect(chat.thinkingEnabled.value).toBe(true)

    chat.setThinkingEnabled(false)
    expect(chat.thinkingEnabled.value).toBe(false)

    chat.setSelectedModel('another-model')
    // Switching models must not reset the user's explicit preference.
    expect(chat.thinkingEnabled.value).toBe(false)
  })
})
