import { SessionFsRepository } from '~/repositories/session-fs.repository'

const repo = new SessionFsRepository()

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const path = validateNonEmptyString(body?.path, 'path')
  await repo.delete(path)
  return { success: true }
})
