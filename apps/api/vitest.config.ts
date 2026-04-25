import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // Use process forks for API integration tests; per-suite app.close() now
    // handles teardown explicitly and keeps shutdown stable.
    pool: 'forks',
    fileParallelism: false,
    maxConcurrency: 1,
    setupFiles: ['src/test/setup.ts'],
  },
});
