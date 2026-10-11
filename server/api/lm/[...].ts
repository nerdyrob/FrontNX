import { Readable } from 'node:stream'
import type { H3Event } from 'h3'

const ALLOWED_LM_PATHS = new Set([
  'v0/models',
  'v0/chat/completions',
])

// Stream-read the request body with a hard byte cap, rejecting oversized
// uploads *while* they arrive (code-review follow-up).  The previous
// readBody-then-check pattern buffered the entire payload and re-stringified
// it twice before the 413 could fire, so a large conversation (e.g. pasted
// base64 images) could transiently exhaust the dev worker's JS heap.
async function readBodyCapped(
  event: H3Event,
  maxBytes: number,
): Promise<{ raw: Buffer; parsed?: Record<string, unknown> } | null> {
  const req = event.node.req
  const chunks: Buffer[] = []
  let total = 0
  try {
    for await (const chunk of req) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      total += buf.length
      if (total > maxBytes) {
        // Stop consuming: do not buffer the rest of the upload.  Responding
        // without destroying the socket lets the 413 still reach the client.
        break
      }
      chunks.push(buf)
    }
  } catch {
    // Upload aborted or reset mid-stream; mirror the old readBody behavior
    // of proceeding without a body.
    return null
  }
  if (total === 0) return null
  if (total > maxBytes) {
    throw createError({
      statusCode: 413,
      message: `Request too large (max ${Math.round(maxBytes / 1024 / 1024)} MB)`,
    })
  }
  const raw = Buffer.concat(chunks)
  try {
    return { raw, parsed: JSON.parse(raw.toString('utf-8')) as Record<string, unknown> }
  } catch {
    return { raw }
  }
}

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
    const capped = await readBodyCapped(event, maxBody)
    body = capped?.parsed
    bodyRaw = capped?.raw
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
