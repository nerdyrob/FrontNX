import { existsSync, mkdirSync, readdirSync, renameSync, readFileSync } from 'node:fs'
import { readFile, writeFile, appendFile, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import type { ISessionRepository, SessionListItem } from './session.repository'
import type { SessionMeta } from '../types'

function toShortTimestamp(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

export class SessionFsRepository implements ISessionRepository {
  private baseDir: string

  constructor(baseDir?: string) {
    this.baseDir = baseDir ?? join(process.cwd(), 'chat-sessions')
    if (!existsSync(this.baseDir)) {
      mkdirSync(this.baseDir, { recursive: true })
    }
    this.migrateOldFiles()
  }

  private migrateOldFiles(): void {
    if (!existsSync(this.baseDir)) return
    for (const f of readdirSync(this.baseDir)) {
      if (!f.endsWith('.md')) continue
      // Old format: YYYY-MM-DDTHH-MM-SS_modelname.md
      const oldMatch = f.match(/^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})_(.+)\.md$/)
      if (!oldMatch) continue
      const dateStr = oldMatch[1].replace(/-/g, '').replace('T', '-') // YYYYMMDD-HHMMSS
      const newName = `${dateStr}.md`
      if (newName === f) continue
      const oldPath = join(this.baseDir, f)
      const newPath = join(this.baseDir, newName)
      if (!existsSync(newPath)) {
        renameSync(oldPath, newPath)
      }
    }
  }

  async create(meta: SessionMeta): Promise<string> {
    const filename = `${toShortTimestamp(meta.created)}.md`
    const filePath = join(this.baseDir, filename)
    if (existsSync(filePath)) return filePath

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

  async list(): Promise<SessionListItem[]> {
    if (!existsSync(this.baseDir)) return []
    const files = readdirSync(this.baseDir).filter((f) => f.endsWith('.md'))
    return files.map((f) => {
      const id = f.replace(/\.md$/, '')
      const path = join(this.baseDir, f)
      const { preview, timestamp } = this.extractPreview(path)
      return { id, path, title: id, preview, timestamp }
    }).sort((a, b) => b.id.localeCompare(a.id))
  }

  private extractPreview(filePath: string): { preview: string; timestamp: string } {
    try {
      const content = readFileSync(filePath, 'utf-8')
      const lines = content.split('\n')
      let timestamp = ''
      let inFrontMatter = false
      let i = 0

      if (lines[0]?.trim() === '---') {
        inFrontMatter = true
        i = 1
        while (i < lines.length && lines[i]?.trim() !== '---') {
          if (lines[i].startsWith('created:')) {
            timestamp = lines[i].slice(8).trim()
          }
          i++
        }
        i++
      }

      for (; i < lines.length; i++) {
        const match = lines[i].match(/^## .+ — User(?: \(.+\))?$/)
        if (match) {
          i++
          const body: string[] = []
          while (i < lines.length && !lines[i].startsWith('## ')) {
            if (lines[i].trim()) body.push(lines[i].trim())
            i++
          }
          const preview = body.join(' ').slice(0, 120)
          return { preview: preview || '(empty)', timestamp }
        }
      }

      return { preview: '(empty)', timestamp }
    } catch {
      return { preview: '', timestamp: '' }
    }
  }

  async delete(path: string): Promise<void> {
    await unlink(path)
  }
}
