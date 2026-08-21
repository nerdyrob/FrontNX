import { getSessionRepository } from '~/server/utils/session-repository'
import { validateNonEmptyString, validateString } from '~/server/utils/validation'

const repo = getSessionRepository()

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const path = validateNonEmptyString(body?.path, 'path')
  const title = validateString(body?.title, 'title').replace(/\r?\n/g, ' ').trim()
  await repo.rename(path, title)
  return { success: true, title }
})
