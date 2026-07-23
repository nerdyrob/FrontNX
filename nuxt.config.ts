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
    apiKey: '',
    public: {
      llmServerBaseURL: '',
      llmServerName: '',
      chatRequestTimeoutMs: 900000,
      llmSystemPrompt: '',
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
