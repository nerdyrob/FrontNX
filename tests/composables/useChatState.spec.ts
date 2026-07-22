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

describe('useChatState', () => {
  beforeEach(() => {
    globalThis.$fetch = vi.fn().mockResolvedValue([])
  })

  it('initializes with empty state', () => {
    const chat = useChatState()
    expect(chat.messages.value).toEqual([])
    expect(chat.isStreaming.value).toBe(false)
    expect(chat.currentSessionPath.value).toBeNull()
    expect(chat.loadError.value).toBeNull()
    expect(chat.thinkingEnabled.value).toBe(true)
  })

  it('newSession clears messages and path', () => {
    const chat = useChatState()
    chat.messages.value = [{ id: '1', role: 'user', content: 'hi', createdAt: '' }]
    chat.currentSessionPath.value = '/tmp/test.md'
    chat.newSession()
    expect(chat.messages.value).toEqual([])
    expect(chat.currentSessionPath.value).toBeNull()
  })

  it('deleteMessage removes a message at index', () => {
    const chat = useChatState()
    chat.messages.value = [
      { id: 'a', role: 'user', content: 'one', createdAt: '' },
      { id: 'b', role: 'assistant', content: 'two', createdAt: '' },
      { id: 'c', role: 'user', content: 'three', createdAt: '' },
    ]
    chat.deleteMessage(1)
    expect(chat.messages.value).toHaveLength(2)
    expect(chat.messages.value[0].id).toBe('a')
    expect(chat.messages.value[1].id).toBe('c')
  })

  it('deleteRange removes messages in range', () => {
    const chat = useChatState()
    chat.messages.value = [
      { id: 'a', role: 'user', content: 'one', createdAt: '' },
      { id: 'b', role: 'user', content: 'two', createdAt: '' },
      { id: 'c', role: 'user', content: 'three', createdAt: '' },
    ]
    chat.deleteRange(0, 2)
    expect(chat.messages.value).toHaveLength(1)
    expect(chat.messages.value[0].id).toBe('c')
  })

  it('sendMessage does nothing without selected model', async () => {
    const chat = useChatState()
    await chat.sendMessage('hello')
    expect(chat.messages.value).toHaveLength(0)
  })

  it('sendMessage adds user and assistant messages', async () => {
    const chat = useChatState()
    chat.selectedModel.value = 'test-model'
    globalThis.$fetch = vi.fn().mockResolvedValue({ path: '/tmp/test.md' })

    await chat.sendMessage('hello')

    expect(chat.messages.value).toHaveLength(2)
    expect(chat.messages.value[0].role).toBe('user')
    expect(chat.messages.value[0].content).toBe('hello')
    expect(chat.messages.value[1].role).toBe('assistant')
  })

  it('loadModels sets available models', async () => {
    const chat = useChatState()
    expect(chat.availableModels.value).toHaveLength(0)
    await chat.loadModels()
    expect(chat.availableModels.value).toHaveLength(1)
    expect(chat.availableModels.value[0].id).toBe('test-model')
  })
})
