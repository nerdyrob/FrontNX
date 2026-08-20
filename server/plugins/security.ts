// Warn (don't break) when the server is exposed on a non-loopback address
// without an API key configured (code-review #7). For a local-only tool this
// is acceptable, but it should not be silently deployed to a shared network.
export default defineNitroPlugin(() => {
  const config = useRuntimeConfig()
  const host = process.env.HOST || '0.0.0.0'
  // 0.0.0.0 listens on all interfaces, so treat it as exposed too.
  const exposed = host !== '127.0.0.1' && host !== 'localhost' && host !== '::1'
  if (exposed && !config.apiKey) {
    console.warn(
      '[security] FrontNX is bound to a non-loopback address (' +
        host +
        ') with no API key set. Set an apiKey (NUXT_API_KEY) to require authentication on the API.',
    )
  }
})
