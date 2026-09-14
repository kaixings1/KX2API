import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts', 'src/**/__tests__/**/*.test.tsx'],
    exclude: [
      'node_modules',
      'out',
      'dist',
      // 基于 node:test，请用 `npm test` / `npm run test:management` 运行
      'tests/**',
      // 独立脚本（自己调用 process.exit），请用 `npx tsx <file>` 运行
      'src/engine/__tests__/**',
      'src/main/__tests__/profiles.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/main/**/*.ts', 'src/engine/**/*.ts'],
      exclude: ['src/main/__tests__/**', 'src/**/*.d.ts'],
    },
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      // 这些用例原本用 bun test 运行，API 与 vitest 兼容
      'bun:test': resolve(__dirname, 'node_modules/vitest/dist/index.js'),
    },
  },
})
