// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { downloadTextFile } from '~/utils/download'

vi.mock('~/services/lm-studio.service', () => ({
  LmStudioService: vi.fn().mockImplementation(() => ({
    getModels: vi.fn().mockResolvedValue([{ id: 'test-model', object: 'model', created: 1, owned_by: 'test' }]),
    sendChat: vi.fn().mockResolvedValue({ content: 'Test response', status: 'complete' }),
  })),
}))

vi.mock('~/services/session.service', () => ({
  SessionService: vi.fn().mockImplementation(() => ({
    buildMarkdown: vi.fn().mockReturnValue('# session'),
    parseMarkdown: vi.fn().mockReturnValue({ meta: { model: '', service: '', created: '' }, messages: [] }),
    exportAsMarkdown: vi.fn().mockReturnValue('MD-CONTENT'),
    exportAsText: vi.fn().mockReturnValue('TXT-CONTENT'),
    exportAsJson: vi.fn().mockReturnValue('JSON-CONTENT'),
  })),
}))

vi.mock('~/utils/download', () => ({
  downloadTextFile: vi.fn(),
}))

function mockFetchWithSession() {
  return vi.fn(async (url: string) => {
    if (url === '/api/session/create') return { path: 'test-session.md' }
    return { success: true }
  })
}

describe('useChatState export', () => {
  beforeEach(() => {
    globalThis.$fetch = vi.fn().mockResolvedValue([])
    vi.mocked(downloadTextFile).mockClear()
  })

  async function seededChat() {
    const chat = useChatState()
    await chat.loadModels()
    globalThis.$fetch = mockFetchWithSession()
    await chat.sendMessage('hello')
    return chat
  }

  it('exportSession downloads markdown with the session filename (#3)', async () => {
    const chat = await seededChat()
    chat.exportSession('markdown')
    expect(downloadTextFile).toHaveBeenCalledWith('MD-CONTENT', 'test-session.md', 'text/markdown')
  })

  it('exportSession downloads JSON with the correct mime type', async () => {
    const chat = await seededChat()
    chat.exportSession('json')
    expect(downloadTextFile).toHaveBeenCalledWith('JSON-CONTENT', 'test-session.json', 'application/json')
  })

  it('exportSession downloads plain text with the correct mime type', async () => {
    const chat = await seededChat()
    chat.exportSession('text')
    expect(downloadTextFile).toHaveBeenCalledWith('TXT-CONTENT', 'test-session.txt', 'text/plain')
  })
})
