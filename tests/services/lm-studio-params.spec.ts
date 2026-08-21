import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LmStudioService } from '../../services/lm-studio.service'
import type { ChatMessage } from '../../types'

function sseStream(...events: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  const data = events.join('\n')
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(data))
      controller.close()
    },
  })
}

function mockFetch(body: ReadableStream | string, status = 200): void {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    body: body instanceof ReadableStream ? body : null,
    json: () => Promise.resolve(typeof body === 'string' ? JSON.parse(body) : body),
    text: () => Promise.resolve(typeof body === 'string' ? body : ''),
  } as Response)
}

describe('LmStudioService model parameters', () => {
  let service: LmStudioService
  const baseUrl = 'http://localhost:1234/api/lm'

  beforeEach(() => {
    service = new LmStudioService(baseUrl)
    vi.restoreAllMocks()
  })

  const messages: ChatMessage[] = [
    { id: '1', role: 'user', content: 'Hello', createdAt: '2026-01-01T00:00:00Z' },
  ]

  it('includes temperature, max_tokens and top_p in the request body (#4)', async () => {
    const stream = sseStream('data: {"choices":[{"delta":{"content":"OK"},"finish_reason":"stop"}]}', 'data: [DONE]')
    mockFetch(stream)

    await service.sendChat(messages, 'test-model', undefined, undefined, false, undefined, undefined, {
      temperature: 0.7,
      maxTokens: 512,
      topP: 0.9,
    })

    const callBody = JSON.parse((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body)
    expect(callBody.temperature).toBe(0.7)
    expect(callBody.max_tokens).toBe(512)
    expect(callBody.top_p).toBe(0.9)
  })

  it('omits parameter fields when not provided', async () => {
    const stream = sseStream('data: {"choices":[{"delta":{"content":"OK"},"finish_reason":"stop"}]}', 'data: [DONE]')
    mockFetch(stream)

    await service.sendChat(messages, 'test-model')

    const callBody = JSON.parse((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body)
    expect(callBody.temperature).toBeUndefined()
    expect(callBody.max_tokens).toBeUndefined()
    expect(callBody.top_p).toBeUndefined()
  })
})
