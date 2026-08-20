// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('~/services/lm-studio.service', () => ({
  LmStudioService: vi.fn().mockImplementation(() => ({
    getModels: vi.fn().mockResolvedValue([{ id: 'test-model', object: 'model', created: 1, owned_by: 'test' }]),
    sendChat: vi.fn().mockResolvedValue({ content: 'Test response', status: 'complete' }),
  })),
}))

function createdFromMarkdown(md: string): string | null {
  const match = md.match(/^created:\s*(.+)$/m)
  return match ? match[1].trim() : null
}

describe('useChatState session created timestamp (#4)', () => {
  let rewriteBodies: string[]

  beforeEach(() => {
    rewriteBodies = []
    globalThis.$fetch = vi.fn(async (url: string, opts: any) => {
      if (url === '/api/session/create') return { path: '/tmp/test.md' }
      if (url === '/api/session/rewrite') {
        rewriteBodies.push(opts.body.content as string)
        return { success: true }
      }
      return []
    })
  })

  it('keeps the same created timestamp across multiple saves', async () => {
    const chat = useChatState()
    await chat.loadModels()

    await chat.sendMessage('first message')
    await chat.sendMessage('second message')

    expect(rewriteBodies.length).toBeGreaterThanOrEqual(2)
    const first = createdFromMarkdown(rewriteBodies[0])
    const second = createdFromMarkdown(rewriteBodies[1])
    expect(first).not.toBeNull()
    expect(first).toBe(second)
  })

  it('preserves the loaded session creation timestamp', async () => {
    const original = '2026-01-02T03:04:05.000Z'
    // Simulate reading back a session with a fixed created timestamp.
    globalThis.$fetch = vi.fn(async (url: string, opts: any) => {
      if (url === '/api/session/read') {
        return {
          content: [
            '---',
            `model: test-model`,
            `service: LM Studio`,
            `created: ${original}`,
            '---',
            '',
            `## ${original} — User`,
            '',
            'hello',
            '',
          ].join('\n'),
        }
      }
      if (url === '/api/session/rewrite') {
        rewriteBodies.push(opts.body.content as string)
        return { success: true }
      }
      return []
    })

    const chat = useChatState()
    await chat.loadSession('/tmp/test.md')

    await chat.sendMessage('follow-up')
    expect(rewriteBodies.length).toBeGreaterThanOrEqual(1)
    expect(createdFromMarkdown(rewriteBodies[0])).toBe(original)
  })
})
