import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['lab/**/*.test.ts'],
    testTimeout: 1_800_000,
    fileParallelism: false,
  },
});
