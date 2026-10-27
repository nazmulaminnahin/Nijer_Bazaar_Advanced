import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    hookTimeout: 60_000,
    testTimeout: 60_000,
    fileParallelism: false, // each suite boots its own embedded database
  },
});
