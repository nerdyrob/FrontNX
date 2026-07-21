import tailwindcss from '@tailwindcss/vite'

const isSharedMount = process.cwd().startsWith('/mnt/sharedfolder/')
const defaultNitroOutput = isSharedMount ? '/tmp/frontnx-output' : 'build'

export default defineNuxtConfig({
  modules: ['@nuxt/ui', '@nuxt/eslint'],
  css: ['~/assets/css/main.css', '~/assets/css/theme.css'],
  devServer: {
    host: process.env.HOST || '0.0.0.0',
    port: Number(process.env.PORT) || 3001,
  },
  vite: {
    plugins: [tailwindcss()],
  },
  runtimeConfig: {
    apiKey: process.env.API_KEY || '',
    public: {
      llmServerBaseURL: process.env.LLM_SERVER_BASE_URL || '',
      llmServerName: process.env.LLM_SERVER_NAME || '',
      chatRequestTimeoutMs: Number(process.env.CHAT_REQUEST_TIMEOUT_MS) || 900000,
    },
  },
  typescript: {
    strict: true,
  },
  devtools: { enabled: false },
  experimental: { appManifest: false },
  app: {
    head: {
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      ],
    },
  },
  colorMode: {
    preference: 'system',
    fallback: 'light',
  },
  nitro: {
    output: {
      dir: process.env.NITRO_OUTPUT_DIR || defaultNitroOutput,
    },
  },
  ui: {
    theme: {
      colors: {
        primary: 'green',
        neutral: 'slate',
      },
    },
  },
  compatibilityDate: '2026-07-13',
})
