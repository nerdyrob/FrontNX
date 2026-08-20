import type { H3Event } from 'h3'

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 60
const store = new Map<string, { count: number; resetAt: number }>()

let cleanupTimer: ReturnType<typeof setInterval> | null = null
if (typeof setInterval !== 'undefined') {
  cleanupTimer = setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store) {
      if (now > entry.resetAt) store.delete(key)
    }
  }, RATE_LIMIT_WINDOW_MS * 2)
}

// Release the timer handle on server shutdown so it doesn't keep the process
// alive (notably for the SEA single-executable binary). `useNitroApp` is a
// Nitro auto-import available in the server runtime; guard for safety.
if (typeof useNitroApp === 'function') {
  try {
    useNitroApp().hooks.hook('close', () => {
      if (cleanupTimer) clearInterval(cleanupTimer)
    })
  } catch {
    // Not running inside the Nitro runtime; leave the timer as-is.
  }
}

export function checkRateLimit(event: H3Event): void {
  // Note: keyed on getRequestIP with xForwardedFor enabled. Behind a trusted
  // proxy this can be spoofed via the X-Forwarded-For header; acceptable for a
  // local-only tool but not suitable as the sole control on an exposed host.
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
