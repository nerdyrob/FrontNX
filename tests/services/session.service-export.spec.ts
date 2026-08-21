import { describe, it, expect } from 'vitest'
import { SessionService } from '../../services/session.service'
import type { ChatMessage, SessionMeta } from '../../types'

describe('SessionService export', () => {
  const service = new SessionService()

  const meta: SessionMeta = {
    model: 'test-model',
    service: 'LM Studio',
    created: '2026-07-13T12:00:00Z',
    title: 'My Chat',
  }

  const messages: ChatMessage[] = [
    { id: '1', role: 'user', content: 'Hi there', createdAt: '2026-07-13T12:00:01Z' },
    { id: '2', role: 'assistant', content: 'Hello! How can I help?', createdAt: '2026-07-13T12:00:05Z' },
  ]

  it('exportAsMarkdown produces clean markdown with a title heading (#3)', () => {
    const md = service.exportAsMarkdown(messages, meta)
    expect(md).toContain('# My Chat')
    expect(md).toContain('## User')
    expect(md).toContain('## Assistant')
    expect(md).toContain('Hi there')
    expect(md).toContain('Hello! How can I help?')
    // No YAML front-matter in the exported markdown.
    expect(md).not.toContain('---')
    expect(md).not.toContain('model:')
  })

  it('exportAsText produces a plain-text transcript', () => {
    const text = service.exportAsText(messages)
    expect(text).toContain('User:\nHi there')
    expect(text).toContain('Assistant:\nHello! How can I help?')
  })

  it('exportAsText returns an empty string for no messages', () => {
    expect(service.exportAsText([])).toBe('')
  })

  it('exportAsJson round-trips into structured data', () => {
    const json = service.exportAsJson(messages, meta)
    const parsed = JSON.parse(json) as { meta: SessionMeta, messages: ChatMessage[] }
    expect(parsed.meta.title).toBe('My Chat')
    expect(parsed.messages).toHaveLength(2)
    expect(parsed.messages[1].content).toBe('Hello! How can I help?')
  })
})
