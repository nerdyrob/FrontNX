import tailwindcss from '@tailwindcss/vite'

const isSharedMount = process.cwd().startsWith('/mnt/sharedfolder/')
const defaultNitroOutput = isSharedMount ? '/tmp/frontnx-output' : '.output'

export default defineNuxtConfig({
  modules: ['@nuxt/ui'],
  css: ['~/assets/css/main.css', '~/assets/css/theme.css'],
  devServer: {
    host: '0.0.0.0',
    port: 3001,
  },
  vite: {
    plugins: [tailwindcss()],
  },
  runtimeConfig: {
    public: {
      lmStudioBaseUrl: 'http://192.168.1.85:1234',
      chatRequestTimeoutMs: 900000,
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
