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

describe('LmStudioService image handling', () => {
  let service: LmStudioService
  const baseUrl = 'http://localhost:1234/api/lm'

  beforeEach(() => {
    service = new LmStudioService(baseUrl)
    vi.restoreAllMocks()
  })

  it('forwards embedded images as multimodal content when includeImages is true (#5)', async () => {
    const img = 'data:image/png;base64,iVBORw0KGgoAAAAN'
    const messages: ChatMessage[] = [
      { id: '1', role: 'user', content: `Look: ![image](${img})`, createdAt: '2026-01-01T00:00:00Z' },
    ]
    const stream = sseStream('data: {"choices":[{"delta":{"content":"OK"},"finish_reason":"stop"}]}', 'data: [DONE]')
    mockFetch(stream)

    await service.sendChat(messages, 'test-model', undefined, undefined, false, undefined, undefined, { includeImages: true })

    const callBody = JSON.parse((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body)
    const userMsg = callBody.messages[callBody.messages.length - 1]
    expect(Array.isArray(userMsg.content)).toBe(true)
    const imagePart = (userMsg.content as Array<{ type: string; image_url?: { url: string } }>)
      .find(p => p.type === 'image_url')
    expect(imagePart).toBeTruthy()
    expect(imagePart!.image_url!.url).toContain('data:image/png;base64')
  })

  it('still sanitizes images from the payload when includeImages is false', async () => {
    const img = 'data:image/png;base64,iVBORw0KGgoAAAAN'
    const msgWithImg: ChatMessage[] = [
      { id: '1', role: 'user', content: `Check this: ${img}`, createdAt: '2026-01-01T00:00:00Z' },
    ]
    const stream = sseStream('data: {"choices":[{"delta":{"content":"Seen"},"finish_reason":"stop"}]}', 'data: [DONE]')
    mockFetch(stream)

    await service.sendChat(msgWithImg, 'test-model')

    const callBody = JSON.parse((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body)
    const userMsg = callBody.messages[callBody.messages.length - 1]
    expect(userMsg.content).toContain('[image omitted]')
    expect(userMsg.content).not.toContain(img)
  })
})
