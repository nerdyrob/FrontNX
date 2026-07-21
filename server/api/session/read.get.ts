import { SessionFsRepository } from '~/repositories/session-fs.repository'

const repo = new SessionFsRepository()

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const path = validateNonEmptyString(query.path, 'path')
  const content = await repo.read(path)
  return { content }
})
