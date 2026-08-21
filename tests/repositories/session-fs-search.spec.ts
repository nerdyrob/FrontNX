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

function makeRepo(): SessionFsRepository {
  const tempDir = mkdtempSync(join(tmpdir(), 'frontnx-search-'))
  tempDirs.push(tempDir)
  return new SessionFsRepository(tempDir)
}

function makeMessages(): ChatMessage[] {
  return [
    { id: '1', role: 'user', content: 'Tell me about black holes', createdAt: '2026-07-16T21:37:34.755Z' },
    {
      id: '2',
      role: 'assistant',
      content: 'Black holes warp spacetime.',
      createdAt: '2026-07-16T21:37:55.755Z',
    },
  ]
}

describe('SessionFsRepository search & rename', () => {
  it('search returns sessions whose content matches the query (#2)', async () => {
    const repo = makeRepo()
    const sessionService = new SessionService()
    const meta: SessionMeta = { model: 'gemma-4', service: 'LM Studio', created: '2026-07-16T21:37:34.755Z' }
    const path = await repo.create(meta)
    await repo.write(path, sessionService.buildMarkdown(makeMessages(), meta))

    const matches = await repo.search('black holes')
    expect(matches).toHaveLength(1)
    expect(matches[0].preview).toContain('Tell me about black holes')

    const none = await repo.search('nonexistent term')
    expect(none).toHaveLength(0)
  })

  it('search matches against a custom title', async () => {
    const repo = makeRepo()
    const sessionService = new SessionService()
    const meta: SessionMeta = { model: 'gemma-4', service: 'LM Studio', created: '2026-07-16T21:37:34.755Z', title: 'Research Notes' }
    const path = await repo.create(meta)
    await repo.write(path, sessionService.buildMarkdown(makeMessages(), meta))

    const matches = await repo.search('research')
    expect(matches).toHaveLength(1)
  })

  it('search returns an empty list for an empty query', async () => {
    const repo = makeRepo()
    const meta: SessionMeta = { model: 'gemma-4', service: 'LM Studio', created: '2026-07-16T21:37:34.755Z' }
    await repo.create(meta)
    expect(await repo.search('   ')).toEqual([])
  })

  it('rename updates the stored title and surfaces it in list (#2)', async () => {
    const repo = makeRepo()
    const sessionService = new SessionService()
    const meta: SessionMeta = { model: 'gemma-4', service: 'LM Studio', created: '2026-07-16T21:37:34.755Z' }
    const path = await repo.create(meta)
    await repo.write(path, sessionService.buildMarkdown(makeMessages(), meta))

    await repo.rename(path, 'My Renamed Chat')

    // The renamed title survives a round-trip through the front-matter.
    const content = await repo.read(path)
    expect(content).toContain('title: My Renamed Chat')

    const sessions = await repo.list()
    expect(sessions[0].title).toBe('My Renamed Chat')
  })

  it('rename strips newlines from the title', async () => {
    const repo = makeRepo()
    const sessionService = new SessionService()
    const meta: SessionMeta = { model: 'gemma-4', service: 'LM Studio', created: '2026-07-16T21:37:34.755Z' }
    const path = await repo.create(meta)
    await repo.write(path, sessionService.buildMarkdown(makeMessages(), meta))

    await repo.rename(path, 'line1\nline2')
    const content = await repo.read(path)
    expect(content).toContain('title: line1 line2')
  })
})
