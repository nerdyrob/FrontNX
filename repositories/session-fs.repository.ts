import { existsSync, mkdirSync, readdirSync, renameSync } from 'node:fs'
import { readFile, writeFile, appendFile, unlink } from 'node:fs/promises'
import { homedir, platform } from 'node:os'
import { join, resolve } from 'node:path'
import type { ISessionRepository, SessionListItem } from './session.repository'
import type { SessionMeta } from '../types'
import { SessionService } from '../services/session.service'

// Guard against unbounded session files (code-review #8).
const MAX_SESSION_FILE_BYTES = 25 * 1024 * 1024

function toShortTimestamp(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

function defaultSessionsDir(): string {
  const appName = 'FrontNX'
  const os = platform()

  if (os === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local')
    return join(localAppData, appName, 'chat-sessions')
  }

  if (os === 'darwin') {
    return join(homedir(), 'Library', 'Caches', appName, 'chat-sessions')
  }

  return join(homedir(), '.cache', appName, 'chat-sessions')
}

export class SessionFsRepository implements ISessionRepository {
  private baseDir: string
  private sessionService: SessionService

  constructor(baseDir?: string) {
    this.baseDir = baseDir ?? defaultSessionsDir()
    this.sessionService = new SessionService()
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

  private resolveSafePath(userPath: string): string {
    const normalized = resolve(this.baseDir, userPath)
    if (!normalized.startsWith(this.baseDir)) {
      throw new Error(`Path traversal blocked: ${userPath}`)
    }
    if (!normalized.endsWith('.md')) {
      throw new Error(`Invalid file type: only .md files are allowed`)
    }
    return normalized
  }

  async create(meta: SessionMeta): Promise<string> {
    const filename = `${toShortTimestamp(meta.created)}.md`
    const filePath = join(this.baseDir, filename)
    if (existsSync(filePath)) return filename

    const header = [
      '---',
      `model: ${meta.model}`,
      `service: ${meta.service}`,
      `created: ${meta.created}`,
      '---',
      '',
    ].join('\n')

    await writeFile(filePath, header, 'utf-8')
    // Return the opaque filename (not the absolute path) so the client
    // never learns the server's directory layout (code-review #6).
    return filename
  }

  async read(path: string): Promise<string> {
    return readFile(this.resolveSafePath(path), 'utf-8')
  }

  async write(path: string, content: string): Promise<void> {
    this.assertSize(content)
    await writeFile(this.resolveSafePath(path), content, 'utf-8')
  }

  async append(path: string, block: string): Promise<void> {
    this.assertSize(block)
    await appendFile(this.resolveSafePath(path), block + '\n', 'utf-8')
  }

  private assertSize(content: string): void {
    const bytes = new TextEncoder().encode(content).length
    if (bytes > MAX_SESSION_FILE_BYTES) {
      throw new Error('Session file too large')
    }
  }

  async list(): Promise<SessionListItem[]> {
    if (!existsSync(this.baseDir)) return []
    const files = readdirSync(this.baseDir).filter((f) => f.endsWith('.md'))
    const entries = await Promise.all(
      files.map(async (f) => {
        const id = f.replace(/\.md$/, '')
        const filePath = join(this.baseDir, f)
        const { title, preview, timestamp, totalTokens, totalProcessingTimeMs } = await this.extractPreview(filePath)
        // `path` is the opaque filename, resolved server-side from baseDir.
        return { id, path: f, title, preview, timestamp, totalTokens, totalProcessingTimeMs }
      }),
    )
    return entries.sort((a, b) => b.id.localeCompare(a.id))
  }

  async search(query: string): Promise<SessionListItem[]> {
    const q = query.trim().toLowerCase()
    if (!q) return []
    if (!existsSync(this.baseDir)) return []

    const files = readdirSync(this.baseDir).filter((f) => f.endsWith('.md'))
    const entries = await Promise.all(
      files.map(async (f) => {
        const id = f.replace(/\.md$/, '')
        const filePath = join(this.baseDir, f)
        try {
          const { title, preview, timestamp, totalTokens, totalProcessingTimeMs, text } = await this.extractPreview(filePath)
          if (!text.includes(q)) return null
          // `path` is the opaque filename, resolved server-side from baseDir.
          return { id, path: f, title, preview, timestamp, totalTokens, totalProcessingTimeMs }
        } catch (err) {
          console.warn('Failed to parse session file during search:', filePath, err)
          return null
        }
      }),
    )
    return entries
      .filter((e): e is SessionListItem => e !== null)
      .sort((a, b) => b.id.localeCompare(a.id))
  }

  async rename(path: string, title: string): Promise<void> {
    const safeTitle = title.replace(/\r?\n/g, ' ').trim()
    const content = await this.read(path)
    const { meta, messages } = this.sessionService.parseMarkdown(content)
    meta.title = safeTitle
    const updated = this.sessionService.buildMarkdown(messages, meta)
    await this.write(path, updated)
  }

  private async extractPreview(filePath: string): Promise<{ title: string; preview: string; timestamp: string; totalTokens: number; totalProcessingTimeMs: number; text: string }> {
    try {
      const content = await readFile(filePath, 'utf-8')
      const { meta, messages } = this.sessionService.parseMarkdown(content)
      const firstUserMessage = messages.find((message) => message.role === 'user')
      const preview = firstUserMessage?.content.replace(/\s+/g, ' ').trim().slice(0, 120) || '(empty)'
      const totalTokens = messages.reduce((sum, message) => sum + (message.metrics?.tokensUsed ?? 0), 0)
      const totalProcessingTimeMs = messages.reduce((sum, message) => sum + (message.metrics?.processingTimeMs ?? 0), 0)

      const text = [meta.title ?? '', ...messages.map((m) => m.content)]
        .join(' ')
        .replace(/\s+/g, ' ')
        .toLowerCase()

      return {
        title: meta.title ?? '',
        preview,
        timestamp: meta.created,
        totalTokens,
        totalProcessingTimeMs,
        text,
      }
    } catch (err) {
      console.warn('Failed to parse session file:', filePath, err)
      return { title: '', preview: '', timestamp: '', totalTokens: 0, totalProcessingTimeMs: 0, text: '' }
    }
  }

  async delete(path: string): Promise<void> {
    await unlink(this.resolveSafePath(path))
  }
}
