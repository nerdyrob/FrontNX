export default defineEventHandler((event) => {
  const url = getRequestURL(event).pathname
  if (!url.startsWith('/api/')) return

  const config = useRuntimeConfig()
  const apiKey = config.apiKey as string | undefined
  if (!apiKey) return

  const authHeader = getRequestHeader(event, 'authorization')
  if (authHeader !== `Bearer ${apiKey}`) {
    throw createError({ statusCode: 401, message: 'Unauthorized: invalid or missing API key' })
  }
})
