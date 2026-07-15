import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  modules: ['@nuxt/ui'],
  css: ['~/assets/css/main.css', '~~/.nuxt/ui.css'],
  vite: {
    plugins: [tailwindcss()],
  },
  runtimeConfig: {
    public: {
      lmStudioBaseUrl: 'http://192.168.1.85:1234',
    },
  },
  devtools: { enabled: false },
  experimental: { appManifest: false },
  colorMode: {
    preference: 'system',
    fallback: 'light',
  },
  ui: {
    theme: {
      colors: {
        primary: 'blue',
        neutral: 'slate',
      },
    },
  },
  compatibilityDate: '2026-07-13',
})
