import { SessionFsRepository } from '~/repositories/session-fs.repository'

const repo = new SessionFsRepository()

export default defineEventHandler(async (event) => {
  const { path } = await readBody(event)
  await repo.delete(path)
  return { success: true }
})
