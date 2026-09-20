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
    // The admin suite creates many isolated jsdom environments. Capping concurrency
    // prevents worker RPC starvation on developer machines while retaining parallelism.
    maxWorkers: 4,
    clearMocks: true,
    restoreMocks: true,
  },
});
