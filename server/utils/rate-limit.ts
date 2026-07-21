const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 60
const store = new Map<string, { count: number; resetAt: number }>()

if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store) {
      if (now > entry.resetAt) store.delete(key)
    }
  }, RATE_LIMIT_WINDOW_MS * 2)
}

export function checkRateLimit(event: any): void {
  const key = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  const now = Date.now()
  let entry = store.get(key)
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS }
    store.set(key, entry)
  }
  entry.count++
  if (entry.count > RATE_LIMIT_MAX) {
    throw createError({ statusCode: 429, message: 'Too many requests. Try again later.' })
  }
}
