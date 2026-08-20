import { SessionFsRepository } from '~/repositories/session-fs.repository'

let _repo: SessionFsRepository | null = null

// Single shared repository instance across API routes (code-review #10).
// Avoids re-running filesystem setup/migration on every request handler module.
export function getSessionRepository(): SessionFsRepository {
  if (!_repo) _repo = new SessionFsRepository()
  return _repo
}
