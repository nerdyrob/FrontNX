import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import { readFile, writeFile, appendFile } from 'node:fs/promises'
import { join, parse } from 'node:path'
import type { ISessionRepository } from './session.repository'
import type { SessionMeta } from '../types'

export class SessionFsRepository implements ISessionRepository {
  private baseDir: string

  constructor(baseDir?: string) {
    this.baseDir = baseDir ?? join(process.cwd(), 'chat-sessions')
    if (!existsSync(this.baseDir)) {
      mkdirSync(this.baseDir, { recursive: true })
    }
  }

  async create(meta: SessionMeta): Promise<string> {
    const date = meta.created.replace(/[:.]/g, '-').slice(0, 19)
    const safeModel = meta.model.replace(/[^a-zA-Z0-9_-]/g, '_')
    const filename = `${date}_${safeModel}.md`
    const filePath = join(this.baseDir, filename)

    const header = [
      '---',
      `model: ${meta.model}`,
      `service: ${meta.service}`,
      `created: ${meta.created}`,
      '---',
      '',
    ].join('\n')

    await writeFile(filePath, header, 'utf-8')
    return filePath
  }

  async read(path: string): Promise<string> {
    return readFile(path, 'utf-8')
  }

  async write(path: string, content: string): Promise<void> {
    await writeFile(path, content, 'utf-8')
  }

  async append(path: string, block: string): Promise<void> {
    await appendFile(path, block + '\n', 'utf-8')
  }

  async list(): Promise<{ id: string; path: string; title: string }[]> {
    if (!existsSync(this.baseDir)) return []
    const files = readdirSync(this.baseDir).filter((f) => f.endsWith('.md'))
    return files.map((f) => {
      const id = f.replace(/\.md$/, '')
      return { id, path: join(this.baseDir, f), title: id }
    }).sort((a, b) => b.id.localeCompare(a.id))
  }
}
