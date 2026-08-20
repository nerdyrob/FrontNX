import { getSessionRepository } from '~/server/utils/session-repository'

const repo = getSessionRepository()

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const path = validateNonEmptyString(body?.path, 'path')
  await repo.delete(path)
  return { success: true }
})
