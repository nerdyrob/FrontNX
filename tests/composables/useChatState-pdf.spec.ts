// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PdfAttachment } from '~/types'

const hoisted = vi.hoisted(() => {
  const lastCall: { messages?: Array<{ role: string; content: string }> } = {}
  return {
    lastCall,
    record: (messages: Array<{ role: string; content: string }>) => {
      lastCall.messages = messages
    },
  }
})

vi.mock('~/services/lm-studio.service', () => ({
  LmStudioService: vi.fn().mockImplementation(() => ({
    getModels: vi.fn().mockResolvedValue([{ id: 'test-model', object: 'model', created: 1, owned_by: 'test' }]),
    sendChat: vi.fn((messages: Array<{ role: string; content: string }>) => {
      hoisted.record(messages)
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

const pdf: PdfAttachment = {
  name: 'report.pdf',
  pages: 3,
  characters: 27,
  truncated: false,
  text: 'Quarterly revenue grew.',
}

describe('useChatState PDF input', () => {
  beforeEach(() => {
    hoisted.lastCall.messages = undefined
    globalThis.$fetch = vi.fn().mockResolvedValue([])
  })

  it('embeds extracted PDF text in the user message', async () => {
    const chat = useChatState()
    await chat.loadModels()
    globalThis.$fetch = mockFetchWithSession()

    await chat.sendMessage('summarize this', undefined, [pdf])

    const content = chat.messages.value[0].content
    expect(content).toContain('summarize this')
    expect(content).toContain('```pdf-attachment')
    expect(content).toContain('"name":"report.pdf"')
    expect(content).toContain('Quarterly revenue grew.')
  })

  it('sends the PDF text to the model as message content', async () => {
    const chat = useChatState()
    await chat.loadModels()
    globalThis.$fetch = mockFetchWithSession()

    await chat.sendMessage('summarize this', undefined, [pdf])

    const sent = hoisted.lastCall.messages?.find((m) => m.role === 'user')
    expect(sent?.content).toContain('Quarterly revenue grew.')
  })

  it('ignores PDF attachments with no text', async () => {
    const chat = useChatState()
    await chat.loadModels()
    globalThis.$fetch = mockFetchWithSession()

    await chat.sendMessage('hello', undefined, [{ ...pdf, text: '   ' }])

    const content = chat.messages.value[0].content
    expect(content).toBe('hello')
    expect(content).not.toContain('pdf-attachment')
  })
})
