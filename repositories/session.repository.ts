import type { SessionMeta } from '../types'

export interface SessionListItem {
  id: string
  path: string
  title: string
  preview: string
  timestamp: string
}

export interface ISessionRepository {
  create(meta: SessionMeta): Promise<string>
  read(path: string): Promise<string>
  write(path: string, content: string): Promise<void>
  append(path: string, block: string): Promise<void>
  list(): Promise<SessionListItem[]>
  delete(path: string): Promise<void>
}
