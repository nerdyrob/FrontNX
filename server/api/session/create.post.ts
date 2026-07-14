import { SessionFsRepository } from '~/repositories/session-fs.repository'

const repo = new SessionFsRepository()

export default defineEventHandler(async (event) => {
  const { meta } = await readBody(event)
  const path = await repo.create(meta)
  return { path }
})
