import { getSessionRepository } from '~/server/utils/session-repository'

const repo = getSessionRepository()

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const path = validateNonEmptyString(query.path, 'path')
  const content = await repo.read(path)
  return { content }
})
