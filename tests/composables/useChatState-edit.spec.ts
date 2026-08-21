// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('~/services/lm-studio.service', () => ({
  LmStudioService: vi.fn().mockImplementation(() => ({
    getModels: vi.fn().mockResolvedValue([{ id: 'test-model', object: 'model', created: 1, owned_by: 'test' }]),
    sendChat: vi.fn().mockResolvedValue({
      content: 'Test response',
      status: 'complete',
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

function mockFetchWithSession() {
  return vi.fn(async (url: string) => {
    if (url === '/api/session/create') return { path: 'test-session.md' }
    return { success: true }
  })
}

describe('useChatState edit & regenerate', () => {
  beforeEach(() => {
    globalThis.$fetch = vi.fn().mockResolvedValue([])
  })

  it('editMessage updates the user content and regenerates the assistant reply', async () => {
    const chat = useChatState()
    await chat.loadModels()
    globalThis.$fetch = mockFetchWithSession()

    await chat.sendMessage('hello')
    expect(chat.messages.value).toHaveLength(2)
    expect(chat.messages.value[0].content).toBe('hello')

    await chat.editMessage(0, 'hi there')
    expect(chat.messages.value).toHaveLength(2)
    expect(chat.messages.value[0].content).toBe('hi there')
    expect(chat.messages.value[0].role).toBe('user')
    expect(chat.messages.value[1].role).toBe('assistant')
    expect(chat.messages.value[1].content).toBe('Test response')
  })

  it('editMessage splices away every message after the edited turn', async () => {
    const chat = useChatState()
    await chat.loadModels()
    globalThis.$fetch = mockFetchWithSession()

    await chat.sendMessage('first')
    await chat.sendMessage('second')
    // [user, assistant, user, assistant]
    expect(chat.messages.value).toHaveLength(4)

    await chat.editMessage(0, 'edited first')
    // Only the edited user turn + one regenerated assistant reply remain.
    expect(chat.messages.value).toHaveLength(2)
    expect(chat.messages.value[0].content).toBe('edited first')
    expect(chat.messages.value[1].role).toBe('assistant')
  })

  it('editMessage ignores non-user indices', async () => {
    const chat = useChatState()
    await chat.loadModels()
    globalThis.$fetch = mockFetchWithSession()

    await chat.sendMessage('hello')
    const before = chat.messages.value.map(m => ({ ...m }))
    await chat.editMessage(1, 'should be ignored')
    expect(chat.messages.value).toEqual(before)
  })

  it('editMessage ignores out-of-range indices', async () => {
    const chat = useChatState()
    await chat.loadModels()
    globalThis.$fetch = mockFetchWithSession()

    await chat.sendMessage('hello')
    await chat.editMessage(99, 'nope')
    await chat.editMessage(-1, 'nope')
    expect(chat.messages.value).toHaveLength(2)
  })

  it('editMessage ignores empty text', async () => {
    const chat = useChatState()
    await chat.loadModels()
    globalThis.$fetch = mockFetchWithSession()

    await chat.sendMessage('hello')
    const before = chat.messages.value.map(m => ({ ...m }))
    await chat.editMessage(0, '   ')
    expect(chat.messages.value).toEqual(before)
  })

  it('regenerate drops the assistant message and produces a fresh reply', async () => {
    const chat = useChatState()
    await chat.loadModels()
    globalThis.$fetch = mockFetchWithSession()

    await chat.sendMessage('hello')
    expect(chat.messages.value).toHaveLength(2)
    const firstAssistantId = chat.messages.value[1].id

    await chat.regenerate(1)
    expect(chat.messages.value).toHaveLength(2)
    expect(chat.messages.value[0].role).toBe('user')
    expect(chat.messages.value[1].role).toBe('assistant')
    expect(chat.messages.value[1].id).not.toBe(firstAssistantId)
    expect(chat.messages.value[1].content).toBe('Test response')
  })

  it('regenerate does nothing for index 0', async () => {
    const chat = useChatState()
    await chat.loadModels()
    globalThis.$fetch = mockFetchWithSession()

    await chat.sendMessage('hello')
    const before = chat.messages.value.map(m => ({ ...m }))
    await chat.regenerate(0)
    expect(chat.messages.value).toEqual(before)
  })
})
