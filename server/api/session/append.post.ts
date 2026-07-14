import { SessionFsRepository } from '~/repositories/session-fs.repository'

const repo = new SessionFsRepository()

export default defineEventHandler(async (event) => {
  const { path, block } = await readBody(event)
  await repo.append(path, block)
  return { success: true }
})
