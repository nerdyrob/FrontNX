import { getSessionRepository } from '~/server/utils/session-repository'

const repo = getSessionRepository()

export default defineEventHandler(async () => {
  return repo.list()
})
