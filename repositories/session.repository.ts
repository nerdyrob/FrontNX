import type { SessionMeta } from '../types'

export interface ISessionRepository {
  create(meta: SessionMeta): Promise<string>
  read(path: string): Promise<string>
  write(path: string, content: string): Promise<void>
  append(path: string, block: string): Promise<void>
  list(): Promise<{ id: string; path: string; title: string }[]>
}
