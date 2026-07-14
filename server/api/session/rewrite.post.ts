import { SessionFsRepository } from '~/repositories/session-fs.repository'

const repo = new SessionFsRepository()

export default defineEventHandler(async (event) => {
  const { path, content } = await readBody(event)
  await repo.write(path, content)
  return { success: true }
})
