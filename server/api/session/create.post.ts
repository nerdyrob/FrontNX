import { SessionFsRepository } from '~/repositories/session-fs.repository'

const repo = new SessionFsRepository()

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const meta = validateSessionMeta(body?.meta)
  const path = await repo.create(meta)
  return { path }
})
