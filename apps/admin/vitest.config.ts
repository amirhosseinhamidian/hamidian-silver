import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'server-only': fileURLToPath(new URL('./src/test/server-only.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // The admin suite creates many isolated jsdom environments. Running test files in one
    // worker prevents Vitest's task-update RPC from timing out under sustained jsdom load.
    fileParallelism: false,
    maxWorkers: 1,
    clearMocks: true,
    restoreMocks: true,
  },
});
