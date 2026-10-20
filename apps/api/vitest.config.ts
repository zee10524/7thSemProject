import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    globalSetup: ['test/globalSetup.ts'],
    pool: 'forks',
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
