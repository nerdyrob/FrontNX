import { getSessionRepository } from '~/server/utils/session-repository'

const repo = getSessionRepository()

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const path = validateNonEmptyString(body?.path, 'path')
  const content = validateString(body?.content, 'content')
  await repo.write(path, content)
  return { success: true }
})
