import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  // Keep CRA's port: the Lambda CORS allowlist includes http://localhost:3000.
  server: {
    port: 3000,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
    // The Lambda's tests (infra/lambda/index.test.mjs) run under `node --test`.
    include: ['src/**/*.test.{js,jsx}'],
    // Route all TF.js imports (app and tests alike) to the manual mock so the
    // suite runs without WebGL/WASM. The browser build uses the real package.
    alias: {
      '@tensorflow/tfjs': fileURLToPath(
        new URL('./src/__mocks__/@tensorflow/tfjs.js', import.meta.url)
      ),
    },
  },
});
