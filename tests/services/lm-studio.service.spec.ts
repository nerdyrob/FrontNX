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

describe('LmStudioService', () => {
  let service: LmStudioService
  const baseUrl = 'http://localhost:1234/api/lm'

  beforeEach(() => {
    service = new LmStudioService(baseUrl)
    vi.restoreAllMocks()
  })

  describe('getModels', () => {
    it('returns model list on success', async () => {
      const models = { data: [{ id: 'llama-3.2-3b', object: 'model', created: 1, owned_by: 'meta' }] }
      mockFetch(JSON.stringify(models))
      const result = await service.getModels()
      expect(result).toEqual(models.data)
    })

    it('throws on HTTP error', async () => {
      mockFetch('', 500)
      await expect(service.getModels()).rejects.toThrow('Failed to fetch models')
    })
  })

  describe('sendChat', () => {
    const messages: ChatMessage[] = [
      { id: '1', role: 'user', content: 'Hello', createdAt: '2026-01-01T00:00:00Z' },
    ]

    it('processes OpenAI-style SSE stream with content deltas', async () => {
      const stream = sseStream(
        'data: {"choices":[{"delta":{"content":"Hello"},"finish_reason":null}]}',
        'data: {"choices":[{"delta":{"content":" world"},"finish_reason":null}]}',
        'data: {"choices":[{"delta":{"content":"!"},"finish_reason":"stop"}]}',
        'data: [DONE]',
      )
      mockFetch(stream)

      const onChunk = vi.fn()
      const result = await service.sendChat(messages, 'test-model', onChunk)

      expect(onChunk).toHaveBeenCalledTimes(3)
      expect(onChunk).toHaveBeenNthCalledWith(1, 'Hello')
      expect(onChunk).toHaveBeenNthCalledWith(2, ' world')
      expect(onChunk).toHaveBeenNthCalledWith(3, '!')
      expect(result.content).toBe('Hello world!')
      expect(result.status).toBe('complete')
      expect(result.stopReason).toBe('stop')
    })

    it('handles custom event SSE format', async () => {
      const stream = sseStream(
        'event: message.delta',
        'data: {"content":"Hello"}',
        '',
        'event: message.delta',
        'data: {"content":" world"}',
        '',
        'event: chat.end',
        'data: {"result":{"content":"Hello world","stats":{"total_output_tokens":10,"tokens_per_second":5,"generation_time":2}}}',
      )
      mockFetch(stream)

      const onChunk = vi.fn()
      const result = await service.sendChat(messages, 'test-model', onChunk)

      expect(onChunk).toHaveBeenCalledTimes(2)
      expect(onChunk).toHaveBeenNthCalledWith(1, 'Hello')
      expect(onChunk).toHaveBeenNthCalledWith(2, ' world')
      expect(result.content).toBe('Hello world')
      expect(result.status).toBe('complete')
    })

    it('extracts reasoning content from delta', async () => {
      const stream = sseStream(
        'data: {"choices":[{"delta":{"reasoning_content":"Let me think"},"finish_reason":null}]}',
        'data: {"choices":[{"delta":{"reasoning_content":" about this"},"finish_reason":null}]}',
        'data: {"choices":[{"delta":{"content":"Final answer"},"finish_reason":"stop"}]}',
        'data: [DONE]',
      )
      mockFetch(stream)

      const onReasoning = vi.fn()
      const result = await service.sendChat(messages, 'test-model', undefined, undefined, true, onReasoning)

      expect(onReasoning).toHaveBeenCalledTimes(2)
      expect(onReasoning).toHaveBeenNthCalledWith(1, 'Let me think')
      expect(onReasoning).toHaveBeenNthCalledWith(2, ' about this')
      expect(result.content).toContain('<thinking>')
      expect(result.content).toContain('Let me think about this')
      expect(result.content).toContain('Final answer')
    })

    it('handles inline thinking tags without separate reasoning', async () => {
      const stream = sseStream(
        'data: {"choices":[{"delta":{"content":"<thinking>Step 1</thinking>"},"finish_reason":null}]}',
        'data: {"choices":[{"delta":{"content":" Answer"},"finish_reason":"stop"}]}',
        'data: [DONE]',
      )
      mockFetch(stream)

      const result = await service.sendChat(messages, 'test-model')

      expect(result.content).toBe('<thinking>Step 1</thinking> Answer')
    })

    it('includes metrics from usage field in delta', async () => {
      const stream = sseStream(
        'data: {"choices":[{"delta":{"content":"Hi"},"finish_reason":null}]}',
        'data: {"choices":[{"delta":{"content":""},"finish_reason":"stop"}],"usage":{"completion_tokens":5,"total_tokens":5}}',
        'data: [DONE]',
      )
      mockFetch(stream)

      const result = await service.sendChat(messages, 'test-model')

      expect(result.metrics?.tokensUsed).toBe(5)
      expect(result.status).toBe('complete')
    })

    it('sanitizes base64 images from messages', async () => {
      const img = 'data:image/png;base64,iVBORw0KGgoAAAAN'
      const msgWithImg: ChatMessage[] = [
        { id: '1', role: 'user', content: `Check this: ${img}`, createdAt: '2026-01-01T00:00:00Z' },
      ]

      const stream = sseStream('data: {"choices":[{"delta":{"content":"Seen"},"finish_reason":"stop"}]}', 'data: [DONE]')
      mockFetch(stream)

      await service.sendChat(msgWithImg, 'test-model')

      const callUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]
      const callBody = JSON.parse((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body)

      expect(callUrl).toBe('http://localhost:1234/api/lm/v0/chat/completions')
      const userMsg = callBody.messages[callBody.messages.length - 1]
      expect(userMsg.content).toContain('[image omitted]')
      expect(userMsg.content).not.toContain(img)
    })

    it('throws on HTTP error', async () => {
      mockFetch('', 400)
      await expect(service.sendChat(messages, 'test-model')).rejects.toThrow('Chat request failed')
    })

    it('uses custom system prompt when provided', async () => {
      const stream = sseStream('data: {"choices":[{"delta":{"content":"OK"},"finish_reason":"stop"}]}', 'data: [DONE]')
      mockFetch(stream)

      const customPrompt = 'You are a custom assistant.'
      await service.sendChat(messages, 'test-model', undefined, undefined, false, undefined, customPrompt)

      const callBody = JSON.parse((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body)
      const systemMessage = callBody.messages.find((m: any) => m.role === 'system')
      expect(systemMessage.content).toContain(customPrompt)
      expect(systemMessage.content).toContain('Code fences')
    })

    it('handles empty stream gracefully', async () => {
      const stream = sseStream()
      mockFetch(stream)

      const result = await service.sendChat(messages, 'test-model')

      expect(result.content).toBe('')
      expect(result.metrics).toBeDefined()
    })

    it('processes custom reasoning event type', async () => {
      const stream = sseStream(
        'event: reasoning.delta',
        'data: {"content":"Let me reason"}',
        '',
        'event: message.delta',
        'data: {"content":"Result"}',
        '',
        'event: chat.end',
        'data: {"result":{"stats":{"total_output_tokens":3,"generation_time":0.1,"tokens_per_second":30}}}',
      )
      mockFetch(stream)

      const onReasoning = vi.fn()
      const result = await service.sendChat(messages, 'test-model', undefined, undefined, true, onReasoning)

      expect(onReasoning).toHaveBeenCalledWith('Let me reason')
      expect(result.content).toContain('Let me reason')
      expect(result.content).toContain('Result')
    })
  })
})
