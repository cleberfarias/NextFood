import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: {
    jsx: 'automatic'
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url))
    }
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // Some shells on this project have NODE_ENV=production set globally,
    // which makes react-dom load its production build (act() becomes a
    // no-op there), breaking @testing-library/react. Force it for tests
    // regardless of the ambient shell env.
    env: {
      NODE_ENV: 'test'
    }
  }
});
