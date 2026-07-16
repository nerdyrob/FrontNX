import { describe, it, expect } from 'vitest'
import { SessionService } from '../../services/session.service'
import type { ChatMessage, SessionMeta } from '../../types'

describe('SessionService', () => {
  const service = new SessionService()

  it('buildMarkdown produces valid front-matter format', () => {
    const meta: SessionMeta = {
      model: 'test-model',
      service: 'LM Studio',
      created: '2026-07-13T12:00:00Z',
    }
    const messages: ChatMessage[] = [
      { id: '1', role: 'user', content: 'Hello', createdAt: '2026-07-13T12:00:01Z' },
    ]
    const result = service.buildMarkdown(messages, meta)
    expect(result).toContain('---')
    expect(result).toContain('model: test-model')
    expect(result).toContain('service: LM Studio')
    expect(result).toContain('## 2026-07-13T12:00:01Z — User')
    expect(result).toContain('Hello')
  })

  it('parseMarkdown round-trips correctly', () => {
    const meta: SessionMeta = {
      model: 'llama-3.2-3b',
      service: 'LM Studio',
      created: '2026-07-13T12:00:00Z',
    }
    const messages: ChatMessage[] = [
      { id: 'a', role: 'user', content: 'Hi', createdAt: '2026-07-13T12:00:01Z' },
      {
        id: 'b',
        role: 'assistant',
        content: 'Hello!',
        model: 'llama-3.2-3b',
        createdAt: '2026-07-13T12:00:05Z',
        metrics: {
          processingTimeMs: 1234,
          tokensUsed: 42,
          tokensPerSecond: 33.9,
        },
      },
    ]

    const md = service.buildMarkdown(messages, meta)
    const parsed = service.parseMarkdown(md)

    expect(parsed.meta.model).toBe('llama-3.2-3b')
    expect(parsed.messages).toHaveLength(2)
    expect(parsed.messages[0].content).toBe('Hi')
    expect(parsed.messages[0].role).toBe('user')
    expect(parsed.messages[1].content).toBe('Hello!')
    expect(parsed.messages[1].role).toBe('assistant')
    expect(parsed.messages[1].model).toBe('llama-3.2-3b')
    expect(parsed.messages[1].metrics?.processingTimeMs).toBe(1234)
    expect(parsed.messages[1].metrics?.tokensUsed).toBe(42)
    expect(parsed.messages[1].metrics?.tokensPerSecond).toBe(33.9)
  })
})
