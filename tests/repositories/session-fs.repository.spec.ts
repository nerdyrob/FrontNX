import { mkdtempSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import { SessionFsRepository } from '../../repositories/session-fs.repository'
import { SessionService } from '../../services/session.service'
import type { ChatMessage, SessionMeta } from '../../types'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('SessionFsRepository', () => {
  it('blocks path traversal in read', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'frontnx-session-'))
    tempDirs.push(tempDir)

    const repository = new SessionFsRepository(tempDir)

    await expect(repository.read('../../etc/passwd')).rejects.toThrow('Path traversal')
    await expect(repository.read('/etc/passwd')).rejects.toThrow('Path traversal')
  })

  it('blocks path traversal in write', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'frontnx-session-'))
    tempDirs.push(tempDir)

    const repository = new SessionFsRepository(tempDir)

    await expect(repository.write('/tmp/evil.md', 'content')).rejects.toThrow('Path traversal')
  })

  it('blocks path traversal in delete', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'frontnx-session-'))
    tempDirs.push(tempDir)

    const repository = new SessionFsRepository(tempDir)

    await expect(repository.delete('../../etc/passwd')).rejects.toThrow('Path traversal')
  })

  it('blocks path traversal in append', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'frontnx-session-'))
    tempDirs.push(tempDir)

    const repository = new SessionFsRepository(tempDir)

    await expect(repository.append('../../../etc/passwd', 'block')).rejects.toThrow('Path traversal')
  })

  it('aggregates session token and processing totals from assistant messages', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'frontnx-session-'))
    tempDirs.push(tempDir)

    const repository = new SessionFsRepository(tempDir)
    const sessionService = new SessionService()
    const meta: SessionMeta = {
      model: 'gemma-4',
      service: 'LM Studio',
      created: '2026-07-16T21:37:34.755Z',
    }
    const messages: ChatMessage[] = [
      {
        id: '1',
        role: 'user',
        content: 'Can you tell me about black holes?',
        createdAt: '2026-07-16T21:37:34.755Z',
      },
      {
        id: '2',
        role: 'assistant',
        content: 'Black holes are collapsed stars with gravity so strong that light cannot escape.',
        createdAt: '2026-07-16T21:37:55.755Z',
        metrics: {
          processingTimeMs: 21000,
          tokensUsed: 180,
          tokensPerSecond: 8.57,
        },
      },
      {
        id: '3',
        role: 'assistant',
        content: 'They warp spacetime and can grow by accreting matter or merging with other black holes.',
        createdAt: '2026-07-16T21:38:25.755Z',
        metrics: {
          processingTimeMs: 12000,
          tokensUsed: 90,
          tokensPerSecond: 7.5,
        },
      },
    ]

    const path = await repository.create(meta)
    await repository.write(path, sessionService.buildMarkdown(messages, meta))

    const sessions = await repository.list()

    expect(sessions).toHaveLength(1)
    expect(sessions[0].preview).toContain('Can you tell me about black holes?')
    expect(sessions[0].timestamp).toBe('2026-07-16T21:37:34.755Z')
    expect(sessions[0].totalTokens).toBe(270)
    expect(sessions[0].totalProcessingTimeMs).toBe(33000)
  })
})