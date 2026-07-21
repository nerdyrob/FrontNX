import { Readable } from 'node:stream'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const base = config.public.llmServerBaseURL.replace(/\/+$/, '')
  const path = getRequestURL(event).pathname.replace(/^\/api\/lm\//, '')
  const target = path.startsWith('v0/')
    ? `${base}/api/${path}`
    : `${base}/${path}`

  const method = event.method

  let body: any
  if (method !== 'GET' && method !== 'HEAD') {
    try {
      body = await readBody(event)
    } catch {
      body = undefined
    }
  }

  // Prevent large request bodies from being proxied
  if (body) {
    const size = new TextEncoder().encode(JSON.stringify(body)).length
    if (size > 200_000) {
      throw createError({ statusCode: 413, message: 'Request too large' })
    }
  }

  try {
    const res = await fetch(target, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: event.signal || undefined,
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw createError({
        statusCode: res.status,
        statusMessage: res.statusText,
        message: errText || res.statusText,
      })
    }

    // Streaming response for chat completions
    if (body?.stream && res.body) {
      setResponseHeader(event, 'Content-Type', 'text/event-stream')
      setResponseHeader(event, 'Cache-Control', 'no-cache')
      setResponseHeader(event, 'Connection', 'keep-alive')

      const nodeStream = Readable.from(res.body as any)
      return sendStream(event, nodeStream)
    }

    const data = await res.json()
    return data
  } catch (err: any) {
    if (err.cause?.code === 'ECONNREFUSED') {
      const name = config.public.llmServerName as string
      throw createError({
        statusCode: 503,
        statusMessage: `${name} not reachable`,
        message: `Cannot connect to ${base}. Make sure ${name} is running.`,
      })
    }
    throw err
  }
})
