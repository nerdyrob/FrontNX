import type { H3Event } from 'h3'

// Stream-read a request body with a hard byte cap. The cap is enforced while
// the body arrives, so an oversized upload is never fully buffered (see the
// LM proxy and code-review #8).
export async function readRawBodyCapped(event: H3Event, maxBytes: number): Promise<Buffer | null> {
  const req = event.node.req
  const chunks: Buffer[] = []
  let total = 0

  try {
    for await (const chunk of req) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      total += buf.length
      if (total > maxBytes) break
      chunks.push(buf)
    }
  } catch {
    // Upload aborted or reset mid-stream.
    return null
  }

  if (total === 0) return null
  if (total > maxBytes) {
    throw createError({
      statusCode: 413,
      message: `Request too large (max ${Math.round(maxBytes / 1024 / 1024)} MB)`,
    })
  }

  return Buffer.concat(chunks)
}
