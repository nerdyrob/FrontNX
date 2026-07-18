import tailwindcss from '@tailwindcss/vite'

const isSharedMount = process.cwd().startsWith('/mnt/sharedfolder/')
const defaultNitroOutput = isSharedMount ? '/tmp/frontnx-output' : 'build'

export default defineNuxtConfig({
  modules: ['@nuxt/ui'],
  css: ['~/assets/css/main.css', '~/assets/css/theme.css'],
  devServer: {
    host: process.env.HOST || '0.0.0.0',
    port: Number(process.env.PORT) || 3001,
  },
  vite: {
    plugins: [tailwindcss()],
  },
  runtimeConfig: {
    public: {
      llmServerBaseURL: process.env.LLM_SERVER_BASE_URL || '',
      llmServerName: process.env.LLM_SERVER_NAME || '',
      chatRequestTimeoutMs: Number(process.env.CHAT_REQUEST_TIMEOUT_MS) || 900000,
    },
  },
  devtools: { enabled: false },
  experimental: { appManifest: false },
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
