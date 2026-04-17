import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // Avoid tinypool recursion issues seen in CI/local with threads.
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    fileParallelism: false,
    maxConcurrency: 1,
    setupFiles: ['src/test/setup.ts'],
  },
});
