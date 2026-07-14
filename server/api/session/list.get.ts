import { SessionFsRepository } from '~/repositories/session-fs.repository'

const repo = new SessionFsRepository()

export default defineEventHandler(async () => {
  return repo.list()
})
