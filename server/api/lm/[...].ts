import { Readable } from 'node:stream'
import { readRawBodyCapped } from '~/server/utils/read-body'

const ALLOWED_LM_PATHS = new Set([
  'v0/models',
  'v0/chat/completions',
])

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const base = config.public.llmServerBaseURL.replace(/\/+$/, '')
  const path = getRequestURL(event).pathname.replace(/^\/api\/lm\//, '')
  const target = path.startsWith('v0/')
    ? `${base}/api/${path}`
    : `${base}/${path}`

  const method = event.method

  // Restrict proxied paths to known-safe endpoints
  const normalizedPath = path.replace(/^api\//, '')
  if (!ALLOWED_LM_PATHS.has(normalizedPath)) {
    throw createError({ statusCode: 403, message: `Proxying ${path} is not allowed` })
  }

  let body: Record<string, unknown> | undefined
  let bodyRaw: Buffer | undefined
  if (method !== 'GET' && method !== 'HEAD') {
    // Limit proxied request body size while reading (configurable via
    // NUXT_PUBLIC_MAX_PROXY_BODY_BYTES, default 10 MB).
    const maxBody = Number(config.public.maxProxyBodyBytes) || 10 * 1024 * 1024
    const raw = await readRawBodyCapped(event, maxBody)
    if (raw) {
      bodyRaw = raw
      try {
        body = JSON.parse(raw.toString('utf-8')) as Record<string, unknown>
      } catch {
        // Not JSON; forward the raw bytes unchanged.
      }
    }
  }

  checkRateLimit(event)

  try {
    const res = await fetch(target, {
      method,
      headers: { 'Content-Type': 'application/json' },
      // Forward the original raw bytes instead of re-stringifying the parsed
      // body (one less full-size copy per proxied request).
      body: body && bodyRaw ? (bodyRaw as BodyInit) : undefined,
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

      const nodeStream = Readable.from(res.body as ReadableStream)
      return sendStream(event, nodeStream)
    }

    const data = await res.json()
    return data
  } catch (err: unknown) {
    const cause = err instanceof Error ? (err.cause as Record<string, unknown> | undefined) : undefined
    if (cause?.code === 'ECONNREFUSED') {
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
