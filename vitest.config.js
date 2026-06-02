import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    environmentMatchGlobs: [
      ['assets/**', 'happy-dom'],
      ['**/*.dom.test.js', 'happy-dom'],
    ],
    include: ['**/*.test.js'],
    exclude: ['node_modules', 'worker/node_modules'],
  },
});
