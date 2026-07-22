import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['components/**/*.vue', 'composables/**/*.ts', 'services/**/*.ts', 'utils/**/*.ts'],
      exclude: ['**/*.spec.ts', 'node_modules'],
      reporter: ['text', 'lcov', 'html'],
      thresholds: {
        lines: 50,
        statements: 50,
        functions: 40,
        branches: 30,
      },
    },
  },
})
