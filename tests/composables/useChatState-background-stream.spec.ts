// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Controllable promise so we can let a stream run in the background while the
// user switches sessions, then resolve it and switch back.
const hoisted = vi.hoisted(() => {
  let resolver: ((value: unknown) => void) | null = null
  return {
    setResolver: (r: ((value: unknown) => void) | null) => { resolver = r },
    getResolver: () => resolver,
  }
})

vi.mock('~/services/lm-studio.service', () => ({
  LmStudioService: vi.fn().mockImplementation(() => ({
    getModels: vi.fn().mockResolvedValue([{ id: 'test-model', object: 'model', created: 1, owned_by: 'test' }]),
    sendChat: vi.fn(() => new Promise((resolve) => {
      hoisted.setResolver(resolve)
    })),
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

describe('background streaming across session switches', () => {
  beforeEach(() => {
    hoisted.setResolver(null)
    globalThis.$fetch = vi.fn(async (url: string) => {
      if (url === '/api/session/create') return { path: '/tmp/A.md' }
      if (url === '/api/session/read') return { content: '# B session' }
      return { success: true }
    })
  })

  it('keeps streaming in the background and returns the response when switching back', async () => {
    const chat = useChatState()
    await chat.loadModels()

    // Start a stream in session A.
    const p = chat.sendMessage('hello')
    // Wait until the request is actually in flight.
    await vi.waitFor(() => expect(hoisted.getResolver()).not.toBeNull())
    expect(chat.currentSessionPath.value).toBe('/tmp/A.md')

    // User clicks another session mid-stream. The stream must NOT be aborted
    // and its partial data must not leak into session B.
    await chat.loadSession('/tmp/B.md')
    expect(chat.currentSessionPath.value).toBe('/tmp/B.md')
    expect(chat.isStreaming.value).toBe(false)
    expect(chat.messages.value).toHaveLength(0)

    // The background stream finishes.
    hoisted.getResolver()!({ content: 'Full response from A', status: 'complete' })
    await p

    // Returning to session A shows the completed response.
    await chat.loadSession('/tmp/A.md')
    expect(chat.currentSessionPath.value).toBe('/tmp/A.md')
    expect(chat.messages.value).toHaveLength(2)
    expect(chat.messages.value[0].role).toBe('user')
    expect(chat.messages.value[1].role).toBe('assistant')
    expect(chat.messages.value[1].content).toBe('Full response from A')
    expect(chat.messages.value[1].responseStatus).toBe('complete')
  })
})
