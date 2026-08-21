import { getSessionRepository } from '~/server/utils/session-repository'
import { validateString } from '~/server/utils/validation'

const repo = getSessionRepository()

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const q = validateString(query.query, 'query')
  return repo.search(q)
})
